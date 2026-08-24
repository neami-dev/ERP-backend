# Code Review Plan — ERP Backend

**Goal:** check the backend is ready, so we can start the frontend.
**Date started:** 2026-08-20
**Branch:** `feature/erp-purchasing-foundation`

> This is a working file. We update it after each step.
> Delete it (or add to `.gitignore`) when the review is done.

---

## Status

| Step | What | Status |
|---|---|---|
| 0 | Environment check | ✅ Done |
| 1 | Base: auth + config + main.ts | ✅ Done |
| 2 | Master data modules (CRUD) | ✅ Done |
| 3 | Business logic (purchases, stock) | ✅ Reviewed — gaps in the report |
| 4 | API contract for frontend | ✅ Done |
| 5 | Final report | ✅ Done — see the bottom |

Legend: ⬜ not started · 🔄 in progress · ✅ done

**Decisions taken (2026-08-20):**
- Signup creates **company + first user** together, in one transaction
- Login with **email** (not username)
- **No roles** for now (add later)
- Frontend = Next.js on `http://localhost:3001`
- Keep `synchronize: true` for now (no migrations yet)

---

## Step 0 — Environment ✅

- ✅ Postgres running (`docker compose -f docker-compose.dev.yml up -d`)
- ✅ App running on `http://localhost:3000`
- ✅ Swagger open on `http://localhost:3000/api`
- ✅ Swagger JSON on `http://localhost:3000/api-json` (44 endpoints)

**Modules in `app.module.ts`:** Auth, Users, Products, Categories, Warehouses,
Inventories, Suppliers, PurchaseOrders, Companies, StockMovements

---

## Step 1 — Base (auth + config) ✅ DONE

### Problems found — all FIXED

**P1 — No CORS** ✅ fixed
[main.ts](src/main.ts) had no `app.enableCors()`. The browser would block every
request from Next.js. Added, origin = `FRONTEND_URL` env or `http://localhost:3001`.

**P2 — `customers` module was dead code** ✅ fixed
The folder existed but `CustomersModule` was missing from the `imports` of
[app.module.ts](src/app.module.ts). Zero `/customers` endpoints existed.
Added to imports → 5 endpoints now live.

**P3 — Auth was still the NestJS tutorial demo** ✅ fixed
This was the big one. The old code had:
- users hardcoded in an array (`john/changeme`, `maria/guess`) — no DB table at all
- password compared in **plain text**
- no `companyId` in the JWT → backend could not know the user's company
- only `/auth/profile` was protected → **the other 42 endpoints were open to everybody**

### What was built

| File | Change |
|---|---|
| [users/entities/user.entity.ts](src/users/entities/user.entity.ts) | **new** — real `users` table, `password` is `select: false` so it can never leak |
| [users/users.service.ts](src/users/users.service.ts) | rewritten — TypeORM repository instead of the fake array |
| [users/users.module.ts](src/users/users.module.ts) | registers the `User` entity |
| [companies/entities/company.entity.ts](src/companies/entities/company.entity.ts) | added `users` relation |
| [auth/dto/sign-up.dto.ts](src/auth/dto/sign-up.dto.ts) | **new** — validated signup body |
| [auth/dto/sign-in.dto.ts](src/auth/dto/sign-in.dto.ts) | **new** — replaces `Record<string, any>` |
| [auth/auth.service.ts](src/auth/auth.service.ts) | bcrypt hash + compare, `signUp` in a transaction, `companyId` in the JWT |
| [auth/decorators/public.decorator.ts](src/auth/decorators/public.decorator.ts) | **new** — `@Public()` opt-out |
| [auth/auth.guard.ts](src/auth/auth.guard.ts) | reads `@Public()` via `Reflector`, typed payload |
| [auth/auth.module.ts](src/auth/auth.module.ts) | guard registered as `APP_GUARD` → **every route protected by default** |
| [auth/auth.controller.ts](src/auth/auth.controller.ts) | `POST /auth/signup` added, DTOs, Swagger tags |
| [app.controller.ts](src/app.controller.ts) | health check marked `@Public()` |
| `package.json` | added `bcrypt` + `@types/bcrypt` |

Security model is now **closed by default**: a route needs a token unless it
has `@Public()`. Forgetting the decorator gives a 401 (visible), not a hole (silent).

### Tests run — all pass

| Test | Expected | Got |
|---|---|---|
| `GET /` no token | 200 (public) | ✅ 200 |
| `GET /products` no token | 401 | ✅ 401 |
| `GET /products` with token | 200 | ✅ 200 |
| `POST /auth/signup` | token + user | ✅ |
| `POST /auth/login` | token | ✅ |
| login, wrong password | 401 | ✅ 401 |
| signup, email already used | 409 | ✅ 409 |
| signup, password too short | 400 | ✅ 400 |
| JWT payload | has `companyId` | ✅ |
| DB: password column | bcrypt hash, 60 chars | ✅ `$2b$10$…` |
| DB: new company | 3 document sequences created | ✅ |

Checklist:
- [x] CORS enabled for the frontend URL
- [x] Password is hashed (bcrypt), never returned to the client
- [x] JWT secret comes from `.env`, not hard-coded
- [x] Token has `companyId` inside (multi-company app!)
- [x] Protected routes really return 401 without a token
- [x] `synchronize` off in production (`NODE_ENV !== 'production'`)

### 🟡 Still open after Step 1

**S1 — `JWT_SECRET` is the placeholder from the NestJS docs.**
`.env` literally says *"DO NOT USE THIS VALUE"*. Fine for dev, must change before deploy.
Fix: `openssl rand -base64 48`.

**S2 — Token lives 15 minutes, no refresh token.**
The Next.js user gets logged out every 15 min. Either raise `JWT_EXPIRES_IN`
(e.g. `7d`) for now, or add a refresh-token flow later. **Decide before the frontend
login page is built.**

**S3 — No company isolation yet.** ⚠️ most important
The JWT now carries `companyId`, but **no service uses it**. Today a user of
company A can read and edit the products of company B. We need a way to filter
every query by the company in the token. → checked module by module in Step 2.

**S4 — Document number prefix looks wrong.**
[document-number.service.ts:92](src/common/ document-number/document-number.service.ts#L92)
uses `prefix: type.charAt(0)` → `P`, `S`, `I`. But the TSDoc above promises
`PO-2026-000001`. Real result is `P-2026-000001`.
Also `createDefaultSequences` only creates 3 of the 5 `DocumentType` values —
`QUOTATION` and `RECEIPT` get no sequence, so generating one later throws 404.

**S5 — There are no tests. `npm test` is red.** (checked)
`npm test` → **5 suites, 5 failed, 0 passed.**

To be clear: **you never wrote unit tests** — the 5 `.spec.ts` files are the empty
files that `nest g` creates automatically. They only contain `it('should be defined')`.
Nobody ever filled them in.

Two separate causes for the red:

1. *Jest could not resolve `src/...` imports* — the whole codebase imports that way,
   but the jest config had `rootDir: src` and no path mapping.
   ✅ **Fixed**: added `modulePaths: ["<rootDir>/.."]` to the jest config in `package.json`.
   (This was broken for a long time, not by our work today.)
2. *The scaffold specs provide no mocks* — the services now inject repositories,
   so Nest throws `can't resolve dependencies … CategoryRepository`.
   ❌ **Not fixed** — needs your decision, see question 1 below.

So today there is **no test coverage at all**. Every check we did was by hand with curl.
That is OK for now, but it means nothing protects the purchase/stock logic in Step 3.

**S6 — Leftover debug code.**
`console.log({company})` in [companies.service.ts:40](src/companies/companies.service.ts#L40).

---

## Step 2 — Company isolation + master data 🔄 IN PROGRESS

**Decisions:** drop & recreate the DB (test data only) · one module at a time, reviewed.
DB was dropped and rebuilt clean by `synchronize` on 2026-08-20.

### The core problem

Three separate holes made the app not really multi-company:

1. **3 entities have no company at all** — `categories`, `warehouses`, `customers`.
   They are global, shared by every company. Warehouses is the worst: a warehouse
   holds stock, so per-company inventory on top of shared warehouses makes no sense.
2. **`companyId` came from the request body** — `create-supplier.dto`,
   `create-purchase-order.dto`, `create-stock-movement.dto`. Any logged-in user
   could write into any company just by sending a different id.
3. **Reads were never filtered** — `findAll`/`findOne` returned every company's rows.

### The pattern (agreed, from the suppliers template)

- Controller reads the company from the token: `@CurrentUser('companyId') companyId: string`
- Service takes `companyId` in **every** method; it scopes reads and stamps writes
- `companyId` is **removed from every DTO** (`forbidNonWhitelisted` then returns 400 if sent)
- Entity: `@ManyToOne(..., { nullable: false })` so the DB refuses orphan rows
- Unique constraints become **per company**: `@Unique(['company', 'email'])`
- Cross-company access returns **404, not 403** — 403 would confirm the id exists

New shared file: [auth/decorators/current-user.decorator.ts](src/auth/decorators/current-user.decorator.ts)

Swagger: `.addSecurityRequirements('access_token')` in
[swagger.config.ts](src/config/swagger.config.ts) applies the lock to **all** routes at
once, mirroring the global guard, instead of `@ApiBearerAuth()` per controller.
Also set `persistAuthorization: true` so the token survives a page reload.

### Module progress

| Module | Has company? | Refactored | Notes |
|---|---|---|---|
| suppliers | ✅ | ✅ **done — template** | + 3 bug fixes |
| warehouses | ➕ added | ✅ done | + B1, B3 |
| customers | ➕ added | ✅ done | + B1, duplicate constraints removed |
| categories | ➕ added | ✅ done | + 5 bug fixes, see below |
| products | ✅ | ✅ done | **was 100% broken**, + 6 fixes |
| inventories | ✅ | ✅ done | **was broken too**, + race condition fixed |
| purchases | ✅ | ✅ done | 8 fixes; race condition **proven** then fixed |
| stock-movements | ✅ | ⬜ | `companyId` in DTO, new module |
| companies | n/a | ✅ done | **worst leak of all**, see below |
| stock-movements | ✅ | ✅ done | + 2 design bugs, see below |

### Suppliers — bugs found and fixed

- **B1** — `update` checked `existsBy({ email })` without excluding the supplier
  itself, so saving a supplier with its own email returned a false 409.
  Fixed with `Not(ignoreId)`. (`companies.service.ts` already did this right.)
- **B2** — name/email were unique **globally**, so if company A had "ACME",
  company B could never add "ACME". Now unique per company.
- **B3** — dead code: `if (!supplier)` after `findOne`, which already throws 404.
- Also: merged the duplicated create/update conflict checks into one private
  method, and added `order: { createdAt: 'DESC' }` — without an ORDER BY,
  Postgres may return the same row on two different pages.

### Categories — bugs found and fixed

- **C1 — `parentId` was never saved on update.** `update` fetched the parent to
  validate it, then **threw the result away** and did `Object.assign(category, dto)`.
  The entity had no `parentId` property (only the `parent` relation), so TypeORM
  ignored it. Moving a category to a new parent silently did nothing.
  Fixed by adding a real `parentId` column and assigning it explicitly.
- **C2 — no cycle protection.** You could set a category as its own parent, or move
  a parent under its own grandchild. Either makes a loop that hangs any code walking
  the tree. Now `assertParentIsValid` walks up the chain and rejects with 400.
- **C3 — the uniqueness check did not match the entity.** The entity said
  `@Unique(['parent','name'])` (unique among siblings) but the code checked
  `existsBy({ name })` (unique everywhere). So a legitimate "Phones" under two
  different parents was wrongly refused. Now both agree: unique among siblings.
- **C4 — root categories escaped the constraint.** Postgres treats NULLs as distinct,
  so `UNIQUE(company, parent_id, name)` does *not* stop two root categories with the
  same name. The service now checks that case explicitly with `IsNull()`.
- **C5 — deleting a parent broke the FK.** Children still pointed at it, so the delete
  gave a 500 from the database. Now it returns a clear 409 telling you to delete the
  sub-categories first.
- Plus B1 (self-conflict on update) and B3 (dead code), same as suppliers.

### Products — bugs found and fixed

**F0 — `POST /products` was completely broken.** Confirmed with curl: **500 every time**.
The entity required a company (`nullable: false`) but nothing ever set one, so every
insert hit a NOT NULL violation. You could not create a single product.
Nobody noticed because there are no tests and the route was never called with auth.

- **F1 — products had no category.** No relation to `Category` at all, so the whole
  categories module was orphan data. Added an optional `category` relation
  (`onDelete: 'SET NULL'` — deleting a category clears it on the product instead of
  breaking the product). `categoryId` added to the DTO, and the service refuses a
  category belonging to another company.
- **F2 — wrong inverse side.** [product.entity.ts](src/products/entities/product.entity.ts)
  said `@ManyToOne(() => Company, (company) => company.purchaseOrders)` on a **Product** —
  copy-paste bug wiring products into the company's purchase-order list. Inverse removed.
- **F3 — money came back as a string.** 🔴 *this one matters for the frontend.*
  Postgres `decimal` arrives in JavaScript as a **string**, so `sellingPrice` was
  `"999.99"`, not `999.99` — even though TypeScript said `number`. In Next.js
  `total + price` would produce `"0999.99"` instead of adding.
  Fixed with a shared [decimalTransformer](src/common/transformers/decimal.transformer.ts).
  Verified: the API now returns a real number.
  ⚠️ `stock-movements` has a decimal column too — apply the same transformer there.
- **F4 — name and SKU were unique globally.** `@Index(['name'], { unique: true })` plus
  `sku unique: true` across all companies. Now `@Unique(['company','sku'])` and
  `@Unique(['company','name'])`.
- **F5 — negative prices were accepted.** Added `@Min(0)` and `maxDecimalPlaces: 2`
  (the column is `scale: 2`, so a third decimal was silently rounded away before).
- **F6 — `findAvailableProduct` was a copy of `findOne`.** The name promises an
  availability check it never did. Now it delegates to `findOne` and is company-scoped;
  the purchasing flow passes its `companyId` through.
- Also: `description` was `@IsNotEmpty()` in the DTO but nullable in the entity — made
  optional so the two agree.

### Stock movements — bugs found and fixed

**SM1 — the last open leak.** `companyId` came from the request body, `findAll()`
returned **every movement of every company** with no filter, and `findOne` had no
company check. The controller had no `@CurrentUser` at all. All scoped now.

**SM2 — product and warehouse were not company-checked** before the movement was
applied, so stock could be moved between companies.

**SM3 — a negative ADJUSTMENT was impossible.** 🔴 *two parts of the code disagreed.*
`InventoriesService.applyMovement` explicitly supports a negative ADJUSTMENT
("can be positive (correction) or negative"), but the DTO said `@Min(1)` and the
service refused `quantity <= 0` for **every** type. So the downward stock correction
the inventory code was written for could never reach it.
Now: ADJUSTMENT may be negative (but not zero); every other type still requires a
positive quantity.

**SM4 — a manual adjustment could not be recorded at all.** `referenceId` was required
and `NOT NULL`, but a stock-count correction has **no source document**. You had to
invent a UUID to record one. `referenceId` is now nullable, required for every
reference type except ADJUSTMENT.

**SM5 — the response shape did not match the rest of the API.** `GET /stock-movements`
returned a plain array while every other list returns `{data, meta}`, and it had no
pagination — the whole stock history in one response, growing forever.

**SM6 — no filters.** A stock history screen needs to filter by product, warehouse and
type. Added `StockMovementQueryDto`.

**SM7 — no Swagger tags or descriptions** on the controller.

No PATCH or DELETE was added, on purpose: movements are the audit trail. A wrong
movement is corrected by recording an ADJUSTMENT, never by rewriting history.

### Stock movements test — all pass

| Test | Expected | Got |
|---|---|---|
| response shape (SM5) | `{data, meta}` | ✅ |
| B sees A's movements | 0 rows | ✅ |
| negative ADJUSTMENT, no referenceId (SM3, SM4) | created, stock 145 → 140 | ✅ |
| IN without referenceId | 400 | ✅ |
| A moves stock in B's warehouse (SM2) | 404 | ✅ |
| `companyId` in body (SM1) | 400 | ✅ |
| filter by `type=IN` (SM6) | only IN rows | ✅ |
| OUT more than available | 409 | ✅ |

### Companies — the tenant table was wide open 🔴

Every other module filters by company. The company row itself did not.
Demonstrated live on the running app, logged in as Company A:

| What A could do to another company | Before |
|---|---|
| see it in `GET /companies` | ✅ all 3 companies listed, with contact details |
| read it by id | ✅ 200 |
| **rename it** | ✅ **it worked** — B was renamed to "OWNED BY A" |
| **delete it** | ✅ nothing stopped it |

(The rename was undone straight after the test; all three names verified intact.)

**Decisions taken:**
- `POST /companies` **removed** — it created a company with no user and no way to log
  into it, an orphan row. A company is born only through `POST /auth/signup`, which
  also creates the first user and the document sequences. One path, kept correct.
- `DELETE /companies/:id` **removed** — deleting a company means deleting a whole
  customer's products, orders, stock history and users. Not something one API call
  should do. Stock movements use `onDelete: 'RESTRICT'` anyway, so it would have
  failed with a 500. If it is ever needed it should be a deliberate offline job.
- `GET /companies` (list) **removed** — a user belongs to exactly one company, so a
  list route can only ever leak.
- `GET /companies/me` **added** — the frontend reads the current company without
  needing to know its id.
- `GET /companies/:id` and `PATCH /companies/:id` now answer **403** for any id that
  is not your own.

Note on 403 vs 404: everywhere else cross-company access returns 404, to avoid
confirming that a row exists. Here 403 is right — the caller already knows their own
company id, so a different id is plainly someone else's and saying so leaks nothing.

Implementation note: `@Get('me')` is declared **before** `@Get(':id')`. Nest matches
routes in order, so the other way round "me" is parsed as an id and `ParseUUIDPipe`
answers 400.

### Companies test — all pass

| Test | Expected | Got |
|---|---|---|
| `GET /companies/me` | own company | ✅ Company A |
| `GET /companies` (list) | gone | ✅ 404 |
| `POST /companies` | gone | ✅ 404 |
| `DELETE /companies/:id` | gone | ✅ 404 |
| `GET` own company by id | 200 | ✅ |
| `GET` another company by id | 403 | ✅ |
| **rename another company** | 403 | ✅ blocked |
| update own company | 200 | ✅ |

### Purchases — bugs found and fixed

**PO1 — `receive` had its own copy of the stock logic, with no lock.** 🔴
`InventoriesService.applyMovement` existed for exactly this, but `receive` never
called it — the purchases module did not even import `InventoriesModule`. Instead it
did its own `inventory.quantityOnHand += item.quantity` with no lock: the same lost
update as I1, in a second place. Now it delegates to `applyMovement`, so the locking
and the movement rules live in one place only.

**PO2 — `receive` required the stock row to already exist.** `if (!inventory) throw
NotFound`, so receiving a product that had never been stocked in that warehouse failed.
`applyMovement` creates the row on first movement, so this now just works.

**PO3 — `update` never checked the status.** `ensureIsDraft` existed and was used by
the items service, but `update` itself called plain `findOne`. So a **received** order
could be edited — its supplier changed after the stock had already landed.

**PO4 — `remove` had no status check at all.** A received order could be deleted, which
orphans the stock movements that point back to it and destroys the audit trail. Now 400.

**PO5 — `receive` never checked the warehouse.** Any warehouse id was accepted, including
another company's. Stock could be pushed into a warehouse that is not yours.

**PO6 — `companyId` came from the request body**, and no read was company-scoped.

**PO7 — `unitCost` was `numeric` with no precision and no transformer** — so it came back
as a **string**, same as F3, and with no `scale` the database kept unbounded decimals.
Now `precision: 10, scale: 2` with `decimalTransformer`. Same fix applied to
`stock_movements.unit_cost`.

**PO8 — small ones.** `status` was typed `string` instead of `PurchaseOrderStatus`
(so any string could be assigned). `@Entity()` on the item had no table name, giving
`purchase_order_item` while every other table is plural — now `purchase_order_items`.
`remove` had the same dead `if (!purchaseOrder)` after `findOne`.

### 🔴 The race condition, proven

Not a theory. Measured on the running app, four receipts of 10 units fired at once:

| | stock before | stock after | expected | lost |
|---|---|---|---|---|
| **without the lock** | 55 | 85 | 95 | **10 units** |
| **with the lock** | 85 | 145 (6 receipts) | 145 | **0** |

Ten units of stock disappeared with no error anywhere. This is what the missing
`FOR UPDATE` costs, and it only ever happens under real concurrent load.

### Purchases test — all pass

| Test | Expected | Got |
|---|---|---|
| create order | 201, number generated | ✅ |
| A uses B's supplier | 404 | ✅ |
| confirm with no items | 400 | ✅ |
| add item, `unitCost` type (PO7) | number | ✅ `799.99` |
| B adds an item to A's order | 404 | ✅ |
| receive a DRAFT order | 400 | ✅ |
| confirm | CONFIRMED | ✅ |
| edit a CONFIRMED order (PO3) | 400 | ✅ |
| add an item to a CONFIRMED order | 400 | ✅ |
| receive into B's warehouse (PO5) | 404 | ✅ |
| receive | RECEIVED, stock 10 → 15 | ✅ |
| stock movement written | IN, qty 5, cost 799.99 | ✅ |
| receive twice | 400 | ✅ |
| cancel a RECEIVED order | 400 | ✅ |
| delete a RECEIVED order (PO4) | 400 | ✅ |

### Inventories — bugs found and fixed

**I0 — `POST /inventories` was broken too.** Same root cause as F0: `company` was
`nullable: false` but `create` never set it → 500 on every call. Confirmed with curl.

**I1 — no lock on the stock row.** 🔴 *the most dangerous bug found so far.*
`applyMovement` read the stock row, did the maths in JavaScript, then saved. With no
lock, two receipts arriving at the same moment both read `quantityOnHand = 10`, both
compute `10 + 5`, and both save `15`. **Stock silently disappears** — the classic
lost update. It only shows up under real load, and the numbers are wrong with no error
anywhere.
Fixed with `.setLock('pessimistic_write')` (SQL `FOR UPDATE`), the same pattern
[document-number.service.ts](src/common/%20document-number/document-number.service.ts)
already uses for sequence numbers. The second transaction now waits for the first.

**I2 — `applyMovement` ignored the company.** It found the stock row by product +
warehouse only, and looked up product/warehouse without any company filter. Now all
three are scoped, so a movement can never touch another company's stock.

**I3 — wrong inverse side**, same copy-paste as F2:
`@ManyToOne(() => Company, (company) => company.purchaseOrders)` on an Inventory.

**I4 — ADJUSTMENT silently clamped to zero.** A bad adjustment was rewritten to `0`
(and reserved quietly cut down to match) instead of being refused. The stock movement
record would then not match what really happened to the stock. Now it throws 409.

**I5 — `PATCH` could move stock to another product or warehouse.** `UpdateInventoryDto`
was `PartialType(CreateInventoryDto)`, so it accepted `productId` and `warehouseId`.
Changing them moves a stock quantity onto a different shelf with no trace, and can
collide with the row that already exists for that pair. The DTO is now
`PickType(..., ['quantityOnHand', 'quantityReserved'])` — sending `warehouseId` is a 400.

**I6 — reserved could exceed on-hand.** Neither `create` nor `update` checked it, so you
could reserve 999 units of a product you have 10 of. Now 409 in both.

**I7 — reads were not company-filtered** (`findAll`, `findOne`, `getAvailableStock`,
`getInventoryDetails`). All scoped now.

### Inventories test — all pass

| Test | Expected | Got |
|---|---|---|
| create inventory (was 500) | 201 | ✅ |
| duplicate product + warehouse | 409 | ✅ |
| A uses B's warehouse | 404 | ✅ |
| B reads A's inventory | 404 | ✅ |
| B lists inventories | 0 rows | ✅ |
| reserved > on hand (I6) | 409 | ✅ |
| change warehouse via PATCH (I5) | 400 | ✅ |

⚠️ The lock (I1) is not covered by these tests — it only shows under concurrency.
It gets exercised in Step 3 through the purchase-order receive flow.

### Products test — all pass

| Test | Expected | Got |
|---|---|---|
| create a product (was 500) | 201 | ✅ |
| `sellingPrice` in the response (F3) | number, not string | ✅ `999.99` float |
| create a product with a category (F1) | `categoryId` saved | ✅ |
| B uses A's category | 404 | ✅ |
| B creates the same name + SKU (F4) | allowed | ✅ 201 |
| B reads A's product | 404 | ✅ |
| A lists products | only its own (2) | ✅ |
| negative price (F5) | 400 | ✅ |
| A updates own product, same SKU (B1) | 200 | ✅ |

### Isolation test — 2 companies, all pass

| Test | Expected | Got |
|---|---|---|
| A creates supplier "ACME" | 201 | ✅ |
| B creates supplier "ACME" too (same name+email) | works, per-company unique | ✅ |
| A lists suppliers | only its own (1) | ✅ |
| B lists suppliers | only its own (1) | ✅ |
| B reads A's supplier by id | 404 | ✅ |
| B updates A's supplier | 404 | ✅ |
| B deletes A's supplier | 404 | ✅ |
| A updates its own, same email | 200 (B1 fixed) | ✅ |
| A sends `company_id` in body | 400 rejected | ✅ |

Warehouses and customers: same 4 isolation checks, all pass (B creates the same
name → 201, B reads/deletes A's row → 404, A renames its own row to the same
name → 200).

Categories — tree rules, all pass:

| Test | Expected | Got |
|---|---|---|
| B attaches a child to A's parent | 404 (no cross-company parent) | ✅ |
| duplicate name under the same parent | 409 | ✅ |
| duplicate **root** name (the NULL case, C4) | 409 | ✅ |
| same name under a **different** parent (C3) | 201 allowed | ✅ |
| category as its own parent (C2) | 400 | ✅ |
| move a parent under its own grandchild (C2) | 400 | ✅ |
| delete a category that has children (C5) | 409 | ✅ |
| move a child to root with `parentId: null` (C1) | really saved | ✅ |

### Public routes — verified still open after all changes

`GET /` 200 · `POST /auth/signup` 201 · `POST /auth/login` 200 · `GET /api` 200 ·
`GET /api-json` 200. All 10 other route groups return 401 without a token.

⚠️ Cosmetic: the global Swagger security makes the lock icon appear on the public
routes too. The routes really are open (tested) — only the icon is wrong.

---

## Step 2 checklist per module

Order: **companies → users → categories → products → suppliers → warehouses → inventories**

For each module check:
- [ ] DTO has validation (`class-validator`)
- [ ] `findOne` with a bad id → 404, not 500
- [ ] Delete: hard delete or soft delete? What if the row is used somewhere?
- [ ] List endpoint: pagination? filter? search?
- [ ] Swagger: response type documented
- [ ] Company isolation: does user of company A see data of company B?

| Module | Reviewed | Notes |
|---|---|---|
| companies | ⬜ | |
| users | ⬜ | no controller |
| categories | ⬜ | |
| products | ⬜ | |
| suppliers | ⬜ | |
| warehouses | ⬜ | |
| inventories | ⬜ | modified, not committed |

> Swept module by module in Step 5 instead of one row at a time. Validation, 404s,
> pagination and isolation came out clean everywhere; what the delete column hid is
> **F1** and **F3** in the final report.

---

## Step 3 — Business logic (the risky part)

This is your new, uncommitted code. Most bugs live here.

Files:
- [purchase-orders.service.ts](src/purchases/services/purchase-orders.service.ts)
- [purchase-order-items.service.ts](src/purchases/services/purchase-order-items.service.ts)
- [inventories.service.ts](src/inventories/inventories.service.ts)
- [stock-movements.service.ts](src/stock-movements/stock-movements.service.ts) — new, untracked

Checklist:
- [ ] **Status flow:** draft → confirmed → received → cancelled. Which change is allowed?
- [ ] Can I confirm an order with 0 items? Should be blocked.
- [ ] Can I cancel an order that is already received?
- [ ] Can I edit items after the order is confirmed?
- [ ] **Receive:** partial receive supported? quantity > ordered blocked?
- [ ] **Transaction:** receive updates order + inventory + stock movement. All in one transaction?
- [ ] **Race condition:** two receives at the same time — does stock go wrong? (needs pessimistic lock)
- [ ] Total price calculated in the backend, not trusted from the frontend
- [ ] Document number generation is inside the transaction

> Worked through in Step 5, by replaying the flow against the running app. Everything
> above holds except partial receive (**F5**) and the missing order total (**F4**);
> the lock and the transaction were confirmed in place.

---

## Step 4 — API contract for the frontend 🔄 MOSTLY DONE

- [x] **List responses: same shape everywhere.** Verified all 8 list endpoints return
      `{data, meta:{page, limit, total, totalPages}}` — identical keys.
- [x] **Error responses: same shape everywhere.** Two problems found and fixed, below.
- [x] **Money is a number.** Verified on products and purchase order items.
- [x] **No secret leaks.** Swept all 10 endpoints plus signup/login: the `password`
      field appears nowhere. The `select: false` column does its job.
- [x] **Pagination validated.** `page=0`, `limit=999`, `page=abc` all answer 400, and a
      page past the end returns an empty `data` with correct `meta`.
- [ ] **Swagger response schemas — 0 of 51 endpoints.** 🔴 See below, needs a decision.
- [ ] Date format — inconsistency found, see below.

### Error shape — was inconsistent in two ways (fixed)

**E1 — a 401 was missing the `error` key.** `new UnauthorizedException()` with no
message produces `{message, statusCode}`, while every other error produces
`{error, message, statusCode}`. The frontend would read `err.error` and get `undefined`
exactly on the auth failure it most needs to detect.

**E2 — `message` was sometimes a string, sometimes an array.** 🔴 The `ValidationPipe`
puts one string per broken rule into `message` as an **array**; everything else puts a
**string** there. So a frontend cannot write `toast(err.message)` — on a 400 it would
print `[object Object]` or a raw comma-joined blob, and it has to branch on the type of
a field first.

Both fixed by a global [HttpExceptionFilter](src/common/filters/http-exception.filter.ts).
Every error, from any source, now has exactly this shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed: 12 problems",
  "details": ["name should not be empty", "sku must be a string"],
  "path": "/products",
  "timestamp": "2026-08-20T13:05:41.559Z"
}
```

`message` is **always a single string**, safe to show to a user. `details` appears only
on validation errors and carries the per-field messages, for highlighting form fields.
`path` and `timestamp` make a bug report from the frontend actionable.

The filter also catches non-HTTP exceptions: it logs the real stack server-side and
returns a plain "Internal server error", so a driver message or stack trace can never
reach the client.

### E3 — DELETE returned a row with no `id` (fixed)

TypeORM's `remove()` **strips the primary key** off the entity it returns. So every
`DELETE` answered with the deleted row minus the one field the frontend needs to
remove it from a list. Verified before: `keys: [address, companyId, createdAt, name,
updatedAt]` — no `id`. Fixed in all 8 services.

### 🔴 Swagger documents no response bodies — 0 of 51 endpoints

Every endpoint declares its **request** DTO (22 schemas) but **not one** declares what
it returns. Swagger shows "200 OK" with no example, and a generated TypeScript client
would type every response as `any`.

This is the single biggest remaining obstacle to smooth frontend work: the Next.js
developer has to open the NestJS entity files to learn the shape of every response.

### Date format inconsistency (open)

`orderDate` returns `"2026-08-20"` (date only) while `createdAt` returns
`"2026-08-20T10:35:32.806Z"` (full ISO). The column is `type: 'date'`, which Postgres
returns without a time.

Watch out on the frontend: `new Date("2026-08-20")` is parsed as **UTC midnight**, so
in a timezone behind UTC it displays as the previous day. Either keep it as a plain
string and never build a `Date` from it, or change the column to a timestamp.

---

## Step 5 — Final report

**Date:** 2026-08-23 · **Method:** read every service, entity and controller, then
replayed the whole purchasing flow by curl against a running app and a real Postgres
(signup → warehouse → product → supplier → order → item → confirm → receive → delete),
plus a fresh two-company isolation check. Every 🔴 and 🟡 below was reproduced, not
guessed; the observed response is quoted with each one.

### Closed since the plan was last written

Four items the earlier steps left open are now done, so they are **not** repeated below:

- **S1 / S2** — `JWT_SECRET` is a real random secret and `JWT_EXPIRES_IN = 7d`.
- **S4** — document number prefixes and the missing sequences (`8ae3282`).
  Verified live: the first order of a new company is `PO-2026-000001`.
- **S6** — the `console.log({company})` is gone.
- **Step 4's blocker** — Swagger response schemas, `679ba53` + `b5b89dc`.
  11 controllers now declare what they return, and the password hash is out of the
  OpenAPI document.


---

### 🔴 Must fix before the frontend — ✅ all three fixed 2026-08-23

Fixed and re-verified against the running app the same way they were found. What each
one now answers is quoted under it.

**F1 — Deleting a row that is referenced answers 500.** ✅ **FIXED**

```
DELETE /products/{id}    → 500 {"message":"Internal server error"}
DELETE /warehouses/{id}  → 500 {"message":"Internal server error"}
DELETE /suppliers/{id}   → 500 {"message":"Internal server error"}
```

All three reproduced on rows that had stock movements / a purchase order behind them.
Postgres refuses the delete with a foreign-key violation (`23503`), nothing catches it,
and [http-exception.filter.ts:72](src/common/filters/http-exception.filter.ts#L72)
correctly turns any non-`HttpException` into a generic 500. So every delete button in
the UI can produce an unexplained "Internal server error", and the frontend cannot tell
the user *why* — which is the one thing they need to know ("this product has stock
history").

**Fixed** by [`isForeignKeyViolation`](src/common/database/postgres-errors.ts) plus a
shared [`removeEntity`](src/common/database/remove-entity.ts) that all 8 services now
delete through. It restores the id `remove()` strips *and* maps the violation to a 409,
so the two things every delete had to get right live in one place instead of eight.

```
DELETE /products/{id}   → 409 "This product cannot be deleted: it appears on a
                               purchase order or has stock history."
DELETE /warehouses/{id} → 409 "This warehouse cannot be deleted: it holds stock
                               or has stock history."
DELETE /suppliers/{id}  → 409 "This supplier cannot be deleted: it has purchase
                               orders. Mark it inactive instead."
```

**F2 — `PATCH /inventories/:id` rewrites stock with no movement and no lock.** ✅ **FIXED**

```
inventory after receiving 5 units  → quantityOnHand: 5,    stock movements: 1
PATCH /inventories/{id} {"quantityOnHand":9999}
                                   → quantityOnHand: 9999, stock movements: 1
```

[stock-movements.service.ts:20](src/stock-movements/stock-movements.service.ts#L20)
promises "stock can never move without a movement recording it". This endpoint breaks
that promise: 9994 units appeared with nothing in the audit trail. It also skips the
`pessimistic_write` lock that `applyMovement` takes, so it can silently overwrite a
concurrent receipt. `POST /inventories` with an opening `quantityOnHand` has the same
hole.

**Fixed** by taking the second option: `POST /inventories` and `PATCH /inventories/:id`
are gone, along with their DTOs and the now-unused repositories in the module.
Inventories is a read-only resource; stock changes go through `POST /stock-movements`,
which locks the row, validates the change and records it. `DELETE /inventories/:id`
stays, but now refuses a record that still holds stock — deleting one would make the
count vanish with nothing in the history to explain it.

Verified that the removed endpoints cost the frontend nothing:

```
POST /inventories                                   → 404 (gone)
POST /stock-movements  ADJUSTMENT +40, no row yet   → row created, onHand 40
DELETE /inventories/{id} while it holds 40          → 409 "Adjust it down to zero…"
POST /stock-movements  ADJUSTMENT -40               → onHand 0
POST /stock-movements  ADJUSTMENT -5  from zero     → 409 "would make stock negative"
DELETE /inventories/{id} now empty                  → 200, id intact
GET  /stock-movements                               → both adjustments recorded
```

**F3 — Deleting a product silently empties draft order lines.** ✅ **FIXED**

```
draft order before → items: [{quantity: 7, unitCost: 3}]
DELETE /products/{id} → 200
draft order after  → items: []
```

`purchase_order_items.product` is `onDelete: 'CASCADE'`
([purchase-order-item.entity.ts:18](src/purchases/entities/purchase-order-item.entity.ts#L18)),
so an order the user is in the middle of writing loses lines with no error and no trace —
the order stays `DRAFT` and just gets cheaper. Today F1 masks this whenever stock
movements exist, but a product that was only ever ordered, never received, deletes clean.

**Fixed**: the relation is now `onDelete: 'RESTRICT'`, so the database refuses and F1's
handler turns that refusal into a 409. A product that appears on any order is not
deletable at all — the order keeps its lines.

```
draft order before    → items: [{quantity: 7, unitCost: 3}]
DELETE /products/{id} → 409
draft order after     → items: [{quantity: 7, unitCost: 3}]   ← intact
```

---

### 🟡 Fix soon

**F4 — A purchase order has no total.** ✅ **FIXED 2026-08-23**
No `totalAmount` on the order, no line total on the item — verified on
`GET /purchases/{id}`. Every screen showing an order had to sum
`items[].quantity * unitCost` itself, and any list-level sum re-implemented the same
arithmetic. Nothing was *trusted* from the client (the Step 3 requirement was already
met — the client cannot send a total), but the number belongs in the backend.

**Fixed** with `totalAmount` on the order and `lineTotal` on each line, computed by
`@AfterLoad` rather than stored, so neither can drift from the columns it comes from.
Rounding goes through one [`roundMoney`](src/common/utils/money.ts) helper.

```
POST /purchases                      → items: [], totalAmount: 0
POST item 3 x 19.99                  → lineTotal 59.97
POST item 7 x 0.10                   → lineTotal 0.7      (not 0.7000000000000001)
GET  /purchases/{id}                 → totalAmount 60.67
GET  /purchases        (list)        → totalAmount 60.67
PATCH line to 5 x 19.99              → lineTotal 99.95, totalAmount 100.65
confirm, then receive                → totalAmount survives both
POST /purchases {totalAmount: 9999}  → 400 "property totalAmount should not exist"
```

**F5 — Receiving is all-or-nothing.** `PATCH /purchases/:id/receive` takes only a
`warehouseId` and books every line in full. There is no `receivedQuantity`, so a
supplier delivering 3 of 5 cannot be recorded — the choice is to lie or to wait.
Re-receiving is correctly refused (`400 "Only confirmed purchase orders can be
received."`), so nothing is *broken*; the capability is simply missing. **Decide before
the receive screen is designed**, because partial receipt changes the entity (a
per-item received quantity) and the status flow (a `PARTIALLY_RECEIVED` state).

**F6 + F7 — Three different user shapes.** ✅ **FIXED 2026-08-23**

```
signup  → user: {id, email, firstName, lastName, companyId, companyName}
login   → user: {id, email, firstName, lastName, companyId}
profile → {sub, email, companyId, iat, exp}
```

`companyName` was absent on login because `signIn` never loaded the company, and
`/auth/profile` handed back the token payload — `sub` instead of `id`, JWT plumbing
leaking into an API response, and a shape that could never reflect a change made after
the token was issued.

**Fixed**: one `toAuthUser` builds the response for all three, `companyName` is required
rather than optional, `findByEmailWithPassword` joins the company (free next to the
bcrypt compare that follows), and `/auth/profile` reads the user from the database.
`JwtPayloadDto` is gone.

```
signup  → {"id":"a815…","email":"…","firstName":"Sara","lastName":"N",
           "companyId":"3008…","companyName":"Shape Co"}
login   → identical
profile → identical
```

**F8 — A company can only ever have one user.** `UsersService` has no controller, and
`POST /auth/signup` always creates a *new* company. There is no invite, no user list, no
deactivate — so a real customer cannot add a colleague. `isActive` is checked at login
but nothing can set it. This is a product decision, not a bug, but it blocks any
team/settings screen.

**F9 — A deactivated user keeps working for up to 7 days.** `isActive` is only read at
login and the token is self-contained, so disabling an account does not end the session.
Acceptable while F8 means there is one user per company; revisit together with F8.

**F10 — There are no tests.** 🔸 **Partly addressed 2026-08-24.** The repo had zero
`.spec.ts` files — the empty scaffolds were deleted rather than filled in, so
`npm test` passed by running nothing. It now has **44 tests across 2 suites**, written
with the two-scenario OUT work: `inventories.service.spec.ts` covers every movement
type, both kinds of OUT, the quantity guards, the invariants and the row lock;
`stock-movements.service.spec.ts` covers the caller-side rules and the rollback.

Still uncovered, and still the code that breaks quietly: the purchase order status
flow, document numbering, company isolation, and every CRUD service.

**F11 — No migrations.** `synchronize` is on outside production
([database.config.ts:22](src/config/database.config.ts#L22)) and there is no migration
setup at all, so there is currently no way to create or evolve a production schema.
Needed before any deploy, not before the frontend.

**F12 — `orderDate` / `expectedDate` are calendar dates, `createdAt` is a timestamp.**
Known and deliberate, and now documented on the entity
([purchase-order.entity.ts:47](src/purchases/entities/purchase-order.entity.ts#L47)).
Left here only as a note for the frontend: never `new Date("2026-08-23")` on those two
fields — it parses as UTC midnight and shows the previous day west of UTC.

---

### 🟢 Good — no change needed

- **Company isolation holds.** Re-verified with two fresh companies: reading another
  company's order or supplier is `404` (not 403 — the id is not confirmed), a listing
  shows only your own rows, and sending `companyId` in the body is refused with
  `400 "property companyId should not exist"`. Every service takes `companyId` from the
  token, never from the request.
- **The receive path is transactional and locked.** Stock, movement and status change
  commit or roll back together, and `applyMovement` takes a `pessimistic_write` lock on
  the stock row ([inventories.service.ts:59](src/inventories/inventories.service.ts#L59)),
  which is what closed the race condition proven in Step 2.
- **Status flow is enforced.** Only a `DRAFT` can be edited or confirmed, confirming an
  empty order is refused, a received order can be neither cancelled nor deleted, and a
  second receive answers 400. Items can only be touched while the order is `DRAFT`.
- **Document numbering is sound.** Generated inside the order's transaction, per company,
  `PO-2026-000001` verified on a new tenant.
- **One error shape everywhere**, `message` always a single string, `details` only for
  validation, and no stack or driver text ever reaches the client.
- **One list shape everywhere**: `{data, meta:{page, limit, total, totalPages}}`, with
  `page`/`limit` validated and capped at 100.
- **Auth basics**: bcrypt, `select: false` on the password (absent from every response
  checked, and from the OpenAPI document), a dummy-hash compare so a wrong email and a
  wrong password take the same time, and public routes limited to signup, login, `/`
  and the docs.

---

### Suggested order of work

1. ~~F1 + F3 — shared foreign-key handling and one `onDelete` change.~~ ✅ done 2026-08-23
2. ~~F2 — remove the inventory write endpoints.~~ ✅ done 2026-08-23
3. ~~F6 + F7 — one user shape from signup, login and profile.~~ ✅ done 2026-08-23
4. ~~F4 — order and line totals in the response.~~ ✅ done 2026-08-23
5. Then start the frontend. F5, F8, F9 are decisions to take while it is being built;
   F10 and F11 before anything is deployed.

Steps 1–2 are on `fix/safe-deletes-and-stock-audit-trail` (PR #6); steps 3–4 on
`feature/api-contract-cleanup`, stacked on it. **Nothing blocks the frontend now** —
what is left is F5 and F8, which are decisions, plus tests and migrations before deploy.

---

## Open questions for the tech lead

1. ~~**Tests** — what do we do with the 5 empty scaffold spec files? (S5)~~
   **Answered:** option (a), they were deleted. Still open as **F10** — the purchase
   status flow and the stock lock have no test at all.
2. ~~**Token life** — 15 minutes is short.~~ **Answered:** `JWT_EXPIRES_IN = 7d`,
   no refresh flow. See **F9** for what that costs.
3. ~~**Company isolation** — how do we filter by company?~~ **Answered:** the
   `@CurrentUser('companyId')` decorator + `companyId` in every service method.
   Done in every module and re-verified in Step 5.
4. **New — F5:** does receiving support partial delivery? It changes the entity and the
   status flow, so it is cheaper to decide now than after the receive screen exists.
5. **New — F8:** can a company have more than one user? If yes, we need invite / list /
   deactivate endpoints, and probably the roles that were deferred at the start.
