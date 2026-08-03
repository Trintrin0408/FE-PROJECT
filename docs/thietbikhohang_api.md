# API cho tab "Thiết bị & Kho hàng" (trang chi tiết đơn đặt)

> Phạm vi tài liệu này: **chỉ** tab `items` ("Thiết bị & Kho hàng") của trang chi tiết 1 đơn đặt —
> bảng "Quản lý phân bổ thiết bị & chuẩn bị kho" (đúng ảnh mẫu cung cấp: cột Hạng mục thiết bị/Dịch
> vụ, Nguồn, SL đặt, Đã bàn giao, Người phụ trách, Giá tiền + dòng tổng "Tổng cộng tài chính đơn
> hàng") và modal "Phiếu chuẩn bị (Picklist)" mở từ nút "Xem phiếu chuẩn bị" trên cùng tab — 2 mặt
> màn hình duy nhất thuộc phạm vi "Thiết bị & Kho hàng" trên trang tiến độ sự kiện. Trang dùng chung
> layout ở cả `/manager/orders/[id]` và `/admin/orders_audit/[id]` (mirror 1:1, chỉ khác tiền tố
> route). **Đã chốt (2026-07-20)**: bản Admin phải read-only ở tầng **backend** (403 cho mọi endpoint
> ghi ở mục 2 nếu role gọi là Admin), không chỉ ẩn UI phía FE — khớp đúng nguyên tắc "Admin không xử
> lý vận hành hằng ngày" (CLAUDE.md mục "Vai trò & phân quyền") và câu hỏi đã nêu chung ở
> `docs/tiendosukien_api.md` mục 0. FE hiện tại cả 2 bản đều có input chỉnh sửa được
> (`admin/orders_audit/[id]/page.tsx` dòng 242/874) — cần bỏ input chỉnh sửa ở bản Admin khi nối API
> thật, không chỉ dựa vào backend chặn ngầm.
>
> **Không** bao gồm 6 mốc timeline của tab "Tiến độ sự kiện" (đã có tài liệu riêng ở
> [`docs/tiendosukien_api.md`](tiendosukien_api.md)) hay tab "Tổng quan sự kiện"
> ([`docs/tongquansukien_api.md`](tongquansukien_api.md)). Phát hiện "join thêm `item.category` vào
> `orderItems`" đã chốt ở `docs/tongquansukien_api.md` mục 8/9.1 áp dụng trực tiếp cho bảng chính của
> tab này — tham chiếu lại, không lặp lại toàn bộ phân tích.
>
> Cũng **không** bao gồm trang "Pick-list xuất kho" độc lập (`/manager/inventory/picklists`) — trang
> đó tổng hợp picklist của **mọi** đơn (không phải 1 đơn), tái dùng đúng dữ liệu `items`/`preparedQty`
> của tab này nhưng thêm khái niệm `pickedUpAt` (đánh dấu "đã xuất kho" cho cả đơn) **không xuất hiện
> ở tab đang xét** — nêu lại ở mục 6 dưới đây như 1 phụ thuộc cần biết, nhưng để tài liệu hoá đầy đủ
> cho 1 tài liệu riêng sau nếu cần.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/[id]/page.tsx` (dòng 88-105 khai báo `AdminOrderLineItem`/
>   `PicklistMaterial`/`PICKLIST_TEMPLATES`, dòng 350-374 handler
>   `handleItemPreparedQtyChange`/`handleItemPreparedByChange`/`handleOpenPicklist`, dòng 1020-1097
>   JSX bảng chính, dòng 1450-1553 JSX modal Picklist), `src/app/admin/orders_audit/[id]/page.tsx`
>   (bản mirror), `src/mocks/db/orders.ts` (`AdminOrderLineItem`, `OrderItemSource`,
>   `ORDER_ITEM_SOURCE_META`, `updateAdminOrderItem`, `getOrCreateOrderPicklist`,
>   `getAdminOrderPicklists`, `markAdminOrderPickedUp`), `src/app/manager/inventory/picklists/page.tsx`,
>   `src/types/order.ts`, `src/types/inventory.ts`, `src/services/order.service.ts`,
>   `src/services/inventory.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/tiendosukien_api.md`) — `SHOW CREATE TABLE order_items/items/item_types/item_categories/
>   orders/users/quotation_items/supplier_transactions/supplier_transaction_items/
>   change_request_items`; `SHOW TABLES` (24 bảng — **không có** bảng `inventory`/
>   `inventory_movements` nào); `_prisma_migrations` chỉ có đúng 1 migration đã chạy
>   (`20260718230757_init_core`); dữ liệu mẫu thật: `order_items` của `ORD-001` có đúng 2 dòng, cả 2
>   `source = 'INTERNAL'`, `prepared_qty = 0` — "Loa JBL 1000W" (category "Âm thanh", 2 cái,
>   500.000đ/cái) và "Đèn Beam 230" (category "Ánh sáng", 2 cái, 300.000đ/cái).
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu từng file `types/*.ts` (đối
>   chiếu trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` của backend ngày 2026-07-06) làm
>   căn cứ chính, giống các tài liệu trước.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- **Đã chốt (2026-07-20, xem mục 4)**: 2 hành động ghi của tab này có 2 chủ thể khác nhau, không còn
  gộp chung "chỉ Manager được làm" như các tab khác:
  - Cập nhật `preparedQty`/`preparedBy` từng dòng (mục 2a) — **Leader Staff** gọi qua mobile app
    (ngoài phạm vi repo web này), backend chỉ nên chấp nhận role `LEADER` đã được gán vào
    `schedule_plan_assignees` của đơn tương ứng.
  - Xác nhận "đã chuẩn bị xong" cấp đơn (mục 2b) — **Manager** gọi trên web, theo đúng CLAUDE.md mục 1.
  - Admin (`/admin/orders_audit/[id]`) — read-only, backend trả 403 cho cả 2 endpoint trên nếu role
    gọi là `ADMIN`.

## 1. Bảng chính "Quản lý phân bổ thiết bị & chuẩn bị kho"

| Cột UI | Nguồn thật | Ghi chú |
|---|---|---|
| Hạng mục thiết bị/Dịch vụ (tiêu đề đậm + mô tả phụ) | `GET /api/v1/orders/:id` → `orderItems[].item.category.categoryName` (đậm) + `orderItems[].item.itemName` (phụ) | **Cần đúng quyết định đã chốt ở `docs/tongquansukien_api.md` mục 8/9.1** (hướng B) — mở rộng `OrderItem.item` từ `{ itemName }` thành `{ itemName, category: { categoryId, categoryName } }` (join 4 cấp `order_items → items → item_types → item_categories` phía backend). Dữ liệu mẫu thật đúng đối tượng: category "Âm thanh"/"Ánh sáng", item name "Loa JBL 1000W"/"Đèn Beam 230" — khớp bố cục tiêu đề đậm/mô tả phụ của UI nếu đảo vai trò `category`↔`description` so với mock hiện tại (mock đang lấy `item.category` là tên nhóm tự bịa kiểu "Tiệc bàn"/"Trang trí sảnh", `item.description` là câu mô tả dài — dữ liệu thật không có câu mô tả dài tương ứng, chỉ có `itemName`, nên khi nối thật: dòng đậm = `category.categoryName`, dòng phụ = `itemName`). |
| Nguồn (badge Kho nhà/Thuê ngoài) | `orderItems[].source` (`INTERNAL`/`SUPPLIER`) | Khớp trực tiếp `order_items.source` — **đã có sẵn**, không cần thay đổi backend. Badge label FE (`ORDER_ITEM_SOURCE_META`) map `internal→'Kho nhà'`, `external→'Thuê ngoài'` bằng chữ thường (`'internal'`/`'external'`) — lệch enum thật viết hoa (`'INTERNAL'`/`'SUPPLIER'`, không phải `'EXTERNAL'`) và tên giá trị thứ 2 khác nhau (`external` vs `SUPPLIER`) — cần sửa lại `OrderItemSource`/`ORDER_ITEM_SOURCE_META` phía FE cho khớp enum thật khi nối API. |
| SL đặt | `orderItems[].quantity` | Khớp trực tiếp `order_items.quantity`. |
| Đã bàn giao | `orderItems[].preparedQty` | **Đã chốt (mục 4, hướng B)**: đổi từ input số chỉnh trực tiếp (mock hiện tại) sang **hiển thị read-only** trên web Manager/Admin — giá trị do Leader Staff cập nhật qua mobile (mục 2a). Đọc khớp trực tiếp `order_items.prepared_qty` (**cột đã tồn tại sẵn trong DB thật**, mặc định 0). |
| Người phụ trách | **Chưa có cột thật tương ứng, xem mục 3** | **Đã chốt (mục 4, hướng B)**: cũng đổi sang hiển thị read-only trên web như "Đã bàn giao" — cùng lý do. |
| Giá tiền | `orderItems[].subtotal` | **Không nên tự tính `unitPrice * quantity` ở client** như mock hiện tại (dòng 1085) — `order_items.subtotal` đã là cột lưu sẵn phía backend (decimal, tính đúng tại thời điểm tạo/sửa item), `types/order.ts` đã khai `OrderItem.subtotal?: number` sẵn nhưng FE chưa dùng tới. Đọc thẳng field này, theo đúng nguyên tắc "không tự cộng trừ số liệu tài chính ở FE" đã áp dụng nhất quán ở các tài liệu trước (`docs/tiendosukien_api.md` mục 3.1/6). |
| Tổng cộng tài chính đơn hàng | `GET /api/v1/orders/:id` → `totalAmount` | Khớp trực tiếp `orders.total_amount`, không cần tự cộng lại từ `orderItems`. |

## 2. Endpoint ghi mới — 2 endpoint tách vai trò theo hướng đã chốt ở mục 4

**Chưa có endpoint nào phù hợp trong `order.service.ts` hiện tại.** `PUT /api/v1/orders/:id/items`
(`updateOrderItems`, đã có sẵn) có ngữ nghĩa "thay TOÀN BỘ danh sách item" (xoá hết rồi tạo lại theo
comment dòng 41 `order.service.ts`) — không phù hợp cho cả 2 thao tác dưới đây (sai ngữ nghĩa "cập nhật
tiến độ" vs "sửa lại đơn hàng", và rủi ro ghi đè nhầm dữ liệu dòng khác nếu gửi lại toàn mảng mỗi lần).

### 2a. Leader Staff (mobile, ngoài phạm vi repo web) — cập nhật tiến độ chuẩn bị từng dòng

```
PATCH /api/v1/orders/:orderId/items/:orderItemId
Body: { preparedQty?: number, preparedBy?: string }
Response: OrderItem đã cập nhật (hoặc 204)
```

Theo đúng phong cách `PATCH .../live-checklist` đã chốt ở `docs/tiendosukien_api.md` mục 5 (cập nhật 1
phần dữ liệu nhỏ, tần suất cao, không phải "sửa đơn"). Ràng buộc backend nên áp dụng: `preparedQty`
không âm và không vượt `quantity` của chính dòng đó (UI mock hiện tự kẹp `Math.min(value, max)` phía
client, dòng 351 `orders.ts` — nhưng validate ở FE không đủ, backend vẫn cần chặn lại). Quyền gọi:
`LEADER` đã được gán vào `schedule_plan_assignees` của đơn (theo mục 0) — chi tiết UI mobile ngoài
phạm vi tài liệu này, chỉ định nghĩa hợp đồng API phía backend.

### 2b. Manager (web) — xác nhận đã chuẩn bị xong cấp đơn

Web tab này (sau khi đổi UI theo mục 4) cần **1 nút xác nhận mới, chưa có trong mock hiện tại**
("Xác nhận đã chuẩn bị xong" hoặc tương đương) để Manager xác nhận toàn bộ tiến độ Leader Staff đã ghi
nhận là đúng, trước khi cho phép xuất kho — cùng mô hình "xác nhận cấp trên" đã dùng cho
`settlements`/`deposits` ở các tab khác (`docs/tiendosukien_api.md` mục 3.1/6), không phải xác nhận
từng dòng riêng lẻ vì UI hiện chỉ có 1 nút tổng cho cả picklist.

```
PUT /api/v1/orders/:orderId/items/confirm-prepared
Body: { notes?: string }
Response: Order đã cập nhật (hoặc 204)
```

**Cần thêm 2 cột mới trên `orders`**: `items_confirmed_at TIMESTAMP NULL`, `items_confirmed_by
VARCHAR(36) NULL` (FK `users.user_id`) — cùng pattern đã chốt cho "Đóng đơn hàng"
(`docs/tiendosukien_api.md` mục 7, cột nullable + endpoint riêng thay vì thêm enum mới). Điều kiện hợp
lệ phía backend: chỉ cho xác nhận khi `preparedQty = quantity` ở mọi dòng (100% đã chuẩn bị xong) —
khớp đúng điều kiện `isAllPrepared` đang dùng ở trang "Pick-list xuất kho" (mục 6).

## 3. Cột mới cần thêm — "Người phụ trách" (`preparedBy`)

**Không có cột nào trong `order_items` lưu tên người/đơn vị phụ trách chuẩn bị** — đối chiếu
`SHOW CREATE TABLE order_items` xác nhận chỉ có `source`/`prepared_qty`/`notes` (text ghi chú chung,
không phải tên người phụ trách), không có `prepared_by` hay `prepared_by_user_id`. Theo hướng đã chốt
ở mục 4, cột này giờ được ghi bởi Leader Staff qua endpoint mục 2a, web chỉ đọc — nhưng vẫn cần đúng
1 cột lưu trữ dưới đây bất kể ai ghi.

**Đề xuất hướng (A)** — thêm cột free-text `order_items.prepared_by VARCHAR(255) NULL`, **không**
dùng FK `users.user_id` (khác hẳn pattern FK đang dùng ở `schedule_plans.created_by`/
`schedule_plan_assignees.user_id`). Lý do: dữ liệu mẫu thực tế của trường này trong mock hiện tại là
tên **tổ/đơn vị**, không phải tên 1 tài khoản hệ thống cụ thể — ví dụ `"Kho bếp trung tâm"`,
`"Tổ trang trí"`, `"Đối tác Âm thanh Gold"` (dòng 192/203/214 `mocks/db/orders.ts`). Đặc biệt giá trị
cuối là tên 1 Supplier — mà theo CLAUDE.md mục "Vai trò & phân quyền", **Supplier không có tài khoản
đăng nhập** nên không thể có `user_id` để gán FK. Ép field này thành FK `users` sẽ chặn hẳn trường hợp
"người phụ trách là 1 đối tác/tổ đội ngoài hệ thống tài khoản", vốn là tình huống thật đơn giản cần hỗ
trợ ở đây. Hướng (B) (FK `users.user_id`, chỉ cho phép chọn nhân sự nội bộ) bị loại vì không khớp dữ
liệu mẫu thật và thu hẹp use-case so với UI hiện tại (input text tự do, không phải dropdown chọn nhân
viên).

## 4. Đã chốt — web chỉ hiển thị + xác nhận, Leader Staff (mobile) mới là nơi ghi nhận tiến độ chuẩn bị kho

CLAUDE.md mục "Vai trò & phân quyền" ghi rõ: **"xuất/nhận/trả kho nội bộ"** là 1 trong các loại dữ
liệu hiện trường mà **"Leader Staff (mobile) ghi nhận trước, Manager chỉ xác nhận (confirm) trên
web"**. Mock hiện tại lại để **Manager tự gõ trực tiếp** số lượng đã bàn giao và tên người phụ trách
ngay trên web (`onChange` cập nhật tức thời, không qua bước "duyệt" nào) — sai với nguyên tắc này.

**Đã chốt (2026-07-20) — đi đúng theo CLAUDE.md (hướng B)**: việc chuẩn bị/xuất kho do Leader Staff
ghi nhận qua mobile app (ngoài phạm vi repo web này, dùng endpoint mục 2a). Tab "Thiết bị & Kho hàng"
trên web (cả Manager lẫn Admin) đổi 2 cột "Đã bàn giao"/"Người phụ trách" từ input chỉnh trực tiếp
sang **hiển thị read-only** (xem lại mục 1), kèm thêm 1 nút xác nhận tổng quát "Xác nhận đã chuẩn bị
xong" chỉ Manager bấm được (mục 2b) sau khi Leader Staff đã báo đủ 100% qua mobile. Lý do chọn (B) dù
tốn công sửa UI hơn hướng giữ nguyên input trực tiếp: đây không phải chi tiết trang trí UI như các quyết
định "giữ nguyên luồng cho rẻ" ở tài liệu khác (vd khảo sát hiện trường, `docs/tiendosukien_api.md`
mục 3.2) — nó đụng thẳng ranh giới phân quyền cốt lõi đã ghi rõ trong CLAUDE.md (Admin/Manager không
trực tiếp ghi nhận dữ liệu hiện trường), nên ưu tiên đúng kiến trúc thay vì chi phí ngắn hạn.

**Việc FE cần làm khi nối API thật** (đánh dấu ngoài phạm vi "chỉ định nghĩa API" của tài liệu này
nhưng ghi lại để không quên): đổi 2 ô input ở dòng 1067-1084 (`orders/[id]/page.tsx`) thành text hiển
thị thường, bỏ `handleItemPreparedQtyChange`/`handleItemPreparedByChange`, thêm 1 nút mới gọi endpoint
mục 2b ở vị trí nút "Xem phiếu chuẩn bị" hiện có.

## 5. Modal "Phiếu chuẩn bị (Picklist)" — không có mô hình BOM/tồn kho thật đứng sau

Modal hiện tại (`PICKLIST_TEMPLATES`, dòng 127-180) tách mỗi hạng mục đơn hàng thành nhiều "vật tư cấu
thành" con (ví dụ "Tiệc bàn" → thêm "Thùng đựng chống sốc", "Dây nguồn chuyên dụng"...) kèm cột "Tồn
kho" hiển thị số khả dụng. **Toàn bộ dữ liệu này 100% dựng sẵn phía FE, không có bảng nào trong DB thật
lưu quan hệ "1 hạng mục cấu thành từ nhiều vật tư con"** (không có bảng kiểu `item_materials`/BOM), và
**cũng không có bảng tồn kho nào tồn tại trong DB hiện tại** để lấy số "Tồn kho" thật — `SHOW TABLES`
chỉ có 24 bảng, không có `inventory`/`inventory_movements`.

Đáng chú ý: `src/services/inventory.service.ts` và `src/types/inventory.ts` **đã có sẵn code** gọi
`GET /api/v1/inventory`, `POST /api/v1/inventory/adjust`, `GET /api/v1/inventory/movements` — comment
đầu file `types/inventory.ts` ghi rõ nguồn là model `Inventory`/`InventoryMovement` trong
`prisma/schema.prisma` của backend. Nhưng đối chiếu DB thật (`_prisma_migrations`) thì **chỉ có đúng 1
migration đã chạy** (`20260718230757_init_core`, hoàn tất `2026-07-19`) và bảng `inventory` **chưa hề
được tạo** — nghĩa là 2 khả năng: (a) model `Inventory` đã viết trong `schema.prisma` nhưng migration
tương ứng chưa chạy trên DB này, hoặc (b) FE đã viết service đón đầu cho 1 API chưa tồn tại.

**Đã chốt (2026-07-20)**: không chặn tiến độ tab này chờ xác nhận model `Inventory` — đi thẳng theo
hướng (A) dưới đây ngay, ẩn cột "Tồn kho" cho tới khi bảng `inventory` thật sự sẵn sàng. Việc chạy
migration cho model này (nếu đã có sẵn trong `schema.prisma`) là việc riêng của Backend, không phụ
thuộc gì vào tab "Thiết bị & Kho hàng" — khi bảng đó lên, chỉ cần bật lại cột "Tồn kho" theo đúng mô tả
dưới đây, không cần sửa gì thêm ở phần còn lại của tài liệu này.

**Đề xuất hướng (A)** — bỏ hẳn phần "vật tư cấu thành" (BOM) dựng sẵn, đơn giản hoá Picklist thành
đúng danh sách `orderItems` đã có (cùng dữ liệu với bảng chính ở mục 1: hạng mục, SL đặt, nguồn, đơn
giá), **không** thêm bảng BOM mới. Cột "Tồn kho" chỉ hiển thị khi (và sau khi) bảng `inventory` được
xác nhận tồn tại thật — đọc qua `GET /api/v1/inventory?itemId=:itemId` (hoặc nếu backend join sẵn vào
`GET /orders/:id`, đọc `orderItems[].item.inventory.quantityAvailable`) cho từng `itemId`; nếu bảng
`inventory` chưa migrate xong, ẩn hẳn cột này thay vì hiển thị số tự bịa như hiện tại (số tồn kho sai
lệch trên 1 phiếu in đưa tổ kho sử dụng thật có thể gây nhầm lẫn vận hành thật, mức rủi ro cao hơn hẳn
các trường hợp mock dữ liệu khác trong tài liệu này). Hướng (B) (xây bảng BOM thật + nhập liệu công
thức cấu thành cho từng loại hạng mục) bị loại vì chi phí triển khai (thêm bảng, thêm màn hình quản trị
công thức, thêm nghiệp vụ mới hoàn toàn) không tương xứng — hiện chưa có yêu cầu nghiệp vụ nào khác
trong CLAUDE.md nhắc tới khái niệm "vật tư cấu thành 1 hạng mục", đây thuần là chi tiết trang trí UI
mock tự thêm vào.

**Mã phiếu** (`PKL-DD0001-01`, hiển thị ở tiêu đề modal) và "Tạo lúc {ngày}" — mock sinh tại client
(`getOrCreateOrderPicklist`, Map trong bộ nhớ, mất khi tải lại trang), **không cần persist thật**: đây
chỉ là nhãn hiển thị/in phiếu, không phải chứng từ cần tra cứu lại nhiều lần hay audit — không đề xuất
thêm bảng `picklists` mới. Backend không cần endpoint riêng cho việc này; FE tự sinh nhãn dạng
`PKL-{orderCode}-01` tại thời điểm mở modal.

Nút "In phiếu" chỉ gọi `window.print()` — không cần API.

## 6. Phụ thuộc liên quan (ngoài phạm vi tài liệu này) — trang "Pick-list xuất kho"

`src/app/manager/inventory/picklists/page.tsx` tổng hợp **mọi** đơn `CONFIRMED`/`IN_PROGRESS` thành 1
danh sách, dùng lại đúng `totalItemsCount`/`preparedItemsCount` (tính từ `orderItems` như mục 1) và
thêm field `pickedUpAt` (đơn đã "Đã xuất kho" hay chưa) — **không có cột thật tương ứng**
(`orders` không có `picked_up_at`). Field này **không xuất hiện ở tab "Thiết bị & Kho hàng"** đang xét
trong tài liệu này, chỉ nêu lại để Backend biết còn 1 gap liên quan cần 1 tài liệu API riêng
(`docs/picklistxuatkho_api.md` hay tương đương) khi tới lượt làm màn hình đó — không đề xuất giải pháp
ở đây vì ngoài phạm vi.

## 7. Tổng hợp — đã chốt hết, Backend có thể implement toàn bộ

Cả 3 điểm trước đây cần Product/Backend xác nhận (Manager nhập trực tiếp hay Leader Staff mobile ghi
nhận; số phận model `Inventory`; quyền ghi của bản Admin) **đã được chốt** trong lần rà soát này
(2026-07-20) — không còn mục nào phải chờ quyết định thêm trước khi Backend bắt đầu code.

### 7.1 Đã chốt — Backend implement theo đúng mô tả ở mục tương ứng

1. **Join `item.category` vào `orderItems`** (mục 1): áp dụng đúng hướng (B) đã chốt ở
   `docs/tongquansukien_api.md` mục 8/9.1 — không cần quyết định lại, chỉ nhắc dùng chung cho tab này.
2. **Đọc thẳng `orderItems[].subtotal`** thay vì tự tính `unitPrice * quantity` ở client (mục 1).
3. **Đổi 2 cột "Đã bàn giao"/"Người phụ trách" thành read-only trên web** (mục 1, 4) — dữ liệu do Leader
   Staff ghi qua mobile (mục 2a), Manager/Admin trên web chỉ xem, không còn input chỉnh trực tiếp.
4. **Thêm endpoint `PATCH /api/v1/orders/:orderId/items/:orderItemId`** `{ preparedQty?, preparedBy? }`
   (mục 2a) — caller là Leader Staff (mobile, ngoài phạm vi repo), cần validate
   `0 ≤ preparedQty ≤ quantity` phía backend, không chỉ dựa vào FE.
5. **Thêm endpoint `PUT /api/v1/orders/:orderId/items/confirm-prepared`** `{ notes? }` (mục 2b) — caller
   là Manager (web), chỉ cho phép khi mọi dòng đã `preparedQty = quantity`; kèm 2 cột mới
   `orders.items_confirmed_at`/`orders.items_confirmed_by`.
6. **Thêm cột `order_items.prepared_by VARCHAR(255) NULL`** (free text, không FK `users`) (mục 3).
7. **Admin (`/admin/orders_audit/[id]`) read-only ở tầng backend** (403 cho mục 2a/2b nếu role là
   `ADMIN`) — không chỉ ẩn UI phía FE (đầu file).
8. **Đơn giản hoá Picklist** (mục 5, hướng A): bỏ hẳn BOM/vật tư cấu thành dựng sẵn, dùng thẳng
   `orderItems` đã có; cột "Tồn kho" ẩn cho tới khi bảng `inventory` sẵn sàng (không chặn phần còn lại
   của tab chờ việc này — xem mục 5); mã phiếu sinh phía client, không cần bảng `picklists` mới.
9. Gọi API qua đúng lớp `services/*.service.ts` (`orderApiService`, cần thêm 2 method mới cho endpoint
   ở mục 2a/2b) theo CLAUDE.md mục 4, không tạo lời gọi `axios`/`fetch` mới trong component.

### 7.2 Việc kỹ thuật thuần phía Backend, không phải quyết định — làm khi rảnh, không chặn tab này

1. **(mục 5)** Xác nhận model `Inventory`/`InventoryMovement` trong `prisma/schema.prisma` đã có hay
   chưa, và chạy migration tương ứng nếu chưa — khi xong chỉ cần bật lại cột "Tồn kho" theo mô tả ở
   mục 5, không ảnh hưởng gì tới các phần khác đã chốt ở mục 7.1.

## 8. Cập nhật 2026-08-03 — `item_components` là BOM thật đang dùng nhưng chưa có route Backend

Tab đã được tách UI thành 2 mục con: **"Thiết bị"** (đọc thẳng `orderItems` như mục 1, cảnh báo thiếu
hàng cố định đúng 2 ngày [ngày liền trước, ngày tổ chức], thuần xem) và **"Chuẩn bị kho"** (giữ nguyên
toàn bộ cơ chế đã mô tả ở mục 1/2/5 — khoảng ngày tùy chỉnh, "Xem phiếu chuẩn bị", "Thuê từ NCC" — nhưng
nổ thêm các hạng mục dạng "gói" xuống từng vật tư/thiết bị vật lý con). Việc nổ "gói" này cần đính chính
lại 1 phần nhận định ở mục 5.

### 8.1. Đính chính mục 5 — bảng BOM CÓ THẬT, khác nhận định cũ

Mục 5 (2026-07-20) kết luận "không có bảng nào trong DB thật lưu quan hệ 1 hạng mục cấu thành từ nhiều
vật tư con" — nhận định này **đã lỗi thời**. Đối chiếu lại trực tiếp qua MySQL MCP (2026-08-03):

- `USER()` = `avnadmin@...`, `@@port` = `28026` — khớp chính xác `DATABASE_URL` trong
  `bnwems-backend-api/.env` (trỏ tới Aiven cloud) → đây đúng là DB thật Backend đang chạy, không phải
  DB rời rạc nào khác.
- `DESCRIBE item_components` xác nhận bảng có thật: `id`, `parent_id`, `child_id`, `quantity` (tất cả
  `varchar(36)`/`int`, cùng kiểu id với `items`/`order_items` hiện có).
- Đã seed dữ liệu thật cho 3 "gói": "Gói Âm Thanh Hội Trường (100-300 khách)" (4× Loa JBL EON715 500W,
  1× Amply Crown XLS2502, 2× Micro Shure SM58, 2× Dây cáp Canon bộ 20m, 1× Bàn mixer Yamaha MG16XU),
  "Gói Ánh Sáng Sân Khấu Tiêu Chuẩn" (4× Đèn Moving Head Wash 19x15W, 4× Truss vuông 290 cây 2m, 2× Đèn
  Beam 230 7R, 8× Đèn Par LED 54x3W), "Gói Âm Thanh Ngoài Trời (500-1000 khách)" (2× Loa Sub JBL
  SRX828S 18inch, 4× Dây cáp Canon bộ 20m, 2× Loa Line Array RCF TTL55A, 1× Vang số DBX DriveRack PA2,
  4× Micro Shure SM58, 1× Bàn mixer Soundcraft Signature 12).
- `_prisma_migrations` trên chính DB này có 2 migration riêng cho bảng này —
  `20260721080000_add_item_components_baseline` (thêm dạng JSON) rồi
  `20260723185702_remove_item_components_json_add_relation_table` (đổi hẳn sang bảng quan hệ riêng như
  hiện tại) — chứng minh đây là tính năng có chủ đích, đã qua 1 lần refactor thật, không phải bảng rác.

### 8.2. Hiện trạng Backend — chưa có route/controller nào đọc bảng này

Rà soát repo backend đang checkout tại `D:\bnwems-backend-api` (`catalog.route/controller/service.ts`,
`inventory.route/controller/service.ts`, `operations.route/controller/service.ts` — kể cả
`getOrderItemsForPickList` chỉ trả thẳng `orderItems`, không nổ BOM), **cả 4 nhánh git** (`develop`,
`main`, `feature/align-api-contract-v1`, `feature/align-new-api-contracts-and-test` — kể cả 1 commit
remote chưa pull `6c2e4ed`): không có model/route/controller nào cho `item_components`.
`prisma/schema.prisma` ở mọi nhánh chỉ có `Item`/`ItemType`/`ItemTypeSpec` — 1 khái niệm BOM **khác**,
ở cấp **loại thiết bị** (không phải cấp item), dùng id kiểu BigInt autoincrement. Đối chiếu
`_prisma_migrations` thật (17 migration đã chạy trên DB) với thư mục `prisma/migrations` của repo đang
checkout (chỉ có 3 migration cũ, đã bị xoá ở commit gần nhất "fig: fix some bug with new db") cho thấy
repo backend đang checkout đã lỗi thời hẳn so với schema thật đang chạy trên DB — code thật sự tạo ra
`item_components` không nằm trong lịch sử git nào truy cập được từ đây.

**Đã cân nhắc và loại** phương án tái dùng `ItemTypeSpec`/`GET/POST /catalog/types/:id/specs` (route
này có thật, đang hoạt động) làm giải pháp thay thế: bảng `item_type_specs` tương ứng của nó **không
tồn tại** trên DB thật (đã kiểm tra `SHOW TABLES`) — gọi route này sẽ luôn ra mảng rỗng, không phản ánh
đúng dữ liệu BOM thật đang có. Kết luận: cần route mới đọc thẳng `item_components`, không tái dùng route
`/specs` cũ.

### 8.3. Endpoint cần bổ sung (đề xuất, chưa chốt — Backend xác nhận lại tên/shape)

- `GET /api/v1/catalog/items/:id/components` — trả danh sách vật tư con của 1 item cha (nếu item đó là
  1 "gói"): `{ componentId, childItemId, childItemName, unit, quantity }[]`; item không phải gói → trả
  mảng rỗng.
- **Đề xuất tốt hơn cho lâu dài** (giảm round-trip so với việc FE tự gọi item→components→inventory
  riêng lẻ cho từng dòng): mở rộng luôn `GET /api/v1/inventory/picklist/:orderId` (đã có sẵn khai báo ở
  FE — `inventoryApiService.getPicklist`, dùng ở `admin/inventory/outbound/page.tsx` — nhưng cũng
  **chưa thấy route BE tương ứng** khi rà soát) để BE tự nổ BOM + join tồn kho sẵn, trả thẳng danh sách
  vật tư vật lý cuối cùng kèm `quantityAvailable`. Đây là đề xuất tối ưu, không bắt buộc làm ngay.
- Ghi chú: có thể cần thêm CRUD quản lý cấu hình BOM (`POST/PUT .../components`) cho màn hình quản trị
  danh mục sau này, nhưng ngoài phạm vi cần ngay của tab "Chuẩn bị kho" — chỉ nêu để Backend biết trước.

### 8.4. Giải pháp tạm ở FE (áp dụng ngay, gỡ bỏ khi có endpoint thật)

Mock BOM tĩnh theo **tên** hạng mục cha (`src/mocks/db/itemComponents.ts`, khớp đúng dữ liệu thật đã
seed ở mục 8.1 — dùng tên vì itemId thật đổi theo môi trường/lần seed lại, còn tên thì ổn định), tra
`itemId`/`unit` thật của từng vật tư con qua `catalogApiService.getItems({ search })` (endpoint thật,
đang hoạt động), rồi gọi `inventoryApiService.getInventory` theo đúng cơ chế cũ ở mục 5. Khi có endpoint
thật ở mục 8.3, chỉ cần thay hàm `explodePhysicalDemand` đọc từ API thay vì từ
`ITEM_COMPONENTS_BY_PARENT_NAME`, phần còn lại (`page.tsx`) giữ nguyên.

**Cập nhật 2026-08-03 (tiếp) — có thể gỡ ngay, xem mục 9**: endpoint ở mục 8.3 **đã implement thật**
(khác repo backend đã rà ở mục 8.2 — xem mục 9). Giải pháp tạm này vẫn cần giữ **một phần** (xem lưu ý
"gói cũng có dòng inventory riêng" ở mục 9.3) cho tới khi FE nối API thật.

## 9. Cập nhật 2026-08-03 (tiếp, sau khi sửa lại đường dẫn repo Backend) — endpoint mục 8.3 ĐÃ CÓ THẬT

**Bối cảnh sửa sai lệch**: mục 8.2 rà nhầm repo backend tại `D:\bnwems-backend-api` (repo cũ, đã lỗi
thời, không phải bản đang chạy) và kết luận "chưa có route/controller nào cho `item_components`".
Repo backend **thật** đang dùng cho dự án là **`D:\sep490-backend-api`** (nhánh `main`, đã ghi lại vào
`CLAUDE.md` mục "Lưu ý: đường dẫn repo Backend thật" để tránh lặp lại nhầm lẫn này). Đối chiếu lại đúng
repo này (2026-08-03) cho kết quả **ngược hẳn** kết luận cũ.

### 9.1. Endpoint `GET /api/v1/catalog/items/:itemId/components` (mục 8.3) — ĐÃ CÓ, đúng shape đề xuất

Đã implement đầy đủ, khớp gần như y hệt đề xuất ở mục 8.3:

- **Route**: `GET /api/v1/catalog/items/:itemId/components`, mount tại `/api/v1/catalog/items` —
  `src/modules/shared/catalog.routes.ts:34-39`, gate `requireRole('MANAGER', 'ADMIN')`, `requireAuth`
  áp dụng chung cho cả router (dòng 17).
- **Controller**: `getItemComponents` — `src/modules/shared/catalog.controller.ts:35-39`, trả 404
  (`AppError.notFound`) nếu `itemId` không tồn tại.
- **Service**: `catalogService.getItemComponents` — `src/modules/shared/catalog.service.ts:168-180`,
  trả đúng shape đề xuất: `{ componentId, childItemId, childItemName, unit, quantity }[]` (map từ
  `componentId: c.id`, `childItemId: c.childId`, `childItemName: c.child.itemName`,
  `unit: c.child.unit`, `quantity: c.quantity`).
- **Repository**: `findComponentsByItemId` — `src/modules/shared/catalog.repository.ts:97-102`, query
  thẳng `prisma.itemComponent.findMany({ where: { parentId: itemId }, include: { child: true } })` —
  đúng bảng `item_components` thật đã xác nhận ở mục 8.1 (Prisma model `ItemComponent`,
  `prisma/schema.prisma:896-908`, `@@map("item_components")`, `parentId`/`childId`/`quantity`).
- **Test**: `src/modules/shared/__tests__/catalog.test.ts:267-310` — case trả về components đã map
  đúng, case mảng rỗng khi item không phải gói, case 404 khi item không tồn tại.

→ **Không cần route mới nào nữa** cho phần này — FE có thể nối thật ngay khi tới lượt (xem mục 9.4).

### 9.2. Bonus phát hiện thêm — bảng `inventory`/`inventory_movements` NAY ĐÃ TỒN TẠI (giải quyết luôn mục 5/7.2)

Mục 5 (2026-07-20) để ngỏ "chưa xác nhận model `Inventory` đã migrate hay chưa" (mục 7.2, việc kỹ thuật
thuần phía Backend). Đối chiếu lại (2026-08-03, đúng repo `sep490-backend-api` + MySQL MCP):

- `prisma/schema.prisma:821-831` có `model Inventory` map `@@map("inventory")`
  (`itemId` unique, `quantityTotal`, `quantityDamaged`); `model InventoryMovement`
  (`prisma/schema.prisma:833-850`) map `@@map("inventory_movements")`.
- Xác nhận trên DB thật qua `information_schema.tables`: **cả 2 bảng `inventory` và
  `inventory_movements` đều đã tồn tại** (đã migrate xong, không còn ở trạng thái "chưa chạy migration"
  như mục 5 ghi nhận trước đó).
- Endpoint `GET /api/v1/inventory/picklist/:orderId` (nhắc tới ở mục 8.3 như "đề xuất tốt hơn cho lâu
  dài") **cũng đã có thật** — `src/modules/inventory/inventory.routes.ts:49-51`,
  `inventory.controller.ts:41-44`, `inventory.service.ts:196-220` (hàm `getPicklist`). Trả về
  `PicklistItemDTO[]`: `{ orderItemId, itemId, itemName, unit, source, quantityOrdered,
  quantityAvailable, quantityExported }` — đọc thẳng `order_items` (không nổ BOM), join
  `item.inventory` để tính `quantityAvailable` khi có, và `getExportedQuantity` cho `quantityExported`.

→ Cột "Tồn kho" ở mục 5/8.4 (đang bị ẩn vì "chưa xác nhận bảng `inventory` tồn tại") **đủ điều kiện bật
lại** — không còn lý do kỹ thuật nào để tiếp tục ẩn.

### 9.3. Lưu ý quan trọng khi FE nối thật — "gói" cũng có dòng `inventory` riêng, đừng dùng nhầm

Kiểm tra thêm qua MySQL MCP phát hiện 1 điểm cần lưu ý khi nối `GET /inventory/picklist/:orderId`: cả
3 item "gói" ở mục 8.1 (`Gói Âm Thanh Hội Trường...`, `Gói Ánh Sáng Sân Khấu...`, `Gói Âm Thanh Ngoài
Trời...`) **cũng có dòng `inventory` riêng của chính nó** (`quantity_total` lần lượt 32/33/23) — độc
lập, không tự động phản ánh tồn kho thật của các vật tư con bên trong gói.

Hệ quả: nếu 1 dòng `orderItems` là 1 "gói" (item cha), `quantityAvailable` mà `GET
/inventory/picklist/:orderId` trả về cho dòng đó là tồn kho của **chính cái gói** (một con số ghi tay
khi seed, không liên động với tồn kho vật tư con) — **không dùng số này để quyết định "đủ hàng chuẩn bị
kho" cho mục con "Chuẩn bị kho"**. Mục "Chuẩn bị kho" (mục 8) cần nổ BOM đúng theo mục 8.4: gọi
`GET /catalog/items/:itemId/components` (mục 9.1) để lấy danh sách vật tư con, rồi tra tồn kho **theo
từng `childItemId`** (qua `GET /api/v1/inventory?itemId=:childItemId`, hoặc gọi lại
`GET /inventory/picklist/:orderId` không giúp gì thêm ở bước này vì nó không trả theo cấp vật tư con) —
đúng chuỗi gọi API đã mô tả ở mục 8.4, chỉ thay bước "mock BOM tĩnh" bằng gọi API thật.

### 9.4. Việc FE cần làm khi nối API thật (cập nhật lại mục 8.4)

1. Thay `ITEM_COMPONENTS_BY_PARENT_NAME`/`src/mocks/db/itemComponents.ts` bằng gọi thật
   `GET /api/v1/catalog/items/:itemId/components` qua `catalogApiService` (thêm 1 method mới,
   `getItemComponents(itemId)`, theo CLAUDE.md mục 4 — không gọi `axios`/`fetch` trực tiếp).
2. Giữ nguyên bước tra tồn kho **theo từng vật tư con** qua `inventoryApiService.getInventory` (mục
   8.4 cũ) — **không** thay bằng `GET /inventory/picklist/:orderId` cho bước này, lý do ở mục 9.3.
3. Với mục con "Thiết bị" (đọc thẳng `orderItems`, không nổ BOM) và bảng chính ở mục 1: có thể cân nhắc
   đổi sang gọi `GET /api/v1/inventory/picklist/:orderId` (mục 9.2) thay vì tự ráp
   `orderItems[].subtotal`/`quantityOrdered` thủ công từ `GET /orders/:id`, vì endpoint này đã trả sẵn
   `quantityExported`/`quantityAvailable` gộp — cân nhắc khi tới lượt nối thật, không bắt buộc ngay.
4. Bật lại cột "Tồn kho" trong modal Picklist (đang ẩn theo mục 5/8.4) — bảng `inventory` đã sẵn sàng
   (mục 9.2), không còn điều kiện chặn.
