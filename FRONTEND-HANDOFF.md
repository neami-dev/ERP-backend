# Frontend handoff — backend changes, 2026-08-24

Four branches:

- `fix/safe-deletes-and-stock-audit-trail` — changes 1–3 below ([PR #6](https://github.com/neami-dev/ERP-backend/pull/6), merged)
- `feature/api-contract-cleanup` — changes 4–6 below ([PR #7](https://github.com/neami-dev/ERP-backend/pull/7), merged)
- `feature/company-profile` — changes 7–8 below ([PR #8](https://github.com/neami-dev/ERP-backend/pull/8), merged)
- `feature/roles-and-permissions` — change 9 below ([PR #9](https://github.com/neami-dev/ERP-backend/pull/9))

**Nothing else moved** — the error shape, the list shape, pagination, company isolation
and every other endpoint are exactly as they were.

| # | Change | Frontend impact |
|---|---|---|
| 1 | `POST /inventories` and `PATCH /inventories/:id` removed | **Breaking** — use stock movements instead |
| 2 | Deletes answer `409` instead of `500` when the row is in use | **New branch to handle** on every delete |
| 3 | A product used by a purchase order can no longer be deleted | Covered by the 409 branch |
| 4 | Signup, login and `GET /auth/profile` return one identical user object | **Breaking** for profile — one session type now |
| 5 | Orders carry `totalAmount`, lines carry `lineTotal` | Stop summing on the client |
| 6 | `OUT` movements take a `fromReservation` flag | **New field** on the stock-out call |
| 7 | Company gains legal identifiers, currency, fiscal year | **New fields** on `GET /companies/me` and `PATCH` |
| 8 | Company logo: `PUT/GET/DELETE /companies/me/logo` | **New routes** — raw binary, needs a fetch-and-blob pattern |
| 9 | Roles & permissions (RBAC) — every route now needs a permission | **Breaking** — any call can now 403; new `/roles` and `/users` endpoints |

---

## 1. Inventory writes are gone — use stock movements

```
POST  /inventories       → 404  (removed)
PATCH /inventories/:id   → 404  (removed)
```

**Why:** both wrote a quantity straight into the stock table. No audit record, and no
row lock — so a manual edit could silently overwrite a purchase order being received at
the same moment. Verified before the fix: stock went from 5 to 9999 while the stock
movement count stayed at 1.

**What to use instead:** `POST /stock-movements` with type `ADJUSTMENT`. It locks the
row, validates the change, records it, and creates the stock row when none exists yet —
so nothing the removed endpoints did is lost.

```jsonc
// opening stock — no inventory row has to exist first
POST /stock-movements
{
  "productId":     "…",
  "warehouseId":   "…",
  "type":          "ADJUSTMENT",
  "quantity":      40,             // may be negative, to correct downwards
  "referenceType": "ADJUSTMENT",   // required
  "notes":         "opening count" // optional, shows in the history
}
```

`referenceId` is required for every `referenceType` **except** `ADJUSTMENT`, which is a
manual correction with no source document.

**Still available, unchanged:**

```
GET    /inventories        paginated, includes product + warehouse
GET    /inventories/:id
DELETE /inventories/:id    now refuses a record that still holds stock — see below
```

**Verified end to end:**

| Request | Result |
|---|---|
| `POST /stock-movements` ADJUSTMENT `+40`, no row yet | row created, `quantityOnHand: 40` |
| `DELETE /inventories/:id` while it holds 40 | `409` "Adjust it down to zero before deleting it." |
| `POST /stock-movements` ADJUSTMENT `-40` | `quantityOnHand: 0` |
| `POST /stock-movements` ADJUSTMENT `-5` from zero | `409` "Adjustment would make stock negative" |
| `DELETE /inventories/:id` now empty | `200`, row returned with its `id` |
| `GET /stock-movements` | both adjustments listed |

---

## 2. Deletes now answer 409, not 500

Deleting a row something still references used to produce
`500 {"message": "Internal server error"}` — the database refused, and nothing turned
that refusal into an answer the UI could use. It is now a `409` whose `message` is
written for a person. **Show it directly.**

```
DELETE /products/:id     409  "This product cannot be deleted: it appears on a
                               purchase order or has stock history."
DELETE /warehouses/:id   409  "This warehouse cannot be deleted: it holds stock or
                               has stock history."
DELETE /suppliers/:id    409  "This supplier cannot be deleted: it has purchase
                               orders. Mark it inactive instead."
DELETE /inventories/:id  409  "This stock record still holds stock. Adjust it down
                               to zero before deleting it."
```

The error body is the standard shape, so nothing new to parse:

```jsonc
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "This supplier cannot be deleted: it has purchase orders. Mark it inactive instead.",
  "path": "/suppliers/5441c51b-…",
  "timestamp": "2026-08-23T14:26:50.812Z"
}
```

**What to build:** every delete button needs a 409 branch, not just success/failure.
Suppliers and customers have an `isActive` flag — when a delete comes back 409, offering
"deactivate instead" is the right recovery. Products and warehouses have no such flag
yet; there, the 409 message is the whole answer.

Unchanged: a successful delete still returns the deleted row **with its `id`**, status
`200`, so you can drop it from a list without refetching.

This applies to all eight resources that support delete — categories, customers,
products, suppliers, warehouses, purchase orders, purchase order lines and inventories —
though only the four listed above have references that can realistically block them
today.

---

## 3. A product on a purchase order can no longer be deleted

Previously the delete succeeded and **silently emptied the order lines** that pointed at
it — the order stayed `DRAFT` and just got cheaper, with no error anywhere. Verified
before the fix:

```
draft order before     items: [{ quantity: 7, unitCost: 3 }]
DELETE /products/:id   200
draft order after      items: []            ← lines gone, no warning
```

Now:

```
draft order before     items: [{ quantity: 7, unitCost: 3 }]
DELETE /products/:id   409
draft order after      items: [{ quantity: 7, unitCost: 3 }]   ← intact
```

**What to build:** nothing beyond the 409 branch from change 2 — but don't design a UI
that promises a product can be removed once it has been ordered. A "discontinue" concept
would need a backend change (products have no `isActive` today); worth raising if the
catalogue screen needs it.

---

## 4. One user shape from signup, login and profile

Before, the three endpoints that return a user returned three different objects: signup
included `companyName`, login left it out, and `GET /auth/profile` handed back the raw
JWT payload (`sub` instead of `id`, plus `iat` and `exp`). All three now return exactly
this, and `companyName` is always present:

```ts
interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string | null
  companyId: string
  companyName: string      // no longer optional
}
```

- `POST /auth/signup` → `{ access_token, user: AuthUser }`
- `POST /auth/login` → `{ access_token, user: AuthUser }`
- `GET /auth/profile` → `AuthUser` — **the shape changed**, it is no longer the token
  payload. It is also read from the database now, so it reflects changes made after the
  token was issued.

**What to build:** one `AuthUser` type for the whole session. You no longer need
`GET /companies/me` just to show the company name — though it still exists, and still
returns the full company record (email, phone, address).

Verified — the three responses are byte-for-byte the same object:

```jsonc
{ "id": "a8159901-…", "email": "sara@…", "firstName": "Sara", "lastName": "N",
  "companyId": "30089bee-…", "companyName": "Shape Co" }
```

---

## 5. Orders and lines carry their totals

```jsonc
// GET /purchases/:id  (and the list, and confirm/cancel/receive)
{
  "orderNumber": "PO-2026-000001",
  "status": "DRAFT",
  "totalAmount": 60.67,            // ← new: the sum of the lines
  "items": [
    { "quantity": 3, "unitCost": 19.99, "lineTotal": 59.97 },   // ← new
    { "quantity": 7, "unitCost": 0.10,  "lineTotal": 0.70  }
  ]
}
```

Both are computed on the backend, rounded to two decimals, and returned by every
endpoint that returns an order or a line — including the list, so an orders table shows
totals without loading anything extra. A freshly created order comes back with
`items: []` and `totalAmount: 0`.

Neither can be sent by the client: `POST /purchases` with a `totalAmount` in the body is
a `400 "property totalAmount should not exist"`.

**What to build:** delete any client-side `reduce` over `items`. Note the rounding is
done for you — `7 × 0.10` returns `0.7`, not `0.7000000000000001`.

---

## 6. Stock can now leave in two different ways

A customer either walks in and takes stock, or collects something they reserved
earlier. Those do different things to the counts, and the backend cannot tell them
apart — so `POST /stock-movements` takes a flag:

```jsonc
// walk-in: takes from available stock, the reservation is untouched
{ "type": "OUT", "quantity": 10, ... }                            // fromReservation defaults to false

// collecting a reservation: lowers on-hand AND the reservation
{ "type": "OUT", "quantity": 20, "fromReservation": true, ... }
```

What each does, starting from `onHand 100, reserved 20, available 80`:

| Call | onHand | reserved | available |
|---|---|---|---|
| `OUT 10` (walk-in) | 90 | 20 | 70 |
| `OUT 20` with `fromReservation: true` | 80 | 0 | 80 |
| `RESERVE 20` | 100 | 40 | 60 |
| `RELEASE 20` | 100 | 0 | 100 |

Validation differs between the two, and so do the errors:

```
walk-in  OUT 80 with only 70 free   → 409 "Insufficient available stock (available: 70, requested: 80)"
reserved OUT 10 with nothing held   → 409 "Insufficient reserved stock (reserved: 0, requested: 10)"
fromReservation on a RESERVE        → 400 "fromReservation only applies to an OUT movement, not RESERVE"
```

**What to build:** wherever the UI takes stock out, it has to know which of the two it
is. If the screen came from a reservation, send `fromReservation: true`; a plain
counter sale sends nothing. Getting it wrong does not fail loudly — booking a reserved
collection as a walk-in leaves the reservation standing over stock that has left, and
`available` stays short until someone releases it by hand.

`GET /stock-movements` now returns `fromReservation` on every row, so a history screen
can label the two kinds of OUT apart.

**Note:** a reservation is still only a number on the stock row — there is no
reservation record to point at, so nothing ties a collection back to the reservation it
fulfils. If you need "show me this customer's reservations", that needs a backend model
first.

---

## 7. Company gains legal identifiers, currency, and a fiscal year

`GET /companies/me` and `PATCH /companies/:id` gain eight new fields, all optional,
all nullable except the two settings:

```ts
interface Company {
  // ...existing: id, name, email, phone, address, isActive...

  ice: string | null              // Identifiant Commun de l'Entreprise — exactly 15 digits
  taxId: string | null            // Identifiant Fiscal (IF)
  rcNumber: string | null         // Registre de Commerce number
  rcCity: string | null           // the commercial court that issued it — pair with rcNumber
  cnss: string | null             // CNSS employer affiliation number
  patente: string | null          // taxe professionnelle

  defaultCurrency: string         // ISO 4217, default "MAD" — see note below
  fiscalYearStartMonth: number    // 1-12, default 1 (January)

  logo: { contentType: string; byteSize: number; updatedAt: string } | null
}
```

**Validation, so you know what error to expect:**

```
PATCH { ice: "1234567890123" }             → 400 "ICE must be exactly 15 digits."
PATCH { defaultCurrency: "TND" }           → 400 "defaultCurrency must be one of: MAD, EUR, USD, GBP, CHF, CAD, AED, SAR"
PATCH { fiscalYearStartMonth: 13 }         → 400 (details array)
```

`ice`, `taxId`, `rcNumber`, `cnss` and `patente` accept spaced input and clean it up —
`"001 234 567 000 025"` is accepted and stored as `"001234567000025"`. Only `ice` is
validated to an exact format (15 digits); the others just have to be digits within a
generous length, since their real-world formats vary and nothing downstream enforces
them yet.

**Clearing a field:** send `null` (or `""`, which is treated the same). Omitting the key
entirely leaves the field unchanged — verified: `PATCH { phone: "+212…" }` alone does not
touch `ice`, `defaultCurrency`, or anything else already set.

**`defaultCurrency` is a display label, not a conversion.** There is no per-document
currency and no exchange rate anywhere in the API — every amount in every response is
assumed to already be in this currency. Changing it **relabels every historical document
without converting a single number**. If you build a currency picker, it should carry a
warning, not read as a neutral setting.

**`fiscalYearStartMonth` is for reporting periods only.** Document numbers
(`PO-2026-000001`) keep using the calendar year regardless of this value — don't wire
the two together on the frontend either.

**Nothing is enforced.** A company can confirm purchase orders with no ICE, no IF, and
no logo. If invoicing is built later and needs these to be present, that check will need
to be added then — today the fields are stored, not required.

---

## 8. Company logo — a new sub-resource, not a field

```
PUT    /companies/me/logo   { contentType, data }   → 200, metadata only
GET    /companies/me/logo                           → 200 raw binary | 304 | 404
DELETE /companies/me/logo                           → 204
```

**Not part of `PATCH /companies/:id`.** Sending `logo` in that body is a
`400 "property logo should not exist"` — the DTO whitelist rejects it on purpose. Upload
and delete are separate calls.

**Upload is base64 in JSON**, capped at 512 KB decoded (`PNG`, `JPEG` or `WebP` only):

```jsonc
PUT /companies/me/logo
{ "contentType": "image/png", "data": "iVBORw0KGgo..." }   // no "data:" prefix
```

```
too big              → 400 "Logo must be at most 512 KB." (details array)
not a real image      → 422 "The uploaded file is not a recognised PNG, JPEG or WebP image."
```

That second one matters: the backend checks the file's actual bytes, not the
`contentType` you send. If you claim `image/png` but the bytes are really a JPEG, it's
accepted anyway and stored under its true type (`GET /companies/me` will show
`"contentType": "image/jpeg"`, not what you sent). Only bytes that aren't recognizable as
any of the three types are rejected.

Response to `PUT` is metadata, **never the bytes**:

```jsonc
{ "contentType": "image/png", "byteSize": 48231, "updatedAt": "2026-08-24T…" }
```

**`GET /companies/me` includes the same metadata** as a `logo` field (or `null`), so you
know whether to fetch the image at all before making a second request.

**Downloading the logo — `<img src="...">` will not work.** The route needs
`Authorization: Bearer <token>`, and a browser never attaches that header to an `<img>`
request — it will 401. Fetch it manually instead:

```js
const res = await fetch('/companies/me/logo', { headers: { Authorization: `Bearer ${token}` } });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
// <img src={url} />, and URL.revokeObjectURL(url) when you're done with it
```

The response carries `ETag` and honors `If-None-Match` with a `304` — worth wiring up if
the logo is fetched more than once per session, since it rarely changes.

**Verified end to end**, including the size boundary:

| Request | Result |
|---|---|
| `PUT` a real PNG | `200`, metadata with the sniffed `contentType` |
| `GET` right after | `200`, exact same bytes back, correct `Content-Type` |
| `GET` again with `If-None-Match` | `304` |
| `PUT` SVG bytes labelled `image/png` | `422` — refused |
| `PUT` ~600 KB payload | `400`, the human-readable size message |
| `DELETE`, then `GET` | `204`, then `404` |

A second, higher limit (2 MB) exists behind the 512 KB one as a pure backstop — you
should never reach it through normal use, but if you ever see a `413` from this API
instead of a `400`, that's what it is, and it comes back in the same error shape as
everything else.

---

## 9. Roles & permissions (RBAC) — new

Every route now needs a permission. Before this, being logged in was enough to call
anything; now the caller's **role** decides what they can do. This closes gap 4 from
earlier versions of this document ("one user per company, no invite or user list") — you
can build a team/settings screen now.

**The mental model:**

- Every company gets an **Owner** role for free at signup. Owner can do everything,
  including managing users and roles. There is always exactly one Owner role per
  company, and it cannot be renamed, edited or deleted.
- The Owner creates **custom roles** with an exact set of permissions — e.g. an
  "Employee" role that can see products but not delete them, or create purchase orders
  but not confirm them.
- Users are created directly (no email invite yet) with a role assigned at creation, and
  can be moved to a different role later.

**`AuthUser` gains a field** (see change 4 for the rest of the shape):

```ts
interface AuthUser {
  // ...id, email, firstName, lastName, companyId, companyName — unchanged
  roleId: string   // new
}
```

**New endpoints:**

```
GET    /roles                 list roles in your company
GET    /roles/permissions     the full permission catalog — use this to render
                               checkboxes when building a role
POST   /roles                 { name, permissions: string[] }
GET    /roles/:id
PATCH  /roles/:id             400/403 on the Owner role
DELETE /roles/:id             403 on the Owner role; 409 if still assigned to a user

GET    /users                 list users in your company, each with their role
GET    /users/:id
POST   /users                 { email, password, firstName, lastName?, roleId }
PATCH  /users/:id             { firstName?, lastName?, isActive?, roleId? }
                               — no DELETE: turn a user off with isActive instead
```

**The permission catalog** — 36 strings, one per resource action. Ask
`GET /roles/permissions` for the live list rather than hardcoding it, but for reference:

| Resource | Permissions |
|---|---|
| products, categories, suppliers, warehouses, customers | `create`, `read`, `update`, `delete` (e.g. `products:read`) |
| inventories | `read`, `delete` |
| stock-movements | `create`, `read` |
| purchases | `create`, `read`, `update`, `delete`, plus `confirm`, `cancel`, `receive` as their own permissions — an Employee role can be allowed to create a draft order without being allowed to confirm or receive one |
| companies | `read`, `update` (covers the profile and the logo routes) |
| users | `read`, `manage` |
| roles | `manage` |

**A blocked call answers `403`, same error shape as everything else:**

```jsonc
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You do not have permission to do this",
  "path": "/products",
  "timestamp": "2026-08-24T16:15:37.397Z"
}
```

**What to build:** a 403 branch, distinct from a 401. A 401 means "log in again"; a 403
means "you're logged in, but your role can't do this" — the right UI response is usually
to hide or disable the button rather than show it and fail on click. You now have
everything needed to do that: read `roleId` off the session, fetch that role's
permissions from `GET /roles/:id`, and gate the UI on the same permission strings the
backend checks.

**Two things worth knowing before you build the role editor:**

- A company can never end up with zero active Owners — the backend blocks demoting or
  deactivating the last one with a `409`. Don't let the UI offer that action on the only
  Owner without expecting it to fail.
- Same as gap 4 below: a permission change takes effect on the user's *next* request —
  there is no push — but `isActive` is still only checked at **login**, not per request,
  so a deactivated user keeps working until their token expires (up to 7 days).

**Verified end to end:**

| Request | Result |
|---|---|
| `POST /auth/signup` | Owner role auto-created, `roleId` in both the token and the response |
| `POST /roles` `{name: "Employee", permissions: ["products:read"]}` | `201`, role created |
| `POST /users` with that `roleId` | `201`, user created |
| Employee logs in, `GET /products` | `200` |
| Employee `POST /products` | `403` "You do not have permission to do this" |
| Employee `GET /roles` | `403` (lacks `roles:manage`) |
| Employee `GET /auth/profile` | `200` — no permission required beyond being logged in |
| Owner `PATCH` / `DELETE` on the Owner role | both `403` |
| Owner deactivates the only Owner user | `409` "This company must always have at least one active Owner." |
| `DELETE` a role still assigned to a user | `409` "This role cannot be deleted: it is still assigned to users. Move them to another role first." |

---

## Not changed today — still true

- Auth: `POST /auth/signup`, `POST /auth/login`, 7-day token, `Authorization: Bearer …`
  on everything else.
- Error shape: `{statusCode, error, message, details?, path, timestamp}` — `message` is
  always a single string; `details` carries per-field validation messages.
- List shape: `{data, meta: {page, limit, total, totalPages}}`, `?page=&limit=`,
  limit max 100.
- Company isolation: `companyId` comes from the token, never from a body. Sending it is
  a 400.
- Money is a number; quantities are integers.
- Purchase order flow: `DRAFT → CONFIRMED → RECEIVED`, cancel from DRAFT or CONFIRMED.
  Only a DRAFT can be edited.

## Known gaps you will hit while building

These were found in the review and are **not** fixed — they are on the list, but build
around them for now.

1. **Receiving is all-or-nothing** — `PATCH /purchases/:id/receive` takes only
   `{ warehouseId }` and books every line in full. No partial delivery. Adding it changes
   the entity and the status flow, so raise it before the receive screen is built.
2. **No search, sort or filters on any list** except `GET /stock-movements`
   (`productId`, `warehouseId`, `type`).
3. **`orderDate` / `expectedDate` are calendar dates** (`"2026-08-23"`), not timestamps.
   `new Date("2026-08-23")` parses as UTC midnight and renders as the previous day west
   of UTC.
4. **A deactivated user keeps working until their token expires** (up to 7 days).
   `isActive` is only read at login.
5. **Never PATCH back an object you fetched.** Validation rejects any property outside
   the DTO, including `id`, `companyId`, `createdAt`, loaded relations and now
   `totalAmount` / `lineTotal`. Send only the edited fields.
6. **User creation is direct, not an email invite.** `POST /users` takes a plain
   password chosen by the Owner — there is no invite email, no "set your own password"
   link. Fine for now, but don't design the team screen as if an email goes out.

Three gaps from earlier versions of this document — no order total, the three user
shapes, and one user per company with no user list — are closed by changes 4, 5 and 9
above.

Full detail on all of these: [REVIEW-PLAN.md](REVIEW-PLAN.md), Step 5.
