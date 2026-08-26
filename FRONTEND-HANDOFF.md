# Frontend handoff — goods receipts, 2026-08-26

Not yet merged — local changes on `main`, pending review. Everything below was run
against a live dev server end to end (real signup, real requests), not just unit tests.

**Nothing else moved** — the error shape, the list shape, pagination, company isolation,
auth, and every endpoint not mentioned below are exactly as they were.

| # | Change | Frontend impact |
|---|---|---|
| 1 | New resource: `goods-receipts` (+ line items) — the real way to receive stock now | **New screen** — itemized, partial receiving against a purchase order |
| 2 | `PurchaseOrder.status` gains `PARTIALLY_RECEIVED` | **New status to handle** everywhere status is shown or branched on |
| 3 | `PATCH /purchases/:id/receive` behavior changed | **Breaking** — no longer moves stock; takes no body now |
| 4 | 5 new permissions, `goods-receipts:*` | **New permission strings** for role editor and route guards |
| 5 | Closes known gap #1 from the previous handoff ("receiving is all-or-nothing") | No frontend action — informational |

This closes the "all-or-nothing receiving" gap flagged in the last handoff. Receiving a
purchase order used to be one button that booked every line in full. It is now its own
resource: a purchase order can be received across several goods receipts over time, each
one itemized, and each one a draft you can edit before it touches stock.

---

## 1. Goods receipts — new resource

**The model:** a purchase order (once `CONFIRMED`) can have any number of goods
receipts. Each goods receipt has its own lines, one per purchase-order line it is
receiving against, each carrying the quantity actually received. A receipt starts as a
`DRAFT` — editable, no effect on anything — and only affects stock once you `confirm` it.
Confirming is permanent: a `CONFIRMED` receipt cannot be edited or cancelled, same as a
`RECEIVED` purchase order today.

```
DRAFT ──confirm──▶ CONFIRMED   (raises stock, permanent)
DRAFT ──cancel───▶ CANCELLED   (no stock effect, permanent)
```

**Shape** (`GET /goods-receipts/:id` — nested relations included, no extra fetches needed):

```jsonc
{
  "id": "cdce379c-…",
  "purchaseOrderId": "728d66a6-…",
  "purchaseOrder": { "orderNumber": "PO-2026-000001", "status": "PARTIALLY_RECEIVED", "…": "…" },
  "warehouseId": "1d78ef4e-…",
  "warehouse": { "name": "Main Depot", "…": "…" },
  "companyId": "af9cd7ef-…",
  "receivedAt": "2026-08-26T15:47:06.156Z",   // when the goods arrived — defaults to now, can be backdated
  "status": "CONFIRMED",
  "notes": null,
  "items": [
    {
      "id": "3636934c-…",
      "purchaseOrderItemId": "64df306e-…",
      "productId": "0bff46a0-…",
      "product": { "sku": "SKU-1", "name": "Widget", "…": "…" },
      "quantityReceived": 6,
      "createdAt": "…"
    }
  ],
  "createdAt": "…",
  "updatedAt": "…"
}
```

### Endpoints

```
POST   /goods-receipts                             create a draft
GET    /goods-receipts                              paginated list
GET    /goods-receipts/:id
PATCH  /goods-receipts/:id                          header only (warehouseId, receivedAt, notes) — draft only
PATCH  /goods-receipts/:id/confirm                  raises stock, updates the purchase order status
PATCH  /goods-receipts/:id/cancel                   draft only

POST   /goods-receipts/:id/items                    add a line — draft only
PATCH  /goods-receipts/:id/items/:itemId            change quantityReceived — draft only
DELETE /goods-receipts/:id/items/:itemId            remove a line — draft only
```

There is no `DELETE /goods-receipts/:id` — cancel a draft instead of deleting it, same
reasoning as purchase orders not having a hard delete once they carry history.

### Creating a receipt

```jsonc
POST /goods-receipts
{
  "purchaseOrderId": "728d66a6-…",
  "warehouseId": "1d78ef4e-…",
  "items": [
    { "purchaseOrderItemId": "64df306e-…", "quantityReceived": 4 }
  ],
  "receivedAt": "2026-08-26T10:00:00.000Z",   // optional, defaults to now
  "notes": "Two boxes arrived damaged"         // optional
}
```

`items` needs at least one line (`"items must contain at least 1 elements"` if empty).
`productId` on each line is filled in from the purchase-order line server-side — don't
send it, it isn't accepted.

**Only a `CONFIRMED` or `PARTIALLY_RECEIVED` purchase order can take a receipt:**

```
purchase order is DRAFT      → 400 "Only a confirmed or partially received purchase order can take a goods receipt."
purchase order is CANCELLED  → same 400
purchase order is RECEIVED   → same 400 — everything on it has already arrived
```

**Over-receiving is rejected, and the message tells you by how much:**

```jsonc
// order line is for 10, this order already has 6 confirmed-received
POST /goods-receipts { "items": [{ "purchaseOrderItemId": "…", "quantityReceived": 7 }] }
→ 400 "Cannot receive 7 unit(s) of product 0bff46a0-…: only 4 remain on the order."
```

This accounts for every other `CONFIRMED` receipt against that line — draft receipts
elsewhere don't count against it (they might get cancelled), but the real, authoritative
check runs again when you confirm (see below), so a draft that looked fine at creation
time can still be refused at confirm time if something else shipped in the meantime.

### Editing a draft

While `DRAFT`, lines can be added, changed, or removed freely:

```
POST   /goods-receipts/:id/items    { "purchaseOrderItemId": "…", "quantityReceived": 2 }
PATCH  /goods-receipts/:id/items/:itemId   { "quantityReceived": 6 }
DELETE /goods-receipts/:id/items/:itemId
```

Only `quantityReceived` is editable on an existing line — you can't repoint a line at a
different purchase-order item (add a new line and remove the old one instead).

Once confirmed, all three answer the same way:

```
400 "Only a draft goods receipt can be modified."
```

### Confirming

```
PATCH /goods-receipts/:id/confirm
```

For each line: raises stock in the receipt's warehouse, and writes a stock movement:

```jsonc
// GET /stock-movements
{ "type": "IN", "quantity": 6, "referenceType": "GOODS_RECEIPT", "referenceId": "cdce379c-…" }
```

`GOODS_RECEIPT` is a new `referenceType` value alongside the existing `PURCHASE_ORDER`,
`SALES_ORDER`, `RETURN`, `ADJUSTMENT`. It's how a stock-movement history screen tells "a
goods receipt raised this" apart from "the old whole-order receive raised this" for
anything received before this change.

The purchase order's status is recalculated from **every confirmed receipt against it**,
not just this one — so it correctly reaches `RECEIVED` on whichever receipt happens to
complete the last line, even if lines were split unevenly across several receipts:

```
some lines still short of their ordered quantity  → purchase order becomes PARTIALLY_RECEIVED
every line fully received, across all receipts    → purchase order becomes RECEIVED
```

### Cancelling a draft

```
PATCH /goods-receipts/:id/cancel   → { "status": "CANCELLED" }
```

No stock effect (a draft never had any), and the purchase order is untouched. A
cancelled receipt's quantities stop counting toward "already received" — verified: after
cancelling a receipt for 5 units, a fresh receipt for the same 5 units on the same line
was accepted and confirmed normally.

### Verified end to end

| Request | Result |
|---|---|
| Create draft receipt, qty 4 of 10 on a line | `201`, purchase order still `CONFIRMED`, no inventory row yet |
| Add a second line for 7 more on the same order line (only 6 remain) | `400`, exact remaining-quantity message |
| `PATCH` the existing line 4 → 6 | `200` |
| Confirm | stock raised to 6, movement written with `GOODS_RECEIPT`, order → `PARTIALLY_RECEIVED` |
| `PATCH` a line on the now-confirmed receipt | `400` "Only a draft goods receipt can be modified." |
| Confirm it again | same `400` |
| Second receipt for the remaining 4 | `201` |
| Try a receipt for 5 when only 4 remain | `400` at creation, before you even get to confirm |
| Confirm the second receipt | stock → 10, order → `RECEIVED` |
| Remove a draft's only line, then add a smaller one | both `200`, list reflects the change immediately |
| Cancel a draft | `200` `{"status":"CANCELLED"}`, order untouched |
| Add an item to a cancelled receipt | `400` "Only a draft goods receipt can be modified." |
| New full receipt after the cancelled one | accepted and confirmed normally — cancelled quantities don't block |

---

## 2. Purchase order status gains `PARTIALLY_RECEIVED`

```
DRAFT ──confirm──▶ CONFIRMED ──(goods receipts)──▶ PARTIALLY_RECEIVED ──▶ RECEIVED
  │                    │
  └──────cancel────────┘
```

`PARTIALLY_RECEIVED` and `RECEIVED` are now driven by goods receipts, not set directly.
A `(PARTIALLY_)RECEIVED` order can no longer be cancelled or deleted — both now answer
`400`/`409` the same way a fully `RECEIVED` order already did, since stock has moved and
there's history to keep.

**What to build:** anywhere `PurchaseOrder.status` is rendered or switched on — status
badges, filters, the confirm/cancel button's enabled state — needs this fifth value. A
"receive" action on a `PARTIALLY_RECEIVED` order should route to creating a goods
receipt for what's left, not to change 3 below.

---

## 3. `PATCH /purchases/:id/receive` — behavior changed, not removed

**Before:** took `{ warehouseId }`, booked every line of the order in full, wrote a
stock movement per line, set the order to `RECEIVED`.

**Now:** takes **no body**. It only flips the status to `RECEIVED` — a manual "mark this
done" flag for your own bookkeeping. **It does not touch stock, inventory, or the goods
receipts on the order.** Verified: calling it on a confirmed order with nothing received
via goods receipts leaves total stock at exactly what it was before the call.

```
PATCH /purchases/:id/receive      // no body

order is CONFIRMED or PARTIALLY_RECEIVED  → 200, status: "RECEIVED"
order is DRAFT, CANCELLED, or already RECEIVED
  → 400 "Only a confirmed or partially received purchase order can be marked as received."
```

**What to build:** if your receiving screen currently calls this endpoint expecting
stock to move, switch it to the goods-receipts flow in section 1 instead. Keep this one
around only for a "mark as received without itemizing" shortcut, and if you keep it,
label it clearly as bookkeeping-only in the UI — a user who clicks it expecting inventory
to update will be confused when it doesn't.

Sending `{ warehouseId: "…" }` in the body is **silently ignored, not rejected** —
verified: the call still returns `200` and the order is still just marked `RECEIVED`,
nothing else happens. There's no DTO on this route to reject unknown fields the way
other endpoints do, so don't rely on a `400` to catch a stale client still sending the
old body shape.

---

## 4. New permissions

Five new strings in the catalog (`GET /roles/permissions` — ask it for the live list):

| Permission | Gates |
|---|---|
| `goods-receipts:create` | `POST /goods-receipts` |
| `goods-receipts:read` | `GET /goods-receipts`, `GET /goods-receipts/:id` |
| `goods-receipts:update` | `PATCH /goods-receipts/:id` **and** all three item endpoints (add/edit/remove a line) — same convention as `purchases:update` covering purchase-order items |
| `goods-receipts:confirm` | `PATCH /goods-receipts/:id/confirm` |
| `goods-receipts:cancel` | `PATCH /goods-receipts/:id/cancel` |

The Owner role gets these automatically — verified on a fresh signup. **Any custom role
your company created before this change will not have them**: if you already built a
role editor, existing roles need `goods-receipts:*` added manually through it (or via
`PATCH /roles/:id`) before their users can touch this feature at all.

Verified with a role holding only `create`/`read`/`update`:

| Request | Result |
|---|---|
| List goods receipts | `200` |
| Confirm a receipt | `403` "You do not have permission to do this" |
| Cancel a receipt | `403` |

---

## Not changed today — still true

- Auth, error shape, list shape, pagination, company isolation, money-as-number,
  quantities-as-integer — all exactly as documented before.
- Purchase order lines (`purchases/:id/items`) are unaffected — still editable only while
  `DRAFT`.
- `receivedAt` (like `orderDate`/`expectedDate`) is a real timestamp here, not a calendar
  date — send full ISO 8601 if you set it explicitly.

## Known gaps you will hit while building

1. **Known gap #1 from the previous handoff is closed** — receiving is no longer
   all-or-nothing. Removed from this list.
2. **No search, sort or filters on `GET /goods-receipts`** — same limitation as every
   list except `GET /stock-movements`.
3. **No "confirmed at" timestamp.** A receipt has `createdAt` (when the draft was made)
   and `updatedAt` (bumped by any header edit, not only by confirming), but nothing that
   specifically means "when this was confirmed." If a receiving history screen needs
   that moment precisely, it isn't there yet — raise it before building that screen.
4. **Editing draft-line quantities can still be rejected at confirm time even if the
   draft looked fine when you made it** — see the note at the end of section 1's
   "creating a receipt". Build the confirm button's error handling expecting this, not
   just the create-time validation.
5. **No line-level `unitCost` on a goods receipt.** The stock movement it writes uses
   the purchase-order line's cost automatically; there's no way to record a different
   cost at receiving time (e.g. a price change from the supplier).
