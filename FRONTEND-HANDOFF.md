# Frontend handoff — backend changes, 2026-08-23

Two branches, both open:

- `fix/safe-deletes-and-stock-audit-trail` — changes 1–3 below ([PR #6](https://github.com/neami-dev/ERP-backend/pull/6))
- `feature/api-contract-cleanup` — changes 4–5 below

Five changes went into the backend today, all from the Step 5 review. **Nothing else
moved** — the error shape, the list shape, pagination, company isolation and every other
endpoint are exactly as they were.

| # | Change | Frontend impact |
|---|---|---|
| 1 | `POST /inventories` and `PATCH /inventories/:id` removed | **Breaking** — use stock movements instead |
| 2 | Deletes answer `409` instead of `500` when the row is in use | **New branch to handle** on every delete |
| 3 | A product used by a purchase order can no longer be deleted | Covered by the 409 branch |
| 4 | Signup, login and `GET /auth/profile` return one identical user object | **Breaking** for profile — one session type now |
| 5 | Orders carry `totalAmount`, lines carry `lineTotal` | Stop summing on the client |

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
4. **One user per company** — signup always creates a new company, and there is no
   invite or user list yet. Blocks any team or settings screen.
5. **A deactivated user keeps working until their token expires** (up to 7 days).
   `isActive` is only read at login.
6. **Never PATCH back an object you fetched.** Validation rejects any property outside
   the DTO, including `id`, `companyId`, `createdAt`, loaded relations and now
   `totalAmount` / `lineTotal`. Send only the edited fields.

Two gaps from the first version of this document — no order total, and the three user
shapes — are closed by changes 4 and 5 above.

Full detail on all of these: [REVIEW-PLAN.md](REVIEW-PLAN.md), Step 5.
