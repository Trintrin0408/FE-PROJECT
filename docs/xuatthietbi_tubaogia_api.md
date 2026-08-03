# API cho nút "Xuất thiết bị" trên màn chi tiết báo giá

> **CẬP NHẬT LẦN 3 (2026-08-03) — ĐẢO NGƯỢC mục 4.1 Bước 2, ĐỒNG THỜI ĐẢO NGƯỢC LẦN NỮA quyết định
> (at)/(au) 2026-07-31 ở `docs/more-require.md`**: theo xác nhận trực tiếp của người dùng **sau khi đã
> được nhắc lại rõ quyết định (at)/(au)** (quyết định đó nói "Xuất thiết bị" CỐ Ý trừ kho thật, đại
> diện lúc thiết bị rời kho vật lý — khác hẳn khóa-theo-ngày tự động qua lịch trình SETUP/COLLECT,
> `getLockedQuantityByDate`, xem mục (at)) — người dùng vẫn chọn đổi lại: nút "Xuất thiết bị" **không
> được gọi API trừ tồn kho thật** — chỉ đồng bộ `order_items` theo `quotation_items` (mục 4.1 Bước 1),
> **bỏ hẳn** bước kiểm tra/trừ `inventory.quantity_total` và ghi `inventory_movements` (Bước 2 cũ).
> Đây là quyết định có chủ đích, biết rõ và chấp nhận đánh đổi: hệ thống **sẽ không còn nơi nào** ghi
> nhận "thiết bị đã thực sự rời kho vật lý" nữa (xem mục 8.3 để biết rõ hệ quả) — nếu sau này cần lại
> mốc đó, phải làm lại từ đầu, không phải khôi phục đơn giản. Chi tiết xem mục 8. Toàn bộ mục 4.1 Bước
> 2, mục 4.2 (dòng lỗi 400 thiếu tồn kho), mục 6 điểm 1 (phần "đổi phần trừ kho...") ở dưới đây **đã
> lỗi thời** — giữ lại để có bối cảnh lịch sử vì sao endpoint từng được thiết kế thế, không phải đặc tả
> hiện hành.
>
> **CẬP NHẬT LẦN 2 (2026-07-21, sau khi Backend đã implement bản v1)** — đổi yêu cầu theo quyết định
> mới của người dùng: bấm "Xuất thiết bị" **bao nhiêu lần cũng được**, và sau mỗi lần bấm thành công,
> tab "Thiết bị & Kho hàng" của đơn liên kết phải hiển thị **đúng y hệt danh sách hạng mục trong báo
> giá ở thời điểm bấm**. Tức endpoint không còn là "xuất 1 lần rồi khóa" (v1) mà là **"đồng bộ đơn
> theo báo giá + xuất bù / thu hồi phần chênh lệch tồn kho"** — xem mục 4 (đã viết lại toàn bộ theo
> v2), mục 4.2 (bảng mã lỗi mới, **bỏ lỗi 409 idempotency**), mục 6 (việc Backend cần sửa trên code
> v1 đã có). Lý do đổi: phát hiện case thật QUO-016/ORD-013 — đơn được tạo/liên kết trước, báo giá
> sửa thêm hạng mục sau, `order_items` không tự đồng bộ nên lần xuất v1 chỉ xuất 1/2 hạng mục và các
> lần bấm sau bị 409 chặn vĩnh viễn, không có cách xuất bù.
>
> **Phạm vi tài liệu này** (2026-07-21): thêm 1 nút **"Xuất thiết bị"** vào trang chi tiết báo giá
> (`Báo giá > Danh sách báo giá > QUO-xxx`, hàng nút cạnh "Xem đơn đặt liên kết"/"Sao chép ảnh"/"In
> báo giá"), chỉ hiện khi báo giá **Đã duyệt** và **đã có đơn đặt liên kết**. Luồng UX mong muốn:
> bấm nút → backend xuất thiết bị cho đơn liên kết → toast "Xuất thiết bị thành công" → điều hướng
> sang tab **"Thiết bị & Kho hàng"** của trang chi tiết đơn đó (màn đã chốt ở
> [`docs/api/thietbikhohang_api.md`](thietbikhohang_api.md)).
>
> Nguồn tham chiếu (đối chiếu trực tiếp code backend + DB thật qua MySQL MCP ngày 2026-07-21):
> - `src/modules/sales/quotation.service.ts` (dòng 238-239: `linkedOrderId` trong response detail),
>   `src/modules/sales/quotation.repository.ts` (dòng 124-126: `getLinkedOrderId`).
> - `src/modules/sales/order.routes.ts` (dòng 83-89 `confirm-prepared`, dòng 152-157
>   `picklist/picked-up`), `src/modules/sales/order.service.ts` (dòng 612-628
>   `markPicklistPickedUp`), `src/modules/sales/order.repository.ts` (dòng 372-377 `markPickedUp`).
> - `src/modules/inventory/inventory.routes.ts` (toàn bộ), `src/modules/inventory/inventory.service.ts`
>   (dòng 249-251: ghi chú reserve/release không ghi movement), `prisma/schema.prisma`
>   (dòng 174-178 enum `InventoryMovementType`, dòng 793-805 `Inventory`, dòng 807-819
>   `InventoryMovement`, dòng 455-456 `orders.picked_up_at`/`picked_up_by`).

## 1. Luồng UI mong muốn

1. Manager mở chi tiết báo giá đã duyệt (ví dụ QUO-016) — báo giá đã liên kết đơn (ví dụ ORD-013).
2. Bấm nút **"Xuất thiết bị"**.
3. FE gọi **1 endpoint duy nhất**, backend xử lý nguyên tử (atomic) toàn bộ việc đồng bộ + xuất kho.
4. Thành công → toast "Xuất thiết bị thành công" → `router.push` sang trang chi tiết đơn liên kết,
   tab "Thiết bị & Kho hàng" (`?tab=items` — tab id thật trong code FE; doc v1 ghi `?tab=equipment`
   là tên chưa đối chiếu code). Tab hiển thị đúng danh sách hạng mục như báo giá.
5. **(v2)** Bấm lần 2/3/n — kể cả sau khi báo giá đã được sửa thêm/bớt hạng mục: backend **đồng bộ
   lại `order_items` theo báo giá hiện tại** rồi xuất bù phần thiếu / thu hồi phần thừa về kho. Không
   còn lỗi 409 "đã xuất trước đó". Nếu không có gì thay đổi so với lần trước → 200 với
   `unchanged: true`, FE toast "Đơn đã khớp báo giá, không có gì cần xuất thêm" và vẫn điều hướng.

## 2. Hiện trạng backend — CHƯA đủ khả năng *(ghi nhận tại thời điểm viết v1 — nay endpoint v1 ĐÃ được implement, mục này chỉ giữ làm bối cảnh; việc cần làm tiếp theo xem mục 6)*

Đối chiếu route surface thật, luồng trên **không thực hiện được bằng 1 call nào hiện có**:

| Đã có | Nhận xét |
|---|---|
| `GET /api/v1/quotations/:id` trả `linkedOrderId` | ✅ Đủ cho việc FE biết đơn nào để điều hướng — **không cần thêm gì** cho bước navigation. |
| `PUT /api/v1/orders/:orderId/picklist/picked-up` | Gần nghĩa nhất ("đánh dấu đã xuất kho" mức đơn) nhưng **(a)** chặn đơn không ở `CONFIRMED`/`IN_PROGRESS` — đơn vừa tạo từ báo giá đang là `NEW` sẽ 409; **(b)** chặn khi còn dòng `prepared_qty < quantity` — đơn mới luôn 0/n sẽ 400; **(c)** chỉ set `picked_up_at`/`picked_up_by`, **không đụng gì tới tồn kho**. |
| `PUT /api/v1/orders/:orderId/items/confirm-prepared` | Chỉ set `prepared_qty` từng dòng, không trừ kho, không ghi movement. |
| `POST /api/v1/inventory/reserve` / `/release` | Đi **từng item một**, không nhận `orderId`, không ghi `inventory_movements` (ghi chú chủ đích ở `inventory.service.ts` dòng 249-251), không atomic cho cả đơn — FE tự lặp gọi N lần là sai hướng (fail giữa chừng → kho lệch). |
| Enum `InventoryMovementType.OUTBOUND` | Có trong schema/DB nhưng **chưa có bất kỳ code path nào tạo movement OUTBOUND** — hiện chỉ có `INBOUND` (xác nhận biên bản thu hồi, `inventory.repository.ts` dòng 225) và `ADJUSTMENT` (`inventory.service.ts` dòng 239). |

→ Kết luận: **thiếu 1 endpoint xuất thiết bị theo đơn, transactional** — phần còn lại (navigation,
hiển thị tab đích) đã đủ.

## 3. Hiện trạng DB — ĐỦ, không cần migration

Toàn bộ cột/bảng cần cho nghiệp vụ này đã tồn tại (xác nhận qua MySQL MCP 2026-07-21, DB `bnwems`):

- `inventory` (`quantity_total`/`quantity_damaged`/`quantity_reserved`/`quantity_available`) — 1-1 `items`.
- `inventory_movements` có sẵn `order_id` (nullable, FK → `orders`), `movement_type` enum chứa
  `OUTBOUND`, `performed_by`, `quantity`, `notes`.
- `orders.picked_up_at` / `picked_up_by` — cờ "đã xuất kho" mức đơn (đã dùng bởi màn Pick-list).
- `order_items.source` (`INTERNAL`/`SUPPLIER`) — chỉ hàng `INTERNAL` mới trừ kho nhà; hàng
  `SUPPLIER` không đụng `inventory` (đồ thuê ngoài, theo dõi ở `supplier_transactions`).

## 4. Endpoint — `POST /api/v1/orders/:orderId/export-equipment` (v2: đồng bộ theo báo giá + xuất bù/thu hồi chênh lệch)

Đặt trên **orders** (không phải quotations) vì hành vi thuộc đơn hàng; FE từ màn báo giá đã có
`linkedOrderId` để gọi. Quyền: `requireRole('MANAGER')` — Admin read-only theo nguyên tắc đã chốt ở
đầu `docs/api/thietbikhohang_api.md` (áp dụng nhất quán cụm Kho vận, xem comment
`inventory.routes.ts` dòng 38-39).

**Nguyên tắc v2 (thay thế hoàn toàn mô tả v1)**: endpoint là phép **reconcile** — sau khi chạy xong,
trạng thái cuối luôn là: (a) `order_items` của đơn khớp y hệt `quotation_items` của báo giá liên kết,
(b) tổng đã-xuất-kho của từng item (tính theo movement) khớp đúng số lượng dòng INTERNAL tương ứng.
Chạy lại lần nữa khi không có gì đổi → no-op trả 200, KHÔNG lỗi. Nhờ đó nút "Xuất thiết bị" bấm bao
nhiêu lần cũng an toàn, kể cả sau khi báo giá được sửa thêm/bớt/đổi số lượng hạng mục.

### 4.1. Việc phải làm trong CÙNG 1 transaction

**Bước 0 — xác định báo giá nguồn**: `orders.quotation_id` của đơn. Nếu `NULL` → 409 "Đơn chưa liên
kết báo giá" (không đồng bộ mù). Không nhận `quotationId` từ body — nguồn luôn là báo giá đang liên kết.

**Bước 1 — đồng bộ `order_items` theo `quotation_items`** (đối chiếu theo `item_id`):

- Dòng có trong báo giá nhưng chưa có trong đơn → INSERT `order_items`: `quantity`/`unit_price` =
  `quotation_items.quantity`/`price`, `subtotal` = `quotation_items.line_total`, `source = 'INTERNAL'`
  (mặc định), `prepared_qty = 0`.
- Dòng có ở cả 2 bên → UPDATE `quantity`/`unit_price`/`subtotal` theo báo giá; **giữ nguyên `source`
  cũ** (dòng đã đánh dấu SUPPLIER vẫn là SUPPLIER); `prepared_qty = LEAST(prepared_qty, quantity mới)`
  (không để "đã bàn giao" vượt số lượng mới khi báo giá giảm SL).
- Dòng có trong đơn nhưng không còn trong báo giá → DELETE.
- Nếu việc sửa items ở nơi khác (`PUT /orders/:id/items`) có tính lại tổng tiền đơn thì tái dùng đúng
  logic đó ở đây cho nhất quán.

**Bước 2 — reconcile tồn kho theo chênh lệch, cho từng dòng `source = 'INTERNAL'` sau bước 1**:

1. Tính `net_exported(item)` = `SUM(quantity các movement OUTBOUND)` − `SUM(quantity các movement
   INBOUND)` trên `inventory_movements` có `order_id = :orderId` của item đó. (Đã xác nhận qua MySQL
   MCP 2026-07-21: INBOUND từ `return-reports/confirm` hiện ghi `order_id = NULL` nên không lẫn vào
   công thức; nếu sau này bước confirm đó bắt đầu set `order_id` thì công thức vẫn đúng ngữ nghĩa —
   đồ đã về kho thì được phép xuất lại.)
2. `delta = quantity (mới, theo báo giá) − net_exported`.
3. `delta > 0` (cần xuất bù): khóa dòng `inventory` (SELECT ... FOR UPDATE qua `prisma.$transaction`),
   kiểm tra `quantity_available >= delta` — thiếu ở **bất kỳ** dòng nào → rollback **toàn bộ
   transaction (kể cả bước 1)**, trả 400 kèm danh sách thiếu (không đồng bộ nửa vời, không xuất nửa
   đơn). Đủ thì `quantity_available -= delta`, `quantity_reserved += delta`, ghi 1 movement
   `OUTBOUND` (`order_id`, `quantity = delta`, `performed_by = userId` từ JWT, notes: "Xuất thiết bị
   theo báo giá {quotationCode}" + notes tùy chọn từ body).
4. `delta < 0` (báo giá giảm/bỏ hạng mục đã xuất): `quantity_available += |delta|`,
   `quantity_reserved = GREATEST(0, quantity_reserved - |delta|)`, ghi 1 movement `INBOUND`
   (`order_id`, `quantity = |delta|`, notes: "Thu hồi chênh lệch do đồng bộ báo giá {quotationCode}").
5. `delta = 0`: bỏ qua, không ghi movement.

Lưu ý bước 2 phải chạy cho cả **item đã bị DELETE khỏi đơn ở bước 1 nhưng từng xuất kho**
(`net_exported > 0`, quantity mới = 0 → delta âm, thu hồi toàn bộ) — vòng lặp phải đi trên hợp
(union) của {item trong báo giá} ∪ {item có movement gắn order này}, không chỉ trên `order_items`
sau đồng bộ.

**Bước 3 — cờ mức đơn**: nếu có ≥ 1 movement được ghi ở bước 2 → set `picked_up_at = NOW()`,
`picked_up_by = userId` (ngữ nghĩa mới: **lần xuất/đồng bộ gần nhất**, được phép ghi đè giá trị cũ).
Nếu không có movement nào (no-op) → giữ nguyên `picked_up_at`/`picked_up_by` cũ.

Dòng `source = 'SUPPLIER'` không đụng `inventory` (đồ thuê ngoài, theo dõi ở `supplier_transactions`)
— trả về ở `skippedSupplierItems` như v1.

### 4.2. Điều kiện & mã lỗi (v2 — bảng này THAY THẾ bảng v1)

| Điều kiện | Lỗi |
|---|---|
| Đơn không tồn tại | 404 |
| Đơn ở trạng thái kết thúc (`CANCELLED`/`COMPLETED`) | 409 |
| `orders.quotation_id IS NULL` (đơn chưa liên kết báo giá) | 409 "Đơn chưa liên kết báo giá" |
| Tồn kho không đủ để xuất bù ≥ 1 dòng `INTERNAL` | 400 kèm `details: { items: [{ itemId, itemName, required, available }] }` — `required` là **phần cần xuất THÊM (delta)**, không phải tổng SL của dòng |
| Không phải MANAGER | 403 |

**BỎ hẳn lỗi 409 "Đơn hàng đã xuất thiết bị trước đó"** của v1 (cùng 2 class `AlreadyExportedError`
và check `existing.pickedUpAt` trong `order.service.ts`/`order.repository.ts`) — chạy lặp lại giờ là
hành vi hợp lệ. Chống double-click/2 người bấm cùng lúc đã có transaction + FOR UPDATE lo (2 request
chạy tuần tự, request sau thấy delta = 0 → no-op), không cần cờ chặn nữa.

Các nới lỏng chủ đích của v1 vẫn giữ nguyên: không yêu cầu `order_status ∈ {CONFIRMED, IN_PROGRESS}`
(chấp nhận `NEW`), không yêu cầu `prepared_qty >= quantity`. Endpoint cũ `picklist/picked-up` giữ
nguyên hành vi chặt cho màn Pick-list.

### 4.3. Response 200 (v2)

```jsonc
{
  "data": {
    "orderId": "…",
    "orderCode": "ORD-013",
    "syncedQuotationId": "…",          // (mới) báo giá nguồn đã đồng bộ theo
    "syncedQuotationCode": "QUO-016",  // (mới)
    "pickedUpAt": "2026-07-21T12:00:00.000Z",
    "pickedUpBy": "…",
    "movements": [
      // (đổi) chỉ chứa các movement THẬT SỰ ghi ở lần chạy này (delta ≠ 0),
      // movementType giờ có thể là OUTBOUND (xuất bù) hoặc INBOUND (thu hồi chênh lệch)
      { "itemId": "…", "itemName": "Loa JBL 1000W", "quantity": 8, "movementType": "OUTBOUND" }
    ],
    "skippedSupplierItems": [ { "itemId": "…", "itemName": "…", "quantity": 8 } ],
    "unchanged": false                 // (mới) true khi no-op — không có movement, items không đổi
  }
}
```

`skippedSupplierItems` liệt kê các dòng `source = 'SUPPLIER'` không trừ kho — FE hiện chú thích nhỏ
trong toast/tab nếu muốn.

## 5. Phía FE (để đối chiếu, không phải việc của Backend)

1. Nút chỉ render khi `quotation.status === 'APPROVED' && quotation.linkedOrderId != null`
   (cả 2 field đã có sẵn trong `GET /quotations/:id`). **(v2)** Nút bấm lại được sau khi đã xuất —
   không cần disable theo trạng thái đã-xuất.
2. Bấm → `POST /api/v1/orders/{linkedOrderId}/export-equipment`.
3. 200 có movement → toast "Xuất thiết bị thành công" → điều hướng trang chi tiết đơn, tab "Thiết bị
   & Kho hàng" (`?tab=items`). Tab này đọc lại `GET /orders/:id` — sau bước 4.1-1, danh sách hiển thị
   khớp y hệt báo giá; cột "Đã bàn giao" vẫn theo `prepared_qty` (không đổi nghĩa); lịch sử xuất/thu
   hồi chênh lệch xem qua `GET /inventory/movements?orderId=…` nếu cần.
4. **(v2)** 200 với `unchanged: true` → toast trung tính "Đơn đã khớp báo giá, không có gì cần xuất
   thêm" + vẫn điều hướng. (Nhánh 409 "đã xuất trước đó" của v1 không còn tồn tại — FE gỡ xử lý riêng
   nhánh này sau khi Backend lên v2.)
5. 400 thiếu tồn kho → hiện danh sách item thiếu từ `details.items` (`required` = phần cần xuất
   thêm), không điều hướng.

## 6. Tổng hợp việc Backend cần làm (v2 — trên nền code v1 ĐÃ implement trong
`order.service.ts` `exportEquipment` / `order.repository.ts` `exportEquipment` / `order.export.test.ts`)

1. **[Sửa]** `exportEquipment` service/repository — thêm bước đồng bộ `order_items` từ
   `quotation_items` của `orders.quotation_id` (mục 4.1 bước 0-1) TRƯỚC khi xử lý kho; đổi phần trừ
   kho từ "xuất toàn bộ quantity" sang "xuất bù/thu hồi theo delta so với movement đã có" (mục 4.1
   bước 2, nhớ case item bị xóa khỏi báo giá nhưng đã xuất → thu hồi INBOUND).
2. **[Xóa]** check idempotency `existing.pickedUpAt` + `AlreadyExportedError` + mã lỗi 409 tương ứng;
   **[Thêm]** check 409 "Đơn chưa liên kết báo giá" khi `quotation_id IS NULL` (mục 4.2).
3. **[Sửa]** response theo mục 4.3: thêm `syncedQuotationId`/`syncedQuotationCode`/`unchanged`;
   `movements` chỉ chứa movement thật của lần chạy (OUTBOUND lẫn INBOUND), không suy từ danh sách
   `internalLines` như v1. `picked_up_at`/`picked_up_by` chỉ ghi đè khi có movement (mục 4.1 bước 3).
4. **[Sửa test]** `order.export.test.ts`: bỏ test 409-đã-xuất; thêm test (a) lần 1 xuất đủ theo báo
   giá, (b) sửa báo giá thêm hạng mục → chạy lại chỉ xuất bù đúng delta, (c) sửa báo giá bớt/xóa hạng
   mục đã xuất → thu hồi INBOUND đúng delta + `quantity_reserved` giảm tương ứng, (d) chạy lại khi
   không đổi → `unchanged: true`, không movement mới, `picked_up_at` giữ nguyên, (e) thiếu kho khi
   xuất bù → 400 + rollback cả phần đồng bộ items.
5. **[Rà lại — giữ nguyên từ v1, vẫn chưa làm]** `PUT /inventory/return-reports/:reportId/confirm` —
   khi hoàn kho `INBOUND` cho đơn đã export, trừ `quantity_reserved` tương ứng (hiện confirm chỉ cộng
   `quantity_available`, và ghi movement với `order_id = NULL` — nếu sửa, cân nhắc set luôn `order_id`
   để công thức `net_exported` mục 4.1 phản ánh đúng đồ đã về kho).
6. **[Không đụng]** `GET /quotations/:id` (đã đủ `linkedOrderId`), `PUT /orders/:orderId/picklist/picked-up`
   (giữ nguyên cho màn Pick-list — chỉ lưu ý ngữ nghĩa `picked_up_at` giờ là "lần xuất gần nhất", xem
   ghi chú đã bổ sung ở `docs/picklistxuatkho_api.md` mục 8), schema DB (không cần migration).

## 7. BUG sau khi lên v2 (2026-07-21) — Prisma transaction timeout với đơn ≥ 3 hạng mục

Tái hiện thật bằng curl trên ORD-002/QUO-003 (3 hạng mục, đơn chưa có `order_items`):

```
HTTP 400 {"error":{"code":"BAD_REQUEST","message":"Invalid request","details":
"Invalid `tx.order.findUnique()` invocation in .../order.repository.ts:560
Transaction API error: Transaction already closed: ... The timeout for this transaction was
5000 ms, however 5026 ms passed since the start of the transaction."}}
```

`prisma.$transaction(async (tx) => {...})` ở `order.repository.ts` dòng 394 đang dùng **timeout mặc
định 5000ms**; tổng số round-trip trong transaction (đồng bộ từng dòng items + groupBy movement +
update inventory + create movement từng item + `findUnique` cuối với `detailInclude` nặng) vượt 5s
ngay từ đơn 3 hạng mục → transaction bị hủy, rơi vào nhánh Prisma-error chung của middleware, FE chỉ
nhận "Invalid request". (ORD-001 1 hạng mục chạy lọt là do may mắn dưới ngưỡng.) Cần sửa:

1. **Bắt buộc**: truyền options cho transaction — `prisma.$transaction(async (tx) => {...},
   { timeout: 20000, maxWait: 5000 })`.
2. **Nên làm** (giảm hẳn thời gian giữ transaction, không chỉ nới ngưỡng):
   - Chuyển `findUnique` cuối cùng (kèm `detailInclude` — chỉ đọc để build response) **ra ngoài
     transaction**, chạy sau khi commit.
   - Gộp các `create` movement thành 1 `tx.inventoryMovement.createMany`, các INSERT dòng
     `order_items` mới thành 1 `createMany`.
3. Thêm test cho case đơn nhiều hạng mục (≥ 5 dòng) để chặn tái diễn.

## 8. Cập nhật 2026-08-03 — ĐẢO NGƯỢC mục 4.1 Bước 2: bỏ hẳn trừ tồn kho thật khỏi "Xuất thiết bị"

**Nguyên nhân đổi**: phát hiện qua case thật ORD `737a64cf-...` — báo giá liên kết yêu cầu 300
"Bàn hội nghị chữ nhật 1m2" nhưng kho khả dụng chỉ 137 → endpoint (đúng theo mục 4.1 Bước 2 v2) chặn
400 "Tồn kho không đủ để xuất thiết bị", không xuất được. Người dùng xác nhận trực tiếp: thiết kế Bước
2 (kiểm tra + trừ `inventory.quantity_available`, ghi `inventory_movements`) là **sai** — nút "Xuất
thiết bị" **chỉ nên đồng bộ dữ liệu** `order_items` theo `quotation_items`, không được phép chặn hay
đụng tới tồn kho thật.

### 8.1. Vì sao bỏ Bước 2 — quyết định có chủ đích, ngược lại (at)/(au) đã chốt trước đó

`docs/more-require.md` mục (at)/(au) (2026-07-31, đối chiếu trực tiếp source Backend thật + test bằng
`curl`) từng kết luận rất rõ ràng và có vẻ hợp lý: hệ thống có **2 cơ chế song song, khác mục đích**—
(1) khóa tồn kho theo ngày (`getLockedQuantityByDate` ở `inventory.repository.ts`) tính **tự động, ảo,
theo khoảng ngày** giữa lịch trình SETUP ("Lắp đặt thiết bị") và COLLECT ("Thu hồi thiết bị") của từng
đơn, không đụng `quantity_total`, không cần API riêng để khóa/nhả; và (2) `export-equipment` trừ
**thật, vĩnh viễn** vào `quantity_total` — đại diện đúng lúc thiết bị **rời kho vật lý**, cố ý tách
biệt khỏi (1) vì (1) chỉ là "đã lên lịch dùng", chưa chắc đã thật sự mang đi. Theo đúng lý này thì lỗi
400 vừa gặp (báo giá cần 300, kho 137) là **hành vi đúng thiết kế**, không phải bug.

**Người dùng đã được nhắc lại đầy đủ lý do trên (2026-08-03) và vẫn xác nhận muốn đổi lại** — bỏ hẳn
cơ chế (2), chấp nhận hệ thống không còn nơi nào ghi nhận "thiết bị đã thật sự rời kho" một cách tách
biệt với "đã lên lịch dùng" nữa (hệ quả đầy đủ xem mục 8.3). Đây là quyết định nghiệp vụ của người
dùng, ghi nhận lại nguyên trạng để không mất dấu lý do đổi qua đổi lại nhiều lần ở khu vực này.

### 8.2. Thiết kế mới — endpoint chỉ còn đúng Bước 1 (đồng bộ), bỏ hẳn Bước 2

- **Giữ nguyên** mục 4.1 Bước 0 (xác định báo giá nguồn, 409 nếu `quotation_id IS NULL`) và Bước 1
  (đồng bộ `order_items` theo `quotation_items`: INSERT/UPDATE/DELETE theo `item_id`, giữ nguyên
  `source` dòng đã có, `prepared_qty = LEAST(prepared_qty, quantity mới)`).
- **Bỏ hẳn** Bước 2 (mục 4.1) — không còn tính `net_exported`/`delta`, không còn `SELECT ... FOR
  UPDATE` trên `inventory`, không còn `quantity_available -= delta`/`quantity_reserved += delta`,
  **không ghi `inventory_movements`** cho hành động này nữa.
- **Bước 3 (cờ mức đơn) — đổi điều kiện set `picked_up_at`/`picked_up_by`**: vì không còn movement
  nào được tạo ở endpoint này để làm căn cứ, đổi điều kiện sang **"có ≥ 1 thay đổi thực sự ở Bước 1"**
  (có dòng `order_items` được INSERT, UPDATE với `quantity` khác giá trị cũ, hoặc DELETE) — không có
  thay đổi nào (đơn đã khớp báo giá) → giữ nguyên `picked_up_at`/`picked_up_by` cũ, coi là `unchanged:
  true` (giữ đúng ngữ nghĩa "bấm bao nhiêu lần cũng an toàn" của mục CẬP NHẬT LẦN 2).
- **Mã lỗi (mục 4.2) — bỏ hẳn dòng** "Tồn kho không đủ để xuất bù ≥ 1 dòng `INTERNAL`" (400 +
  `details.items`). Các dòng lỗi còn lại (404 đơn không tồn tại, 409 trạng thái kết thúc, 409 chưa
  liên kết báo giá, 403 không phải MANAGER) giữ nguyên.
- **Response (mục 4.3)** — `movements` giờ **luôn là mảng rỗng** (không còn nhánh nào tạo movement ở
  endpoint này); giữ `syncedQuotationId`/`syncedQuotationCode`/`pickedUpAt`/`pickedUpBy`/`unchanged`/
  `skippedSupplierItems` như cũ, nhưng `unchanged` giờ theo nghĩa mới ở trên (Bước 1 không đổi gì),
  không còn dựa vào "có movement hay không".
- **Dòng `source = 'SUPPLIER'`**: không đổi — vẫn không đụng `inventory`/`supplier_transactions` ở
  endpoint này, vẫn trả về `skippedSupplierItems` như cũ (đơn giản vì hàng thuê ngoài vốn dĩ chưa từng
  nằm trong Bước 2 sắp bị bỏ).

### 8.3. Hệ quả thật — từ nay hệ thống KHÔNG còn nơi nào trừ `quantity_total` thật nữa, chỉ còn khóa ảo theo ngày

Khác với suy nghĩ ban đầu ("chỗ khác đã lo tồn kho rồi") — sau khi đọc lại đúng mục (at)/(au), thật ra
**chỉ có 2 cơ chế đụng tới tồn kho trong toàn hệ thống**: khóa ảo theo ngày
(`getLockedQuantityByDate`, không đụng `quantity_total`, tự hết hạn khi qua ngày COLLECT) và chính
`export-equipment` (Bước 2 cũ, trừ thật `quantity_total`). Bỏ hẳn Bước 2 nghĩa là **không còn hành
động nào trong hệ thống trừ thật `quantity_total`** — số tồn kho vật lý (`items.quantity_total`) từ
nay chỉ giảm qua con đường duy nhất còn lại: `POST /inventory/adjust` (Admin chỉnh tay) hoặc chưa có
đường nào khác. Đây là đánh đổi người dùng đã biết và chấp nhận (xem mục 8.1) — không phải tác dụng
phụ ngoài ý muốn. Nếu sau này cần lại 1 mốc "đã thực xuất vật lý khỏi kho" tách biệt với "đã lên lịch
dùng", phải thiết kế lại từ đầu (có thể gắn vào tab "Chuẩn bị kho",
`docs/thietbikhohang_api.md` mục 2b "Xác nhận đã chuẩn bị xong", hoặc 1 nút riêng khác) — ngoài phạm
vi sửa lại của mục 8 này, cần Product xác nhận lại khi có nhu cầu thật.

### 8.4. Tác dụng phụ tích cực — có thể giải quyết luôn BUG mục 7

Bug transaction timeout ở mục 7 phần lớn đến từ khối lượng round-trip của chính Bước 2 (khóa dòng
`inventory` FOR UPDATE, tính `net_exported` qua `groupBy` trên `inventory_movements`, tạo movement
từng item). Bỏ hẳn Bước 2 nhiều khả năng đưa transaction về dưới ngưỡng 5s mặc định mà không cần nới
timeout — nhưng vẫn giữ khuyến nghị tách `findUnique` cuối ra ngoài transaction (mục 7, điểm 2) vì đó
là tối ưu độc lập, không phụ thuộc việc có Bước 2 hay không; cần Backend đo lại thời gian thực tế sau
khi bỏ Bước 2 trước khi quyết định có cần áp `{ timeout, maxWait }` nữa không.

### 8.5. Đã hoàn tất (2026-08-03) — cả Backend lẫn FE đã sửa xong theo mục 8.2

- **Backend** (`D:\sep490-backend-api`): `order.repository.ts` (bỏ hẳn Bước 2, đổi điều kiện
  `pickedUpAt` sang `itemsChanged`, `movements` luôn trả rỗng, xoá class `InsufficientStockError`),
  `order.service.ts` (bỏ tham số `force`, bỏ nhánh catch `InsufficientStockError`),
  `order.controller.ts`/`order.validators.ts` (bỏ field `force` khỏi body), `order.routes.ts` (cập nhật
  lại comment). Test:
  viết lại `order.export.integration.test.ts` (3 case, không còn case thiếu-tồn-kho/force), xoá 1 case
  lỗi thời ở `order.export.test.ts`. `npx tsc --noEmit` sạch, `npx jest src/modules/sales/` 139/139 pass.
- **FE**: `src/app/manager/quotations/[id]/page.tsx` — bỏ hẳn state `stockShortage`, modal "Tồn kho
  không đủ để xuất thiết bị", tham số `force` ở `handleExportEquipment`. `src/app/admin/inventory/
  outbound/page.tsx` — bỏ nhánh hiển thị `details.items`. `src/types/order.ts` — bỏ `force` khỏi
  `ExportEquipmentPayload`, xoá hẳn `ExportEquipmentShortageItem`. `src/services/order.service.ts` —
  cập nhật lại comment JSDoc. `npx tsc --noEmit` ở FE không phát sinh lỗi mới ở các file đã sửa (các lỗi
  còn lại trong toàn repo là lỗi có sẵn từ trước, không liên quan tới đợt sửa này).
