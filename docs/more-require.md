# Yêu cầu bổ sung cho Backend

Danh sách các chỗ dữ liệu/endpoint backend hiện chưa đáp ứng đủ nhu cầu UI, phát hiện trong quá trình dựng
giao diện — nối tiếp theo thứ tự (a), (b), (c)... Mỗi mục ghi rõ màn hình liên quan, vấn đề, và đề xuất xử
lý (nếu có).

> **⚠️ Lưu ý quan trọng (2026-07-20)**: các mục (a)-(l) viết trước thời điểm này dựa trên đối chiếu với
> `D:\bnwems-backend-api` — phát hiện ra đây **KHÔNG PHẢI** backend đang thực sự chạy ở `localhost:3001`.
> Backend thật (đã xác nhận qua tiến trình đang chạy + người dùng xác nhận) là **`D:\sep490-backend-api`**
> — kiến trúc module khác hẳn (`src/modules/{identity,sales,operations,inventory}`), route surface nhỏ
> hơn nhiều: chỉ có `/auth`, `/customers`, `/customers/:id/quotations`, `/quotations`, `/orders`,
> `/schedule-plans`, `/work-tasks`, `/survey-reports`, `/events`, `/inventory` — **không có** `/catalog`,
> `/suppliers`, `/policies`, `/evidence`, `/attendance`, `/wages`, `/dashboard`, `/reports` dưới bất kỳ
> hình thức nào. Đã sửa lại 2 mục (d)/(k) sau khi phát hiện (2 endpoint đó thật ra **đã có sẵn**). Các
> mục còn lại **chưa được rà soát lại** — coi là cần xác minh lại qua `curl` trực tiếp backend thật hoặc
> đọc `D:\sep490-backend-api\src\modules\**\*.routes.ts` trước khi tin, đừng dùng làm căn cứ cuối cùng.
> `D:\sep490-backend-api\docs\api\*.md` có sẵn các file **trùng tên** với `docs/*.md` ở repo này (khả
> năng cao là bản đã đồng bộ/chốt với code thật) — nên ưu tiên đối chiếu 2 bộ file này với nhau khi cần
> viết thêm mục mới, thay vì chỉ dựa vào `docs/*.md` ở repo frontend.

## (a) Lập lịch khảo sát hiện trường khi báo giá chưa có Order thật

- **Màn liên quan**: "Kế hoạch và phân công" (`/manager/schedule/plans`, mirror
  `/admin/coordination/planning`) — luồng lập kế hoạch khảo sát sớm mở từ trang chi tiết báo giá
  (`?quotationId=...`), xem chi tiết ở [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) mục 8.1
  và mục 12.
- **Vấn đề**: `schedule_plans.order_id` là FK `NOT NULL` trỏ thẳng `orders.order_id`, không có cột nào
  tham chiếu tới `quotations.quotation_id`. Trong khi đó vòng đời nghiệp vụ là **Request → Survey →
  Quotation → mới có Order** (CLAUDE.md mục 1) — tại thời điểm cần lên lịch khảo sát hiện trường, báo giá
  còn đang ở trạng thái `DRAFT`/chưa duyệt và **chưa có `order_id` thật**, nên không thể tạo được dòng
  `schedule_plans` nào cho buổi khảo sát đó với schema hiện tại.
- **Đã chốt hướng (A) — đổi schema** (2026-07-20, xem lựa chọn ở
  `docs/kehoachvaphancong_api.md` mục 8.1): thêm cột `schedule_plans.quotation_id` (nullable, FK →
  `quotations.quotation_id`), đồng thời nới `schedule_plans.order_id` thành nullable, ràng buộc **đúng 1
  trong 2 cột (`order_id` hoặc `quotation_id`) có giá trị** ở tầng ứng dụng (CHECK constraint hoặc validate
  ở service layer, vì MySQL không hỗ trợ tốt CHECK phức tạp trên nhiều cột NULL/NOT NULL).
  - Không chọn hướng (B) — tạo `orders` sớm hơn (trước khi có Quotation duyệt) — vì sẽ đảo ngược thứ tự
    Request→Survey→Quotation→Order hiện mô tả ở CLAUDE.md mục 1, ảnh hưởng toàn bộ state machine
    `OrderStatus` (vốn đã có nhiều bất đồng bộ khác cần dọn trước, xem `docs/danhsachdondat_api.md`).
- **Cần Backend làm thêm sau khi đổi schema**:
  1. `POST /api/v1/schedule-plans` nhận `orderId` **hoặc** `quotationId` (hiện chỉ có `orderId` bắt buộc
     trong `CreateSchedulePlanPayload`).
  2. `GET /api/v1/schedule-plans` trả kèm `quotationId` (khi dòng đó chưa gắn Order thật) bên cạnh
     `orderId` hiện có.
  3. Khi báo giá được duyệt và sinh Order thật, cần 1 bước gán lại `order_id` cho các dòng
     `schedule_plans` đã tạo trước đó bằng `quotation_id` (không rõ có endpoint nào xử lý việc "chuyển"
     này chưa — cần Backend xác nhận).
- **Trạng thái**: FE **chưa code** luồng này (kể cả bằng mock) cho tới khi Backend xác nhận đã đổi schema
  xong, tránh phải sửa lại 2 lần khi model đổi.

## (b) Chưa có bảng `inventory` nào trong DB thật — chặn màn "Tồn kho doanh nghiệp" + "Thiết bị đang bảo trì"

- **Màn liên quan**: "Tồn kho doanh nghiệp" (`/manager/inventory/stock-check`, mirror
  `/admin/inventory/stock-status`) + modal chi tiết thiết bị (`EquipmentDetailModal`) + trang "Thiết bị
  đang bảo trì" (`/admin/inventory/maintenance`, đã code sẵn gọi API chờ bảng này) — xem chi tiết ở
  [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md).
- **Vấn đề**: đối chiếu MySQL MCP ngày 2026-07-20, bảng `items` chỉ có dữ liệu catalog (tên/giá/mô
  tả/đơn vị/trạng thái `ACTIVE`/`INACTIVE`/`MAINTENANCE`), **không có bất kỳ cột số lượng tồn kho nào**
  (tổng/khả dụng/hỏng). `src/types/inventory.ts` + `src/services/inventory.service.ts` đã viết sẵn code
  gọi `GET/POST /api/v1/inventory...` chờ 1 model `Inventory`, nhưng bảng đó **chưa hề được tạo** trong
  DB (chỉ 1 migration `init_core` đã chạy). Ngoài ra `items` cũng thiếu 2 trường "Kích thước"/"Chất
  liệu" mà UI cần hiển thị, chưa tồn tại ở bất kỳ đâu (kể cả các trang catalog CRUD thật).
- **Đã chốt hướng (A) — tạo bảng `inventory` mới, quan hệ 1-1 với `items`** (khớp đúng hướng code FE/
  service đã viết sẵn, không có hướng nào khác hợp lý hơn):
  ```sql
  CREATE TABLE inventory (
    inventory_id     VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    item_id          VARCHAR(36) NOT NULL UNIQUE,
    quantity_total   INT NOT NULL DEFAULT 0,
    quantity_damaged INT NOT NULL DEFAULT 0,
    location         VARCHAR(255) NULL,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(item_id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_inventory_damaged_lte_total CHECK (quantity_damaged <= quantity_total)
  );
  ```

  Có chủ đích **không** lưu "đã khóa"/"khả dụng" như cột tĩnh — 2 số này phụ thuộc ngày chọn trên UI
  (Date-based Inventory Lock, UC 2.13), tính trực tiếp bằng query lúc đọc (công thức đã chốt ở
  `docs/tonkhodoanhnghiep_api.md` mục 3 — khóa theo khoảng ngày `schedule_plans` của đơn, không cần
  bảng lock riêng). Seed 1 dòng `inventory` cho mỗi dòng `items` hiện có (hiện chỉ 2 dòng thật), mặc
  định 0 chờ vận hành nhập số liệu thật qua nghiệp vụ nhập/kiểm kê kho.
- **2 cột mới trên `items`**: `dimensions VARCHAR(100) NULL`, `material VARCHAR(255) NULL`.
- **Mở rộng `MovementType`** (`types/inventory.ts`) thêm giá trị `DAMAGE` (bên cạnh `INBOUND`/
  `ADJUSTMENT` hiện có) để phân biệt điều chỉnh vào `quantity_total` hay `quantity_damaged` — xem
  `AdjustInventoryPayload` mở rộng ở `docs/tonkhodoanhnghiep_api.md` mục 5.1.
- **Trạng thái**: FE giữ nguyên mock cho tới khi Backend tạo xong bảng `inventory` + 2 cột trên trên
  `items`. Khi xong, toàn bộ endpoint đã định nghĩa sẵn ở `docs/tonkhodoanhnghiep_api.md` (mục 2/4/5)
  implement được ngay theo đúng mô tả, không cần quay lại đổi tài liệu đó.

## (c) Chưa có bảng `collected_equipment_reports` nào trong DB thật — chặn màn "Thu hồi & hoàn kho"

- **Màn liên quan**: "Thu hồi & hoàn kho" (`/manager/inventory/returns`, mirror
  `/admin/inventory/returns`) — xem chi tiết ở [`docs/thuhoi_hoankho_api.md`](thuhoi_hoankho_api.md).
- **Vấn đề**: FE **đã có sẵn 1 hợp đồng type/service được thiết kế đúng cho nghiệp vụ này**
  (`src/types/collectedEquipmentReport.ts`, `inventoryApiService.createReturnReport`/
  `confirmReturnReport`) nhưng chưa UI nào gọi tới — UI thật đang tự dựng mock riêng
  (`adminInventoryReturnsMock.ts`, shape `ReturnSlip` khác hẳn, item là chuỗi tên tự do thay vì FK
  thật). Đối chiếu MySQL MCP (nhiều lần trong ngày 2026-07-20, xem `docs/thuhoi_hoankho_api.md`): không
  có bảng `collected_equipment_reports`/`collected_equipment_report_items` nào trong 25 bảng thật.
  Ngoài ra bước "Xác nhận hoàn kho" của màn này còn phụ thuộc thêm bảng `inventory` ở mục (b) — 2 lớp
  thiếu bảng chồng nhau.
- **Đã chốt hướng (A) — tạo 2 bảng mới, đi theo đúng shape `CollectedEquipmentReport` đã có sẵn ở FE**
  (không theo `ReturnSlip` mock — mock có nhược điểm item là tên tự do, không FK):
  ```sql
  CREATE TABLE collected_equipment_reports (
    report_id      VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    report_code    VARCHAR(50) NOT NULL UNIQUE,
    order_id       VARCHAR(36) NOT NULL,
    report_type    ENUM('INTERNAL','SUPPLIER') NOT NULL DEFAULT 'INTERNAL',
    transaction_id VARCHAR(36) NULL,
    status         ENUM('SUBMITTED','CONFIRMED') NOT NULL DEFAULT 'SUBMITTED',
    reported_by    VARCHAR(36) NOT NULL,
    confirmed_by   VARCHAR(36) NULL,
    confirmed_at   TIMESTAMP NULL,
    notes          TEXT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT collected_equipment_reports_order_id_fkey FOREIGN KEY (order_id)
      REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT collected_equipment_reports_reported_by_fkey FOREIGN KEY (reported_by)
      REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT collected_equipment_reports_confirmed_by_fkey FOREIGN KEY (confirmed_by)
      REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT collected_equipment_reports_transaction_id_fkey FOREIGN KEY (transaction_id)
      REFERENCES supplier_transactions(transaction_id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  CREATE TABLE collected_equipment_report_items (
    cer_item_id      VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    report_id        VARCHAR(36) NOT NULL,
    item_id          VARCHAR(36) NOT NULL,
    good_quantity    INT NOT NULL DEFAULT 0,
    damaged_quantity INT NOT NULL DEFAULT 0,
    lost_quantity    INT NOT NULL DEFAULT 0,
    notes            TEXT NULL,
    CONSTRAINT cer_items_report_id_fkey FOREIGN KEY (report_id)
      REFERENCES collected_equipment_reports(report_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT cer_items_item_id_fkey FOREIGN KEY (item_id)
      REFERENCES items(item_id) ON DELETE RESTRICT ON UPDATE CASCADE
  );
  ```

  **Chưa xác nhận được** tên cột PK thật của `supplier_transactions` trong phiên viết tài liệu này (MCP
  bị timeout kết nối DB) — Backend cần tự đối chiếu lại trước khi tạo FK `transaction_id`.
- **Không lưu tiền đền bù ở bảng này** — theo comment gốc `types/collectedEquipmentReport.ts`, đền bù
  hỏng/mất xử lý riêng qua `settlements.compensation` (đã có sẵn cột), không gắn per-item ở đây (xem
  `docs/thuhoi_hoankho_api.md` mục 5).
- **Trạng thái**: FE giữ nguyên mock (`adminInventoryReturnsMock.ts`) cho tới khi Backend tạo xong 2
  bảng trên (và bảng `inventory` ở mục (b), cần cho bước xác nhận). Khi xong, FE cần đổi UI sang gọi
  `inventoryApiService.createReturnReport`/`confirmReturnReport` theo đúng shape
  `CollectedEquipmentReport` thay vì tiếp tục dùng mock `ReturnSlip` — xem `docs/thuhoi_hoankho_api.md`
  mục 0/3 cho toàn bộ thay đổi UI cần làm (bỏ modal "Tạo phiếu" trên web, chuyển ghi nhận số liệu sang
  Leader Staff mobile theo đúng CLAUDE.md).
- **⛔ Toàn bộ 4 endpoint đã định nghĩa ở `docs/thuhoi_hoankho_api.md` đều CHƯA CẦN LÀM NGAY** — chỉ là
  hợp đồng chốt sẵn để Backend làm khi rảnh tay, theo đúng thứ tự: (1) tạo bảng `inventory` ở mục (b)
  nếu chưa xong, (2) tạo 2 bảng ở mục này, (3) `GET .../return-reports` (danh sách), (4)
  `GET .../return-reports/:id` (chi tiết), (5) `POST .../return-reports` (tạo phiếu), (6)
  `PUT .../return-reports/:id/confirm` (xác nhận — làm **sau cùng**, vì là endpoint duy nhất đụng tới
  cả 2 bảng mới cùng lúc, xem `docs/thuhoi_hoankho_api.md` mục 4.3/9.2).

## (d) ~~Thiếu `GET /api/v1/quotations`~~ — ĐÃ CÓ SẴN trên backend thật, không cần Backend làm gì thêm (xác nhận 2026-07-20)

- **Màn liên quan**: "Danh sách báo giá" (`/manager/quotations`, `/admin/quotations`) — xem
  [`docs/danhsachbaogia_api.md`](danhsachbaogia_api.md) mục 1/4.1.
- **⚠️ Sửa lại nhận định ban đầu (2026-07-20)**: mục này lúc đầu viết dựa trên `docs/danhsachbaogia_api.md`
  (soạn từ việc đối chiếu `D:\bnwems-backend-api` — backend **KHÔNG PHẢI** backend đang thực sự chạy).
  Backend thật đang chạy trên `:3001` là **`D:\sep490-backend-api`** (xác nhận qua tiến trình đang lắng
  nghe cổng, `quotation.routes.ts` của repo này) — repo này **đã có sẵn** `quotationRouter.get('/', ...)`
  mounted tại `/api/v1/quotations`. Test thật bằng `curl` (2026-07-20) xác nhận hoạt động đúng, response
  khớp gần như y hệt shape đã đoán trong doc:
  ```json
  { "data": [{ "quotationId": "uuid", "code": "QUO-002", "customerId": "uuid",
      "customerName": "Event Pro", "customerPhone": "0922222222", "version": "v1",
      "subtotal": 3000000, "discount": 0, "totalAmount": 3000000, "status": "draft",
      "createdAt": "2026-07-20T05:53:04.000Z" }],
    "meta": { "page": 1, "limit": 10, "totalItems": 2, "totalPages": 1,
      "counts": { "all": 2, "draft": 1, "approved": 1, "rejected": 0, "approvedValue": 1600000 } } }
  ```

  `meta.counts` giữ nguyên bất kể filter — đúng như cần cho 5 thẻ KPI. **Không cần Backend làm gì thêm**
  — FE chỉ cần thêm hàm `getQuotations()` vào `quotation.service.ts` gọi `GET /quotations` và wire vào
  `manager/quotations/page.tsx`/`admin/quotations/page.tsx` thay cho mock.
- **Vấn đề phụ vẫn còn cần Product xác nhận (không phải thiếu API, mà thiếu quyết định nghiệp vụ)**: bộ
  lọc trạng thái trên UI có thêm giá trị `"Đang khảo sát"` (`surveying`) không tồn tại trong enum DB thật
  (response thật chỉ trả `draft`/`approved`/`rejected`, khớp đúng cảnh báo ban đầu của doc mục 3.1) —
  vẫn cần Product chọn Hướng A (bỏ `surveying` khỏi màn này) hay Hướng B trước khi FE sửa UI.
- **Bài học quy trình**: mọi mục còn lại trong file này (viết trước 2026-07-20, giờ này) cần được đối
  chiếu lại với route thật của `D:\sep490-backend-api` trước khi coi là "đã xác nhận" — xem ghi chú
  tổng quát cuối file.

## (e) ~~Thiếu `GET /api/v1/orders/stats`~~ — ĐÃ CÓ SẴN, không cần làm gì thêm (xác nhận 2026-07-20)

- **Màn liên quan**: "Danh sách đơn đặt" (`/admin/orders_audit`, `/manager/orders`) — xem
  [`docs/danhsachdondat_api.md`](danhsachdondat_api.md) mục 2.
- **Cập nhật (2026-07-20, đối chiếu trực tiếp backend thật đang chạy)**: mục này ban đầu đề xuất thêm
  endpoint `GET /orders/stats` vì tưởng phải gọi `GET /orders?orderStatus=X&limit=1` **5 lần** để lấy đủ
  6 thẻ KPI. Test thật (`curl`) cho thấy **response của `GET /orders` (endpoint đã có, không lọc gì) đã
  trả sẵn `meta.counts`**:
  ```json
  { "data": [...], "meta": { "page": 1, "limit": 10, "totalItems": 1, "totalPages": 1,
    "counts": { "all": 1, "new": 0, "confirmed": 1, "inProgress": 0, "completed": 0, "cancelled": 0 } } }
  ```

  `counts` giữ nguyên không đổi dù có truyền `orderStatus`/`paymentStatus`/`search` hay không (đã test cả
  3 trường hợp) — đúng hành vi cần cho 6 thẻ KPI (luôn hiển thị số liệu toàn bộ tập dữ liệu). **Không cần
  Backend làm gì thêm** — FE chỉ cần đọc `meta.counts` từ response `GET /orders` sẵn có. Đã áp dụng ở
  `manager/orders/page.tsx`/`admin/orders_audit/page.tsx` (xem `DEMO_CHECKLIST.md` mục 4).
- **Lưu ý cho object `counts`**: field dùng **camelCase/lowercase** (`all`/`new`/`confirmed`/
  `inProgress`/`completed`/`cancelled`), khác hẳn dạng UPPERCASE của `OrderStatus` enum
  (`NEW`/`CONFIRMED`/...) — cần map thủ công khi dùng, không thể `counts[orderStatus]` trực tiếp.

## (f) `work_tasks` chưa có dòng "Khảo sát hiện trường" — chặn khối phân công khảo sát ở tab "Tổng quan sự kiện" + "Tiến độ sự kiện"

- **Màn liên quan**: tab "Tổng quan sự kiện" (khối "Phân công khảo sát") và tab "Tiến độ sự kiện" (Mốc 1)
  trong chi tiết đơn — xem [`docs/tongquansukien_api.md`](tongquansukien_api.md) mục 5,
  [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 3.2/9.1.
- **Vấn đề**: đối chiếu MySQL MCP ngày 2026-07-20, bảng `work_tasks` (danh mục tĩnh, **không có route
  tạo/sửa/xóa phía FE** — comment `types/workTask.ts`) hiện **chỉ seed đúng 2 dòng**: `TSK-SETUP` ("Lắp
  đặt thiết bị") và `TSK-TEARDOWN` ("Tháo dỡ thiết bị") — **không có dòng nào cho "Khảo sát"** (hay "Vận
  chuyển", cùng gốc vấn đề với tab "Lịch trình & Kỹ thuật"). Vì `schedule_plans.task_id` là `NOT NULL`
  FK trỏ `work_tasks`, FE không thể tạo lịch phân công khảo sát cho tới khi có dòng này.
- **Đã chốt hướng (A)** (2026-07-20, áp dụng chung cho cả 2 tab vì cùng phụ thuộc 1 nguồn dữ liệu
  `surveyAssignment`): **Backend seed thêm 1-2 dòng tĩnh vào `work_tasks`**: `"Khảo sát hiện trường"`
  (bắt buộc) và `"Vận chuyển"` (nếu tab Lịch trình & Kỹ thuật cũng cần) — không tạo bảng/cột mới, chỉ
  cần `INSERT` 1-2 dòng. Không chọn Hướng B (bỏ hẳn khối phân công khảo sát khỏi tab Tổng quan, chuyển
  toàn bộ sang màn Khảo sát riêng) vì sẽ phải thiết kế lại điều hướng, chi phí cao hơn.
- **API cần thêm/sửa sau khi seed xong**:
  1. `POST /api/v1/schedule-plans` (đã có) dùng `taskId` = ID dòng "Khảo sát hiện trường" mới — không
     cần đổi payload.
  2. **Endpoint mới** để gán người phụ trách vào `schedule_plan_assignees` (`plan_id`, `user_id`,
     `role ENUM('LEAD','TECHNICAL')`) — **chưa có** ở `schedulePlanApiService`, cần Backend bổ sung
     (vd `POST /api/v1/schedule-plans/:id/assignees`, path cụ thể cần Backend đề xuất).
  3. `GET /api/v1/schedule-plans?orderId=:id` (đã có) cần **join thêm tên người phụ trách** trong
     response — hiện `SchedulePlan.assigneeName` (`types/schedulePlan.ts` dòng 26) giả định model
     "1 plan - 1 người" nhưng bảng thật `schedule_plan_assignees` là **nhiều người/nhiều vai trò**
     (many-to-many có `role`) — type `SchedulePlan` ở FE cần Backend làm rõ lại shape trước khi code
     (đổi `assigneeName: string` thành `assignees: {userId, fullName, role}[]`).
- **Trạng thái**: FE chưa code khối này ở cả 2 tab cho tới khi Backend seed xong `work_tasks` + xác nhận
  lại shape `SchedulePlan.assignees`.
  **Rà lại 2026-07-20 (khi nối tab "Tổng quan sự kiện")**: `GET /api/v1/work-tasks` test lại bằng `curl`
  — **vẫn chỉ đúng 2 dòng** `TSK-SETUP`/`TSK-TEARDOWN`, chưa seed "Khảo sát hiện trường" — gap này còn
  nguyên, chưa đổi. Tin tốt cho điểm 3 ở trên: `GET /schedule-plans?orderId=` test lại bằng `curl` xác
  nhận **đã trả đúng `assignees: {userId, fullName, role, phone, checkInAt, checkOutAt}[]`** (nhiều
  người/vai trò, đúng model thật) — không còn `assigneeName` đơn như lo ngại ban đầu, sẵn sàng dùng khi
  tới lượt migrate tab "Lịch trình & Kỹ thuật"/"Tiến độ sự kiện". Khối "Phân công khảo sát báo giá" ở
  tab "Tổng quan sự kiện" (`src/app/{manager/orders,admin/orders_audit}/[id]/page.tsx`) đã đổi sang
  hiện placeholder rõ ràng thay vì dữ liệu mock, trỏ lại đúng mục này — sẽ code thật ngay khi Backend
  seed xong.

## (g) Tiến độ sự kiện Mốc 4 (checklist trước giờ diễn) + Mốc 6 (đóng đơn) — 2 cột mới + 2 endpoint mới trên `orders`

- **Màn liên quan**: tab "Tiến độ sự kiện" (Mốc 3 trong chi tiết đơn) — xem
  [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 5 (Mốc 4) và mục 7 (Mốc 6).
- **Mốc 4 — checklist trước giờ diễn** (`PATCH /api/v1/orders/:orderId/live-checklist`):
  - **Đã chốt hướng (A)**: thêm 1 cột JSON trên `orders`, không tạo bảng audit riêng (từ chối phương án
    có `checked_by`/`checked_at` vì đây chỉ là checklist nhanh trước giờ diễn, không cần audit trail).
  - **DB cần sửa**: `ALTER TABLE orders ADD COLUMN live_show_checklist JSON NULL;` — lưu thẳng
    `{ backdrop: boolean, soundTest: boolean, powerBackup: boolean, operatorReady: boolean }`.
  - **Request**: `{ key, checked }` (từng mục) hoặc cả object — doc chưa chốt cách nào, cần Backend chọn.
  - **Output**: trả lại `liveChecklist` mới nhất (shape JSON như trên).
- **Mốc 6 — đóng đơn** (`PUT /api/v1/orders/:orderId/close`):
  - **Đã chốt hướng (A)**: thêm 2 cột trên `orders`, **không** thêm giá trị `CLOSED` vào enum
    `order_status` (vì nhiều chỗ code đã switch cứng theo 5 giá trị hiện có, đổi enum ảnh hưởng rộng).
  - **DB cần sửa**:
    ```sql
    ALTER TABLE orders
      ADD COLUMN closed_at TIMESTAMP NULL,
      ADD COLUMN closed_by VARCHAR(36) NULL,
      ADD CONSTRAINT orders_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - **Điều kiện hợp lệ**: chỉ cho đóng khi `order_status = 'COMPLETED' AND payment_status = 'PAID' AND closed_at IS NULL`.
  - **Request**: không có body, hoặc `{ notes? }` (doc chưa chốt).
  - **Ảnh hưởng khác**: các endpoint ghi khác trên đơn (`PUT /orders/:id/status`, `PUT /orders/:id/items`,
    các API ghi `schedule_plans` của đơn đó) **phải trả 403** một khi `closed_at IS NOT NULL`.
- **Trạng thái**: cả 2 hướng đã chốt, Backend có thể triển khai theo đúng schema trên; FE chưa code chờ
  Backend xác nhận đã thêm cột.

## (h) `actualStartTime`/`actualEndTime` cho `schedule_plans` — chưa chốt hướng, chặn hiển thị "giờ bắt đầu/hoàn thành thực tế" ở Mốc 3

- **Màn liên quan**: tab "Tiến độ sự kiện" (Mốc 3, mỗi công việc kỹ thuật hiển thị giờ bắt đầu/hoàn
  thành thực tế theo Leader Staff cập nhật) — xem [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 4,
  mục 9.2. Liên quan trực tiếp tới yêu cầu đã ghi ở `DEMO_CHECKLIST.md` mục 2b ("Ở mốc 3 có cập nhật
  trạng thái làm việc — bắt đầu lúc mấy giờ, hoàn thành lúc mấy giờ").
- **Vấn đề**: bảng `schedule_plans` thật đã có `start_time`/`end_time` nhưng đó là **giờ dự kiến (kế
  hoạch)**, không phải giờ thực tế Leader Staff ghi nhận khi thi công. Doc tự nhận **chưa có đủ căn cứ để
  đề xuất 1 hướng** — cần Backend cho biết `start_time`/`end_time` hiện tại đang được những màn
  hình/luồng nào khác dùng (đặc biệt phía mobile Leader Staff) trước khi quyết định.
- **2 hướng đang cân nhắc (chưa chốt)**:
  1. Thêm cột riêng `schedule_plans.actual_start_time TIMESTAMP NULL`,
     `schedule_plans.actual_end_time TIMESTAMP NULL` — giữ nguyên `start_time`/`end_time` là kế hoạch.
  2. Ghi đè trực tiếp lên `start_time`/`end_time` hiện có khi Leader Staff cập nhật — rủi ro nếu chỗ
     khác đang đọc 2 cột này như "giờ kế hoạch".
- **Trạng thái**: **chưa code**, cần Backend trả lời câu hỏi trên trước khi Product/FE chọn hướng.

## (i) Thiết bị & kho hàng — 2 cột mới + 2 endpoint mới để Leader Staff cập nhật tiến độ chuẩn bị, Manager xác nhận

- **Màn liên quan**: tab "Thiết bị & kho hàng" (trong chi tiết đơn) — xem
  [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) mục 2a/2b/3/7.
- **Đã chốt hết (2026-07-20)** — Backend có thể triển khai toàn bộ theo đúng mô tả dưới đây.
- **`PATCH /api/v1/orders/:orderId/items/:orderItemId`** (Leader Staff cập nhật số lượng đã chuẩn bị +
  người chuẩn bị):
  - **DB cần sửa**: cột `order_items.prepared_qty` **đã có sẵn**, không cần đổi. Cần thêm mới:
    `ALTER TABLE order_items ADD COLUMN prepared_by VARCHAR(255) NULL;` — dùng **free-text**, **không**
    FK `users.user_id` vì giá trị có thể là tên Supplier/đội ngoài, không có tài khoản user.
  - **Request**: `{ preparedQty?: number, preparedBy?: string }`.
  - **Output**: `OrderItem` đã cập nhật (hoặc 204).
  - **Backend cần validate**: `0 ≤ preparedQty ≤ quantity` ở server (không chỉ tin FE); người gọi phải
    có role `LEADER` và đang được gán (`schedule_plan_assignees`) cho đơn đó.
- **`PUT /api/v1/orders/:orderId/items/confirm-prepared`** (Manager xác nhận đã chuẩn bị xong 100%):
  - **DB cần sửa**:
    ```sql
    ALTER TABLE orders
      ADD COLUMN items_confirmed_at TIMESTAMP NULL,
      ADD COLUMN items_confirmed_by VARCHAR(36) NULL,
      ADD CONSTRAINT orders_items_confirmed_by_fkey FOREIGN KEY (items_confirmed_by)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - **Điều kiện**: chỉ cho xác nhận khi `preparedQty = quantity` ở **mọi** dòng `order_items` của đơn đó.
  - **Request**: `{ notes?: string }`. **Output**: `Order` đã cập nhật (hoặc 204).
- **Lưu ý**: `actualStartTime`/`actualEndTime` **không** thuộc phạm vi 2 endpoint này — xem mục (h) ở trên
  (thuộc `schedule_plans`, Mốc 3, chưa chốt).
- **Trạng thái**: đã chốt schema, FE chờ Backend làm xong 2 cột + 2 endpoint trên.

## (j) Pick-list xuất kho — 2 cột mới trên `orders` + 2 endpoint mới, thuộc domain `orders` (không phải `inventory`)

- **Màn liên quan**: "Pick-list xuất kho" (`/admin/inventory/outbound`) — xem
  [`docs/picklistxuatkho_api.md`](picklistxuatkho_api.md) mục 4, 5.1, 5.2.
- **Đã chốt hết (2026-07-20)** — không còn mục nào chờ Product quyết định thêm.
- **`GET /api/v1/orders/picklists?page=&limit=&search=&exportStatus=`** — danh sách + KPI cho màn
  pick-list (endpoint mới, **không đề xuất tạo bảng `picklists` riêng** — dùng lại `orders`/`order_items`
  cộng 2 cột mới ở endpoint dưới).
  - **Output** (ví dụ mẫu từ doc):
    ```jsonc
    {
      "data": [{
        "orderId": "uuid", "orderCode": "ORD-001", "customerName": "Nguyễn Văn A",
        "eventDate": "2026-08-15T02:00:00.000Z", "coordinatorName": "Vũ Hoàng Long",
        "totalItemsCount": 4, "preparedItemsCount": 0,
        "itemsConfirmedAt": null, "pickedUpAt": null, "pickedUpByName": null
      }],
      "meta": { "page": 1, "limit": 20, "totalCount": 32, "readyCount": 5, "exportedCount": 3 }
    }
    ```
  - `coordinatorName` join theo "LEAD của `schedule_plans` sớm nhất" (SQL cụ thể ở doc mục 3.4).
- **`PUT /api/v1/orders/:orderId/picklist/picked-up`** — đánh dấu đã lấy hàng khỏi kho:
  - **DB cần sửa**:
    ```sql
    ALTER TABLE orders
      ADD COLUMN picked_up_at TIMESTAMP NULL,
      ADD COLUMN picked_up_by VARCHAR(36) NULL,
      ADD CONSTRAINT orders_picked_up_by_fkey FOREIGN KEY (picked_up_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - **Request**: body rỗng `{}`. **Output**: 204, hoặc order summary đã cập nhật
    `{ pickedUpAt, pickedUpByName }`.
  - **Backend cần validate trước khi set**: (1) `order_status IN ('CONFIRMED','IN_PROGRESS')` else 409;
    (2) `picked_up_at IS NULL` else 409 (chưa lấy 2 lần); (3) `items_confirmed_at IS NOT NULL` (bắt buộc
    đã qua bước Manager xác nhận chuẩn bị ở mục (i) trước, không chỉ dựa vào tổng `prepared_qty`).
- **Trạng thái**: đã chốt schema, FE chờ Backend làm xong 2 cột + 2 endpoint trên.

## (k) ~~Thiếu `GET /api/v1/survey-reports`~~ — ĐÃ CÓ SẴN trên backend thật, không cần Backend làm gì thêm (xác nhận 2026-07-20)

- **Màn liên quan**: "Khảo sát hiện trường" (`/manager/survey`, `/admin/reports/survey`) — xem
  [`docs/khaosathientruong_api.md`](khaosathientruong_api.md) mục 1, 8.
- **⚠️ Sửa lại nhận định ban đầu (2026-07-20)** — cùng nguyên nhân với mục (d): viết dựa trên backend sai
  (`D:\bnwems-backend-api`). Backend thật (`D:\sep490-backend-api\src\modules\operations\survey.routes.ts`)
  **đã có sẵn** `router.get('/', ...)` mounted tại `/api/v1/survey-reports` — danh sách xuyên mọi đơn,
  không cần `orderId`. Test thật bằng `curl` xác nhận hoạt động đúng, đã JOIN sẵn đúng như doc mong muốn:
  ```json
  { "data": [{ "surveyId": "uuid", "reportCode": "SUR-001", "orderId": "uuid", "orderCode": "ORD-001",
      "customerName": "Tech Corp", "eventName": "Tech Summit 2026", "surveyDate": "2026-08-01T10:00:00.000Z",
      "location": "123 Tech St. Hall A", "status": "CONFIRMED", "reportedByName": "Team Leader" }],
    "meta": { "page": 1, "limit": 10, "totalItems": 1, "totalPages": 1,
      "counts": { "all": 1, "draft": 0, "needsReview": 0, "submitted": 0, "confirmed": 1 } } }
  ```

  **Không cần Backend làm gì thêm** — FE chỉ cần thêm hàm gọi `GET /survey-reports` (không có `orderId`)
  vào `survey.service.ts` và wire vào màn danh sách khảo sát thay cho mock.
  Lưu ý `meta.counts` dùng key khác `AdminQuotationStatus`/`OrderStatus` — 5 khóa riêng
  (`all`/`draft`/`needsReview`/`submitted`/`confirmed`), cần đối chiếu lại với `SurveyReportStatus` FE
  hiện có (`types/survey.ts`) trước khi map, không giả định trùng.

## (l) `GET /api/v1/schedule-plans` cần mở rộng `dateFrom`/`dateTo` + trường join — dùng cho "Lịch timeline" và "Kế hoạch và phân công"

- **Màn liên quan**: "Lịch timeline" (`/manager/schedule`, xem
  [`docs/lichtimeline_api.md`](lichtimeline_api.md) mục 2, 2.1, 2.2, 5.1) và "Kế hoạch và phân công"
  (`/admin/coordination/planning`, xem [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md)
  mục 6, 11.2).
- **Vấn đề**: `GetSchedulePlansQuery` hiện chỉ có `date` (1 ngày đơn lẻ) — 2 màn trên cần lọc theo
  **khoảng ngày** (`dateFrom`/`dateTo`) và cần nhiều trường join sẵn trong response mà hiện chưa có.
- **DB cần sửa**: **không cần ALTER/CREATE** — `schedule_plans.start_time`/`end_time` và
  `orders.event_date` đã đủ cột để tính khoảng ngày; doc chỉ gợi ý cân nhắc thêm index trên `start_time`
  nếu dữ liệu lớn (đã có vẻ có sẵn theo tên `idx_schedule_plans_start`, chưa xác nhận chắc chắn).
- **⚠️ 2 doc đang mâu thuẫn nhau, cần Backend/Product thống nhất trước khi code**:
  - `docs/lichtimeline_api.md` (mục 5.1) tự nhận **"đã chốt với người dùng (2026-07-20)"**: khoảng ngày
    tính theo `[orders.event_date, MAX(schedule_plans.end_time)]`.
  - `docs/kehoachvaphancong_api.md` (mục 11.2) liệt kê **cùng đề xuất `dateFrom`/`dateTo` này là "chưa
    chốt, cần Backend/Product xác nhận"**, và dùng công thức khác:
    `MIN(schedule_plans.start_time)`/`MAX(schedule_plans.end_time)` (không có `orders.event_date`).
  - Cần chốt 1 công thức duy nhất trước khi Backend implement, tránh 2 tab cho ra khoảng ngày khác nhau.
- **Query params đề xuất**: `dateFrom` (`YYYY-MM-DD`, bắt buộc), `dateTo` (`YYYY-MM-DD`, bắt buộc),
  `orderId` (tùy chọn — cần Backend xác nhận query builder cho phép bỏ trống để trả mọi đơn).
- **Output mỗi dòng cần thêm** (join): `orderCode`, `eventName`, `eventDate`, `taskName`,
  `assignees: {userId, fullName, role}[]` (theo `lichtimeline_api.md`; `kehoachvaphancong_api.md` xin
  thêm `customerName`, `orderLocation`, và `phone` trong từng assignee). Ví dụ mẫu (từ
  `lichtimeline_api.md` mục 2.2):
  ```jsonc
  {
    "planId": "uuid", "planCode": "PLN-001", "orderId": "uuid", "orderCode": "ORD-001",
    "eventName": "Tech Summit 2026", "eventDate": "2026-08-15T02:00:00.000Z",
    "taskId": "uuid", "taskName": "Lắp đặt thiết bị",
    "startTime": "2026-08-14T07:00:00.000Z", "endTime": "2026-08-14T11:00:00.000Z",
    "location": "123 Tech St. Hall A", "status": "IN_PROGRESS", "notes": null,
    "assignees": [{ "userId": "uuid", "fullName": "Lê Văn Leader", "role": "LEAD" }]
  }
  ```
- **2 endpoint batch đề xuất thêm (chưa chốt, chỉ là tiện ích FE, không bắt buộc)**:
  `POST /api/v1/schedule-plans/batch` (tạo nhiều dòng cùng `order_id` trong 1 transaction) và
  `PATCH /api/v1/schedule-plans/batch/status` (hủy nhiều dòng cùng lúc) — mục đích tránh lưu dở dang khi
  tạo/hủy nhiều dòng kế hoạch cùng lúc. Doc tự nói rõ: **Backend có thể từ chối**, FE chấp nhận tự lặp
  gọi tuần tự (kém an toàn hơn khi lỗi giữa chừng) nếu Backend không muốn làm endpoint batch riêng.
- **Trạng thái**: chờ Backend/Product thống nhất công thức khoảng ngày, sau đó implement phần mở rộng
  `GET /schedule-plans`; 2 endpoint batch để tùy Backend quyết định có làm hay không.

## (m) `PATCH /api/v1/orders/:orderId/quotation` — liên kết/hủy liên kết báo giá với đơn (tab "Báo giá & hợp đồng")

- **Màn liên quan**: tab "Báo giá & hợp đồng" (trong chi tiết đơn) — xem
  [`docs/baogiavahopdong_api.md`](baogiavahopdong_api.md) mục 1.2, 2, 5.2.
- **Vấn đề**: nghiệp vụ **đã chốt giữ** (cho phép đổi báo giá gắn với 1 đơn), nhưng **shape endpoint
  chưa chốt** — hiện chưa có endpoint nào cho việc này ở `order.service.ts` (5 hàm hiện có:
  `getOrders`/`getOrder`/`createOrder`/`updateOrderStatus`/`updateOrderItems`, không có hàm nào sửa
  `quotation_id`).
- **DB cần sửa**: **không cần** — `orders.quotation_id` đã là FK nullable với `ON DELETE SET NULL`
  (xác nhận qua `SHOW CREATE TABLE orders`). Vấn đề hiện tại là hệ thống chỉ tự **gỡ** liên kết khi
  quotation bị xóa (hành vi của DB), chưa có cơ chế để **client** chủ động gỡ/đổi liên kết qua API.
- **API đề xuất** (doc nói rõ đây chỉ là gợi ý minh họa, Backend có thể chọn cách khác — vd gộp vào
  `PUT /orders/:id`, hoặc tách riêng 2 endpoint "liên kết"/"hủy liên kết"):
  `PATCH /api/v1/orders/:orderId/quotation` — **Request**: `{ "quotationId": string | null }` (gửi id để
  liên kết, gửi `null` để hủy liên kết). **Output**: chưa có ví dụ, cần Backend tự định nghĩa.
- **Ràng buộc nghiệp vụ Backend nên enforce ở server** (không chỉ tin điều kiện disable nút ở FE):
  1. Chỉ nhận `quotationId` của báo giá có `status = APPROVED` và **chưa** bị đơn nào khác trỏ tới.
  2. Khi gửi `null` (hủy liên kết), Backend nên tự kiểm tra lại điều kiện "khách hàng này còn >1 báo giá
     `APPROVED`" ở server — cách hiểu chính xác điều kiện này (đếm theo khách hàng hay theo đơn) **chưa
     chốt**, cần Product mô tả lại chính xác (doc mục 5.2.1).
  3. Có cần lưu lịch sử audit mỗi lần đổi `quotation_id` hay ghi đè trực tiếp — **chưa quyết** (doc mục
     5.2.3).
- **Trạng thái**: nghiệp vụ đã chốt giữ tính năng, nhưng shape endpoint + 2 câu hỏi trên cần Backend/
  Product trả lời trước khi code.

## (n) Module Nhà cung cấp chưa được mount trên backend đang chạy + trường `debtBalance` chưa chốt hướng tính

- **Màn liên quan**: "Nhà cung cấp" (`/admin/suppliers`, `/manager/suppliers`) — xem
  [`docs/supplier_api.md`](supplier_api.md) mục 3.1, 6.
- **Phát hiện qua test thật (không phải suy đoán)**: doc tự test bằng curl vào backend thật đang chạy
  (`localhost:3001`) — `GET/POST /api/v1/suppliers`, `PUT /api/v1/suppliers/:id`,
  `GET /api/v1/supplier-transactions` đều trả **404 "Route not found"**, trong khi route đã biết chắc
  tồn tại như `/orders`/`/customers` trả **401 UNAUTHORIZED** (thiếu token) khi gọi không kèm token. Vì
  router bắt path **trước** khi tới middleware auth, 404 (thay vì 401) nghĩa là **toàn bộ route Supplier
  chưa được đăng ký/mount trên server đang chạy** — không phải vấn đề quyền hay cấu hình FE. FE
  (`supplier.service.ts`: `getSuppliers`/`createSupplier`/`updateSupplier`,
  `procurement.service.ts`: `getTransactions`) đã viết đúng path chờ sẵn.
- **Cần Backend xác nhận**: module Supplier có đang phát triển ở nhánh khác chưa merge, hay server thật
  đang chạy build cũ hơn, hay chưa bắt đầu code — để biết ETA trước khi FE lên kế hoạch nối.
- **`debtBalance` (số công nợ, trường nổi bật nhất trên UI danh sách NCC) — chưa chốt hướng tính**:
  - Type `Supplier` (`types/supplier.ts`) hiện **không có field `debtBalance`/`totalDebt`** nào; UI mock
    hiện tại chỉ gán 1 số tĩnh lúc seed, không tính lại từ `transactions[]`.
  - **Khuyến nghị của doc**: **không** lưu `debtBalance` như 1 cột riêng trên `suppliers` (dễ lệch dữ
    liệu) — tính động mỗi lần trả response, theo công thức (nếu tính theo giao dịch):
    `value + compensationAmount - supplierDeduction - paidAmount`.
  - **Câu hỏi còn mở, cần Backend/Product quyết định**: (a) `GET /suppliers` (danh sách) có nên trả kèm
    `debtBalance` đã tổng hợp sẵn (denormalized view, tính lại mỗi lần ghi) hay để FE tự gọi thêm
    `GET /supplier-transactions?supplierId=X` rồi cộng dồn ở client (doc **không khuyến nghị** cách này
    cho màn danh sách nhiều dòng, chỉ chấp nhận được cho màn chi tiết 1 đối tác).
  - **DB cần sửa**: chưa có SQL cụ thể — phụ thuộc quyết định (a) ở trên (nếu chọn denormalize thì cần
    thêm cột; nếu tính động thì không cần đổi schema).
- **Gap phụ khác trên `suppliers` (mục 4.1/5, chưa chốt)**: `catalogItems[]` ("Danh mục hạng mục & giá
  thiết bị cung cấp") **không có entity/endpoint tương ứng nào** trong DB thật — nếu Product xác nhận
  cần giữ tính năng này, phải tạo bảng mới kiểu `supplier_catalog_items(supplier_id, item_name, price, unit)` (chỉ là ví dụ minh họa, chưa phải SQL chính thức, cần Backend thiết kế lại). Enum trạng thái
  giao dịch NCC cũng đang lệch giữa mock (`NEW/RECEIVED/CANCELLED`) và type thật
  (`PENDING/APPROVED/IN_PROGRESS/COMPLETED/CANCELLED`) — cần chạy lại `SHOW CREATE TABLE supplier_transactions` để chốt (lần viết doc này bị lỗi kết nối MySQL MCP, chưa xác nhận được; tương
  tự chưa xác nhận được `SHOW CREATE TABLE suppliers`).
- **Trạng thái**: chờ Backend xác nhận trạng thái module Supplier trên server thật; FE giữ nguyên mock
  cho tới khi có ETA rõ ràng.

## (o) Mở rộng `GET /api/v1/inventory` (tìm kiếm/lọc) + `POST /api/v1/inventory/adjust` (loại biến động) — phụ thuộc mục (b) đã tạo xong bảng `inventory`

- **Màn liên quan**: "Tồn kho doanh nghiệp" (`/admin/inventory/stock-status`,
  `/manager/inventory/stock-check`) — xem [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md)
  mục 4.1, 5.1, 9. **Điều kiện tiên quyết**: chỉ làm được sau khi bảng `inventory` ở mục (b) đã tồn tại.
- **`GET /api/v1/inventory` cần mở rộng thêm param** (so với `GetInventoryQuery` hiện chỉ có
  `itemId`/`page`/`limit`):
  - `search` (mới) — tìm theo ID/tên thiết bị.
  - `categoryId` (mới) — lọc theo nhóm sản phẩm (options lấy từ `GET /api/v1/catalog/categories` đã có).
  - `date` (mới, `YYYY-MM-DD`) — dùng tính `quantityLocked` theo khoảng ngày `schedule_plans` của đơn
    (công thức đã chốt, **không cần thêm cột/bảng mới**, thuần đổi công thức query); nếu bỏ trống, trả
    `quantityLocked = null`/ẩn cột thay vì mặc định hôm nay.
  - `onlyDamaged=true` (mới) — lọc `quantity_damaged > 0`.
  - Response nên **JOIN sẵn** `itemCode`/`itemName`/`categoryName` (qua `items → item_types → item_categories`), và khi có `date`, trả kèm `quantityAvailable = quantity_total - quantity_damaged
    - quantityLocked`.
  - **DB cần sửa**: không cần cột/bảng mới — thuần mở rộng query + JOIN trên schema đã có ở mục (b).
- **`POST /api/v1/inventory/adjust` cần thêm field `movementType`**:
  - Đổi `MovementType` (`types/inventory.ts`) từ `'INBOUND' | 'ADJUSTMENT'` thành
    `'INBOUND' | 'ADJUSTMENT' | 'DAMAGE'` (giá trị `DAMAGE` này cần được thêm khi Backend tạo bảng
    `inventory` ở mục (b) — nhắc lại ở đây để không bỏ sót).
  - **Request**: `{ itemId: string, movementType: 'INBOUND'|'ADJUSTMENT'|'DAMAGE', quantityChange: number, notes?: string }`. **Output**: `InventoryRow` đã cập nhật (hoặc 204).
  - **Backend cần validate**: `quantity_total` không âm sau khi cộng; `quantity_damaged` không âm và
    không vượt `quantity_total`; `movementType = 'DAMAGE'` ghi vào `quantity_damaged`, 2 loại còn lại
    ghi vào `quantity_total`.
  - Bỏ lựa chọn "xuất kho đi tiệc" (`OUTBOUND`) khỏi form điều chỉnh thủ công của màn này — thuộc phạm
    vi trang "Pick-list xuất kho" (mục (j) ở trên).
- **`GET /api/v1/inventory/movements` giữ nguyên, không cần cột mới** — đã đủ field cho UI hiện có; chỉ
  cột "Tham chiếu" (`reference`, vd `"PN-2607-01"`) cần Backend xác nhận nguồn map từ đâu.
- **Trạng thái**: chờ mục (b) xong trước, sau đó implement 2 phần mở rộng trên theo đúng mô tả (đã chốt,
  không cần hỏi lại Product).

## (p) Modal "Tạo báo giá mới" — `POST /customers/:customerId/quotations` bị lỗi thật (bug, không phải thiếu API) + module `/catalog/*` chưa mount + không có API giá thiết bị

- **Màn liên quan**: modal `CreateQuotationWizardModal` (mở từ `/manager/quotations`, `/admin/quotations`)
  — xem [`docs/taobaogiamoi_api.md`](taobaogiamoi_api.md) (toàn bộ mục 3 đã chốt hướng xử lý, chỉ 2 phát
  hiện dưới đây là MỚI, phát sinh khi test lại bằng `curl` vào backend thật ngày 2026-07-20 — muộn hơn
  thời điểm viết doc gốc).

### (p.1) Bug thật: `GET`/`POST /api/v1/customers/:customerId/quotations` luôn trả lỗi validate sai, dù route có tồn tại

Test trực tiếp bằng `curl` vào backend thật (`localhost:3001`, có JWT hợp lệ, `customerId` là UUID có
thật đã xác nhận tồn tại qua `GET /customers/:id` thành công):

```text
GET /api/v1/customers/6d36f94d-.../quotations
→ 400 { "code": "VALIDATION_ERROR", "details": [{ "path": "customerId",
        "message": "Invalid input: expected string, received undefined" }] }

POST /api/v1/customers/6d36f94d-.../quotations  (đã thử cả 2 cách: customerId chỉ ở path, VÀ
                                                   customerId lặp lại thêm trong body — cùng lỗi)
→ 400 { "code": "VALIDATION_ERROR", "details": [{ "path": "customerId",
        "message": "Invalid input: expected string, received undefined" }] }
```

Đối chứng cùng lúc để loại trừ nguyên nhân "path param nói chung không hoạt động":
`GET /api/v1/customers/:id` (không lồng) và `GET /api/v1/customers/:id/orders` (lồng, cùng dạng route)
**đều hoạt động đúng**, trả dữ liệu thật bình thường với đúng `customerId` đó. Vậy lỗi **chỉ xảy ra
riêng ở route `.../quotations`** — route rõ ràng có được đăng ký (trả lỗi validate 400 có cấu trúc,
không phải 404 "Route not found" như các route chưa mount ở mục (n)), nhưng validator của route này
đang đọc `customerId` từ một nguồn không đúng (có thể do thiếu `mergeParams: true` khi mount
sub-router theo `customerId`, hoặc validator dùng `req.body.customerId`/`req.query.customerId` trong
khi route thật chỉ truyền qua `req.params.customerId`) — **cần Backend tự kiểm tra middleware validate
của route này**, FE không có cách nào workaround vì không kiểm soát được validator phía server.

**Ảnh hưởng**: nút "Lưu" ở Bước 3 của modal Tạo báo giá mới **không thể lưu thành công** với backend
thật ở trạng thái hiện tại — `quotationApiService.createQuotation()` đã gọi đúng endpoint theo đúng
tài liệu, lỗi hoàn toàn ở phía server. FE đã wire đúng (`src/components/quotations/ CreateQuotationWizardModal.tsx`, gọi `quotationApiService.createQuotation(customerId, payload)`) và
hiển thị lỗi rõ ràng cho người dùng thay vì giả vờ thành công — không sửa gì thêm ở FE cho tới khi
Backend xác nhận đã fix.

**Không có endpoint thay thế**: đã thử `POST /api/v1/quotations` (dạng phẳng, `customerId` trong body)
— route này **404 Route not found**, không tồn tại dưới bất kỳ hình thức nào. `GET /api/v1/quotations ?customerId=X` (dạng phẳng, dùng cho màn danh sách ở mục 4.1 doc gốc) **hoạt động đúng** — chỉ riêng
nhánh `POST` mới không có bản thay thế nào khác ngoài route đang lỗi.

### (p.2) Toàn bộ module `/catalog/*` chưa mount + không có API trả đơn giá thiết bị — Bước 2 của modal đang dùng giá FIX CỨNG

Doc gốc (viết trước khi test lại) đề xuất dùng `GET /api/v1/catalog/items?status=ACTIVE` để tải danh
mục thiết bị cho Bước 2 — test thật bằng `curl` xác nhận **toàn bộ `/catalog/items`, `/catalog/types`,
`/catalog/categories` đều 404 Route not found**, module Catalog hoàn toàn chưa được implement trên
backend thật (tương tự phát hiện ở mục (n) cho module Supplier). Endpoint thật duy nhất trả được danh
sách thiết bị là `GET /api/v1/inventory` (đã hoạt động, xác nhận trả `itemId`/`itemName`/`itemCode`/
`unit`/`categoryName`/`typeName`/số lượng tồn — nhưng **không có bất kỳ field giá nào**
(`rentalPrice`/`unitPrice`/`price`)).

Vì báo giá bắt buộc phải có `price` cho mỗi dòng hạng mục, và không có API nào trả giá thiết bị,
FE hiện đang **fix cứng đơn giá gợi ý** theo `itemCode` (`src/components/quotations/ CreateQuotationWizardModal.tsx`, hằng số `FALLBACK_UNIT_PRICE`, có `DEFAULT_FALLBACK_PRICE` cho item
lạ) — **hiển thị in nghiêng trên UI** kèm dòng chú thích "Đơn giá gợi ý... là dữ liệu fix cứng" ngay
dưới tiêu đề Bước 2, người dùng vẫn sửa tay được trước khi lưu (đúng tinh thần "giá tại thời điểm báo
giá" đã chốt ở doc gốc mục 2).

**Cần Backend làm 1 trong 2 hướng** (chưa chốt, cần Backend/Product chọn):

- **Hướng A (khuyến nghị — ít việc hơn)**: thêm cột giá vào response `GET /api/v1/inventory` — mở rộng
  JOIN hiện có sang `items` để trả kèm 1 field giá (ví dụ `unitPrice DECIMAL(14,2)` — cần Backend xác
  nhận bảng `items` đã có cột giá nào chưa, nếu chưa thì `ALTER TABLE items ADD COLUMN unit_price DECIMAL(14,2) NOT NULL DEFAULT 0`). Input: không đổi (`GET /inventory` giữ nguyên params). Output:
  thêm 1 field `unitPrice: number` vào mỗi dòng response hiện có.
- **Hướng B**: implement thật module `/catalog/items` như doc gốc đề xuất (đầy đủ CRUD, có cột giá) —
  nhiều việc hơn Hướng A nhưng khớp đúng kiến trúc `catalog.service.ts`/`types/catalog.ts` đã viết sẵn
  ở FE từ trước (dùng cho các trang quản trị danh mục khác, ví dụ `/admin/catalog/*` — ngoài phạm vi
  tài liệu này, cần rà riêng khi tới lượt các trang đó).

**Trạng thái**: chờ Backend chọn hướng + implement; FE giữ nguyên giá fix cứng in nghiêng cho tới khi
có 1 trong 2 API trên. Mục (p.1) độc lập với mục này — cần Backend fix cả 2 để modal hoạt động đầy đủ
với backend thật (p.1 chặn việc LƯU, p.2 chỉ ảnh hưởng độ chính xác giá gợi ý ban đầu).

**Cập nhật 2026-07-21 — ĐÃ XONG (Hướng A)**: xác nhận lại bằng `curl` thật (đăng nhập `manager`, gọi
`GET /api/v1/inventory?limit=200`) — Backend đã bổ sung đúng Hướng A, response giờ trả kèm
`rentalPrice`/`purchasePrice` thật cho từng dòng (vd `ITM-SPK-01` "Loa JBL 1000W" → `rentalPrice: 500000`), không cần đợi module `/catalog/*` (Hướng B) nữa. Đã cập nhật `InventoryRow`
(`src/types/inventory.ts`) thêm 2 field này, và sửa `CreateQuotationWizardModal.tsx` dùng thẳng
`catalogItem.rentalPrice` thay cho `FALLBACK_UNIT_PRICE`/`fixedPriceFor` — gỡ luôn phần in nghiêng
"dữ liệu fix cứng" ở Bước 2 vì giá giờ là dữ liệu thật. Mục (p.1) (lỗi `POST .../quotations`) vẫn còn
tồn đọng riêng, chưa xử lý ở lần sửa này.

## (q) Trang chi tiết báo giá — tin tốt: `GET /quotations/:id` đã trả đủ dữ liệu mở rộng thật; 3 gap còn lại đã xử lý bằng bỏ/fix cứng, không chặn nối API phần còn lại

- **Màn liên quan**: `/manager/quotations/:id`, `/admin/quotations/:id` — xem
  [`docs/xemchitietbaogia_api.md`](xemchitietbaogia_api.md).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: khác với giả định "chưa chốt" của doc gốc,
  `GET /api/v1/quotations/:id` **đã trả sẵn đúng 100%** shape mở rộng mà doc mục 5.1 đề xuất
  (`customerEmail`/`customerAddress` JOIN, `createdBy` object có `role`, `linkedOrderId`,
  `items[].categoryName`/`unit` JOIN thật) — không cần Backend làm gì thêm cho Trang 1. Đã nối thật,
  bỏ hard-code nhãn "(Kinh doanh)" (dùng `createdBy.role` map sang tiếng Việt), bỏ dòng
  "hiệu lực đến ngày `validUntil`" (cột không tồn tại), items hiển thị đúng `categoryName`/`unit` JOIN
  thật thay vì suy đoán.
- **`PATCH /quotations/:id/status` sai kiểu trong `types/quotation.ts` cũ — đã tự sửa, không cần Backend
  làm gì**: type cũ khai `status: QuotationStatus` (uppercase, có cả `'DRAFT'`) nhưng test thật xác nhận
  backend chỉ nhận **lowercase**, chỉ 2 giá trị `'approved'|'rejected'` (không cho PATCH ngược về draft).
  Đã sửa `UpdateQuotationStatusPayload` + 1 call site sai (`CreateQuotationModal.tsx` từng gửi
  `{status:'APPROVED'}` — sẽ luôn bị backend từ chối, đã sửa thành `'approved'`).
- **3 gap còn lại — đã tự quyết định hướng xử lý ở tầng FE (không chặn phần còn lại), nhưng vẫn cần
  Backend/Product quyết định lâu dài**:
  1. **`GET /policies` (chính sách hoàn cọc/hủy đơn hiển thị ở "Chính sách chung") 404** — chưa tồn tại
     trên backend thật. Đã fix cứng dòng "hiệu lực 30 ngày" + giữ đọc `MOCK_POLICIES` (mock in-memory)
     cho phần chính sách %, **đánh dấu in nghiêng toàn bộ khối** trên UI. **API cần bổ sung**:
     `GET /api/v1/policies?type=DEPOSIT,CANCELLATION&isActive=true` — **Output đề xuất**:
     `{ data: [{ policyId, policyName, policyType, policyValue, unit, description, isActive }] }`.
     Không cần sửa DB (đã xác nhận bảng `business_policies` tồn tại thật ở
     `docs/xemchitietbaogia_api.md` mục 1.2) — chỉ cần route mới.
  2. **Khối "Phân công khảo sát báo giá" — đã BỎ HẲN khỏi UI** (Hướng A đã chốt ở doc mục 2, không có
     cột DB nào liên kết khảo sát trực tiếp vào Quotation) — thay bằng link "Xem đơn đặt liên kết" khi
     `linkedOrderId` có giá trị. Không cần API mới cho quyết định này.
  3. **Trang 2 "Picklist chi tiết vật tư" — đã BỎ HẲN phần bóc tách BOM + cột tồn kho giả** (Hướng B đã
     chốt ở doc mục 3.1/3.2/3.3 — không có bảng nào trong DB thật biểu diễn "1 item gồm nhiều item con"
     hay theo dõi số lượng tồn kho), Trang 2 giờ chỉ hiện thẳng `items[]` thật từ mục 5.1. Nếu Product
     sau này thật sự cần lại 2 tính năng này, cần 2 việc DB riêng (module BOM + module Tồn kho theo
     ngày — module Tồn kho đã có khung sơ bộ ở mục (b)/(o), module BOM **hoàn toàn chưa có đề xuất nào**,
     cần bảng mới kiểu `item_components(parent_item_id, child_item_id, quantity_per_unit)` — xem ví dụ
     SQL minh họa ở `docs/xemchitietbaogia_api.md` mục 3.1, chưa chốt, chỉ là gợi ý).
- ~~Nút "Tạo đơn đặt từ báo giá" (`CreateOrderFromQuotationModal`) — tạm khóa khỏi 2 trang chi tiết
  này~~ **— ĐÃ XONG 2026-07-21**: viết lại hẳn `CreateOrderFromQuotationModal.tsx` nhận đúng
  `QuotationDetailApi` thật (không còn `AdminQuotationRow` mock) — giữ cùng bố cục/validate với
  `CreateOrderModal.tsx` đã hoạt động thật (mục (s)), chỉ khác là prefill sẵn khách hàng + hạng mục từ
  `quotation.items` (`unitPrice = lineTotal/quantity`, tức giá thật sau chiết khấu đã chốt ở báo giá).
  Gọi `orderApiService.createOrder({..., quotationId: quotation.quotationId})` — đã xác nhận qua `curl`
  thật (tạo `ORD-003` từ `QUO-002`) rằng gửi kèm `quotationId` ngay lúc `POST /orders` tự động liên kết
  Order ↔ Quotation (`GET /quotations/:id` sau đó trả đúng `linkedOrderId`), không cần gọi thêm
  `PATCH /orders/:id/quotation` (mục (m)/(y)) cho trường hợp tạo mới. Nút "Sinh đơn đặt từ báo giá" đã
  hiện lại ở `/admin/quotations/:id` và `/manager/quotations/:id` khi `status === 'approved'` và chưa có
  `linkedOrderId`, sau khi tạo thành công điều hướng thẳng sang trang chi tiết đơn vừa tạo.
  **Chưa đụng tới**: nút "Tạo đơn từ báo giá" (disabled) ở `/admin/contracts` — dùng
  `CreateOrderPickQuotationModal` (luồng chọn báo giá trước rồi mới tạo đơn), vẫn còn shape cũ, ngoài
  phạm vi lần sửa này.
- **Trạng thái**: Trang 1 đã nối đầy đủ, hoạt động thật 100% với backend thật (đã test `curl` +
  `GET`/`PATCH status`/`DELETE`/`POST orders` kèm `quotationId`). 2 gap còn lại (chính sách fix cứng,
  N+1 picklist) đã có hướng xử lý tạm ở FE, không chặn — chỉ cần Backend làm khi rảnh tay theo đúng mô
  tả trên.

## (r) Màn "Hợp đồng" (`/admin/contracts`) — đã áp dụng Hướng A (bỏ entity Hợp đồng riêng, dùng view lọc Order); 1 gap hiệu năng N+1 cần Backend bổ sung field khi rảnh tay

- **Màn liên quan**: `/admin/contracts` (chỉ trang danh sách — xem
  [`docs/danhsachhopdong_api.md`](danhsachhopdong_api.md) mục 1.5 "Hướng A khuyến nghị"). Trang chi tiết
  `/admin/contracts/[id]` và modal `ContractEditModal` **ngoài phạm vi** — vẫn đọc
  `src/mocks/adminContractsMock.ts` như cũ, chưa đụng tới.
- **Đã áp dụng Hướng A đúng như doc khuyến nghị**: bỏ hẳn khái niệm "Hợp đồng" là 1 entity riêng (DB
  thật không có bảng `contracts`) — `src/app/admin/contracts/page.tsx` giờ là 1 **view lọc của Order**
  (chỉ hiển thị `Order` có `quotationId` — tức đơn được sinh từ 1 báo giá đã duyệt), gọi thẳng
  `orderApiService.getOrders()`/`getOrder()`/`updateOrderStatus()` đã có sẵn — không có entity/endpoint
  riêng nào cho "Hợp đồng". Đã xóa `ContractCreateModal.tsx` (modal 3 trường thiếu field bắt buộc theo
  `CreateOrderPayload` thật, đúng phân tích doc mục 3.2) — nút "Tạo đơn từ báo giá" tạm khóa (cùng lý do
  đã ghi ở mục (q): `CreateOrderFromQuotationModal` chưa tương thích shape API thật).
- **Gap phát hiện khi nối thật (ngoài phạm vi phân tích ban đầu của doc gốc)**: `GET /api/v1/orders`
  (danh sách) **không trả field `quotationId`** — xác nhận qua `curl` thật (2026-07-20): response danh
  sách chỉ có `orderId/orderCode/customerId/customerName/customerPhone/eventType/eventName/eventDate/ location/guestCount/totalAmount/paymentStatus/orderStatus/createdAt`, không có `quotationId`. Chỉ
  `GET /api/v1/orders/:id` (chi tiết) mới trả `quotationId` (đã xác nhận đơn mẫu thật `ORD-001` có
  `quotationId` khi gọi chi tiết). Vì màn này cần lọc chính xác "đơn có `quotationId`", FE phải gọi
  danh sách rồi gọi tiếp **chi tiết từng đơn** (N+1) để biết đơn nào có `quotationId` — chấp nhận được
  tạm thời vì tổng số đơn hiện rất nhỏ (nghiệp vụ tổ chức sự kiện, không phải khối lượng thương mại điện
  tử), nhưng sẽ chậm khi số đơn tăng lên.
  **Cần Backend bổ sung** (không cần sửa DB, chỉ cần mở rộng response): thêm field `quotationId?: string`
  vào từng phần tử của response `GET /api/v1/orders` (danh sách), giống hệt field đã có sẵn ở
  `GET /api/v1/orders/:id`. **Input**: không đổi (giữ nguyên toàn bộ query param hiện có). **Output**:
  thêm 1 field `quotationId: string | null` vào mỗi object trong `data[]`. Sau khi có field này, FE sẽ
  bỏ hẳn bước gọi chi tiết N+1, lọc thẳng trên response danh sách.
- **4 KPI + tabs trạng thái + cột bảng — đã đổi đúng theo mục 2.1-2.3 của doc**: KPI "Tổng số đơn từ báo
  giá"/"Đang triển khai"/"Đã hoàn thành"/"Tổng giá trị" tính từ chính `Order` (không còn VAT/discount
  giả — cột `orders.total_amount` không có 2 field này, đúng phát hiện mục 2.1). 6 tab trạng thái đổi
  hẳn sang `orderStatus` thật (`NEW/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED`), bỏ 4 tab ký kết văn bản
  cũ (`draft/sent/signed/completed`) vì không có cột thật tương đương (mục 2.2). Cột bảng bỏ 3 cột "Đơn
  đặt liên kết/Trạng thái Đơn/Thanh toán" (join tình cờ qua mock cũ) — mỗi dòng giờ **chính là** 1 Order
  nên không cần cột "liên kết" nữa, hiển thị trực tiếp `orderStatus`/`paymentStatus` của chính dòng đó
  (mục 2.3). Nút "Xóa hợp đồng" đổi thành "Hủy đơn" (`updateOrderStatus(id, {orderStatus:'CANCELLED'})`)
  thay vì xóa cứng bản ghi — đúng khuyến nghị mục 2.3 (không có `DELETE` an toàn cho Order theo CLAUDE.md).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `admin`/`123456`) — mở
  `/admin/contracts` hiển thị đúng đơn thật `ORD-001` (Tech Corp, Tech Summit 2026, 1.600.000₫, "Đã xác
  nhận"/"Chưa thanh toán"), 4 KPI tính đúng (1/1/0/1.600.000₫), tab "Đã xác nhận (1)" lọc đúng. 0 lỗi
  console. `npx tsc --noEmit` sạch (đã sửa 1 lỗi type nhỏ — `o.eventName` optional, thêm `?? ''`).
  Gap N+1 ở trên không chặn demo, chỉ cần Backend bổ sung khi rảnh tay.

## (s) Modal "Tạo đơn đặt lịch tiệc mới" — đã mở lại nút, module `/catalog/*` hóa ra ĐÃ hoạt động (khác ghi nhận cũ ở mục (n)/(p.2)); phát hiện thêm bug thật: giới hạn `limit` không đồng nhất giữa các route

- **Màn liên quan**: `/manager/orders`, `/admin/orders_audit` (nút "Khởi tạo đơn đặt hàng") — xem
  [`docs/taodondatlichtiecmoi_api.md`](taodondatlichtiecmoi_api.md) mục 3.
- **Tin tốt — cập nhật lại phát hiện cũ ở mục (n)/(p.2)**: 2 mục đó (viết cùng ngày 2026-07-20, nhưng
  sớm hơn trong ngày) ghi nhận `/catalog/*` **404 toàn bộ** ("chưa mount trên backend"). Test lại bằng
  `curl` (muộn hơn cùng ngày, sau khi backend được cập nhật) xác nhận **`GET /api/v1/catalog/items` giờ
  hoạt động đầy đủ**, trả kèm `rentalPrice`/`purchasePrice` thật (ví dụ `ITM-SPK-01` "Loa JBL 1000W" —
  `rentalPrice: 500000`) — đúng dữ liệu cần cho bước chọn hạng mục khi tạo đơn, **không cần fix cứng giá
  nữa** cho tính năng này. Component `CreateOrderModal.tsx` (đã viết sẵn từ trước, dùng đúng
  `catalogApiService.getItems()` + `orderApiService.createOrder()`, nhưng mồ côi — không trang nào
  import) giờ wire được thẳng vào nút "Khởi tạo đơn đặt hàng" ở 2 trang trên, không cần viết lại logic.
  **Chưa xóa mục (n)/(p.2) cũ** vì (n) còn nói về module Supplier (vẫn 404, chưa đổi) và (p.2) còn liên
  quan tới đơn giá fix cứng ở modal Tạo báo giá (`CreateQuotationWizardModal`, `FALLBACK_UNIT_PRICE`) —
  **đây là việc riêng, chưa gỡ trong lần sửa này** (ngoài phạm vi task "Tạo đơn đặt lịch tiệc mới"), cần
  1 lần sửa riêng sau để gỡ hard-code giá ở modal báo giá và dùng thẳng `rentalPrice` thật.
- **Bug thật phát hiện + đã sửa (không phải thiếu API, mà là giới hạn `limit` không đồng nhất giữa các
  route)**: `GET /api/v1/customers?limit=200` và `GET /api/v1/orders?limit=200` đều trả `400 VALIDATION_ERROR` ("limit: Too big: expected number to be <=100"), trong khi `GET /api/v1/catalog/items`
  và `GET /api/v1/inventory` lại chấp nhận `limit=200` bình thường (không giới hạn, hoặc giới hạn cao
  hơn). Nhiều nơi trong FE đang gọi `getCustomers({limit:200})`/`getOrders({limit:200})` — khi backend từ
  chối, `.catch()` âm thầm trả về mảng rỗng, khiến dropdown chọn khách hàng/đơn hàng **trống hoàn toàn**
  mà không có lỗi hiển thị nào (rất khó phát hiện nếu không test tay). Đã tự sửa ở FE (đổi tất cả
  `limit: 200` → `limit: 100` cho 2 route này): `src/app/manager/orders/page.tsx`,
  `src/app/admin/orders_audit/page.tsx`, `src/components/quotations/CreateQuotationWizardModal.tsx`
  (chỉ sửa lời gọi `getCustomers`, giữ nguyên `getInventory({limit:200})` vì route đó không giới hạn),
  `src/components/schedule/CreateTaskModal.tsx` (sửa cả `getOrders` và `getCustomers`).
  **Cập nhật 2026-07-24**: sót 1 chỗ — `src/components/layout/Header.tsx` (load "sự kiện sắp tới" ở
  header, chạy trên MỌI trang) vẫn gọi `getOrders({limit:200})`, gây `[API 400] GET /orders` lặp lại ở
  console trên mọi trang (không vỡ UI vì có `.catch()`, nhưng banner "sự kiện sắp tới" luôn rỗng). Đã sửa
  về `limit: 100` cùng đợt này.
  **Đề xuất Backend** (không bắt buộc, chỉ để nhất quán API): hoặc nâng giới hạn `/customers`/`/orders`
  lên khớp `/catalog/items`/`/inventory` (khuyến nghị, ít việc FE hơn về sau), hoặc tài liệu hóa rõ giới
  hạn `limit` tối đa của mỗi route trong OpenAPI spec để FE không phải dò bằng `curl`. **Input/Output**:
  không đổi, chỉ là thay đổi giá trị cho phép của query param `limit` đã có sẵn.
- **Field đã bỏ khỏi form so với mock cũ** (đúng khuyến nghị doc mục 2 — không có cột thật trên `orders`):
  `weddingEndDate` ("Ngày kết thúc"), `depositAmount`, `paymentStatus`, `coordinatorName` ("Điều phối
  viên"), checkbox "Đã khảo sát hiện trường trước khi tạo đơn", dòng subtitle "Mã đơn đặt dự kiến". Gói
  dịch vụ/loại sự kiện dùng chung 1 field `eventType` (danh sách gợi ý `EVENT_TYPES`, cột thật là text tự
  do — đúng phát hiện của doc).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`) —
  mở `/manager/orders`, bấm "Khởi tạo đơn đặt hàng", chọn khách hàng thật ("Tech Corp"), chọn loại sự
  kiện, ngày tổ chức, số khách, địa điểm, thêm 1 hạng mục thật từ catalog (giá tự điền `rentalPrice`
  thật), bấm "Tạo đơn hàng" — tạo thành công, danh sách tự tải lại và hiện đơn mới. `npx tsc --noEmit`
  sạch. Đã áp dụng y hệt cho `/admin/orders_audit`.

## (t) Màn "Khảo sát hiện trường" — đã nối API thật đầy đủ (danh sách toàn cục + chi tiết + xác nhận); 3 gap còn lại xử lý bằng in nghiêng, theo đúng hướng đã chốt ở doc

- **Màn liên quan**: `/manager/survey`, `/admin/reports/survey` — xem
  [`docs/khaosathientruong_api.md`](khaosathientruong_api.md) (toàn bộ quyết định đã chốt ở mục 0/2/3,
  xem bảng tổng hợp mục 8 — tài liệu này chỉ xác nhận lại bằng `curl`/Playwright thật, không cần quyết
  định kiến trúc mới).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: khác với ghi nhận cũ ở comment đầu `types/survey.ts`
  ("KHÔNG join reporter/confirmer"), `GET /api/v1/survey-reports` (danh sách toàn cục — **trước đây
  hoàn toàn chưa có, chỉ có bản theo 1 đơn**) và `GET /api/v1/survey-reports/:id` giờ **đã join sẵn**
  `orderCode`/`customerName`/`eventName`/`reportedByName`/`confirmedByName` + `meta.counts` đúng 4 giá
  trị enum thật (`all`/`draft`/`needsReview`/`submitted`/`confirmed`) — khớp 100% yêu cầu doc mục 1/7,
  không cần Backend làm gì thêm cho phần join. Đã nối thật: `src/types/survey.ts` (thêm
  `SurveyReportListItem`/`GetSurveyReportsQuery`/`SurveyReportListMeta`, thêm field
  `orderCode`/`customerName`/`eventName`/`reportedByName`/`confirmedByName` vào `SurveyReport`),
  `src/services/survey.service.ts` (thêm `getSurveyReports()`), viết lại toàn bộ
  `src/app/{manager/survey,admin/reports/survey}/page.tsx` (gọi `surveyApiService.getSurveyReports()`
  server-side search/status/phân trang, KPI đọc thẳng `meta.counts`) và
  `src/components/survey-reports/SurveyDetailDrawer.tsx` (nhận `SurveyReport` thật thay vì mock
  `AdminSurveyReport`).
- **Đã bỏ nút "+ Tạo báo cáo khảo sát" + `SurveyCreateDrawer`** khỏi cả 2 trang (đúng chốt ở doc mục 0
  — đây là hành động Leader Staff qua mobile, không phải Manager trên web). `SurveyCreateDrawer.tsx`
  giữ nguyên trên đĩa (không xóa) — chỉ còn giá trị tham khảo bàn giao mobile team như doc đã ghi, hiện
  mồ côi (không trang nào import), cùng loại với `SurveyPersonnelTab`/`RecordDepositModal` đã ghi nhận
  ở các Task trước.
- **Enum đổi đúng theo mục 2**: `PENDING_CONFIRM` (mock) → `NEEDS_REVIEW` (thật); `SUBMITTED` tạm gộp
  badge/KPI "Chờ xác nhận" cùng `NEEDS_REVIEW` cho tới khi Backend làm rõ sự khác biệt (đúng khuyến
  nghị mục 2, không cần API mới).
- **3 gap còn lại — đã áp dụng đúng nguyên tắc "chỉ lấy dữ liệu đủ" của doc mục 3, fix cứng in nghiêng
  phần thiếu, không chặn phần còn lại**:
  1. **2 cột đo đạc chưa có** (mục 3.1): "Chiều cao trần" và "Công suất nguồn điện khả dụng" —
     `survey_reports` không có cột nào lưu 2 giá trị này. Đã hiển thị **in nghiêng** bằng dữ liệu fix
     cứng (`MOCK_CEILING_HEIGHT`/`MOCK_POWER_CAPACITY` trong `SurveyDetailDrawer.tsx`) kèm chú thích rõ.
     **API/DB cần bổ sung**: `ALTER TABLE survey_reports ADD COLUMN ceiling_height DECIMAL(5,2) NULL, ADD COLUMN power_capacity VARCHAR(100) NULL` — **Output**: thêm 2 field
     `ceilingHeight?: number`/`powerCapacity?: string` vào response `GET /survey-reports/:id` (và có
     thể cả list nếu cần hiển thị ở bảng). **Input**: thêm 2 field tương ứng (optional) vào
     `CreateSurveyReportPayload` (`POST /survey-reports`, phía mobile Leader Staff điền khi nộp báo cáo).
  2. ~~"Danh sách thiết bị báo giá nháp" (`quoteItems`) hoàn toàn không có trong DB~~ — **ĐÃ GIẢI QUYẾT
     (2026-07-21), không cần bảng mới.** Nhận định cũ sai: gap này không nằm ở `survey_reports` (bảng đó
     đúng là không có cột nào lưu thiết bị), mà dữ liệu thật ra đã có sẵn ở **báo giá (quotation) liên
     kết với đơn của báo cáo khảo sát đó** — `report.orderId` → `GET /orders/:orderId` (trả
     `quotationId`) → `GET /quotations/:quotationId` (đã trả đủ `items[]` thật: `itemName`/
     `categoryName`/`unit`/`quantity`/`price`/`lineTotal`, xác nhận qua `curl`). Đã sửa
     `SurveyDetailDrawer.tsx` gọi 2 API này tuần tự khi mở drawer, đổi bảng từ `MOCK_QUOTE_ITEMS` sang
     `linkedQuotation.items` thật, bỏ nhãn "(dữ liệu minh họa)"; có 3 trạng thái hiển thị: đang tải /
     đơn chưa liên kết báo giá nào / lỗi tải. Cùng cách xử lý áp dụng được cho khối "Đối chiếu khảo sát
     thực tế" ở trang chi tiết báo giá đã ghi nhận ở mục (q) — có thể tái dùng khi tới lượt màn đó (hiện
     màn đó đã bỏ hẳn tính năng theo Hướng B, chưa cần làm lại).
  3. **Đa ảnh minh chứng** (mục 3.5) — `survey_reports.evidence_id` chỉ lưu được **1 ảnh**/báo cáo
     (cột đơn, không có bảng đính kèm nhiều file dạng `evidence_attachments` như CLAUDE.md mô tả —
     bảng đó **không tồn tại thật**, đã xác nhận qua `SHOW TABLES`). Đã hiển thị đúng 1 ảnh thật qua
     `GET /evidence/:id` (khi có `evidenceId`) + 1 ảnh minh họa viền nét đứt kèm chú thích rõ, không
     giả vờ có nhiều ảnh thật. **Cần Backend làm** (nếu Product xác nhận cần đa ảnh cho khảo sát —
     nghiệp vụ hợp lý vì 1 buổi khảo sát thường cần chụp nhiều góc): bảng mới
     `evidence_attachments(attachment_id PK, entity_type ENUM(...,'SURVEY_REPORT'), entity_id, evidence_id, created_at)`
     theo đúng pattern polymorphic CLAUDE.md đã đề xuất (hiện chưa implement) — **Output**
     `GET /survey-reports/:id` đổi `evidenceId`/`evidence` đơn thành `evidenceIds: string[]`/
     `evidences: Evidence[]`, **Input** `POST /survey-reports` nhận `evidenceIds?: string[]` thay cho
     `evidenceId?: string`.
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`) —
  `/manager/survey` hiện đúng 1 báo cáo thật `SUR-001` (Tech Corp, Tech Summit 2026, trạng thái "Đã xác
  nhận"), 4 KPI đúng (1/0/1/0); mở "Xem chi tiết" hiện đúng dữ liệu thật (địa điểm, khảo sát viên "Team
  Leader", người xác nhận "Project Manager") + 2 khối in nghiêng đúng vị trí. `npx tsc --noEmit` sạch.
  Đã áp dụng y hệt cho `/admin/reports/survey`. Chưa test được nút "Xác nhận báo cáo khảo sát" bằng
  thao tác thật (báo cáo mẫu duy nhất trong DB đã ở trạng thái `CONFIRMED`, không còn báo cáo nào ở
  `NEEDS_REVIEW`/`SUBMITTED` để bấm thử) — đã xác nhận đúng logic qua code review (điều kiện hiện nút,
  payload gửi `PUT /survey-reports/:id/confirm`).

## (u) Màn "Tồn kho doanh nghiệp" — bảng `inventory` thật ra ĐÃ được tạo (khác ghi nhận cũ ở mục (b)); đã nối API thật, 3 gap còn lại xử lý bằng bỏ/in nghiêng theo đúng hướng đã chốt ở doc

- **Màn liên quan**: `/manager/inventory/stock-check`, `/admin/inventory/stock-status` + modal chi
  tiết thiết bị + trang "Thiết bị đang bảo trì" (`/admin/inventory/maintenance`) — xem
  [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md) (viết với giả định bảng `inventory`
  **chưa tồn tại**, xem mục (b) — nay cần cập nhật lại phần "giả định" đó).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: khác hẳn ghi nhận ở mục (b) ("chưa có bảng `inventory`
  nào trong DB thật"), `GET /api/v1/inventory` và `GET /api/v1/inventory/movements` **đã hoạt động đầy
  đủ với dữ liệu thật** — trả sẵn `itemCode`/`itemName`/`categoryName`/`typeName` (join `items → item_types → item_categories`) + 4 số liệu `quantityTotal`/`quantityDamaged`/`quantityReserved`/
  `quantityAvailable`. `GET /api/v1/catalog/items/:id` cũng trả kèm `rentalPrice`/`purchasePrice`/
  `description` thật (không cần fix cứng giá cho modal chi tiết). Đã nối thật toàn bộ: viết lại
  `src/types/inventory.ts` (sửa field theo response thật — bỏ `inventoryId` không tồn tại,
  `performedBy` là object `{userId, fullName}` không phải string, `AdjustInventoryPayload` dùng
  `deltaTotal`/`deltaDamaged` không phải `movementType`/`quantityChange` như doc gốc đề xuất), viết lại
  `src/app/{manager/inventory/stock-check,admin/inventory/stock-status}/page.tsx` (gọi
  `inventoryApiService.getInventory()` thật), tạo **component mới** `src/components/catalog/ InventoryDetailModal.tsx` (**không** sửa `EquipmentDetailModal.tsx` cũ — component đó vẫn đang dùng
  chung ở `/admin/catalog/packages`, 1 trang CRUD danh mục hoàn toàn khác, thuần mock, đổi chung sẽ phá
  vỡ trang đó). Đã sửa `src/app/admin/inventory/maintenance/page.tsx` (bỏ tham chiếu `row.inventoryId`
  không còn tồn tại trên type, dùng `itemId` làm khóa).
- **3 gap phát hiện khi test thật (khác giả định ban đầu của doc, doc viết trước khi có bảng
  `inventory` thật nên chưa biết các gap này) — đã xử lý bằng bỏ khỏi UI hoặc fix cứng in nghiêng,
  không chặn phần còn lại**:
  1. **`date` không ảnh hưởng `quantityReserved`** — công thức "khóa kho theo khoảng ngày
     `schedule_plans`" đã chốt ở doc mục 3 **chưa được implement**; backend nhận param `date` nhưng bỏ
     qua, `quantityReserved` luôn là 1 con số cố định (không phụ thuộc ngày). Đã **bỏ hẳn ô chọn ngày**
     khỏi UI (giữ sẽ gây hiểu nhầm là số liệu date-based thật) — đổi nhãn cột thành "Số lượng đã khóa"
     đơn giản (không kèm ngày). **Cần Backend implement đúng công thức SQL đã chốt ở doc mục 3** (dùng
     `schedule_plans.start_time`/`end_time`) nếu muốn tính năng lọc theo ngày hoạt động thật — **Input**
     giữ nguyên param `date` đã có, **Output** thêm field `quantityReserved` tính động theo `date` thay
     vì tĩnh như hiện tại.
  2. **`categoryId`/`onlyDamaged` bị backend bỏ qua** (nhận param nhưng không lọc, xác nhận qua `curl`:
     `onlyDamaged=true` vẫn trả cả item không hỏng). Đã chuyển 2 filter này sang lọc **phía client**
     (dữ liệu hiện chỉ 3 item, chấp nhận được) — dropdown "Nhóm sản phẩm" derive từ `categoryName` của
     chính danh sách đã tải (không cần `GET /catalog/categories`, endpoint đó cũng đang 404 — xem mục
     (n)/(p.2) cho phát hiện tương tự ở Supplier/Catalog). **Cần Backend implement lọc thật ở server**
     khi số lượng item tăng lên (client-side không scale) — **Input**: giữ nguyên 2 param đã có,
     **Output**: áp dụng đúng điều kiện lọc trước khi trả `data[]`/`meta`.
  3. **`POST /inventory/adjust` không hỗ trợ ghi nhận riêng "hàng hỏng" mà không đổi tổng số lượng** —
     xác nhận qua `curl`: `deltaTotal` bắt buộc và phải khác 0 (validate chặn `deltaTotal: 0` dù có
     `deltaDamaged` khác 0), nghĩa là không thể mô tả nghiệp vụ "kiểm kê phát hiện 1 đơn vị đã hỏng
     trong số hiện có, không nhập/xuất thêm gì" bằng endpoint này. Form "Điều chỉnh tồn kho" đã đổi
     thành 2 loại có nghĩa thật (Nhập kho thêm / Điều chỉnh kiểm kê ±), bỏ hẳn lựa chọn "Ghi nhận hỏng"
     độc lập, kèm chú thích rõ giới hạn này. **Cần Backend nới validate**: cho phép `deltaTotal: 0` khi
     `deltaDamaged !== 0` (chỉ cấm trường hợp cả 2 đều 0/thiếu) — **Input**: đổi rule validate của
     `deltaTotal` từ "bắt buộc khác 0" thành "ít nhất 1 trong 2 field `deltaTotal`/`deltaDamaged` khác
     0", **Output**: không đổi.
  4. **2 cột `items.dimensions`/`items.material` + cột `inventory.location` vẫn chưa có** (đúng ghi
     nhận cũ ở mục (b), phần này KHÔNG phải tin mới) — hiển thị in nghiêng bằng dữ liệu fix cứng trong
     `InventoryDetailModal.tsx`, giữ nguyên đề xuất DB ở mục (b).
  5. **`GET /api/v1/catalog/items/:id` (chi tiết theo id) trả 404** — xác nhận qua `curl` (route
     không tồn tại, khác `GET /catalog/items` danh sách hoạt động đúng). Đã sửa FE gọi danh sách
     (`limit: 100`) rồi tự lọc theo `itemId` phía client thay vì gọi endpoint chi tiết không tồn tại
     (dữ liệu hiện rất nhỏ, chấp nhận được). **Cần Backend bổ sung** route `GET /api/v1/catalog/items/:id`
     nếu muốn FE gọi trực tiếp theo id khi danh mục lớn hơn — **Input**: `:id` (path param, UUID),
     **Output**: 1 object `Item` giống 1 phần tử trong response danh sách hiện có.
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`) —
  `/manager/inventory/stock-check` hiện đúng 3 thiết bị thật (Loa JBL 1000W/Đèn Beam 230/Bàn tiệc
  tròn) với số liệu tồn kho thật; mở modal chi tiết hiện đúng giá/mô tả thật + nhật ký biến động thật
  (join tên người thực hiện); thử "Nhập kho thêm" 1 thiết bị — số Tổng số lượng tăng đúng, nhật ký ghi
  thêm dòng mới. `npx tsc --noEmit` sạch. Đã áp dụng y hệt cho `/admin/inventory/stock-status`.

## (v) Tab "Tiến độ sự kiện" (chi tiết đơn) — đã nối API thật cả 6 mốc; 3 điểm sai lệch shape thật vs comment cũ trong `types/order.ts` đã tự sửa

- **Màn liên quan**: `/manager/orders/[id]` (tab "Tiến độ sự kiện") — xem
  [`docs/tiendosukien_api.md`](tiendosukien_api.md) (mọi quyết định đã chốt ở mục 9.1, không còn mục
  nào chờ Product ngoại trừ 9.2 điểm 1 — giờ thực tế `schedule_plans`, xem dưới).
- **3 điểm shape thật khác comment cũ trong `types/order.ts` — đã tự sửa qua `curl` (2026-07-20), không
  phải gap cần Backend làm gì thêm**:
  1. `GET /orders/:id` trả field tên **`items`**, không phải `orderItems` như comment cũ giả định.
     Response cũng **không kèm** `orderWarnings`/`deposits`/`settlements` lồng sẵn — đã đổi 3 field này
     thành optional trên `OrderDetail`, gọi riêng qua `paymentApiService.getOrderDeposits()`/
     `settlementApiService.getOrderSettlement()` (2 endpoint này hoạt động đúng, xác nhận qua `curl`).
  2. `orders.created_by` (`Order.createdBy`) đã **join sẵn thành object** `{userId, fullName, role}` —
     khác hẳn comment cũ ("ID thô, cần Backend join thêm `createdByName`" — doc mục 2/9.1 điểm 3). Tin
     tốt: dùng thẳng `order.createdBy.fullName` làm "Điều phối viên" ở Mốc 1, không cần round-trip
     `GET /users/:id` như doc lo ngại.
  3. `PATCH /orders/:orderId/live-checklist` và `PUT /orders/:orderId/close` (2 endpoint doc mục 9.1
     điểm 1/2 đề xuất Backend làm) **đã được implement đầy đủ**, xác nhận qua `curl`: PATCH trả lại
     object checklist đầy đủ mới nhất (không có GET riêng — FE khởi tạo state ban đầu luôn là tất cả
     `false`, không có cách đọc lại state cũ nếu rời trang); PUT close đúng chặn 400 khi
     `orderStatus != COMPLETED` hoặc `paymentStatus != PAID` hoặc đã đóng rồi.
- **Việc còn lại đã ghi ở mục (f) (chưa đổi)**: Khảo sát hiện trường ở Mốc 2 vẫn placeholder — backend
  chưa seed `work_tasks` "Khảo sát hiện trường".
- **Gap còn mở, chưa tự chốt được (đúng doc mục 9.2 điểm 1)**: giờ bắt đầu/kết thúc **thực tế** của
  `schedule_plans` (khác giờ kế hoạch) — Mốc 3 hiện chỉ hiển thị read-only `startTime` kế hoạch từ
  `GET /schedule-plans?orderId=`, không có cột `actualStartTime`/`actualEndTime` nào để đọc thêm; hành
  động sửa/xóa/bắt đầu thuộc tab "Lịch trình & Kỹ thuật" (chưa tới lượt), không code ở đây.
  **Tin tốt phụ**: `GET /schedule-plans?orderId=` đã trả đúng `assignees[]` nhiều người/vai trò/SĐT thật
  (không phải `assigneeName` đơn như type cũ khai) — đã sửa `types/schedulePlan.ts` thêm field
  `assignees`, dùng hiển thị "Team Leader (Trưởng nhóm)"/"Technician (Kỹ thuật viên)" ở Mốc 3.
- **"N nhóm thiết bị" ở Mốc 1 (doc mục 8)**: vẫn chưa join category vào `orderItems` — đã đổi label
  UI sang "N hạng mục thiết bị" (đếm `order.items.length`) thay vì giả vờ đếm theo category, tránh số
  liệu sai. Giữ nguyên đề xuất Backend join `item.category` ở mục 8 nếu muốn khôi phục đúng ý nghĩa cũ.
- **Component tái sử dụng**: `src/components/orders/RecordSettlementModal.tsx` (mồ côi từ trước, đã
  viết sẵn đúng `settlementApiService.recordSettlement()`) giờ wire vào Mốc 5 — không cần viết lại.
- File đã sửa: `src/types/order.ts` (sửa `OrderDetail`, thêm `LiveShowChecklist`/
  `UpdateLiveChecklistPayload`/`CloseOrderPayload`, sửa `createdBy`), `src/services/order.service.ts`
  (thêm `updateLiveChecklist`/`closeOrder`), `src/types/schedulePlan.ts` (thêm `assignees`/`orderCode`/
  `customerName`/`eventName`), `src/services/mockAdapter.ts` (sửa `createdBy` mock khớp object mới),
  viết lại tab "lifecycle" ở `src/app/manager/orders/[id]/page.tsx` (đã mirror sang
  `src/app/admin/orders_audit/[id]/page.tsx`, chưa rà lại riêng theo phân quyền Admin read-only —
  ngoài phạm vi lần này, người dùng chỉ yêu cầu làm Manager).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`,
  đơn thật `ORD-001`) — mở tab "Tiến độ sự kiện" hiện đúng cả 6 mốc với dữ liệu thật (giá trị đơn,
  điều phối viên, cọc 800.000₫, lịch trình "Lắp đặt thiết bị" + 2 người phụ trách thật, checklist Live
  Show, quyết toán 800.000₫ DRAFT); bấm "Xác nhận đã nhận cọc" → gọi đúng
  `PUT /deposits/:id {status:'SUCCESS'}` thật, Mốc 2 chuyển "Hoàn thành", header đổi badge "Đã cọc",
  "Tiến độ chung" tăng từ 1/5 lên 2/5 — trạng thái lưu thật trong DB (còn nguyên sau khi tải lại trang).
  `npx tsc --noEmit` sạch, 0 lỗi console. Chưa test thao tác thật luồng Mốc 5 (lập/xác nhận quyết toán)
  và Mốc 6 (đóng đơn) trong phiên này — đã xác nhận đúng logic/endpoint qua `curl` riêng lẻ trước khi
  code, nhưng chưa bấm thật qua UI end-to-end.

## (w) Tab "Thiết bị & Kho hàng" (chi tiết đơn, chỉ Manager) — đã nối API thật bảng chính + Picklist; endpoint "confirm-prepared" không hoạt động đúng như tài liệu

- **Màn liên quan**: `/manager/orders/[id]` tab "Thiết bị & Kho hàng" — xem
  [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) (mọi quyết định đã chốt ở mục 7.1). **Chỉ làm
  phía Manager theo yêu cầu người dùng** — chưa rà lại bản Admin (đúng ra phải read-only ở tầng backend
  theo mục 0/7.1 điểm 7, chưa xác nhận).
- **2 điểm shape thật khác comment cũ trong `types/order.ts` — đã tự sửa qua `curl` (2026-07-20)**:
  1. `OrderItem.itemName`/`unit` là field **top-level** trên mỗi phần tử, không phải lồng trong
     `item.itemName` như khai báo cũ — đã sửa type.
  2. **`preparedBy` hoàn toàn không xuất hiện trong response** `GET /orders/:id` dù
     `PATCH /orders/:orderId/items/:orderItemId` **có nhận** field này (xác nhận qua `curl`: PATCH
     `{preparedQty:1}` cập nhật thành công, đọc lại `GET /orders/:id` thấy `preparedQty` đổi nhưng
     không có field `preparedBy` nào trong response để đọc lại tên người phụ trách đã ghi, nếu có). Web
     hiện hiển thị "Chưa cập nhật" cho cột này. **Cần Backend bổ sung**: thêm field `preparedBy` vào
     response `GET /orders/:id` → `items[]` (đã có cột `order_items.prepared_by` theo doc mục 3, chỉ
     thiếu SELECT ra). **Input**: không đổi. **Output**: thêm `preparedBy?: string` vào mỗi phần tử
     `items[]`.
- **Tin tốt xác nhận qua `curl`**: `PATCH /api/v1/orders/:orderId/items/:orderItemId` (mục 2a doc,
  dành cho Leader Staff mobile) **đã hoạt động đúng** — test `{preparedQty:1}` cập nhật thành công,
  verify lại `GET /orders/:id` thấy `preparedQty` đổi từ 0 → 1. Không gọi endpoint này từ web (đúng
  quyết định Hướng B đã chốt — web chỉ đọc, Leader Staff mobile mới ghi).
- **Bug/gap thật phát hiện**: `PUT /api/v1/orders/:orderId/items/confirm-prepared` (mục 2b doc, dành
  cho Manager xác nhận cấp đơn) **không hoạt động như tài liệu mô tả** — test bằng `curl` với body
  `{}`/`{notes:...}` đều trả lỗi `VALIDATION_ERROR` yêu cầu field `items` dạng mảng (khớp payload của
  `PUT /orders/:id/items` — endpoint thay TOÀN BỘ danh sách item — không khớp payload `{notes?}` mà
  doc mục 2b đề xuất). Nhiều khả năng route `confirm-prepared` **chưa được implement riêng**, request
  đang bị 1 route khác (`PUT /orders/:orderId/items`) bắt nhầm. Đã khóa nút "Xác nhận đã chuẩn bị xong"
  trên UI (disabled + tooltip trỏ tới mục này) thay vì gọi 1 API không hoạt động đúng. **Cần Backend**:
  implement đúng route `PUT /api/v1/orders/:orderId/items/confirm-prepared` theo mô tả doc mục 2b
  (`{notes?: string}` → xác nhận khi mọi dòng `preparedQty = quantity`, ghi `items_confirmed_at`/
  `items_confirmed_by`), tách biệt khỏi route `PUT /orders/:orderId/items` hiện có.
- **Tin tốt khác**: bảng `inventory` (đã xác nhận tồn tại thật ở mục (u)) cho phép hiện lại cột "Tồn
  kho khả dụng" ở modal Picklist mà doc gốc dự tính phải ẩn (viết trước khi phát hiện bảng này tồn tại)
  — đã bật cột này, đọc qua `inventoryApiService.getInventory({itemId})` cho từng hạng mục.
- File đã sửa: `src/types/order.ts` (sửa `OrderItem`), viết lại tab "items" +
  modal Picklist ở `src/app/manager/orders/[id]/page.tsx` (chỉ phía Manager, chưa mirror sang Admin).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đơn `ORD-001`) — tab hiện đúng 2
  hạng mục thật (Loa JBL 1000W 1/2 đã bàn giao — khớp đúng lần PATCH thử qua `curl` trước đó; Đèn Beam
  230 0/2), giá tiền/tổng cộng đúng; mở "Xem phiếu chuẩn bị" hiện đúng tồn kho khả dụng thật (8, 12).
  `npx tsc --noEmit` sạch, 0 lỗi console.

## (x) Tab "Lịch trình & Kỹ thuật" (chi tiết đơn, chỉ Manager) — đã nối API thật đầy đủ, không phát sinh gap mới ngoài các mục đã ghi ở (f)

- **Màn liên quan**: `/manager/orders/[id]` tab "Lịch trình & Kỹ thuật" — xem
  [`docs/lichtrinhkythuat_api.md`](lichtrinhkythuat_api.md) (mọi quyết định đã chốt ở mục 10.1, mục
  10.2 "không còn mục nào" — tài liệu tự nhận là đầy đủ nhất trong các tài liệu API đã viết).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: `GET /schedule-plans?orderId=` đã trả **đủ mọi field**
  doc yêu cầu — `taskName` join sẵn, `assignees[]` đa phân công thật kèm `role`/`phone` join sẵn (đúng
  hướng đã chốt mục 4 điểm 9, không cần round-trip `GET /users/:id`), và còn tốt hơn dự tính: mỗi
  assignee có luôn `checkInAt`/`checkOutAt` **theo từng người** — thay thế trực tiếp nhu cầu
  "actual_start_time/actual_end_time" mà doc mục 1/10.1 điểm 10 đề xuất thêm cột mới (Backend đã hiện
  thực theo hướng chi tiết hơn: giờ thực tế gắn với **từng người** trong `schedule_plan_assignees`,
  không phải 1 cặp giờ chung cho cả `schedule_plans`) — **không cần Backend làm gì thêm cho điểm này**,
  chỉ cần cập nhật lại `docs/tiendosukien_api.md` mục 9.2 điểm 1 (đã đóng, không còn là câu hỏi mở).
  `PATCH /schedule-plans/:id/status {status:'CONFIRMED'}` đã test đúng validate ("Chỉ có thể xác nhận
  kế hoạch đang ở trạng thái PENDING").
- **Đã nối thật**: danh sách nhiều `schedule_plans` (bỏ hẳn `.find()` lấy 1 plan), badge theo đúng
  `ScheduleStatus` thật (5 giá trị, có `CANCELLED`), người/đội phụ trách hiện đủ tên/vai trò/SĐT/
  check-in-out thật, nút "Xác nhận kế hoạch" (`PENDING → CONFIRMED`), nút "Hủy" (`* → CANCELLED`, điều
  kiện `status ∉ {IN_PROGRESS, COMPLETED, CANCELLED}`), nút "Xem ảnh minh chứng" (`GET /evidence/:id`
  khi `evidenceId` có giá trị, khác `null` mới hiện nút). Nút "Bắt đầu làm việc"/"Tải ảnh thi công" đã
  bỏ hẳn khỏi web (đúng ranh giới vai trò đã chốt — hành động Leader Staff mobile).
- **Chưa xử lý (đúng phạm vi doc, không phải gap mới)**: nút "Sửa" chỉ điều hướng sang
  `/manager/schedule/plans` (chưa truyền `?planId=`, vì trang đó chưa có tài liệu/implement riêng —
  ngoài phạm vi). Danh mục loại việc vẫn thiếu "Khảo sát hiện trường"/"Vận chuyển thiết bị" — đã ghi ở
  mục (f), không lặp lại.
- File đã sửa: viết lại tab "plans" ở `src/app/manager/orders/[id]/page.tsx` (chỉ phía Manager, chưa
  mirror sang Admin theo yêu cầu người dùng).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đơn `ORD-001`, plan
  "Lắp đặt thiết bị" đang `IN_PROGRESS`) — thẻ hiện đúng `LICH-001`, ngày/giờ/địa điểm thật, 2 người
  phụ trách thật (Team Leader/Technician) kèm SĐT + check-in thật; nút "Xác nhận kế hoạch"/"Hủy" đúng
  bị ẩn (vì status đã `IN_PROGRESS`, không còn `PENDING`); modal "Xem chi tiết" hiện đúng dữ liệu thật.
  `npx tsc --noEmit` sạch, 0 lỗi console. Chưa test được thao tác thật nút "Xác nhận kế hoạch"/"Hủy"/
  "Xem ảnh minh chứng" (dữ liệu mẫu hiện tại không có plan nào ở `PENDING` hoặc `COMPLETED` có
  `evidenceId` để bấm thử) — đã xác nhận đúng endpoint/payload qua `curl` riêng lẻ trước khi code.

## (y) Tab "Báo giá & Hợp đồng" (chi tiết đơn, chỉ Manager) — tin tốt bất ngờ: endpoint liên kết/hủy liên kết doc đánh dấu "CHƯA CHỐT shape" hóa ra ĐÃ hoạt động thật; workaround cho bug (p.1) vẫn còn

- **Màn liên quan**: `/manager/orders/[id]` tab "Báo giá & Hợp đồng" — xem
  [`docs/baogiavahopdong_api.md`](baogiavahopdong_api.md) (đã chốt Hướng A bỏ "Hợp đồng" ở mục 1.1,
  giữ tính năng liên kết/hủy liên kết ở mục 1.2/5.1, nhưng mục 5.2 điểm 2 ghi rõ "shape endpoint CHƯA
  CHỐT" cho `PATCH /orders/:orderId/quotation`).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: `PATCH /api/v1/orders/:orderId/quotation`
  `{quotationId: string | null}` — endpoint mà doc mục 2 #4/5.2 điểm 2 đánh dấu "chỉ là gợi ý minh
  họa, chưa chốt, Backend có thể chọn shape khác" — **đã được implement đúng y hệt shape đề xuất**,
  test thật (gửi lại đúng `quotationId` hiện có) trả về `Order` đầy đủ đã cập nhật. Không cần chờ
  Backend xác nhận thêm cho điểm này — đã nối thẳng qua `orderApiService.updateOrderQuotation()`
  (method mới, thêm vào `order.service.ts`).
- **Workaround cho bug đã biết (mục (p.1))**: `GET /customers/:customerId/quotations` (đề xuất ở doc
  mục 2 #3 để đếm số báo giá `APPROVED` của khách hàng — điều kiện enable nút "Hủy liên kết", mục 1.2)
  **vẫn lỗi thật y hệt mục (p.1)** ("customerId: expected string, received undefined"), chưa được
  Backend sửa. Đã dùng **workaround khác**: `GET /api/v1/quotations?customerId=:id` (endpoint phẳng,
  đã nối thật ở "Danh sách báo giá") — `meta.counts.approved` của response này chính là số báo giá
  `APPROVED` của khách hàng đó (đã verify: counts không đổi theo filter `status`, luôn phản ánh tổng
  theo `customerId`), dùng thay cho endpoint bị lỗi, không cần Backend sửa gấp mục (p.1) chỉ để phục
  vụ tab này (dù vẫn nên sửa cho các nơi khác cần dùng endpoint đó).
- **Đã tự quyết cách xác định "báo giá có thể liên kết"** (doc mục 3 dòng cuối, `linkableQuotations`):
  vì `QuotationListItem` (danh sách phẳng) không có field `linkedOrderId`, đã tự làm N+1 nhỏ — lấy
  danh sách báo giá `APPROVED` của khách hàng (thường 1-2 báo giá/khách, chấp nhận được), gọi chi tiết
  từng cái (`GET /quotations/:id`, có `linkedOrderId`) để lọc ra báo giá **chưa** gắn đơn nào.
- **Đã bỏ hẳn khối "Hợp đồng liên kết"** (dòng `HD2507-001` + nút "Xem hợp đồng"/"Tạo hợp đồng") đúng
  Hướng A đã chốt ở `docs/danhsachhopdong_api.md` — khi `order.quotationId` khác `null`, chính đơn
  đang xem là "hợp đồng", không có gì khác để xem/tạo thêm.
- **"Giá trị giao kèo" đọc đúng `quotation.totalAmount`** (chốt lúc duyệt báo giá, `1.600.000₫` khớp
  dữ liệu mẫu), không dùng `order.totalAmount` (có thể đổi sau qua Change Request) — đúng quyết định
  đã chốt ở doc mục 3/5.1.
- File đã sửa: `src/types/order.ts` (thêm `UpdateOrderQuotationPayload`), `src/services/order.service.ts`
  (thêm `updateOrderQuotation`), viết lại tab "quotation" ở `src/app/manager/orders/[id]/page.tsx`
  (chỉ phía Manager, chưa mirror sang Admin — theo yêu cầu người dùng; doc mục 0 cũng khuyến nghị bản
  Admin nên read-only cho tab này, chưa áp dụng).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đơn `ORD-001`, báo giá `QUO-001`)
  — tab hiện đúng mã/phiên bản/badge "Đã duyệt"/giá trị giao kèo thật; nút "Hủy liên kết" đúng bị khóa
  kèm tooltip "Khách hàng chỉ có 1 báo giá đã duyệt, không thể hủy liên kết" (khách hàng thật chỉ có 1
  báo giá `APPROVED`). `npx tsc --noEmit` sạch, 0 lỗi console. Chưa test được thao tác thật nút "Liên
  kết ngay"/"Hủy liên kết" khi đủ điều kiện (dữ liệu mẫu hiện tại không có khách hàng nào có > 1 báo
  giá `APPROVED` để bấm thử) — đã xác nhận đúng endpoint qua `curl` riêng lẻ trước khi code.

## (z) Màn "Đặt cọc" (`/manager/payments/deposits`, `/admin/orders_audit/payments` + `[id]`) — đã nối API thật; re-test qua curl 2026-07-21 phát hiện 2 điểm khác doc gốc `docs/datcoc_api.md`

- **Màn liên quan**: xem [`docs/datcoc_api.md`](datcoc_api.md) (viết 2026-07-20, đã cập nhật lại đúng
  trạng thái mới nhất trong lần nối này).
- **2 phát hiện khác doc gốc (backend đã đổi hành vi giữa 2 ngày, hoặc doc gốc ghi chưa đúng)**:
  1. **Tin tốt**: `POST /orders/:id/deposits` giờ **đã nhận và lưu đúng `dueDate`** — doc gốc mục 4.2
     ghi "không có cách set hạn thanh toán qua API" khi test lần đầu, nay test lại đã hoạt động (đã
     thêm `dueDate?: string` vào `CreateOrderDepositPayload`, dùng trong form tạo yêu cầu cọc mới).
  2. **Tin xấu hơn doc gốc**: doc mục 4.5 ghi "`notes` chỉ được lưu khi `status: 'SUCCESS'`" — re-test
     kỹ hơn (tạo hồ sơ mới không có notes, PUT `status:'SUCCESS'` kèm `notes` mới) xác nhận **`notes`
     KHÔNG lưu ở bất kỳ status nào qua `PUT /deposits/:id`**, không riêng gì `CANCELLED`. `amount`/
     `evidenceId` vẫn bị bỏ qua như doc gốc ghi. Tức `PUT` chỉ thật sự ghi được đúng 1 field: `status`.
  3. **Xác nhận role đã bị chặn ở backend** (doc mục 7 để ngỏ câu hỏi "chưa thử token ADMIN"): test qua
     `curl` với token `admin` — cả `POST /orders/:id/deposits` và `PUT /deposits/:id` đều trả `403 FORBIDDEN`. Vì vậy trang Admin **cố tình bỏ hẳn** mọi nút tạo/xác nhận/hủy (`canManage={false}`),
     không phải thiếu sót — nếu giữ nút như bản mock cũ, Admin bấm sẽ luôn gặp lỗi 403.
- **Kiến trúc đã chọn khi nối**:
  - Không có `GET /api/v1/deposits` gộp toàn hệ thống (vẫn 404) — danh sách dùng N+1 tạm thời: `GET /orders` (≤100) + `GET /orders/:id/deposits` cho từng đơn (lấy hồ sơ mới nhất theo `createdAt` để
    hiển thị ở bảng), cùng kỹ thuật N+1 trên `GET /quotations?status=approved` + `GET /quotations/:id`
    (đọc `linkedOrderId`) để suy ra báo giá đã duyệt nhưng chưa tạo đơn — tái dùng đúng pattern đã có ở
    `manager/orders/[id]/page.tsx` (mục y). Gắn `TODO(perf)` rõ ràng trong code, không chặn demo ở quy
    mô hiện tại (7 đơn).
  - `GET /orders/:id/deposits` trả **mảng, có thể nhiều hồ sơ/đơn** (đúng mục 4.6 doc gốc) — trang chi
    tiết hiển thị dạng **lịch sử** (mới nhất lên đầu) thay vì giả định chỉ 1 hồ sơ, mỗi hồ sơ `PENDING`
    có nút Xác nhận/Hủy riêng. Nút "Tạo yêu cầu cọc mới" bị khóa khi đang có hồ sơ `PENDING` (tự chọn,
    Product chưa chốt nghiệp vụ này — tránh tạo trùng nhiều yêu cầu đang chờ cùng lúc).
  - Bỏ hẳn UI "sửa số tiền cọc"/"gắn chứng từ" (không có endpoint thật hoàn tất) — đúng khuyến nghị mục
    4.2/4.3 của doc gốc. **Giữ nguyên khối "Cổng thanh toán VietQR"** (mã QR minh họa, không phải cổng
    thật — đúng hành vi mock cũ, người dùng yêu cầu giữ lại khi review) thay vì bỏ như đề xuất ban đầu ở
    mục 4.4 — giờ gắn theo hồ sơ cọc `PENDING` gần nhất (hoặc hồ sơ mới nhất nếu không còn cái nào
    `PENDING`) do trang giờ hiển thị nhiều hồ sơ/đơn thay vì 1.
  - Bổ sung `OVERDUE: 'error'` vào `getStatusBadgeVariant` (`components/ui/Badge.tsx`, trước đó thiếu),
    thêm `src/constants/deposit-status.ts` (nhãn 4 trạng thái thật + danh sách phương thức thanh toán)
    dùng chung cho cả list/detail, cả 2 role.
- **File đã thêm/sửa**: `src/constants/deposit-status.ts` (mới), `src/components/payments/{DepositListView,DepositDetailView}.tsx`
  (mới — dùng chung cho cả 4 trang, tham số hóa `detailBasePath`/`quotationBasePath`/`canManage`),
  4 trang `manager/payments/deposits/{page,[id]/page}.tsx` + `admin/orders_audit/payments/{page,[id]/page}.tsx`
  viết lại thành wrapper mỏng gọi 2 component trên, `src/types/payment.ts` (thêm `dueDate` vào payload
  tạo + sửa comment theo phát hiện mới), `src/components/ui/Badge.tsx` (thêm `OVERDUE`).
- **Trạng thái**: Đã re-test toàn bộ endpoint dùng qua `curl` với backend thật đang chạy (login
  `manager`/`admin`, tạo hồ sơ cọc thật `DEP-002`/`DEP-003`/`DEP-004` trên `ORD-002`/`ORD-005`/`ORD-006`
  để xác nhận hành vi tạo/xác nhận/khóa 1 chiều/đồng bộ `paymentStatus` — **nếu đây là DB dùng chung
  demo/staging, 3 bản ghi này cần dọn lại**, cùng lý do doc gốc đã nêu). Đã mô phỏng đúng chuỗi gọi
  N+1 mà `DepositListView` sẽ thực hiện (7 đơn + 7 báo giá đã duyệt, toàn bộ đã có đơn liên kết nên
  khối "báo giá chờ tạo đơn" hiện đang rỗng — đúng dữ liệu thật, không phải lỗi). `npx tsc --noEmit`
  sạch. Chưa test bằng trình duyệt thật (không có tool browser trong phiên này).

## (aa) Màn "Kế hoạch và phân công" + "Lịch timeline" + modal "Chi tiết kế hoạch" — đã nối API thật cả 3; hầu hết đề xuất "chưa chốt" ở cả 3 doc hóa ra ĐÃ được Backend làm; 2 gap còn lại (join "người lập", bug PUT)

- **Màn liên quan**: [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md), [`docs/lichtimeline_api.md`](lichtimeline_api.md),
  [`docs/chitietkehoach_api.md`](chitietkehoach_api.md) — cả 3 cùng phân tích 1 trang `/manager/schedule/plans`
  (mirror `/admin/coordination/planning`), viết lại 1 lần.
- **Tin tốt bất ngờ (2026-07-21, test lại bằng `curl`)**: gần như toàn bộ đề xuất "chưa chốt/cần Backend
  xác nhận" ở cả 3 tài liệu đã được triển khai thật:
  1. `GET /schedule-plans` không truyền `orderId` trả về **toàn bộ** đơn (không bắt buộc `orderId`), đã
     join sẵn `orderCode`/`customerName`/`eventName`/`eventDate`/`orderLocation`/`taskName`/`assignees[]`
     (kèm `checkInAt`/`checkOutAt` — vượt cả yêu cầu ban đầu).
  2. `dateFrom`/`dateTo` hoạt động đúng, lọc theo khoảng ngày như đề xuất.
  3. `work_tasks` đã được seed thêm 2 dòng mới: `TSK-SURVEY` ("Khảo sát hiện trường") và `TSK-COLLECT`
     ("Thu hồi thiết bị") — chỉ còn thiếu "Vận chuyển thiết bị" so với 4 loại hoạt động UI cần.
  4. `POST /schedule-plans/:id/assignees` (gán người, đã ghi nhận ở comment `types/schedulePlan.ts`
     trước đó) hoạt động đúng, trả lại full `SchedulePlan` kèm `assignees[]` mới.
- **2 gap còn lại, chưa có API/còn bug**:
  1. **"Người lập" (docs/chitietkehoach_api.md mục 2.2/4.1)**: dù đã chốt hướng dùng `orders.created_by`,
     field này **chưa được join sẵn** vào response `GET /schedule-plans` — trang hiện đa đơn (nhiều đơn
     cùng lúc, không có ngữ cảnh 1 đơn bao quanh) nên gọi thêm `GET /orders/:id` riêng cho từng đơn chỉ để
     lấy 1 field là N+1 không hợp lý. Đề xuất: Backend join thêm `createdByName` (từ `orders.created_by`
     → `users.full_name`) vào response `GET /schedule-plans`, giống cách đã join `orderCode`/`customerName`.
     Hiện hiển thị in nghiêng "chưa có API" ở modal chi tiết.
  2. **Bug thật**: `PUT /schedule-plans/:id` báo lỗi validate (`startTime: expected date, received Date`)
     nếu payload không kèm `startTime`, dù tài liệu describe đây là partial update (chỉ sửa field muốn
     đổi). Test xác nhận: gửi `{"notes": "..."}` → lỗi; gửi kèm `startTime` (dù không đổi giá trị) → OK.
     Workaround FE: luôn gửi kèm `startTime` hiện tại của dòng trong mọi lần gọi `PUT`. Backend nên sửa
     validator cho phép thiếu `startTime` khi không cần đổi.
- **Quyết định kiến trúc áp dụng khi nối**: viết `src/utils/schedulePlanGroups.ts` — nhóm dữ liệu phẳng
  `schedule_plans` thành "1 kế hoạch/1 đơn" (đúng phát hiện cốt lõi mục 1 của `docs/kehoachvaphancong_api.md`),
  dùng chung cho 3 tab (Lịch điều phối/Lịch timeline/Danh sách) + 2 drawer (chi tiết/lập-sửa kế hoạch).
  Gộp "hoạt động" + "công việc" thành 1 danh sách theo quyết định đã chốt ở `docs/chitietkehoach_api.md`
  mục 6.3. Bỏ `PLANNING_STAFF_POOL` (đổi sang chọn user thật role LEADER/TECHNICAL), bỏ tên việc tự do
  (đổi sang `task_id` + `notes`), bỏ luồng "đơn đặt ảo từ báo giá" (chờ Backend thêm cột
  `schedule_plans.quotation_id` — chưa có route nào trỏ vào đây kèm `quotationId` nên đã gỡ hẳn nhánh
  code cũ thay vì để dở dang).
- **File đã sửa**: `src/types/schedulePlan.ts`, `src/utils/schedulePlanGroups.ts` (mới),
  `src/components/planning/{PlanDetailDrawer,PlanFormDrawer}.tsx`,
  `src/app/{manager/schedule/plans,admin/coordination/planning}/page.tsx`,
  `src/app/manager/field-ops/progress/page.tsx` (trang khác dùng chung `PlanDetailDrawer` cũ theo shape
  mock — tách 1 panel xem nhanh cục bộ để không phá vỡ trang đó).
- **Trạng thái**: `npx tsc --noEmit` sạch; `curl` xác nhận toàn bộ luồng CRUD thật hoạt động đúng trên
  `ORD-001` (tạo dòng, gán người, sửa, xác nhận, hủy). Chưa test bằng trình duyệt thật (không có tool
  browser trong phiên này).

## (ab) Màn "Pick-list xuất kho" (`/manager/inventory/picklists`) — 2 endpoint đề xuất ở `docs/picklistxuatkho_api.md` VẪN CHƯA được Backend implement (test lại 2026-07-21)

- **Màn liên quan**: [`docs/picklistxuatkho_api.md`](picklistxuatkho_api.md).
- Khác các màn khác gần đây (kehoachvaphancong, lịch timeline, chi tiết kế hoạch) — nơi phần lớn đề xuất
  hóa ra Backend đã âm thầm triển khai — màn này re-test bằng `curl` xác nhận **chưa có gì mới**:
  1. `GET /api/v1/orders/picklists` → `404 {"code":"NOT_FOUND","message":"Order not found"}` (route
     `/orders/:id` khớp nhầm `"picklists"` thành `:id`, xác nhận route riêng chưa tồn tại).
  2. `GET /api/v1/orders/:id` (đơn thật `ORD-001`) không có field `pickedUpAt`/`pickedUpByName`/
     `itemsConfirmedAt` trong response — 2 cột `orders.picked_up_at`/`picked_up_by` (doc mục 4) và cột
     `items_confirmed_at` (tham chiếu từ `docs/thietbikhohang_api.md` mục 2b, cũng chưa có — xem mục (w))
     đều chưa được thêm vào schema.
- **Đã xử lý theo đúng nguyên tắc "phần nào chưa có API thì in nghiêng + ghi chú"**: trang vẫn hiển thị
  đầy đủ dữ liệu thật hiện có (danh sách đơn CONFIRMED/IN_PROGRESS, số lượng/đã chuẩn bị từng đơn qua
  `GET /orders/:id`, "Điều phối viên" qua `GET /schedule-plans` theo đúng hướng đã chốt ở doc mục 3.4)
  — riêng cột "Trạng thái xuất kho" + nút "Đã xuất kho" hiển thị in nghiêng "Chưa có API" (nút khóa hẳn),
  và KPI "Sẵn sàng xuất kho" đổi tên thành "(ước tính)" vì phải tạm tính `SUM(preparedQty) >= SUM(quantity)` phía client thay vì dựa vào cột `items_confirmed_at` như doc khuyến nghị.
- **Cần Backend làm** (nhắc lại nguyên trạng doc mục 7.1, chưa có gì thay đổi):
  1. `GET /api/v1/orders/picklists` (list + KPI, mục 5.1).
  2. `PUT /api/v1/orders/:orderId/picklist/picked-up` (mục 5.2).
  3. 2 cột `orders.picked_up_at`/`orders.picked_up_by` (mục 4).
- File đã sửa: `src/app/manager/inventory/picklists/page.tsx` (viết lại toàn bộ).
- **Trạng thái**: `npx tsc --noEmit` sạch; `curl` xác nhận route `/manager/inventory/picklists` trả về
  HTTP 200. Chưa test bằng trình duyệt thật (không có tool browser trong phiên này).

## (ac) Màn "Thu hồi & hoàn kho" (`/manager/inventory/returns`, `/admin/inventory/returns`) — re-test 2026-07-21 xác nhận VẪN CHƯA nối được, đúng như doc đã tự đánh dấu "⛔ chưa cần làm ngay"

- **Màn liên quan**: [`docs/thuhoi_hoankho_api.md`](thuhoi_hoankho_api.md).
- Khác toàn bộ các màn đã re-test gần đây (phần lớn hóa ra Backend đã âm thầm làm xong) — màn này xác
  nhận lại đúng y hệt trạng thái doc đã ghi ngày 2026-07-20, không có gì mới:
  1. `GET /api/v1/inventory/return-reports` → `404 {"code":"NOT_FOUND","message":"Inventory record not found for this item"}` — lỗi này cho thấy route khớp nhầm vào `/inventory/:itemId` (coi
     `"return-reports"` là 1 `itemId`), xác nhận route riêng thật sự không tồn tại.
  2. `POST /api/v1/inventory/return-reports` → `404 {"code":"NOT_FOUND","message":"Route not found: POST /api/v1/inventory/return-reports"}` — lỗi rõ ràng, không mơ hồ như trên.
  3. Bảng `inventory` (khác với `collected_equipment_reports`) **đã tồn tại thật** (dùng được ở màn "Tồn
     kho doanh nghiệp", mục (u)) — nhưng 2 bảng `collected_equipment_reports`/`collected_equipment_report_items`
     mà toàn bộ 4 endpoint của màn này phụ thuộc (doc mục 1/7) vẫn chưa được tạo.
- **Quyết định**: không sửa gì ở 2 trang `manager/inventory/returns` + `admin/inventory/returns` (giữ
  nguyên 100% mock `adminInventoryReturnsMock.ts`) — vì không có API thật nào để gọi (khác các màn khác
  nơi luôn có ít nhất 1 phần dữ liệu thật để nối), và chính tài liệu API cũng khuyến nghị "⛔ CHƯA CẦN
  BACKEND LÀM NGAY" cho toàn bộ nội dung. Đổi UI sang gọi API không tồn tại sẽ phá vỡ 1 demo đang chạy
  được mà không thay thế bằng gì thật.
- **Nhắc lại thứ tự ưu tiên khi Backend rảnh tay** (đã có ở doc mục 9.1/9.2, không đổi): (1) tạo 2 bảng
  `collected_equipment_reports`/`collected_equipment_report_items`; (2) `GET /inventory/return-reports`
  (list); (3) `GET /inventory/return-reports/:id` (detail); (4) `POST` (tạo, khuyến nghị chuyển hẳn sang
  mobile Leader Staff — doc mục 3); (5) `PUT .../confirm` (làm sau cùng, phụ thuộc cả bảng `inventory`
  đã có sẵn để cộng/trừ tồn kho thật khi xác nhận).
- **Trạng thái**: không có thay đổi code. Xác nhận lại bằng `curl` với backend thật đang chạy
  (2026-07-21).

## (ad) Màn "Nhà cung cấp" (`/admin/suppliers`, `/manager/suppliers`) — re-test 2026-07-21 xác nhận module Supplier VẪN CHƯA được mount trên backend

- **Màn liên quan**: [`docs/supplier_api.md`](supplier_api.md).
- Test lại toàn bộ endpoint doc gốc đã liệt kê (mục 6.0) + thử thêm vài biến thể tên phòng trường hợp
  Backend đổi path — **tất cả đều 404 `"Route not found"`**, không có gì mới so với lần test
  2026-07-20:
  - `GET/POST /api/v1/suppliers`, `GET /api/v1/suppliers/:id`, `GET /api/v1/supplier-transactions`
    (đúng 4 route doc gốc đã test).
  - Thử thêm: `/api/v1/supplier` (số ít), `/api/v1/procurement`, `/api/v1/procurement/purchase-orders`,
    `/api/v1/purchase-orders`, `/api/v1/supplier-transactions?supplierId=1` — **cũng 404 cả**.
- Đối chứng `GET /api/v1/orders` vẫn trả 401 (route tồn tại, chỉ thiếu token) — xác nhận lại kết luận
  của doc gốc: đây là router chưa mount, không phải lỗi quyền hay lỗi gọi sai tham số.
- **Quyết định**: không sửa 2 trang `admin/suppliers`/`manager/suppliers` — giữ nguyên 100% mock
  (`mocks/db/suppliers.ts`), cùng lý do đã áp dụng ở mục (ac) — không có API thật nào để nối, kể cả
  1 phần nhỏ (khác pick-list/kế hoạch nơi luôn có dữ liệu `orders`/`schedule-plans` thật để tận dụng).
- **Khuyến nghị lặp lại từ doc gốc, ưu tiên cao nhất**: Backend cần xác nhận trước tiên liệu module
  Supplier có đang phát triển ở nhánh/máy khác chưa deploy lên server test này, hay thực sự chưa bắt
  đầu implement — quan trọng hơn việc đối chiếu tên cột/enum chi tiết (doc gốc mục 0).
- **Trạng thái**: không có thay đổi code. Xác nhận lại bằng `curl` với backend thật đang chạy
  (2026-07-21).

## (ae) Bug thật: `PUT /api/v1/quotations/:id` (sửa hạng mục báo giá) luôn 400 nếu thiếu `version` — khác hẳn comment cũ "không dùng khi update"

- **Màn liên quan**: `/manager/quotations/[id]`, `/admin/quotations/[id]` (nút "Lưu thay đổi" khi sửa
  hạng mục báo giá nháp), và modal `CreateQuotationModal.tsx` (chế độ sửa báo giá gọi từ trang chi tiết
  đơn, tab "Báo giá & hợp đồng").
- **Nguyên nhân người dùng báo "báo giá không update được"**: `types/quotation.ts` khai
  `SaveQuotationPayload.version?: string` kèm comment "bắt buộc khi tạo mới, không dùng khi update" —
  sai. Test qua `curl` xác nhận `PUT /quotations/:id` **luôn** yêu cầu `version` có mặt, kể cả khi update:
  thiếu field này trả `400 {"code":"VALIDATION_ERROR","details":[{"path":"version","message":"Invalid input: expected string, received undefined"}]}`; gửi kèm đúng `version` hiện tại của báo giá thì `200`
  thành công. Cả 3 nơi gọi `updateQuotation()` trong code (2 trang chi tiết báo giá + `CreateQuotationModal.tsx`)
  đều **không gửi `version`** trong payload update — nghĩa là tính năng sửa hạng mục báo giá **luôn thất
  bại 100%** với backend thật từ trước tới nay, chỉ hiện lỗi chung chung "Lưu thay đổi thất bại. Vui lòng
  thử lại." (bị nuốt trong khối `catch` không đọc `error.response.data`), không có gì gợi ý nguyên nhân
  thật.
- **Đã sửa**: cả 3 nơi gọi `updateQuotation()` giờ gửi kèm `version: detail.version` (2 trang chi tiết)
  / `version: editingQuotation.version` (`CreateQuotationModal.tsx`) — gửi lại đúng version hiện tại của
  báo giá, không tự đổi version chỉ vì sửa hạng mục/số lượng/đơn giá. `SaveQuotationPayload.version` đổi
  từ optional (`version?: string`) sang bắt buộc (`version: string`) để tsc tự bắt lỗi nếu có nơi khác
  quên gửi field này sau này.
- **Cần Backend xác nhận thêm** (chưa rõ, chỉ workaround được ở FE): route update có thực sự dùng giá
  trị `version` gửi lên để làm gì (tăng version tự động? chỉ validate tồn tại?) hay chỉ là field bị yêu
  cầu nhầm trong Zod schema (copy nhầm từ schema tạo mới, quên đổi thành optional cho route update) —
  nếu là nhầm lẫn, Backend nên sửa validator cho phép bỏ trống `version` khi PUT, đúng nghĩa "chỉ đổi
  field nào gửi lên" của 1 partial update thông thường.
- **File đã sửa**: `src/types/quotation.ts` (`SaveQuotationPayload.version` bắt buộc + đính chính
  comment), `src/app/{manager,admin}/quotations/[id]/page.tsx` (`handleSaveEditedItems`),
  `src/components/orders/CreateQuotationModal.tsx` (`handleSubmit`, đổi tên biến `payload` →
  `itemsAndNotes` để rõ nghĩa không còn thiếu field bắt buộc).
- **Trạng thái**: `npx tsc --noEmit` sạch; `curl` tái hiện đúng bug (400 thiếu `version`) rồi xác nhận
  fix hoạt động (200, cập nhật đúng SL/đơn giá) trên báo giá thật `QUO-004`, sau đó khôi phục lại đúng số
  liệu gốc của báo giá này để không để lại dữ liệu test trong DB dùng chung. Smoke-test qua `curl` xác
  nhận `/manager/quotations/[id]` và `/admin/quotations/[id]` trả HTTP 200, không lỗi compile. Chưa có
  tool trình duyệt trong phiên này để tự bấm "Sửa hạng mục" → "Lưu thay đổi" và xem trực quan — cần người
  dùng tự mở lại 1 báo giá `draft`, sửa SL/đơn giá 1 hạng mục, bấm lưu để xác nhận không còn báo lỗi.

### (ae.1) Bổ sung 2026-07-21 (theo yêu cầu người dùng) — nút "Sửa hạng mục" giờ hiện ở MỌI trạng thái, không chỉ `draft`

- **Phát hiện thêm khi test**: `PUT /quotations/:id` còn có **1 lớp chặn nghiệp vụ thứ 2**, độc lập với
  bug `version` ở trên — kể cả gửi đủ `version`, backend vẫn từ chối `400 {"code":"BAD_REQUEST","message":"Chỉ có thể sửa báo giá khi còn ở trạng thái nháp (DRAFT)"}` nếu báo
  giá đã `approved`/`rejected` (test trên báo giá thật `QUO-002`, đã `approved` + có `linkedOrderId`).
- **Yêu cầu người dùng**: nút "Sửa hạng mục" phải hiện **bất kể trạng thái nào**, không chỉ `draft` như
  trước. Đã chốt hướng xử lý qua `AskUserQuestion`: **vẫn hiện nút ở mọi trạng thái, cho vào chế độ sửa
  bình thường, nhưng khi bấm "Lưu thay đổi" mà bị backend từ chối thì hiện đúng nguyên văn lỗi thật từ
  backend** (không còn thông báo chung chung) — đồng thời ghi yêu cầu này vào đây để Backend cân nhắc nới
  lỏng ràng buộc.
- **Đã sửa**: bỏ điều kiện `detail.status === 'draft'` khỏi nút "Sửa hạng mục" ở cả 2 trang chi tiết báo
  giá (giữ nguyên điều kiện `!isLinkedToContract` — không liên quan tới yêu cầu này), thêm `title` tooltip
  báo trước khi trạng thái khác `draft`. `catch` của `handleSaveEditedItems` đổi từ thông báo cứng sang
  đọc `error.response.data.error.message`/`.message` thật (cùng pattern `extractErrorMessage` đã dùng ở
  `manager/customers/page.tsx`) — khi lưu thất bại vì lý do trạng thái, người dùng thấy đúng câu backend
  trả về thay vì "Lưu thay đổi thất bại. Vui lòng thử lại." vô nghĩa.
- **Cần Backend/Product quyết định**: có nên nới lỏng ràng buộc "chỉ sửa khi draft" hay không — đây là 1
  quyết định nghiệp vụ (báo giá đã duyệt/gắn Order thật có nên cho sửa ngược lại số lượng/đơn giá hay
  không, ảnh hưởng tới số liệu Order/Hợp đồng đã tạo dựa trên báo giá đó), **không phải bug kỹ thuật đơn
  thuần** — FE chỉ có thể hiện đúng lỗi thật, không thể tự ý bỏ qua ràng buộc phía backend. Nếu Product
  xác nhận cần cho sửa cả báo giá đã duyệt, Backend cần nới lỏng validator ở route `PUT /quotations/:id` (có thể giữ nguyên chặn khi đã `linkedOrderId` — tránh sửa ngược khi đã phát sinh đơn
  thật — nhưng cho phép sửa báo giá `approved` chưa gắn đơn nào).
- **File đã sửa thêm**: `src/app/{manager,admin}/quotations/[id]/page.tsx` (nút "Sửa hạng mục" + catch
  `handleSaveEditedItems`).
- **Trạng thái**: `npx tsc --noEmit` sạch; `curl` xác nhận đúng lỗi `BAD_REQUEST` khi PUT báo giá
  `approved` (`QUO-002`, không sửa dữ liệu, chỉ test-đọc hành vi lỗi). Chưa test trực quan qua trình
  duyệt trong phiên này.

### (ae.2) Re-test 2026-07-21 (theo yêu cầu người dùng "muốn sửa được báo giá kể cả đã liên kết đơn hàng") — Backend đã đổi thông báo lỗi, có vẻ đã thu hẹp phạm vi chặn về đúng `linkedOrderId`, nhưng CHƯA nới lỏng

- **Người dùng yêu cầu**: cho sửa được hạng mục báo giá ngay cả khi báo giá đã liên kết Order thật, kèm
  1 request `curl PUT /quotations/:id` mẫu (báo giá `QUO-011`, đã `approved` + có `linkedOrderId`).
- **Test lại**: gửi đúng `curl` đó tới backend thật (dùng lại toàn bộ giá trị hiện tại, không đổi số liệu
  để tránh để lại dữ liệu test) — vẫn bị từ chối, nhưng **thông báo lỗi đã đổi khác** so với lần test ở
  mục (ae.1):
  - Cũ (test trên `QUO-002`): `400 {"code":"BAD_REQUEST","message":"Chỉ có thể sửa báo giá khi còn ở trạng thái nháp (DRAFT)"}`.
  - Mới (test trên `QUO-011`, 2026-07-21): `400 {"code":"BAD_REQUEST","message":"Không thể sửa báo giá đã được chuyển thành đơn hàng"}`.
  - Thông báo mới gợi ý điều kiện chặn giờ bám theo `linkedOrderId` (đã "chuyển thành đơn hàng") thay vì
    chặn mọi báo giá khác `draft` — **đúng hướng đề xuất** đã ghi ở cuối mục (ae.1) ("giữ nguyên chặn khi
    đã `linkedOrderId` nhưng cho phép sửa báo giá `approved` chưa gắn đơn nào"). Tuy nhiên **chưa xác
    minh được** vế còn lại (báo giá `approved` nhưng CHƯA có `linkedOrderId`) vì tại thời điểm test, toàn
    bộ 8 báo giá `approved` hiện có trong DB đều đã có `linkedOrderId` — không còn báo giá nào ở trạng
    thái "approved nhưng chưa gắn đơn" để thử.
- **Kết luận**: đây vẫn là chặn nghiệp vụ chủ động phía backend, không phải bug — **FE không có cách nào
  cho sửa thành công khi đã `linkedOrderId`** mà không giả kết quả (nút "Sửa hạng mục" + luồng lưu ở 2
  trang chi tiết báo giá đã đúng như mô tả ở (ae.1): vẫn cho bấm sửa, khi lưu thất bại thì hiện đúng
  nguyên văn lỗi thật ở trên). Giữ nguyên hiện trạng FE, không đổi gì thêm ở lần này.
- **Cần Backend/Product xác nhận lại** (nối tiếp câu hỏi mở ở (ae.1)): có đúng là backend đã chủ đích thu
  hẹp điều kiện chặn về riêng `linkedOrderId` hay không, và nếu người dùng thực sự cần sửa báo giá đã
  liên kết Order — đây vẫn là quyết định nghiệp vụ (ảnh hưởng ngược số liệu Order đã tạo từ báo giá đó),
  cần Backend nới lỏng có chủ đích (vd chỉ cho Manager sửa kèm cảnh báo đồng bộ lại Order, hoặc bắt buộc
  hủy liên kết Order trước khi sửa) — FE sẽ nối theo ngay khi có endpoint/luồng chính thức.

### (ae.3) Yêu cầu chính thức từ người dùng 2026-07-21 — CẦN Backend nới lỏng `PUT /quotations/:id` để cho sửa số lượng/đơn giá/giảm giá của báo giá đã có `linkedOrderId`

- **Người dùng xác nhận rõ**: muốn Manager sửa được số liệu sản phẩm (số lượng/đơn giá/giảm giá từng
  hạng mục) của báo giá **ngay cả khi đã liên kết Order** — không chấp nhận theo hướng vòng qua bằng cách
  bắt Manager tự hủy liên kết Order rồi sửa rồi liên kết lại (đã đề xuất phương án này ở trên nhưng người
  dùng chọn chờ Backend nới lỏng thay vì làm workaround đó ở FE).
- **Lý do không tự làm workaround "hủy liên kết → sửa → liên kết lại" ở FE lúc này** (đã cân nhắc, không
  chọn): 2 vướng mắc thật sẽ gây sai số liệu nếu làm ẩu — (1) nút "Hủy liên kết" hiện chỉ bật khi khách
  hàng có **>1 báo giá đã duyệt** (`canUnlinkQuotation` ở `manager/orders/[id]/page.tsx`), phần lớn đơn
  chỉ gắn đúng 1 báo giá nên sẽ bị khóa ngay bước đầu; (2) `handleLinkQuotation` hiện **cộng dồn** số
  lượng từ báo giá vào `order.items` thay vì thay thế — nếu liên kết lại đúng báo giá vừa sửa sẽ bị cộng
  dồn 2 lần, sai lệch tồn kho/hóa đơn của Order. Muốn làm workaround an toàn cần sửa cả 2 điểm này trước,
  ngoài phạm vi yêu cầu hiện tại.
- **Yêu cầu Backend**: nới lỏng validator ở route `PUT /api/v1/quotations/:id` — bỏ điều kiện chặn khi
  báo giá đã có `linkedOrderId` (thông báo lỗi hiện tại: `"Không thể sửa báo giá đã được chuyển thành đơn hàng"`, xem (ae.2)), cho phép Manager sửa `quantity`/`price`/`discount` của từng `quotation_items` bất
  kể trạng thái liên kết Order. Nếu cần giữ 1 lớp bảo vệ nghiệp vụ, đề xuất: chỉ chặn khi Order đã ở giai
  đoạn không còn hợp lý để đổi số liệu nữa (vd đã `settlement_pending`/`completed`/đã khóa kho), thay vì
  chặn cứng ngay khi vừa có `linkedOrderId`.
- **Lưu ý đồng bộ ngược khi Backend mở khóa**: nếu chỉ nới lỏng phía `quotations`, số liệu trên
  `order.items` (tab "Thiết bị & Kho hàng" của Order) sẽ **không tự cập nhật theo** — hiện chỉ đồng bộ 1
  lần lúc liên kết (`handleLinkQuotation`, cộng dồn). Khi backend cho sửa báo giá đã liên kết, FE sẽ cần
  làm thêm 1 việc: sau khi sửa báo giá thành công, gọi lại để đồng bộ số liệu mới nhất vào `order.items`
  của Order đang liên kết — chưa có endpoint/luồng nào cho việc đồng bộ lại này, cần Backend xác nhận
  cách làm đúng (server tự đồng bộ, hay FE tự gọi `updateOrderItems` sau khi sửa báo giá).
- **Trạng thái**: chưa có thay đổi code ở FE cho mục này — theo lựa chọn của người dùng, chờ Backend nới
  lỏng trước khi triển khai UI cho phép sửa thật sự khi đã `linkedOrderId`.

## (af) Màn "Thu hồi & hoàn kho" — ĐÃ nối API thật đầy đủ (list + detail + confirm), (ac) đã lỗi thời chỉ vài giờ sau khi viết; Backend đã âm thầm implement xong trong ngày 2026-07-21

- **Màn liên quan**: `/manager/inventory/returns` (+ `[id]`), mirror `/admin/inventory/returns` (+
  `[id]`) — xem [`docs/thuhoi_hoankho_api.md`](thuhoi_hoankho_api.md) (tài liệu đó vẫn đối chiếu
  `D:\bnwems-backend-api`, SAI repo — xem cảnh báo đầu file này; chưa cập nhật lại, đọc mục này thay vì
  tin nguyên văn tài liệu đó cho tới khi có người sửa lại).
- **(ac) (viết sớm hơn cùng ngày 2026-07-21) đã lỗi thời**: `GET`/`POST /inventory/return-reports` lúc
  đó test 404 thật, nhưng khi re-test lại (muộn hơn cùng ngày) cả 2 endpoint đã hoạt động — đối chiếu
  timestamp file trong `D:\sep490-backend-api` (`prisma/`, `package.json`, `node_modules` đều sửa đổi
  trong buổi sáng 2026-07-21) cho thấy Backend đã âm thầm code xong module `inventory` (bao gồm cả
  `collected-equipment-reports`/alias `return-reports`) ngay trong ngày, sau thời điểm viết (ac).
- **Xác nhận `D:\sep490-backend-api` (không phải `D:\bnwems-backend-api`) mới là backend đang chạy
  thật** (cổng 3001, cùng DB Aiven `bnwems`) — đọc thẳng
  `src/modules/inventory/{inventory.routes,inventory.service,inventory.repository,inventory.validators}.ts`
  xác nhận:
  1. **Có đủ 4 endpoint** dưới cả 2 tên `/inventory/collected-equipment-reports` và alias
     `/inventory/return-reports` (cùng route/controller, không tách logic) — `GET` (danh sách, filter
     `status`/`orderId`/`page`/`limit`, KHÔNG có `search` tự do), `GET /:reportId` (chi tiết, kèm JOIN
     sẵn `itemName`/`unit`/`orderCode`/`reportedBy.fullName`/`confirmedBy.fullName`), `POST` (tạo — chỉ
     role **LEADER** gọi được, 403 với Manager/Admin — đúng nguyên tắc CLAUDE.md "Leader Staff ghi nhận
     qua mobile"), `PUT /:reportId/confirm` (chỉ role **MANAGER**, 403 với Admin — đúng "Admin không xử
     lý vận hành hằng ngày"). Endpoint tạo thật cho Leader Staff là
     `POST /api/v1/mobile/orders/:id/collected-reports` (module `mobile`, đã có sẵn, ngoài phạm vi web).
  2. **Toàn bộ ID đều là string UUID** (`z.string().trim().min(1)` ở validator) — KHÔNG có bug
     BigInt/UUID nào cả (giả thuyết bug này ở phiên trước dựa nhầm vào `D:\bnwems-backend-api`, 1 repo
     backend cũ/khác, đã lỗi thời, không phải backend đang chạy — bài học: luôn xác nhận lại backend nào
     đang thực sự chạy ở cổng 3001 trước khi kết luận bug, đừng tin theo path cũ đã ghi ở tài liệu trước
     đó mà không kiểm tra lại).
  3. **2 bảng `collected_equipment_reports`/`collected_equipment_report_items` VÀ bảng `inventory` đều
     đã tồn tại thật** trong DB (khớp đúng schema đề xuất ở mục (c) — Backend làm đúng theo đề xuất, chỉ
     thiếu cột `report_code` như (c) đề xuất, dùng thẳng `report_id` UUID làm mã hiển thị, FE tự cắt 8 ký
     tự đầu để hiển thị gọn).
- **Đã sửa FE** (nối API thật, bỏ hẳn mock):
  - `src/types/collectedEquipmentReport.ts` — viết lại theo đúng `ReportDTO` thật (JOIN sẵn tên người,
    tên thiết bị, mã đơn); giữ `CreateCollectedEquipmentReportPayload` cho `fieldOpsApiService` (mobile,
    ngoài phạm vi web).
  - `src/services/inventory.service.ts` — thêm `getReturnReports`/`getReturnReport`, bỏ
    `createReturnReport` (web không gọi được, luôn 403).
  - `src/app/{manager,admin}/inventory/returns/page.tsx` — đọc thật `GET .../return-reports` (phân
    trang + filter `status` server-side, tìm kiếm tự do chỉ lọc trong trang hiện tại do backend không hỗ
    trợ `search`), **bỏ hẳn nút/modal "Tạo phiếu"** (Manager/Admin không gọi được endpoint tạo).
  - `src/app/{manager,admin}/inventory/returns/[id]/page.tsx` — đọc thật `GET .../return-reports/:id` +
    `orderApiService.getOrder()` (lấy tên khách hàng/sự kiện) + `inventoryApiService.getInventory({itemId})`
    cho từng dòng (số tồn kho "trước" live, để tính panel "Tổng hợp sau hoàn kho (dự kiến)" đúng công
    thức thật `confirmReportAndApplyInventory` — available += good, damaged += damaged, total -= lost).
    Bảng kiểm đếm đổi thành chỉ đọc (không còn input sửa tay — backend không có endpoint sửa item sau
    khi tạo). Nút "Xác nhận hoàn kho" gọi thật `PUT .../confirm`, gate hiển thị qua
    `usePermission('inventory:confirm-return')` (thêm permission key mới, map `['Manager']`) thay vì
    hardcode role — trang Admin không còn nút này, hiện dòng chú thích thay thế.
  - `src/constants/permissions.ts` — thêm `'inventory:confirm-return': ['Manager']`.
  - Xóa hẳn `src/mocks/adminInventoryReturnsMock.ts` (không còn nơi nào dùng).
- **Trạng thái**: `npx tsc --noEmit` sạch, `npm run build` sạch. **Đã test bằng trình duyệt thật**
  (Playwright, đăng nhập thật 2 tài khoản seed `manager`/`admin`, mật khẩu `123456` —
  `D:\sep490-backend-api\prisma\seed.ts`): danh sách hiển thị đúng 1 phiếu thật (`ORD-001`/Tech Corp,
  Leader "Team Leader" tạo), vào chi tiết thấy đúng 2 thiết bị thật + panel tồn kho live đúng công thức,
  bấm "Xác nhận hoàn kho" thành công thật (`confirmedBy: Project Manager`), số tồn kho 2 thiết bị cập
  nhật đúng dự kiến (Loa JBL 1000W: available 8→10; Đèn Beam 230: available 12→13, damaged 1→2) — đối
  chiếu lại qua `curl` sau khi xác nhận khớp 100% số đã hiển thị ở panel trước đó. Không có lỗi console.
  Trang Admin xác nhận đúng không có nút xác nhận, chỉ xem.
  ⚠️ **Lưu ý**: phiên test này đã xác nhận thật 1 phiếu hoàn kho có sẵn trong DB dùng chung
  (`report_id = e6f5e369-ffe2-4c49-97df-a0446747e959`) — hành động không thể hoàn tác qua UI (không có
  endpoint "hủy xác nhận"), nhưng đây rõ ràng là dữ liệu seed/demo (`ORD-001`, "Tech Corp", theo đúng
  `prisma/seed.ts`), không phải dữ liệu khách hàng thật.
- **Việc còn lại (không phải bug, chỉ là giới hạn đã biết của API hiện tại)**: không có `search` tự do
  phía server cho danh sách (chỉ lọc được trong trang hiện tại); không có mã hiển thị ngắn cho phiếu
  (dùng UUID cắt 8 ký tự); `reportType = 'SUPPLIER'` (trả thiết bị thuê ngoài) chưa lọc riêng khỏi danh
  sách này (trang chỉ dùng cho `INTERNAL`, lọc client-side) — đủ dùng cho phạm vi màn `/manager/suppliers/returns`
  khác xử lý riêng, không cần sửa thêm ở đây.

## (ag) `POST /api/v1/orders` cần cho phép tạo đơn với `items` rỗng — bỏ hẳn bước nhập hạng mục khỏi modal "Tạo đơn hàng"

- **Màn liên quan**: modal "Tạo đơn hàng mới" (`src/components/orders/CreateOrderModal.tsx`), mở từ nút
  "Khởi tạo đơn đặt hàng" ở `manager/orders/page.tsx` và `admin/orders_audit/page.tsx`.
- **Thay đổi UI (theo yêu cầu người dùng, 2026-07-21)**: bỏ hẳn khối "Hạng mục thiết bị/dịch vụ" khỏi
  bước tạo đơn — Manager giờ chỉ nhập thông tin khách hàng + sự kiện (loại/ngày/địa điểm/số khách) ở
  bước tiếp nhận, khớp đúng luồng nghiệp vụ Manager mô tả (Bước 1 "Tiếp nhận & tạo đơn" chỉ tạo
  `customers`/`orders`, order = `NEW`, payment = `UNPAID` — chưa cần quyết định hạng mục thiết bị ngay).
  Hạng mục thật sự được quyết định sau, ở bước khảo sát/báo giá, rồi gắn vào đơn qua tab "Báo giá & Hợp
  đồng" ở chi tiết đơn (nút "Tạo báo giá liên kết"/"Liên kết báo giá đã duyệt", đã nối API thật —
  `PATCH /orders/:orderId/quotation` rồi merge `items` từ báo giá qua `PUT /orders/:orderId/items`, xem
  `manager/orders/[id]/page.tsx` hàm `handleLinkQuotation`).
- **Vấn đề cần Backend xác nhận/sửa**: theo comment cũ ở `types/order.ts` ("createOrderSchema thật...
  items: tối thiểu 1"), validator của `POST /api/v1/orders` hiện bắt buộc `items` có **ít nhất 1 phần
  tử** (`z.array(...).min(1)` hoặc tương đương). Từ giờ FE luôn gửi `items: []` khi tạo đơn ở modal này
  — nếu ràng buộc `min(1)` còn giữ nguyên, request sẽ bị từ chối `400 VALIDATION_ERROR` ngay từ bước tạo
  đơn đầu tiên, chặn toàn bộ luồng.
- **Đề xuất**: nới lỏng validator `items` trong `createOrderSchema` xuống `min(0)` (cho phép mảng rỗng
  hoặc bỏ hẳn field `items` ở request khi tạo đơn theo luồng này). Không cần thêm cột/bảng nào — chỉ là
  nới ràng buộc validate ở tầng service/validator.
- **Trạng thái**: FE đã đổi xong, **chưa xác nhận được qua `curl`** ràng buộc `min(1)` này còn áp dụng
  hay Backend đã tự nới lỏng — cần Backend kiểm tra lại `order.validator.ts` (`createOrderSchema`) và
  xác nhận, hoặc sửa nếu ràng buộc còn đó.

## (ah) Chấm công theo `schedule_plan_assignees` (check-in/check-out từng người) — endpoint ghi chưa xác nhận hoạt động, model FE cũ lệch schema thật, chưa chốt nghiệp vụ tự chuyển trạng thái

- **Màn liên quan**: khối "Lịch thi công & đơn vị phụ trách kỹ thuật" (tab "Lịch trình & Kỹ thuật",
  `/manager/orders/[id]`) — xem [`docs/lichtrinhkythuat_api.md`](lichtrinhkythuat_api.md) mục 0/1/6/7 —
  và rộng hơn là nghiệp vụ **Chấm công (Attendance)** ở CLAUDE.md mục 1 (2 lớp xác nhận trước khi tính
  lương: Technical Staff tự check-in → Leader Staff xác nhận điểm danh & hoàn thành việc → Manager xác
  nhận tổng hợp công/lương cuối cùng).
- **Schema thật do người dùng cung cấp (2026-07-21), khác hẳn giả định cũ ở `src/types/attendance.ts`**:

  ```text
  attendances: attendance_id PK, assignee_id (FK → schedule_plan_assignees.assignee_id),
    check_in_at, check_in_evidence_id, check_out_at, note, created_at, updated_at
  schedule_plan_assignees: assignee_id PK, plan_id, user_id, role ENUM('LEAD','TECHNICAL'),
    notes, created_at
  ```
  Tức 1 dòng `attendances` gắn với **1 dòng `schedule_plan_assignees`** (1 người trong 1 plan cụ thể),
  không phải gắn trực tiếp `planId`+`userId` như `src/types/attendance.ts` hiện khai báo
  (`attendanceId, planId, userId, checkInAt, checkInEvidenceId, checkOutAt, note...`). Type FE này viết
  từ nguồn `D:\bnwems-backend-api` — **backend sai**, đã bị cảnh báo lỗi thời ở đầu file này (dòng
  7-19) — cần viết lại theo đúng `assignee_id` làm khóa liên kết.

  - **Tin đã xác nhận qua curl thật (2026-07-20/21)**: chiều **đọc** đã hoạt động đúng — mỗi phần tử
    `assignees[]` trong response `GET /api/v1/schedule-plans` đã có sẵn `checkInAt`/`checkOutAt` theo
    từng người (xem `src/types/schedulePlan.ts:35`, mục (x)/(aa) ở trên) — khớp đúng việc join
    `schedule_plan_assignees` ⋈ `attendances` theo `assignee_id`. Không cần Backend làm gì thêm cho
    chiều đọc này.
  - **Chưa xác nhận — chiều ghi**: `POST /attendance/check-in`/`PUT /attendance/:id/check-out` (khai ở
    `src/attendance.service.ts`) test route surface ngày 2026-07-20 (cảnh báo đầu file) cho kết quả
    `/attendance` **404 — chưa mount** trên backend đang chạy, cùng nhóm thiếu với `/suppliers`/
    `/evidence`/`/wages`. Chưa có lần re-test nào sau đó (khác các module khác đã re-test 2026-07-21)
    xác nhận lại route này — **cần Backend xác nhận hiện trạng**.
- **Đã sửa lại shape endpoint đề xuất (2026-07-21, sau khi rà lại)** — bỏ payload cũ dùng `assigneeId`
  (mục ngay trên): `assignees[]` trả về từ `GET /schedule-plans` (`types/schedulePlan.ts:35`) **không hề
  có `assigneeId`** (chỉ có `userId, fullName, role, phone, checkInAt, checkOutAt`), nên client (mobile)
  không có cách nào lấy được `assigneeId` nếu payload yêu cầu field đó — phải đổi sang key hỗn hợp
  `planId`+`userId` mà client vốn đã có sẵn (đang xem plan nào + chính mình từ token), khớp đúng
  convention nested-resource đã dùng cho `POST /schedule-plans/:id/assignees`:

  1. `POST /api/v1/schedule-plans/:planId/assignees/:userId/check-in` — body
     `{ checkInAt: string, checkInEvidenceId?: string }`. Backend tự resolve `assignee_id` qua
     `WHERE plan_id=:planId AND user_id=:userId` (404 nếu người này chưa được gán vào plan). **Bắt buộc**
     validate `userId` trong path == `userId` suy từ JWT của người gọi — chỉ cho tự check-in, không cho
     check-in hộ người khác (đúng CLAUDE.md "Technical Staff tự check-in"). Trả lại `Attendance` vừa tạo.
  2. `POST /api/v1/schedule-plans/:planId/assignees/:userId/check-out` — body
     `{ checkOutAt: string, note?: string }`, cùng validate self-only như check-in. Không cần
     `checkOutEvidenceId` — **đã chốt (2026-07-21, xác nhận bởi người dùng): không thêm cột
     `check_out_evidence_id`**, giữ nguyên schema `attendances` chỉ có `check_in_evidence_id` (ảnh minh
     chứng chỉ chụp lúc bắt đầu việc, không chụp lúc hoàn thành qua luồng check-out này — xem thêm ghi
     chú `schedule_plans.evidence_id` bên dưới, đây là 2 khái niệm ảnh minh chứng khác nhau).
  3. **Endpoint mới, chưa từng đề xuất**: `GET /api/v1/attendance?assigneeId=` hoặc
     `GET /api/v1/schedule-plans/:id/attendance` (Backend chọn 1 trong 2, hoặc dùng luôn `assignees[]` đã
     join sẵn nếu đủ) — dùng cho màn hình tổng hợp công/lương cuối tháng (Manager xác nhận tổng hợp), vì
     `checkInAt`/`checkOutAt` join theo từng plan hiện tại chưa đủ để truy vấn theo khoảng thời gian
     (tháng) xuyên nhiều plan/nhiều đơn cho 1 nhân sự — **chưa có tài liệu/màn hình nào ở FE cho bước
     tổng hợp lương này**, ngoài phạm vi các mục đã ghi ở file này.
- **`schedule_plans.evidence_id` — đã chốt (2026-07-21, xác nhận bởi người dùng): tách biệt hoàn toàn
  khỏi ảnh check-in của `attendances`**, không tự động copy/bridge. Nhân viên **tự thêm** ảnh này riêng
  (không bắt buộc, optional) — vẫn cần **1 cách để gắn `evidenceId` vào `schedule_plans`** sau khi upload
  qua `POST /evidence/upload`, nhưng đường cũ (`PATCH .../status {status:'COMPLETED', evidenceId}`) không
  còn dùng được vì `status` không còn nhận `COMPLETED` qua endpoint đó (xem hướng đã chốt bên dưới) —
  **cần Backend đề xuất 1 endpoint/field khác** để set `schedule_plans.evidence_id` độc lập với
  transition status (vd cho `PUT /schedule-plans/:id` nhận thêm `evidenceId?: string` dù không đổi
  `startTime`/`endTime`/`location`/`notes`). Chưa chốt, cần Backend chọn hướng.
- **Đã chốt hướng nghiệp vụ (2026-07-21, xác nhận bởi người dùng)** — thay cho câu hỏi mở trước đây: bạn
  mô tả "khi nhân viên check-in thì `schedule_plans.status` tự chuyển `IN_PROGRESS`, check-out thì tự
  chuyển `COMPLETED`" mâu thuẫn với tài liệu cũ (`docs/lichtrinhkythuat_api.md` mục 0/6, mô tả 2
  transition này là mobile tự gọi `PATCH /schedule-plans/:id/status {status:'IN_PROGRESS'|'COMPLETED'}`,
  tách biệt hoàn toàn khỏi `attendances`) — nay **đã chốt chọn hướng (2)**: `status` **tự suy ra** từ
  `attendances`, không còn là transition Leader tự gọi tay cho 2 giá trị này.

  **Quy tắc chốt cho trường hợp nhiều `assignee` trên cùng 1 plan** (câu hỏi "lấy mốc giờ của ai khi có
  nhiều `TECHNICAL` check-in/out lệch nhau"): **chỉ lấy theo người có `role = 'LEAD'`** trên plan đó, bỏ
  qua giờ check-in/out của các `TECHNICAL` khi suy ra `status` — cụ thể:
  - Nếu plan chỉ có **1 assignee** (bất kể `LEAD` hay `TECHNICAL`) → lấy check-in/out của đúng người đó.
  - Nếu plan có **nhiều assignee** → **chỉ** lấy check-in/out của assignee có `role = 'LEAD'` làm mốc,
    check-in/out của các `TECHNICAL` khác **không ảnh hưởng** tới `status` của plan (vẫn lưu bình thường
    trong `attendances` để phục vụ chấm công/tính lương cá nhân — mục đích khác, không liên quan `status`).

  **Suy ra cụ thể**: `status` (chỉ 2 giá trị `IN_PROGRESS`/`COMPLETED` bị chi phối bởi rule này, `PENDING`/
  `CONFIRMED`/`CANCELLED` vẫn do Manager/Backend set tay như cũ, không đổi):
  - Assignee `LEAD` của plan có `attendances.check_in_at` nhưng chưa `check_out_at` → `status = 'IN_PROGRESS'`.
  - Assignee `LEAD` của plan đã có cả `check_in_at` và `check_out_at` → `status = 'COMPLETED'`.
  - Assignee `LEAD` của plan chưa có `attendances` nào (chưa check-in) → giữ nguyên `status` hiện tại
    (không tự đổi, vẫn `PENDING`/`CONFIRMED` chờ Leader check-in).

  **Không ràng buộc unique trên `attendances`** — đã chốt (2026-07-21, xác nhận bởi người dùng): 1
  `assignee_id` **có thể có nhiều dòng `attendances`** (nhiều lượt check-in/check-out, vd nghỉ giữa
  chừng rồi quay lại) — nhưng khi suy `status`, **chỉ lấy đúng 1 dòng mới nhất** của assignee `LEAD`
  (sắp theo `created_at`/`check_in_at` giảm dần) làm căn cứ, không cộng dồn nhiều dòng.

  **Việc cần Backend làm theo hướng đã chốt**:
  1. **Bỏ** 2 giá trị `IN_PROGRESS`/`COMPLETED` khỏi input hợp lệ của `PATCH /schedule-plans/:id/status`
     (endpoint này từ giờ chỉ nhận `CONFIRMED`/`CANCELLED` — 2 giá trị Manager set tay trên web, xem mục
     6/8.2 của `docs/lichtrinhkythuat_api.md`) — trả `400` nếu client cố gửi `IN_PROGRESS`/`COMPLETED`.
  2. Trigger đổi `status` **tự động ở tầng service** ngay khi
     `POST /schedule-plans/:planId/assignees/:userId/check-in` hoặc `.../check-out` được gọi **và**
     `(planId, userId)` tương ứng có `role = 'LEAD'` trong `schedule_plan_assignees` — tính lại theo
     đúng 3 case ở trên, dùng dòng `attendances` **mới nhất** của người đó (xem ghi chú "không ràng buộc
     unique" ngay trên). Check-in/out của `TECHNICAL` chỉ ghi vào `attendances`, không gọi trigger này.
  3. Cần xác nhận: 1 plan có **đúng 1** assignee `role = 'LEAD'` (ràng buộc ở tầng tạo `schedule_plan_assignees`
     — vd chỉ cho gán tối đa 1 `LEAD`/plan) hay có thể nhiều `LEAD`? Nếu cho phép nhiều `LEAD`, cần chốt
     thêm quy tắc "nhiều LEAD thì lấy ai" (chưa được hỏi/trả lời ở phạm vi này).
  4. Cập nhật lại `docs/lichtrinhkythuat_api.md` mục 0/6 cho khớp hướng mới (đã đánh dấu ở cuối mục
     này, chưa tự sửa file đó — cần rà soát lại toàn bộ mục 0/3/6 của tài liệu đó vì đang mô tả ngược
     lại hướng vừa chốt).
- **Chưa mô hình hóa 2 lớp xác nhận (CLAUDE.md mục 1)**: schema `attendances` hiện tại chỉ có 1 cặp
  `check_in_at`/`check_out_at` cho 1 `assignee_id` — chưa thấy cột nào thể hiện bước "Leader Staff xác
  nhận điểm danh của Technical Staff" (vd `confirmed_by_leader_id`, `leader_confirmed_at`) hay bước
  "Manager xác nhận tổng hợp công/lương cuối cùng" (vd `manager_confirmed_at`, hoặc 1 bảng tổng hợp lương
  riêng theo tháng). Cần Backend xác nhận: 2 lớp xác nhận này có được model ở bảng/API khác chưa công bố,
  hay `attendances` hiện tại **chỉ mới có lớp 1** (tự check-in) và 2 lớp còn lại vẫn cần thiết kế thêm.
- **Ranh giới vai trò (nhắc lại, không đổi)**: theo CLAUDE.md và `docs/lichtrinhkythuat_api.md` mục 0,
  hành động check-in/check-out là của Leader/Technical Staff qua **mobile**, ngoài phạm vi ghi dữ liệu
  của repo web này — web Manager chỉ cần chiều **đọc** (đã có, xem trên) và (khi có) endpoint tổng hợp
  công/lương cuối tháng ở điểm 3.
- **Trạng thái**: FE **chưa code** thêm gì cho luồng ghi (đúng phạm vi, vì thuộc mobile) — chỉ cần
  Backend: (1) implement 2 endpoint `POST /schedule-plans/:planId/assignees/:userId/check-in`/`.../check-out`
  đúng shape đã chốt ở trên (thay hẳn `/attendance/check-in` cũ), (2) implement đúng hướng tự động hóa
  `status` theo rule LEAD đã chốt (bỏ `IN_PROGRESS`/`COMPLETED` khỏi `PATCH .../status`, thêm trigger ở
  2 endpoint check-in/check-out, dùng dòng `attendances` mới nhất), (3) chốt cách gắn
  `schedule_plans.evidence_id` độc lập (điểm ngay trên, chưa có endpoint), (4) làm rõ mô hình 2 lớp xác
  nhận chấm công, (5) cân nhắc thêm endpoint tổng hợp chấm công/lương theo khoảng thời gian cho màn
  "Công & lương" (Manager) — màn này hiện chưa có tài liệu API riêng trong `docs/`. Web Manager **không
  đổi gì** ở tab "Lịch trình & Kỹ thuật" hiện tại (vẫn đọc `status` read-only như đang làm) — hướng mới
  chỉ đổi cách Backend/mobile tự tính `status`, không phát sinh việc code mới phía web.

### Đính chính 2026-08-02 — GPS check-in đã CÓ THẬT trên backend, nhiều điểm ở mục (ah) đã lỗi thời

Đọc trực tiếp source thật tại `D:\sep490-backend-api` (không chỉ dựa vào curl/doc cũ) để phục vụ yêu
cầu "trang chi tiết lịch trình + tab Chấm công" — phát hiện các điểm ở mục (ah) trên đã lỗi thời vì
được viết ngày 2026-07-20/21, TRƯỚC 2 migration bổ sung cột GPS:

- `attendances.latitude`/`attendances.longitude` — có thật (`prisma/schema.prisma` dòng 573-589, model
  `Attendance`; migration `20260728095707_add_attendance_coordinates`).
- `orders.latitude`/`orders.longitude` — có thật (migration `20260731112151_add_order_latitude_longitude`).
  FE đã bắt đầu ghi giá trị này khi tạo Order qua Goong Place Detail (`src/services/geocoding.service.ts`,
  `CreateOrderModal.tsx`, 2026-08-02 — việc khác, không thuộc phạm vi chấm công).
- Endpoint ghi nhận **đã tồn tại và đúng path đã đề xuất** ở điểm 1/2 mục (ah) trên:
  `POST /schedule-plans/:planId/assignees/:userId/check-in` và `.../check-out` (`schedule.routes.ts`
  dòng 113-126, role `STAFF`, tự check cho chính mình). Khác 1 chi tiết nhỏ so với đề xuất cũ: body
  **không nhận `checkInAt`/`checkOutAt` từ client** (server tự set giờ thật lúc gọi), chỉ nhận
  `checkInEvidenceId?`, `latitude?`, `longitude?` (`schedule.validators.ts` dòng 86-95).
- Server tự validate bán kính check-in so với toạ độ Order (`src/utils/geo.utils.ts` hàm
  `calculateDistanceMeters`, ngưỡng `MAX_CHECKIN_DISTANCE_METERS` mặc định 500m, áp dụng trong
  `schedule.service.ts` hàm `checkIn`) — chặn 400 nếu check-in ngoài phạm vi cho phép.
- `GET /api/v1/schedule-plans/:planId` (đã mount sẵn, `schedule.routes.ts` dòng 40-44) trả `assignees[]`
  kèm đầy đủ `checkInAt`, `checkOutAt`, `checkInEvidenceId`, `latitude`, `longitude` cho từng người
  (`schedule.service.ts` `AssigneeDTO`/`mapAssignee`, dòng 26-38, 77-94) — dùng trực tiếp cho web Manager
  đọc, không cần endpoint tổng hợp riêng (điểm 3 mục (ah) trên) cho trường hợp xem theo 1 plan cụ thể.
- Vẫn đúng như mục (ah) đã ghi: 2 lớp xác nhận (Leader xác nhận Technical, Manager xác nhận tổng hợp
  công/lương) **chưa được model** ở schema thật — vẫn cần Backend thiết kế thêm nếu làm màn "Công &
  lương".

Đã cập nhật `src/types/schedulePlan.ts` (`SchedulePlan.assignees[]`) thêm 3 field
`checkInEvidenceId`/`latitude`/`longitude` cho khớp response thật (trước đó FE type bỏ sót dù JSON đã
trả sẵn).

## (ai) Yêu cầu chính thức từ người dùng 2026-07-22 — CẦN Backend cho phép role `MANAGER` gọi `POST /api/v1/survey-reports` (hiện chỉ cho `LEADER`)

- **Bối cảnh**: theo `docs/khaosathientruong_api.md` mục 0 (đã chốt trước đó), nút "+ Tạo báo cáo khảo
  sát" từng bị bỏ khỏi web vì coi đây là hành động của Leader Staff qua mobile. Người dùng sau đó yêu
  cầu thêm lại nút này cho Manager trên web (2026-07-21) — đã code xong: `src/components/survey-reports/SurveyReportCreateDrawer.tsx`
  (form mới, đúng shape `CreateSurveyReportPayload`) + nút "+ Tạo báo cáo khảo sát" ở
  `src/app/manager/survey/page.tsx`. Không đổi gì ở `/admin/reports/survey` (Admin không xử lý vận hành
  hằng ngày, CLAUDE.md mục 1).
- **Vấn đề phát sinh (người dùng xác nhận trực tiếp từ phía backend)**: `POST /api/v1/survey-reports`
  hiện chỉ chấp nhận role `LEADER` gọi — Manager gọi sẽ luôn nhận **403 Forbidden**, khiến nút vừa thêm
  không hoạt động được với backend thật dù code FE không có lỗi.
- **Người dùng chọn hướng xử lý**: **giữ nguyên nút trên web Manager**, không revert lại quyết định
  (ai) — chờ Backend nới lỏng permission thay vì bỏ tính năng.
- **Yêu cầu Backend**: nới lỏng authorization của route `POST /api/v1/survey-reports` để chấp nhận
  thêm role `MANAGER` (giữ nguyên `LEADER` cho mobile), tương tự cách các route khác trong hệ thống đã
  cho phép cả 2 role cùng thao tác nghiệp vụ tương ứng ở web/mobile.
- **Response đã xác nhận đúng** (theo người dùng, giữ nguyên không cần đổi): trả về đầy đủ
  `SurveyReportDetailDTO` — kèm `reportCode` tự sinh dạng `SUR-xxx`, `status` mặc định `NEEDS_REVIEW`,
  đã join sẵn `orderCode`/`customerName`/`eventName`/`reportedByName` — khớp đúng `SurveyReport` ở
  `src/types/survey.ts`, không cần đổi type FE.
- **Lưu ý gửi kèm cho Backend** (người dùng cảnh báo, đã xác nhận FE làm đúng): `orderId` gửi lên phải
  là **UUID thật** (`order_id`), không phải `order_code` hiển thị (vd `ORD-001`) — FE (`SurveyReportCreateDrawer.tsx`)
  đã lấy đúng `order.orderId` (UUID) làm value chọn, không dùng `orderCode`. `planId` tương tự phải là
  UUID (`plan_id`), không phải `plan_code` — nhưng field này FE **hiện chưa gửi** (form chưa có ô chọn
  buổi khảo sát đã lên lịch), nên chưa phát sinh rủi ro gửi nhầm ở thời điểm này.
- **Trạng thái**: FE đã code xong và giữ nguyên nút trên web Manager — chờ Backend nới lỏng role trước
  khi test end-to-end thành công; hiện tại gọi thật từ web Manager sẽ nhận 403 cho tới khi Backend xử lý
  mục này.

## (aj) `schedule_plans.status = 'CONFIRMED'` — đã chốt lại (2026-07-22): là Staff tự xác nhận qua mobile, không phải Manager bấm trên web

- **Màn liên quan**: khối "Lịch thi công & đơn vị phụ trách kỹ thuật" (tab "Lịch trình & Kỹ thuật",
  `/manager/orders/[id]`) — cùng chuỗi quyết định với mục (ah) (nơi đã chốt `IN_PROGRESS`/`COMPLETED`
  tự suy từ check-in/check-out của `LEAD`, không còn là nút Manager bấm tay).
- **Ý nghĩa `CONFIRMED` do người dùng xác nhận lại (2026-07-22)**: không phải "Manager duyệt kế hoạch"
  như tài liệu cũ (`docs/lichtrinhkythuat_api.md` mục 6) mô tả, mà là **Staff (nhân sự được gán vào
  plan) nhìn thấy kế hoạch, bấm nút để xác nhận sẵn sàng tham gia thực hiện — nhưng chưa ai bắt đầu
  làm**. Tức đây cũng là hành động của Staff qua mobile, giống hệt mẫu hình đã áp dụng cho
  `IN_PROGRESS`/`COMPLETED` ở mục (ah), không phải hành động Manager.
- **Đã sửa trên web Manager (2026-07-22)**: bỏ hẳn nút **"Xác nhận kế hoạch"** + modal xác nhận +
  `handleConfirmPlan` khỏi `src/app/manager/orders/[id]/page.tsx` (endpoint
  `PATCH /schedule-plans/:id/status {status:'CONFIRMED'}` **vẫn giữ nguyên, không đổi** — chỉ đổi phía
  gọi từ "web Manager" sang "mobile Staff", đúng pattern đã áp dụng cho `IN_PROGRESS`/`COMPLETED`).
  **Hành động ghi thật duy nhất còn lại của Manager trên web ở tab này giờ chỉ còn "Hủy"**
  (`CANCELLED`) — không còn hành động ghi nào khác cho `schedule_plans.status`.
- **Chưa chốt — cần Backend/Product xác nhận thêm**:
  1. "Staff" ở đây là **assignee nào** — chỉ `LEAD` (giống rule đã chốt cho check-in/out ở mục (ah)),
     hay **bất kỳ assignee nào** (kể cả `TECHNICAL`) bấm cũng đủ để chuyển `CONFIRMED`? Nếu nhiều người
     cùng phải xác nhận mới coi là "sẵn sàng", schema hiện tại (`schedule_plans.status` chỉ 1 cột dùng
     chung, không phải theo từng assignee) **không đủ để lưu trạng thái "ai đã xác nhận, ai chưa"** —
     cần Backend làm rõ có bảng/cột nào khác lưu việc này không, hay tạm chấp nhận theo đúng rule đã có
     (chỉ `LEAD` xác nhận là đủ, tương tự check-in/out).
  2. Cần xác nhận **mobile gọi đúng endpoint nào** — tái dùng `PATCH /schedule-plans/:id/status
     {status:'CONFIRMED'}` sẵn có (đơn giản nhất, không cần Backend làm gì thêm), hay Backend muốn tách
     riêng thành 1 endpoint mới cùng nhóm với `POST .../assignees/:userId/check-in` (mục (ah)) cho nhất
     quán về pattern URL?
- **Trạng thái**: FE đã bỏ nút khỏi web Manager (không còn hành động ghi `CONFIRMED` nào trên web) —
  cần Backend/Product xác nhận 2 điểm trên trước khi mobile code phần "Staff xác nhận sẵn sàng tham
  gia". `docs/lichtrinhkythuat_api.md` mục 0/6 cần rà soát lại cho khớp (đang mô tả ngược — ghi là hành
  động Manager) khi có dịp cập nhật file đó, chưa tự sửa trong lần này.

## (ak) Chuông thông báo Header (2026-07-23) — đã nối "Mốc sắp diễn ra" sang dữ liệu thật, 2 phần còn lại vẫn chặn bởi backend

- **Bối cảnh**: người dùng yêu cầu nối chuông thông báo ở `Header.tsx` với backend thật. Dropdown có 2
  khối: "Mốc sắp diễn ra" và "Yêu cầu thay đổi chờ duyệt", cộng với 1 API `/notifications` chung đã có
  sẵn ở `notification.service.ts` nhưng chưa được Header dùng tới.
- **Đã nối thật**: khối "Mốc sắp diễn ra" — trước đọc từ mock `mocks/db/approachingEvents.ts` (orderId
  không khớp Order thật, link "xem chi tiết" trỏ sai đơn khi bấm vào). Đã xóa file mock đó, thay bằng
  `src/utils/approachingEvents.ts` (hàm thuần `computeApproachingEvents`) + `Header.tsx` tự fetch qua
  `orderApiService.getOrders({limit:200})` và `schedulePlanApiService.getSchedulePlans({dateFrom,dateTo})`
  thật. Nhãn mốc hiện trường đổi từ enum `ActivityType` (Khảo sát/Lắp đặt/Thu hồi — vốn chỉ có ở mock)
  sang `SchedulePlan.taskName` (free-form, join thật từ backend).
- **Chưa nối được — do giới hạn backend, không phải việc frontend tự làm**:
  1. **"Yêu cầu thay đổi chờ duyệt"**: model `ChangeRequest` đã bị xóa hoàn toàn khỏi backend thật (xem
     comment đầu `changeRequest.service.ts`) — 0 route/controller/model tương ứng. Vẫn giữ nguyên đọc từ
     mock `mocks/db/changeRequests.ts` như trước. Backend cần làm lại tính năng này (hoặc xác nhận có
     entity thay thế) trước khi nối lại.
  2. **API `/notifications` chung** (`notification.service.ts`): endpoint có thật nhưng là **stub hoàn
     toàn** — `GET` luôn trả mảng rỗng, `PUT read`/`read-all` không cập nhật `NotificationRecipient` dù
     schema đã có model. Chưa thêm khối hiển thị riêng cho API này ở Header vì nối vào lúc này sẽ luôn
     rỗng, không có giá trị hiển thị thật — nên làm khi Backend implement xong logic ghi/đọc thật.
- **Trạng thái**: mục 1 đã xong, có thể coi là "đã nối BE" cho phần khả thi. Mục 2.1 chờ Backend làm lại
  API change-request. Mục 2.2 chờ Backend hiện thực hoá logic notification (đã có route, chưa có logic).

### (ak.2) Bổ sung 2026-07-23: xóa hẳn khối "Yêu cầu thay đổi chờ duyệt", thêm khối "Cảnh báo cần xử lý" (OrderWarning thật)

- **Theo yêu cầu người dùng**: bỏ hẳn khối "Yêu cầu thay đổi chờ duyệt" khỏi `Header.tsx` (không chỉ để
  mock nữa) — cùng lúc dọn theo state/handler/import liên quan (`pendingChangeRequests`,
  `handleApproveChangeRequest`, `locallyApprovedIds`, import từ `mocks/db/changeRequests.ts`).
- **Người dùng cũng hỏi thêm 2 nguồn thông báo mới**: (1) staff cập nhật trạng thái công việc, (2) audit
  log hệ thống khi có thay đổi cần duyệt/cần báo người trước. Đã tra `D:\bnwems-backend-api`:
  - **Audit log**: model `auditLog` có tồn tại (Prisma, được `user.service.ts` ghi khi tạo/sửa/xóa user)
    nhưng **không có route nào expose ra ngoài** (`grep audit` trong `src/routes` ra 0 kết quả) — chỉ ghi,
    không đọc lại được qua API. **Không nối được** ở thời điểm này.
  - **Staff cập nhật trạng thái công việc**: là `SchedulePlan.status`, nhưng theo mục (aj) ở trên, các
    bước CONFIRMED/IN_PROGRESS/COMPLETED giờ đều do Staff tự chuyển qua mobile, **không sinh hàng đợi
    "chờ Manager duyệt"** — nên tự thay đổi trạng thái không phải nguồn thông báo phù hợp.
  - **Đã chọn thay thế**: `OrderWarning` (`GET/POST /api/v1/orders/{id}/warnings`,
    `PUT /api/v1/warnings/{id}/resolve`) — model thật, khớp đúng ý "cần người duyệt/xử lý". Giới hạn:
    backend chỉ có endpoint lấy warning **theo từng đơn**, không có endpoint liệt kê toàn bộ warning
    chưa xử lý trên mọi đơn — `Header.tsx` phải gọi lặp `getOrderWarnings(orderId)` cho từng đơn đang
    hoạt động (danh sách đã fetch sẵn cho khối "Mốc sắp diễn ra") rồi gộp lại phía client. Chấp nhận
    được ở quy mô hiện tại (back-office nội bộ, không nhiều đơn hoạt động cùng lúc), nhưng nếu số đơn
    tăng nhiều, nên đề xuất Backend thêm endpoint `GET /orders/warnings?resolved=false` liệt kê toàn bộ.
  - Đây cũng là service **lần đầu được UI nào đó gọi tới** — trước đó `orderWarningApiService` tồn tại
    trong code nhưng không trang nào dùng (chỉ có trong `mocks/apiFixtures.ts` chờ sẵn, xem comment đầu
    file đó — "DEMO_CHECKLIST.md Task 10").
- **Trạng thái**: đã xong khối "Cảnh báo cần xử lý" (nối BE thật, có nút "Đã xử lý" gọi
  `resolveOrderWarning`). Audit log vẫn chờ Backend expose route đọc. "Yêu cầu thay đổi chờ duyệt" đã bỏ
  hẳn khỏi Header theo yêu cầu người dùng — nếu sau này Backend làm lại `ChangeRequest`, cần hỏi lại
  người dùng có muốn thêm lại vào Header hay không (không tự ý thêm lại).

## (al) 🔴 NGHIÊM TRỌNG (2026-07-23) — Toàn bộ ID trong database thật là UUID (`varchar(36)`), nhưng `prisma/schema.prisma` + validator + service layer của backend đang code theo BigInt số đếm dần — gần như MỌI endpoint "theo ID" có nguy cơ lỗi

- **Phát hiện khi**: đang test nối chuông thông báo Header với backend, gặp `GET /quotations/{id}` trả
  400 dù `id` gửi lên đúng là `order.quotationId` lấy từ chính response `GET /orders/{id}` (không phải
  do frontend gửi sai). Tái hiện được ở cả 2 chiều: mở báo giá rồi xem đơn liên kết, và mở đơn rồi xem
  báo giá đã liên kết (`src/app/manager/orders/[id]/page.tsx:275`,
  `src/app/manager/quotations/[id]/page.tsx:112`).
- **Đã xác nhận trực tiếp qua query database thật `bnwems`** (không suy đoán): **TOÀN BỘ khóa chính của
  TOÀN BỘ bảng trong database đều là `varchar(36)`** (định dạng UUID, vd
  `84432a45-003f-4ee1-8f45-00bf0d44c52c`) — đã kiểm tra `orders.order_id`, `orders.customer_id`,
  `orders.quotation_id`, `quotations.quotation_id`, `customers.customer_id`, `users.user_id`,
  `items.item_id`, `deposits.deposit_id`, `settlements.settlement_id`, và liệt kê toàn bộ khóa chính của
  mọi bảng còn lại (`attendances`, `business_policies`, `change_requests`, `collected_equipment_reports`,
  `evidences`, `inventory`, `inventory_movements`, `item_categories`, `item_types`, `notifications`,
  `order_items`, `quotation_items`, `schedule_plans`, `schedule_plan_assignees`, `supplier_transactions`,
  `suppliers`, `survey_reports`, `work_tasks`...) — **không có ngoại lệ**, ngoại trừ bảng nội bộ của
  Prisma (`_prisma_migrations.id`, vốn luôn là UUID theo chuẩn Prisma, không liên quan).
- **Nhưng code backend lại giả định BigInt số đếm dần ở CẢ 3 tầng**, không đồng bộ với thực tế trên:
  1. **`prisma/schema.prisma`**: khai `BigInt @id @default(autoincrement())` cho khóa chính — đã xác nhận
     ở `Order.orderId`/`customerId`/`quotationId` (dòng 484-489), `Quotation.quotationId` (dòng 445),
     `InternalUser.userId` (dòng 189), `Customer.customerId` (dòng 322), `Item.itemId` (dòng 385) — nhiều
     khả năng **toàn bộ model khác cũng vậy** (chưa kiểm tra hết nhưng không có lý do các model còn lại
     khác biệt).
  2. **Validator (`src/validators/*.ts`)**: pattern `z.string().regex(/^\d+$/, 'Invalid ID format')` cho
     mọi field ID (params `id`, hoặc body/query `customerId`/`orderId`/`itemId`/`categoryId`/`typeId`/
     `supplierId`/`userId`/`assignedTo`...) — **81 chỗ trên 10 file**
     (`order`, `quotation`, `customer`, `catalog`, `inventory`, `operations`, `policy`, `supplier`,
     `user`, `wage` validator). Lưu ý: **không phải cả 81 chỗ đều là ID** — khoảng 24-26 chỗ là
     `page`/`limit` (phân trang, đúng là nên giữ số) — cần bóc tách kỹ, chỉ sửa field ID thật.
     Ngoài regex-string, `order.validator.ts` còn có kiểu **`z.number().int().positive()`** cho
     `customerId`/`quotationId`/`policyId`/`itemId` trong `createOrderSchema.body` (dòng 32-34, 43) — bug
     tương tự nhưng khác dạng (type mismatch số/chuỗi thay vì regex), rất có thể lặp lại ở
     `createQuotationSchema` và các schema tạo mới khác.
  3. **Service layer (`src/services/*.service.ts`)**: ép kiểu tường minh, vd `order.service.ts:40`
     `prisma.order.findUnique({ where: { orderId: BigInt(id) } })` — nếu `id` là UUID, `BigInt(id)` ném
     lỗi runtime ngay (không phải lỗi bắt được gọn gàng). **Chỉ sửa validator KHÔNG đủ** — request sẽ
     qua được bước kiểm tra định dạng rồi crash ngay bước này.
- **Giả thuyết quan trọng cần Backend xác nhận**: lỗi `GET /orders` trả 400 `code: 'DB_ERROR'` mà frontend
  từng gặp trong phiên làm việc này (xử lý bằng retry 1 lần trong `src/services/api.ts:48-57`, comment cũ
  đoán là "Prisma P2024 connection pool timeout trên Aiven") — **rất có thể thực chất là hệ quả của đúng
  mismatch này**: Prisma cố đọc cột `varchar(36)` vào field khai `BigInt` trong lúc `findMany()` trả về
  toàn bộ cột cho mỗi dòng, ném `PrismaClientKnownRequestError` → `errorMiddleware` bắt thành 400
  `DB_ERROR` (xem `D:\bnwems-backend-api\src\middlewares\error.middleware.ts` dòng 47-51) — **không hẳn
  do nghẽn kết nối**. Backend nên kiểm tra lại log Prisma thật (không chỉ dựa vào `code: 'DB_ERROR'`
  chung chung) để xác nhận đúng nguyên nhân trước khi coi đây là vấn đề hạ tầng/connection pool.
- **Vì sao FE chưa tự sửa**: đây là thay đổi nền tảng ở tầng dữ liệu backend (đổi kiểu cột ID xuyên suốt
  `schema.prisma` + generate lại Prisma Client + rà soát toàn bộ chỗ ép `BigInt(id)`/`Number(id)` trong
  service layer + đồng bộ lại validator), rủi ro cao, ảnh hưởng toàn hệ thống đang kết nối database thật
  — vượt phạm vi sửa nhanh từ phía frontend, và trái nguyên tắc "không tự ý sửa BE" của dự án. Repo
  backend hiện ở branch `feature/align-new-api-contracts-and-test` — có thể người phụ trách đã biết/đang
  xử lý việc này.
- **Đề xuất hướng xử lý cho Backend** (2 hướng, cần Backend/DB owner quyết định, không phải FE):
  (a) Sửa `schema.prisma`: đổi toàn bộ ID liên quan từ `BigInt @id @default(autoincrement())` sang
  `String @id @db.VarChar(36)` (khớp đúng dữ liệu thật đang chạy) + generate lại Prisma Client + bỏ hết
  `BigInt(id)`/`Number(id)` trong service layer + đổi validator từ regex số sang `z.string().uuid()`; hoặc
  (b) nếu ý định thật sự là chuyển toàn hệ thống sang BigInt số đếm dần, cần chạy migration đổi kiểu dữ
  liệu + convert toàn bộ giá trị hiện có trong database thật (rủi ro mất liên kết dữ liệu nếu làm sai) —
  hướng (a) an toàn hơn nhiều vì chỉ đổi phía code cho khớp dữ liệu đã có sẵn, không đụng vào dữ liệu.
- **Trạng thái**: mới chỉ phát hiện + ghi lại bằng chứng, **FE chưa sửa gì ở repo backend**. Theo yêu cầu
  người dùng (2026-07-23), chỉ ghi báo cáo này để chuyển cho người phụ trách backend tự quyết định hướng
  xử lý.
- **⚠️ CẬP NHẬT 2026-07-24 — mục này đã điều tra NHẦM repo backend, xem (am) bên dưới**: máy dev có 2 thư
  mục backend riêng biệt cùng trỏ 1 database và cùng `PORT=3001` — `D:\bnwems-backend-api` (repo CŨ, commit
  gần nhất 2026-07-06) và `D:\sep490-backend-api` (repo ĐANG PHÁT TRIỂN THẬT, commit mới nhất 2026-07-24).
  Toàn bộ phân tích BigInt/UUID ở trên tra cứu vào `D:\bnwems-backend-api` (đường dẫn stack trace/đường dẫn
  file trích dẫn ở trên đều là `D:\bnwems-backend-api\...`) — **không phải backend thật đang được đội
  backend phát triển**. Đã xác nhận lại trực tiếp trên `D:\sep490-backend-api\prisma\schema.prisma`: mọi
  khóa chính đã là `String @id @default(dbgenerated("(uuid())")) @db.VarChar(36)` (vd `Order.orderId` dòng
  430, `Customer.customerId` dòng 236, `Quotation.quotationId` dòng 380...) — **khớp đúng UUID thật trong
  database**, không còn BigInt. Kết luận: bug "NGHIÊM TRỌNG" mô tả ở mục này **không tồn tại trên backend
  thật hiện hành** — giữ lại mục (al) nguyên văn để làm lịch sử điều tra, nhưng **không dùng làm căn cứ báo
  cho Backend nữa**.

## (am) 🔴 Máy dev có 2 thư mục backend cùng chạy port 3001 (`D:\bnwems-backend-api` CŨ vs `D:\sep490-backend-api` THẬT) — nhiều kết luận trước đây trong file này (kể cả (ak.2), (al)) đã tra nhầm repo cũ, cần đối chiếu lại `D:\sep490-backend-api` trước khi kết luận backend thiếu/lỗi gì

- **Phát hiện khi**: user báo lỗi console `[API 404] GET /orders/{id}/warnings` khi test khối "Cảnh báo cần
  xử lý" ở Header (đã nối theo (ak.2), lúc đó tưởng route đã có ở backend). Tra lại thì route này **không
  tồn tại** trong `D:\sep490-backend-api\src\modules\sales\order.routes.ts` (liệt kê toàn bộ route của
  order, không có route nào khớp `warnings`; cũng không có module/controller/service nào tên `warning`
  trong toàn bộ `src/` của repo này).
- **Vì sao (ak.2) từng viết là "đã có, model thật"**: lúc viết (ak.2), câu lệnh tra cứu đã chạy nhầm vào
  `D:\bnwems-backend-api` — một checkout backend CŨ, commit gần nhất 2026-07-06, đứng yên không cập nhật.
  Repo backend thật đang được phát triển là `D:\sep490-backend-api` (commit mới nhất tính đến lúc viết mục
  này: 2026-07-24). Hai repo này **có cùng `DATABASE_URL` (cùng 1 database MySQL thật trên Aiven) và cùng
  `PORT=3001`** trong `.env` của từng repo — nếu chỉ 1 trong 2 process được chạy `npm run dev`, request tới
  `localhost:3001` vẫn trả lời bình thường (không lỗi kết nối) nhưng có thể là **code của repo sai** đang
  phục vụ, khiến kết luận "endpoint có/không có", "field tên gì", "kiểu dữ liệu ID gì" đều có thể sai nếu
  tra nhầm thư mục.
- **Bằng chứng cụ thể đã đối chiếu `D:\sep490-backend-api` (repo thật) với database thật**:
  - Model `User` map bảng `users` (không phải `InternalUser`/`internal_users` như repo cũ) — khớp đúng
    `SHOW TABLES` thật.
  - Có model `ChangeRequest`/`ChangeRequestItem` map `change_requests`/`change_request_items` — khớp bảng
    thật, khác hẳn kết luận cũ ở (ak) "model ChangeRequest đã bị xóa hoàn toàn khỏi backend thật" (kết luận
    đó cũng tra nhầm repo cũ, cần re-test lại nếu muốn khôi phục khối "Yêu cầu thay đổi chờ duyệt").
  - Toàn bộ ID đã là `String @db.VarChar(36)` (UUID), không phải `BigInt` — xem chi tiết ở phần cập nhật
    (al) bên trên.
  - Không có route/module/controller nào cho `OrderWarning`, `audit log đọc`, hay danh sách warning gộp —
    cả 2 phần "Audit log" và "OrderWarning" ghi ở (ak)/(ak.2) đều cần Backend làm mới thật sự, không phải
    chỉ là giới hạn nhỏ như mô tả cũ.
- **Hành động đã làm**: không sửa gì ở cả 2 repo backend (đúng nguyên tắc không tự ý sửa BE). Đã báo cho
  user tắt process cũ đang chiếm port 3001 (chạy từ `D:\bnwems-backend-api`, PID xác định qua
  `netstat -ano` + `wmic process`) để `D:\sep490-backend-api` là backend thật sự trả lời request.
- **Khuyến nghị cho các lần điều tra backend sau này**: luôn xác nhận lại đường dẫn thư mục backend đang
  thực sự lắng nghe `PORT=3001` (`netstat -ano | findstr :3001` rồi tra ngược PID ra `CommandLine`/
  `ExecutablePath`) trước khi kết luận "backend có/không có X" — không suy đoán qua tên thư mục hay giả định
  chỉ có 1 checkout backend trên máy.
- **Trạng thái**: khối "Cảnh báo cần xử lý" ở Header hiện luôn rỗng vì gọi vào endpoint không tồn tại
  (`.catch(() => [])` ở `Header.tsx:73` nên không crash, chỉ không hiển thị gì thật). Cần Backend
  (`D:\sep490-backend-api`) làm route `GET/POST /orders/{id}/warnings` + `PUT /warnings/{id}/resolve`
  trước khi tính năng này hoạt động thật; nếu không làm sớm, cân nhắc tạm ẩn khối này khỏi Header thay vì
  để âm thầm rỗng (hỏi lại user trước khi ẩn, không tự ý bỏ UI theo quy tắc chung của dự án).
- **Cập nhật 2026-07-24**: user chọn giữ nguyên UI/API call, chỉ chặn tiếng ồn console — đã thêm điều kiện
  `isKnownMissingOrderWarnings` (regex `/^\/orders\/[^/]+\/warnings$/`) vào `src/services/api.ts` để bỏ qua
  riêng log `[API 404]` của route này, các lỗi 4xx/5xx khác vẫn log như cũ. Xoá điều kiện này ngay khi
  Backend làm xong endpoint.

## (an) 2026-07-24 — Thêm lại khối "Yêu cầu thay đổi chờ duyệt" ở chuông Header bằng dữ liệu mô phỏng + yêu cầu chính thức cho Backend làm API `change-requests`

- **Bối cảnh**: sau khi (am) xác nhận lại đúng backend thật (`D:\sep490-backend-api`) thì phát hiện bảng
  `change_requests`/`change_request_items` **vẫn tồn tại trong database thật** và model Prisma
  `ChangeRequest`/`ChangeRequestItem` (`prisma/schema.prisma:622-654`) cũng đã khai đúng — khác hẳn kết
  luận cũ ở (ak) ("model ChangeRequest đã bị xóa hoàn toàn khỏi backend thật", tra nhầm repo cũ). User yêu
  cầu thêm lại khối "Yêu cầu thay đổi chờ duyệt" vào chuông Header dựa trên phát hiện này.
- **Giới hạn còn lại**: dù bảng/model đã có, **backend hiện tại vẫn chưa có route/controller/service** nào
  expose ra API (`grep -rli changerequest src/` trong `D:\sep490-backend-api` ra 0 kết quả). Nên chưa thể
  nối API thật ngay — đã thêm lại UI ở `Header.tsx` dùng `changeRequestApiService.getChangeRequests({status:
  'pending'})` (đã có sẵn, đi qua `mockAdapter.ts` → `mocks/db/changeRequests.ts`), đánh dấu rõ
  **"(Dữ liệu minh họa)"** (in nghiêng, có `title` giải thích) theo đúng quy tắc mục 4 CLAUDE.md khi biết rõ
  backend chưa hỗ trợ. Nút "Duyệt"/"Từ chối" gọi `changeRequestApiService.approveChangeRequest()` (cũng
  mock qua `PUT /change-requests/:id/approve`).
- **Đã sửa lại 2 comment ghi sai** (do tra nhầm repo cũ) để không gây hiểu lầm cho lần sau:
  `src/services/changeRequest.service.ts` (đầu file) và `src/components/orders/FieldChangeRequestCard.tsx`
  (tooltip "(Dữ liệu minh họa)") — cả 2 giờ ghi đúng: bảng/model còn, chỉ thiếu route.
- **Yêu cầu chính thức cho Backend** (`D:\sep490-backend-api`) — làm route cho `ChangeRequest` khớp đúng
  shape mà frontend đã sẵn ở `src/types/changeRequest.ts` + `src/services/changeRequest.service.ts`:
  1. `GET /api/v1/change-requests?status=pending&orderId=&page=&limit=` — liệt kê change request, hỗ trợ
     lọc theo `status` (`pending`/`approved`/`rejected`) và `orderId`, trả kèm `meta.totalCount` (đúng
     pattern paginate chung của dự án).
  2. `POST /api/v1/orders/:orderId/change-requests` — Leader Staff (mobile) tạo change request tại hiện
     trường, body `{ type: 'add'|'remove'|'replace', items: [{ catalogItemId, quantity, action: 'add'|
     'remove' }] }` (khớp `CreateChangeRequestPayload`); `type='replace'` cần cả 1 item `action='remove'`
     (đồ cũ) và 1 item `action='add'` (đồ mới) trong `items`.
  3. `PUT /api/v1/change-requests/:id/approve` — Manager duyệt/từ chối, body `{ status: 'approved'|
     'rejected' }`; khi `approved` cần tính lại số tiền theo đúng công thức mục 1 CLAUDE.md (`add`: cộng
     giá thiết bị + phụ phí vận chuyển nếu khoảng cách kho→địa điểm > 2km; `remove`: trừ 100% giá trị thiết
     bị bị bớt; `replace`: `tổng mới = cũ - giá đồ cũ + giá đồ mới`) và cộng dồn vào settlement cuối của
     order — hiện chưa rõ pricing tính ở đâu (theo comment cũ trong `types/changeRequest.ts`: "tính tự động
     khi approve và cộng vào settlement cuối"), cần Backend xác nhận field/luồng lưu số tiền phát sinh này.
  4. Đối chiếu `catalog_item_id` trong `change_request_items` — validator nên dùng `z.string().uuid()`
     khớp UUID thật của bảng `items` (không phải regex số, theo đúng phát hiện chung ở mục (al)).
- **Trạng thái**: UI Header đã có lại, đang chạy bằng dữ liệu mô phỏng in nghiêng. Chờ Backend làm 3 route
  trên rồi đổi `changeRequestApiService` sang gọi thật + gỡ nhãn "(Dữ liệu minh họa)" ở cả `Header.tsx` và
  `FieldChangeRequestCard.tsx`.

### (an.2) Cập nhật 2026-07-24: theo yêu cầu người dùng, BỎ HẲN khối "Cảnh báo cần xử lý" (OrderWarning) khỏi Header — khác quyết định ở (an), không liên quan tới khối "Yêu cầu thay đổi chờ duyệt"

- **Yêu cầu người dùng**: bỏ UI + API gọi `GET /orders/{id}/warnings` (khối "Cảnh báo cần xử lý" thêm ở
  (ak.2)) — vì route này chưa tồn tại ở backend thật (`D:\sep490-backend-api`, xem (am)) và người dùng
  không muốn giữ lại nữa (khác với "Yêu cầu thay đổi chờ duyệt" ở (an), vẫn giữ dạng mock).
- **Đã xóa hoàn toàn** (không chỉ ẩn UI):
  - `Header.tsx`: bỏ state `orderWarnings`, effect gọi lặp `getOrderWarnings(order.orderId)` cho từng đơn,
    handler `handleResolveWarning`, khối JSX "Cảnh báo cần xử lý" trong dropdown chuông, và trừ khỏi
    `totalNotifications`.
  - `src/services/orderWarning.service.ts` và `src/types/orderWarning.ts` — xóa file, vì sau khi bỏ khỏi
    Header thì không còn nơi nào gọi tới (đã grep xác nhận 0 kết quả).
  - `src/services/mockAdapter.ts`: bỏ 2 route mock `GET/POST /orders/:orderId/warnings` và
    `PUT /warnings/:warningId/resolve` (không còn caller). Giữ nguyên `MOCK_ORDER_WARNINGS` trong
    `mocks/apiFixtures.ts` vì mảng này còn được `mockAdapter.ts` dùng để nhúng sẵn `orderWarnings` trong
    response `GET /orders/{id}` (field `OrderDetail.orderWarnings`, xem `types/order.ts`) — đổi type import
    sang `OrderWarningSummary` (`types/order.ts`) thay vì file `types/orderWarning.ts` đã xóa.
  - `src/services/api.ts`: bỏ điều kiện `isKnownMissingOrderWarnings` (thêm ở mục (am) để chặn log 404
    riêng route này) — không còn cần thiết vì không còn request nào gọi route đó nữa.
- **Không đụng tới**: field `OrderDetail.orderWarnings?`/`OrderWarningSummary` (`types/order.ts`) và
  `Report`/dashboard type có field `orderWarnings` (`types/report.ts`) — đây là phần nhúng sẵn trong
  response khác (order detail, report), không phải endpoint riêng `GET /orders/{id}/warnings` mà user yêu
  cầu bỏ, và hiện không trang nào đọc field này nên để nguyên, không mở rộng phạm vi ngoài yêu cầu.
- **Trạng thái**: đã xóa xong, `npx tsc --noEmit` chạy sạch không lỗi. Nếu sau này Backend làm route
  `/orders/{id}/warnings`, cần hỏi lại người dùng có muốn thêm lại tính năng này hay không (không tự ý
  thêm lại, theo đúng quy tắc chung của dự án).

## (ao) 2026-07-24 — Backend đã làm xong cả 3 route `change-requests` yêu cầu ở (an) — đã nối API thật, gỡ nhãn "(Dữ liệu minh họa)"

- **Xác nhận trực tiếp trên `D:\sep490-backend-api\src\modules\sales\`**: cả 3 route yêu cầu ở (an) đều đã
  có — `changeRequest.routes.ts` (`GET /change-requests`, `PUT /change-requests/:changeRequestId/approve`,
  mounted tại `/api/v1/change-requests`) và `order.routes.ts:143` (`POST /orders/:orderId/change-requests`).
  `NEXT_PUBLIC_MOCK_MODE=false` trong `.env.local` nên FE vốn đã gọi thẳng backend thật từ trước (không qua
  `mockAdapter.ts`) — chỉ type/service/UI chưa khớp shape response thật.
- **Response thật khác giả định cũ**: `GET /change-requests` trả kèm `orderCode`, `eventName`,
  `customerName`, `customerPhone`, `amount` (tính on-the-fly từ items + giá catalog hiện tại, không lưu cột
  riêng) ngay trên từng change-request — không cần FE tự tra `customerName` qua danh sách order như code cũ ở
  `Header.tsx`. Từng item trả thêm `changeRequestItemId`, `itemName`, `rentalPrice`. `meta` phân trang theo
  đúng pattern `page/limit/totalItems/totalPages` (không phải `totalCount` như comment cũ).
- **Đã cập nhật**:
  - `src/types/changeRequest.ts`: viết lại `ChangeRequest`/`ChangeRequestItem` khớp đúng response thật, tách
    `ChangeRequestItemInput` riêng cho body tạo (`CreateChangeRequestPayload`).
  - `src/services/changeRequest.service.ts`: sửa `meta` type; `createChangeRequest()` gọi thật
    `POST /orders/:orderId/change-requests` (trước đó luôn `throw` vì nghĩ route chưa tồn tại).
  - `src/services/mockAdapter.ts`: xóa hẳn `mapFieldChangeRequestToApi` + 2 route mock
    `GET /change-requests` / `PUT /change-requests/:id/approve` (đúng chỉ dẫn "XÓA toàn bộ mock này ngay khi
    backend bổ sung API thật" ghi sẵn trong comment cũ) — không còn dùng `FieldChangeRequest` làm nguồn giả
    lập cho model `ChangeRequest` thật nữa. `mocks/db/changeRequests.ts` (`FieldChangeRequest`) vẫn giữ
    nguyên vì còn phục vụ 2 trang `/manager/field-ops/*` (xem mục "Chưa đụng tới" bên dưới).
  - `src/components/layout/Header.tsx`: gỡ nhãn "(Dữ liệu minh họa)", bỏ logic tự tra `customerName` qua
    `activeOrders` (không cần nữa, dùng thẳng `cr.customerName` từ response), state `activeOrders` không còn
    dùng nên xóa luôn.
  - `src/components/orders/FieldChangeRequestCard.tsx`: gỡ nhãn "(Dữ liệu minh họa)".
- **Chưa đụng tới (ngoài phạm vi)**: trang `/manager/field-ops/change-requests` và
  `mocks/db/changeRequests.ts` (`FieldChangeRequest`) — đây là mô hình mock hoàn toàn khác (vocabulary
  ADD/REMOVE/REPLACE hoa, item lưu theo tên thay vì `catalogItemId`, có thêm `reason`/`distanceKm`/phụ phí
  vận chuyển mô phỏng mà backend thật không có cột tương ứng) được dựng riêng từ trước theo mục 0 CLAUDE.md
  ("trang thuần giao diện", chưa có màn hình admin/coordination tương ứng để mirror). Nối trang này sang model
  `ChangeRequest` thật sẽ mất các trường mô phỏng đó — cần hỏi lại người dùng trước khi đổi, không tự ý gộp
  2 model.
- **Trạng thái**: khối "Yêu cầu thay đổi chờ duyệt" ở Header + card ở tab Khảo sát/Nhân sự (order detail) đã
  nối API thật hoàn toàn (list + approve/reject + create). `npx tsc --noEmit` chạy sạch không lỗi.

## (ap) 2026-07-30 — Nối API thật cho trang "Đơn thuê/mua" (Manager) — `supplier_transactions` thiếu cột ngày dự kiến + bồi thường/đền bù

- **Bối cảnh**: người dùng phát hiện NCC thật "Studio Ánh Sáng Sự Kiện Nam Việt" (SUP-006) có đúng hạng
  mục "Đèn Par LED 54x3W" nhưng modal "Tạo đơn thuê/mua mới" báo không NCC nào khai báo — do trang
  `/manager/suppliers/purchase-orders` và modal dùng chung `PurchaseOrderFormModal.tsx` trước đó hoàn toàn
  chạy mock (`mocks/db/suppliers.ts`, 7 NCC giả), tách biệt khỏi NCC thật. `docs/supplier_api.md`
  (2026-07-21) từng cố tình loại 2 trang `purchase-orders` khỏi phạm vi nối API — người dùng yêu cầu chính
  thức nối lại lần này, chỉ cho trang Manager (Admin giữ nguyên mock, có modal cục bộ riêng cũ hơn).
- **Xác nhận trực tiếp qua schema DB thật do người dùng cung cấp** (3 bảng `supplier_transactions`,
  `supplier_transaction_items`, `supplier_items`) + `curl` chỉ-đọc vào backend dev: `GET
  /catalog/items/:id/suppliers` trả đúng SUP-006 cho item Đèn Par LED; `GET /suppliers` (7 NCC thật); `GET
  /supplier-transactions` hoạt động đúng shape `types/supplier.ts`. Đã thử tạo 1 giao dịch thật từ đầu tới
  cuối qua UI (`POST /supplier-transactions`) — **thành công**, xác nhận lại qua `curl` (`STX-001`, đúng
  `supplierId`/`serviceTitle`/`status: PENDING`/`paymentStatus: UNPAID`).
- **Phát hiện quan trọng — `supplier_transactions` KHÔNG có cột**: ngày thực hiện/ngày dự kiến (mock cũ
  gọi "Ngày đặt"/"Ngày dự kiến"), bồi thường phát sinh cho NCC, đền bù/giảm trừ từ NCC. Cũng không có
  "dư nợ còn lại" theo từng giao dịch — chỉ có `Supplier.debtBalance` (tổng dư nợ theo NCC, backend tự
  tính sẵn, không có breakdown). Theo quyết định của người dùng, **đã bỏ hẳn các field này khỏi UI đã nối
  API thật** — nếu nghiệp vụ thật sự cần theo dõi "ngày dự kiến nhận hàng từ NCC" hoặc bồi thường/đền bù
  theo từng giao dịch (như UI mock cũ từng mô phỏng), **cần Backend bổ sung cột tương ứng** vào bảng
  `supplier_transactions` (vd `expected_date`, `compensation_amount`, `supplier_deduction`).
- **Đã cập nhật**:
  - `src/constants/supplier-transaction-status.ts`: sửa lỗi có sẵn — khai báo trạng thái `IN_PROGRESS`
    (theo `types/procurement.ts`, SAI) → `RECEIVED` (đúng theo schema DB thật + `UpdateSupplierTransactionModal.tsx`
    đang dùng thật). Không dùng `getStatusBadgeVariant()` dùng chung nữa (cho màu sai với domain này) —
    hardcode variant riêng theo đúng quy ước `SupplierDetailView.tsx`. Thêm mới
    `SUPPLIER_TRANSACTION_PAYMENT_STATUS_META`.
  - `src/components/suppliers/PurchaseOrderFormModal.tsx`: viết lại hoàn toàn từ mock sang
    `supplierApiService`/`catalogApiService` thật — dropdown NCC ưu tiên `getItemSuppliers(itemId)` khi mở
    từ CTA thiếu hàng, rơi về `getSuppliers({status:'ACTIVE'})` nếu rỗng; hạng mục chọn từ catalog thật của
    đúng NCC (`getSupplierItems`) thay vì gõ tên tự do; submit tách 3 lệnh khi sửa (PUT thân đơn nếu còn
    `PENDING` / PATCH status nếu đổi / PATCH paymentStatus nếu đổi), giống hệt
    `UpdateSupplierTransactionModal.tsx`. Props đổi `onSubmit` → `onSuccess` (modal tự gọi API + tự đóng).
  - `src/app/manager/suppliers/purchase-orders/page.tsx`: viết lại danh sách/lọc/chi tiết từ
    `getSupplierTransactions` thật, đổi tên `OrderDetailModal` → `TransactionDetailModal` (fetch thêm
    `getTransactionById` để có `items[]`), cột "Nhà cung cấp" trỏ sang `/manager/suppliers/:id` thật thay
    vì modal mock, "Đơn liên quan" dùng lại `OrderQuickViewModal` có sẵn.
  - `src/app/manager/orders/[id]/page.tsx`: bỏ import mock + handler `handleCreateSupplierRental` (không
    cần nữa vì modal tự xử lý), đổi `onSubmit` → `onSuccess`.
- **Chưa đụng tới (ngoài phạm vi)**: `src/app/admin/suppliers/purchase-orders/page.tsx` (modal cục bộ
  riêng, cũ hơn, không import `PurchaseOrderFormModal.tsx`, vẫn mock) — theo đúng lựa chọn của người dùng.
  `src/services/procurement.service.ts`/`src/types/procurement.ts`/`CreateProcurementModal.tsx` (module
  API thật song song, trùng lặp, chỉ 1 nơi gọi và đã chết) — không dùng, không xoá.
- **Trạng thái**: `npx tsc --noEmit` và `npx eslint` sạch trên toàn bộ file đã sửa. Đã kiểm thử trực tiếp
  qua trình duyệt (đăng nhập `manager`) + `curl`: tạo giao dịch thật thành công, danh sách + chi tiết hiện
  đúng dữ liệu thật, không có lỗi console. Còn 1 bản ghi test thật trong DB dev (`STX-001`, "Test giao dịch
  tự động (Playwright verification)", NCC Studio Ánh Sáng Sự Kiện Nam Việt) — chưa xoá, người dùng có thể
  tự xoá qua UI nếu muốn dọn dẹp.

## (aq) 2026-07-30 — Yêu cầu Backend thêm nhánh "vẫn xuất dù thiếu tồn kho" (`force`) cho `POST /orders/:orderId/export-equipment`

- **Bối cảnh**: người dùng yêu cầu — khi bấm "Xuất thiết bị" từ báo giá mà thiếu tồn kho, chỉ cần báo số
  lượng thiếu rồi hỏi Manager "Bạn có chắc chắn muốn xuất thiết bị không?"; nếu xác nhận thì **vẫn cho
  xuất** thay vì chặn cứng như hiện tại.
- **Hiện trạng backend (docs/xuatthietbi_tubaogia_api.md mục 4.1 bước 3 / mục 4.2)**: điều kiện
  `quantity_available >= delta` là bắt buộc trong transaction — thiếu ở bất kỳ dòng `INTERNAL` nào thì
  rollback **toàn bộ** (kể cả phần đồng bộ `order_items`) và trả 400, không có nhánh bỏ qua. Đây là chặn
  ở tầng service, phía frontend không có cách nào vượt qua chỉ bằng cách gọi lại endpoint.
- **Đã làm ở FE** (`src/app/manager/quotations/[id]/page.tsx`, `src/types/order.ts`): đổi modal thiếu tồn
  kho thành hỏi xác nhận (nút "Hủy"/"Vẫn xuất" thay vì chỉ "Đóng"); `handleExportEquipment(force?)` khi
  Manager bấm "Vẫn xuất" sẽ gọi lại `POST .../export-equipment` kèm `{ force: true }` trong body
  (`ExportEquipmentPayload.force`, field mới, optional). Vì backend chưa đọc field này, lần gọi lại vẫn bị
  400 y hệt — FE bắt riêng trường hợp này (`force === true` mà vẫn 400 thiếu kho) để hiện thông báo rõ
  ràng "Hệ thống chưa hỗ trợ xuất vượt tồn kho khả dụng — cần bổ sung phía backend" thay vì lặp vô nghĩa.
- **Cần Backend làm**: đọc `force` từ request body ở bước kiểm tra `quantity_available >= delta` (mục
  4.1 bước 2.3) — khi `force === true` và thiếu kho: vẫn ghi nhận `net_exported`/movement OUTBOUND theo
  đúng `delta` yêu cầu (không giới hạn theo `quantity_available`), nhưng cho phép `quantity_available` xuống
  âm (hoặc quyết định business rule khác nếu không muốn cho âm — cần người dùng chốt lại cách xử lý số âm
  trước khi code, vd có tự động tạo cảnh báo/ghi log riêng hay không). Response 200 vẫn giữ nguyên shape
  mục 4.3.
- **Trạng thái**: FE đã sẵn sàng gửi `force: true`, chỉ chờ Backend implement nhánh xử lý. Chưa test được
  qua `curl` vì backend chưa có field này.

## (ar) 2026-07-31 — Backend đã âm thầm triển khai `force` ở (aq) nhưng SAI công thức, trừ thẳng toàn bộ SL đặt vào `quantity_total` gây tồn kho âm

- **Phát hiện qua test thật**: đơn `ORD-021` (2 hạng mục Loa Sub JBL SRX828S 18inch SL đặt 100, Bàn tiệc
  tròn 1m5 SL đặt 500) đột nhiên hiện `quantityAvailable` âm trên tab "Thiết bị & Kho hàng" — xác minh lại
  bằng `curl` trực tiếp `GET /inventory?itemId=`: Loa Sub JBL từ `17` (đúng lúc trước) tụt xuống
  `quantityTotal = quantityAvailable = -83`; Bàn tiệc tròn 1m5 xuống `quantityTotal = -391`,
  `quantityAvailable = -396`. Cả 2 đổi cùng lúc (`updatedAt ≈ 2026-07-31T06:35:19Z`, khớp
  `order.updatedAt`), và **độ lệch đúng bằng SL đặt của từng dòng** (100 và 500) — chứng tỏ có 1 lần gọi
  đã trừ thẳng **toàn bộ SL đặt** khỏi `quantity_total`, không giới hạn theo tồn thực có.
- **Nguyên nhân xác định**: khớp với luồng "Xuất thiết bị → Vẫn xuất" (`handleExportEquipment(true)`,
  `src/app/manager/quotations/[id]/page.tsx:162`, gửi `POST /orders/:orderId/export-equipment` kèm
  `{force: true}`) — đúng tính năng đã yêu cầu Backend làm ở mục (aq). Nhưng Backend implement **sai
  công thức đã tài liệu** ở `docs/xuatthietbi_tubaogia_api.md` mục 4.1 (đáng lẽ chỉ trừ
  `quantity_available`/cộng `quantity_reserved` theo đúng `delta = quantity − net_exported`) — thay vào đó
  trừ thẳng **toàn bộ SL đặt** vào **`quantity_total`** (không phải chỉ `quantity_available`), không giới
  hạn theo tồn thực có. Comment cũ ở `quotations/[id]/page.tsx:181-186` ghi "Backend chưa xử lý `force`,
  vẫn luôn 400" — nay đã lỗi thời, đã sửa lại theo phát hiện này.
- **Ảnh hưởng lan sang FE**: mọi chỗ tính "số thiếu cần thuê thêm" kiểu `SL đặt − quantityAvailable` sẽ
  tính **gấp đôi** số thiếu thật một khi rơi vào tình huống này (vì `quantityAvailable` đã tự mang dấu âm
  bằng đúng số thiếu). Ví dụ: Loa Sub JBL đã có giao dịch thuê thật `STX-016` đúng 83 cái, nhưng badge
  "Thiếu/Thuê" ở `src/app/manager/orders/[id]/page.tsx` tính ra 100 − (−83) = **183** (sai gấp đôi); Bàn
  tiệc tròn 1m5 ra 500 − (−396) = **896** thay vì đúng 396.
- **Đã sửa tạm ở FE** (`src/app/manager/orders/[id]/page.tsx`, tab "Thiết bị & Kho hàng"): công thức
  `shortfall` giờ kiểm tra `quantityAvailable < 0` → dùng thẳng `Math.abs(quantityAvailable)` (suy ra
  được chính xác từ cơ chế lỗi trên: `postAvailable = preAvailable − SL đặt` ⇒
  `SL đặt − preAvailable = −postAvailable`), thay vì công thức cũ luôn tính gấp đôi trong trường hợp này.
  Badge khi đã khớp được giao dịch thuê thật (`itemSupplierMap`) giờ hiện **số lượng ghi trong giao dịch**
  (nguồn đáng tin nhất) thay vì số suy luận. **Đây chỉ là vá tạm đúng với đúng cơ chế lỗi hiện tại** (trừ
  thẳng full SL đặt) — nếu Backend đổi cách xử lý khác thì công thức này cần rà lại, không phải fix gốc.
- **Cần Backend làm**: (a) sửa `POST /orders/:orderId/export-equipment` nhánh `force` cho đúng công thức
  `delta` đã tài liệu ở mục 4.1 (chỉ đụng `quantity_available`/`quantity_reserved`, không đụng
  `quantity_total`); (b) chốt chính sách cho phép tồn kho âm hay không (câu hỏi mở đã nêu ở mục (aq),
  hình như đã tự quyết đi theo hướng "cho âm" mà chưa xác nhận lại với người dùng); (c) reset lại 2 dòng
  `inventory` bị sai trên DB dev hiện tại (Loa Sub JBL SRX828S 18inch, Bàn tiệc tròn 1m5) về đúng giá trị
  gốc — FE chỉ có quyền đọc DB (MySQL MCP read-only), không tự sửa được.
- **Trạng thái**: đã vá tạm hiển thị ở FE, `npx tsc --noEmit` sạch. Còn nguyên vấn đề dữ liệu sai trên DB
  dev + cần Backend sửa endpoint theo đúng công thức tài liệu — chưa xử lý được từ phía FE.

### (ar.1) Cập nhật 2026-07-31 — Quyết định chính thức: KHÔNG chấp nhận tồn kho âm; đã bỏ nút "Vẫn xuất", chuyển điểm khóa kho sang lúc tạo lịch trình "Lắp đặt thiết bị"

- **Quyết định chính thức của người dùng**: đóng hẳn câu hỏi mở ở mục (aq)/(ar) — tồn kho **không được
  phép âm dưới bất kỳ hình thức nào**. Đã bỏ hoàn toàn khả năng gọi `force: true` từ UI:
  `src/app/manager/quotations/[id]/page.tsx` xóa nút "Vẫn xuất" khỏi modal `stockShortage`, chỉ còn nút
  "Đã hiểu" (đóng modal, không gọi lại API). Tham số `force` ở `handleExportEquipment`/
  `ExportEquipmentPayload` **giữ nguyên trong code** (không xóa) để dễ mở lại nếu sau này Backend xác
  nhận đã sửa đúng công thức — hiện tại không còn nơi nào trong UI truyền `force: true` nữa.
- **Điểm khóa kho thật sự chuyển sang lúc tạo lịch trình (Schedule Plan) loại "Lắp đặt thiết bị"**:
  người dùng chốt luồng nghiệp vụ — "Xuất thiết bị" ở trang báo giá chỉ nên **so sánh** SL đặt với tồn
  kho khả dụng để biết thiếu bao nhiêu (không mutate theo cách có thể gây âm); việc **thật sự trừ/khóa
  kho nội bộ** chỉ nên xảy ra khi Manager tạo lịch trình "Lắp đặt thiết bị" — đúng thời điểm thiết bị cam
  kết rời kho để lắp đặt tại sự kiện.
  - **Không cần Backend làm gì thêm cho phần này**: bản `export-equipment` KHÔNG kèm `force` (mặc định)
    vốn đã đúng là hành vi an toàn cần dùng — theo `docs/xuatthietbi_tubaogia_api.md` mục 4.1, nó tính
    `delta` rồi rollback 400 (không mutate gì) nếu `quantity_available < delta`, chỉ trừ đúng `delta`
    (không bao giờ âm) nếu đủ. Chỉ cần **gọi đúng lúc** (khi tạo lịch trình Lắp đặt) và không bao giờ
    dùng `force` nữa.
  - **Đã cài ở FE**: `src/components/schedule/CreateSchedulePlanModal.tsx` — thêm helper
    `isInstallationTaskName(taskName)` (regex `/lắp đặt/i`, cùng pattern với `isDateRestrictedTaskName`
    đã có sẵn, vì `WorkTask` là danh mục tĩnh chỉ có `taskName` tự do, không có field loại việc riêng).
    Trong `handleSubmit`, nếu loại việc được chọn khớp "Lắp đặt", gọi
    `orderApiService.exportEquipment(orderId)` (không `force`) **trước khi** tạo `schedule_plan`:
    thành công/`unchanged` → tạo lịch trình bình thường; lỗi 400 kèm `details.items` → **chặn tạo lịch
    trình**, hiện bảng thiếu tồn kho (`required/available/thiếu`) ngay trong modal kèm hướng dẫn tạo đơn
    thuê NCC ở tab "Thiết bị & Kho hàng" trước.
- **Giới hạn kiến trúc còn lại (chưa giải quyết, ghi nhận để biết khi gặp)**: nếu 1 hạng mục có
  `source = INTERNAL` nhưng thực tế cần bù 1 phần từ NCC (đã tạo `supplier_transactions` riêng cho phần
  thiếu, như trường hợp Loa Sub JBL/`STX-016`), `export-equipment` bản an toàn sẽ **mãi mãi rollback
  400** cho hạng mục đó — vì `quantity_available` không bao giờ đủ `delta = SL đặt` toàn phần, và giao
  dịch thuê NCC không cộng ngược lại `quantity_available`. Tức Manager sẽ **không tạo được lịch trình
  "Lắp đặt"** cho đơn có hạng mục thiếu-đã-thuê-bù kiểu này cho tới khi có 1 trong 2 hướng: (a) Backend hỗ
  trợ tách `order_items` thành 2 dòng theo nguồn thật (phần từ kho nội bộ + phần từ NCC, đúng field
  `source` riêng cho từng phần, thay vì 1 dòng duy nhất như hiện tại); hoặc (b) 1 cơ chế khác để
  `export-equipment` biết loại trừ phần đã có giao dịch `SUPPLIER` che phủ ra khỏi `delta` cần từ kho nội
  bộ. Đây là gap kiến trúc lớn hơn phạm vi đợt sửa này — cần bàn riêng với Backend/Product khi gặp
  trường hợp thật (đơn `ORD-021` hiện tại chính là ví dụ sẽ bị chặn theo đúng giới hạn này).
- **Vẫn còn nguyên, chưa xử lý**: 2 dòng `inventory` bị sai trên DB dev (Loa Sub JBL SRX828S 18inch,
  Bàn tiệc tròn 1m5, xem giá trị đề xuất khôi phục ở mục (ar) phía trên) — cần Backend/người quản lý DB
  tự chạy, FE chỉ có quyền đọc DB.
- **Trạng thái**: đã cài xong ở FE, `npx tsc --noEmit` sạch. Đã ngăn được nguy cơ âm kho phát sinh MỚI từ
  UI này; dữ liệu cũ đã sai vẫn cần dọn riêng.

## (as) 2026-07-31 — Yêu cầu chính thức cho Backend: Tồn kho theo ngày (Date-based Inventory Lock) — giải pháp gốc thay cho mô hình `reserved`/`available` cộng-trừ thủ công hiện tại

- **Bối cảnh dẫn tới yêu cầu này**: sau khi xử lý xong 2 lỗi liên tiếp ở mục (ar)/(ar.1) (tồn kho bị
  trừ âm do `force` export, rồi tới câu hỏi "nhả khóa kho vào đúng ngày Thu hồi thiết bị"), phát hiện ra
  gốc rễ chung của cả 2 vấn đề: hệ thống tồn kho hiện tại **không tính theo ngày** — mỗi hạng mục chỉ có
  **1 bộ số duy nhất tại thời điểm hiện tại** (`quantity_total/available/reserved/damaged`, xem
  `src/types/inventory.ts`), không phân biệt được "còn trống ngày 5/8" khác "còn trống ngày 20/8". Điều
  này đã được ghi nhận rải rác trước đó (`GetInventoryQuery.date` — BE nhận nhưng không ảnh hưởng gì,
  xem mục (u); comment "hệ thống chưa hỗ trợ khóa tồn kho theo ngày" ở tab "Thiết bị & Kho hàng") nhưng
  chưa từng được đặt thành yêu cầu chính thức, tách riêng — nay ghi rõ ở đây.
- **Vì sao mô hình hiện tại (1 bộ số + cộng/trừ thủ công) gây rủi ro cố hữu, không chỉ 1 lần**:
  1. Muốn "khóa" thiết bị cho 1 đơn → phải trừ `available` (và tăng `reserved`) tại thời điểm tạo lịch
     trình Lắp đặt (đã cài ở mục (ar.1), dùng lại `export-equipment` không-force).
  2. Muốn "nhả khóa" khi đơn kết thúc (qua ngày Thu hồi) → cần 1 API cộng trả đúng `reserved`→`available`
     mà **không tồn tại** — API `POST /inventory/adjust` hiện có chỉ sửa được `deltaTotal`/`deltaDamaged`,
     dùng tạm nó để cộng `available` sẽ vô tình **phình `quantity_total` vĩnh viễn** mỗi chu kỳ (phân
     tích chi tiết bằng số liệu cụ thể đã trao đổi với người dùng — không lặp lại ở đây), một dạng lỗi
     âm thầm khó phát hiện hơn cả lỗi âm kho ở mục (ar).
  3. Ngay cả khi có API đúng, mô hình "1 bộ số cho mọi thời điểm" vẫn không xử lý được trường hợp 2 đơn
     dùng chung 1 hạng mục nhưng ở 2 khoảng ngày khác nhau, không giao nhau (vd đơn A dùng 10 cái Loa từ
     1/8-3/8, đơn B dùng chính 10 cái đó từ 10/8-12/8) — hệ thống hiện tại sẽ báo "thiếu" sai dù thực tế
     không xung đột ngày nào cả, vì không biết phân biệt theo khoảng ngày.
- **Yêu cầu Backend — đổi mô hình tồn kho sang tính theo khoảng ngày chiếm dụng**:
  - Mỗi đơn (qua lịch trình "Lắp đặt thiết bị" → "Thu hồi thiết bị") ghi nhận **chiếm dụng N đơn vị của
    hạng mục X trong khoảng [ngày Lắp đặt, ngày Thu hồi]** — có thể là 1 bảng riêng kiểu
    `inventory_reservations(item_id, order_id, quantity, start_date, end_date)`, không nhất thiết phải
    đụng tới `inventory.quantity_total` (số vật lý thật) ở bước này.
  - **Tồn kho khả dụng cho 1 ngày D** = `quantity_total` − tổng `quantity` của mọi reservation có
    khoảng `[start_date, end_date]` **giao với ngày D** − `quantity_damaged` (thiết bị hỏng loại khỏi
    lưu thông) — tính **động** mỗi lần truy vấn, không lưu sẵn 1 con số tĩnh.
  - **Không cần bước "nhả khóa" thủ công/tự động nào nữa**: qua khỏi `end_date`, reservation tự động
    không còn được tính vào phép trừ của các ngày sau đó — loại bỏ hoàn toàn rủi ro cộng/trừ sai, cộng
    trùng, hay phình `quantity_total` đã phân tích ở trên.
  - `GET /inventory` nên nhận thêm `date` (param `date` đã có sẵn trong query nhưng đang bị bỏ qua —
    chỉ cần cài đúng logic tính theo mục trên) để FE hỏi đúng "khả dụng ngày X" khi cần (vd Manager xem
    trước tồn kho cho ngày sự kiện sắp diễn ra của 1 đơn khác).
- **Phạm vi ảnh hưởng nếu Backend làm mô hình này**: sẽ thay thế được toàn bộ cơ chế
  `export-equipment`/`quantity_reserved` hiện tại (mục (ar.1)) — cần bàn lại với FE trước khi đổi để cập
  nhật lại `CreateSchedulePlanModal.tsx`/tab "Thiết bị & Kho hàng" cho khớp API mới, không tự ý đổi 1
  phía.
- **Trạng thái**: đây là yêu cầu tính năng mới, **chưa** implement ở cả Backend lẫn FE — người dùng đã
  quyết định **không** dùng giải pháp tạm `/inventory/adjust` để né rủi ro phình `quantity_total`, chờ
  Backend làm đúng mô hình theo ngày. Cho tới lúc đó, tính năng "tự động nhả khóa kho khi tới ngày Thu
  hồi thiết bị" **chưa được cài** — thiết bị đã khóa cho 1 đơn (qua mục (ar.1)) sẽ ở trạng thái "đã khóa"
  vô thời hạn cho tới khi Backend có API đúng, hoặc người dùng chọn cách xử lý khác.
- ⚠️ **ĐÍNH CHÍNH TOÀN BỘ MỤC NÀY — xem mục (at) ngay dưới**: nhận định "chưa implement Date-based
  Inventory Lock" ở trên dựa trên comment cũ/stale trong FE (`date` param bị bỏ qua) và suy luận qua
  `curl`, **chưa đọc thẳng source code Backend thật**. Sau khi đọc trực tiếp
  `D:\sep490-backend-api\src\modules\inventory\inventory.repository.ts`, xác nhận Backend **đã** có cơ
  chế khóa theo ngày (`getLockedQuantityByDate`) từ trước — nhận định ở mục (as) sai, đọc mục (at) để
  biết đúng cơ chế thật.

## (at) 2026-07-31 — ĐÍNH CHÍNH (as): Backend ĐÃ có Date-based Inventory Lock (`getLockedQuantityByDate`) — đọc thẳng source thật, không phải suy luận qua `curl`

- **Bài học rút ra**: các nhận định ở mục (ar)/(ar.1)/(as) trước đó đều dựa trên test qua `curl` + đọc
  comment cũ trong FE, **chưa từng đọc trực tiếp source Backend** (`D:\sep490-backend-api`, đã có sẵn
  trên máy, đọc được bằng công cụ Read bình thường) trước khi kết luận "chưa implement". Lần này đọc
  thẳng `inventory.repository.ts`/`inventory.service.ts`/`order.repository.ts`/`order.service.ts` để có
  câu trả lời chính xác — nên áp dụng cách này sớm hơn cho các lần điều tra sau, thay vì chỉ suy luận qua
  hành vi API quan sát được.
- **Cơ chế thật (`inventory.repository.ts:97` hàm `getLockedQuantityByDate(itemId, date)`)**:
  1. `quantity_reserved` mà FE nhận qua `GET /inventory` **không phải cột lưu trong DB** — bảng
     `inventory` (Prisma) **chỉ lưu `quantityTotal`/`quantityDamaged`**, không có cột `reserved`/
     `available` nào cả (xác nhận qua `inventory.repository.ts:82-87` hàm `create`). `quantityReserved`
     và `quantityAvailable` đều được **tính lại mỗi lần gọi API** (`inventory.service.ts:94-110` hàm
     `mapInventory`): `quantityReserved = lockedQty` (kết quả của `getLockedQuantityByDate`),
     `quantityAvailable = quantityTotal - quantityDamaged - lockedQty`.
  2. `getLockedQuantityByDate(itemId, date)` — với mỗi item, quét toàn bộ đơn có
     `orderStatus ∈ {CONFIRMED, IN_PROGRESS}`, **`pickedUpAt = null`** (chưa từng "Xuất thiết bị" thật),
     có `orderItems` chứa item này (`source = 'INTERNAL'`), có ít nhất 1 `schedulePlans`. Với mỗi đơn:
     `lockStart` = giờ bắt đầu lịch trình có `task.taskCode = 'SETUP'` ("Lắp đặt thiết bị"), nếu không có
     thì lấy giờ bắt đầu sớm nhất trong các lịch trình của đơn; `lockEnd` = giờ bắt đầu lịch trình có
     `task.taskCode = 'COLLECT'` ("Thu hồi thiết bị"), nếu **chưa có lịch Thu hồi** thì `lockEnd =
     Infinity` (coi như khóa vô thời hạn cho tới khi có lịch Thu hồi). Ngày truy vấn nằm trong
     `[lockStart, lockEnd)` → cộng dồn `quantity` của đơn vào tổng khóa.
  3. **Trả lời trực tiếp câu hỏi "nhả khóa vào đúng ngày Thu hồi"**: Backend đã tự làm đúng việc này —
     ngay khi lịch trình "Thu hồi thiết bị" (COLLECT) được tạo với 1 giờ bắt đầu, từ đúng giờ đó trở đi
     mọi ngày truy vấn sau sẽ không còn cộng đơn này vào "đã khóa" nữa. **Hoàn toàn tự động, tính lại mỗi
     lần đọc, không cần bất kỳ API cộng/trừ thủ công nào** — không có rủi ro phình `quantity_total` như
     đã lo ngại ở mục (as).
- **`export-equipment` là 1 cơ chế THỨ HAI, song song, khác mục đích** (`order.repository.ts:416-641`):
  - Không liên quan gì tới `getLockedQuantityByDate` — nó **trừ thẳng vào `quantity_total`** thật (dòng
    561/577: `quantityTotal: { decrement: delta }`) và set `order.pickedUpAt` (dòng 624-628, chỉ khi có
    movement thật) — đại diện cho khoảnh khắc thiết bị **thật sự rời kho vật lý**, không phải lúc chỉ mới
    lên lịch.
  - Once `pickedUpAt` được set, đơn đó **rời khỏi** phép tính `getLockedQuantityByDate` (vì điều kiện
    `pickedUpAt: null` không còn khớp) — quyền kiểm soát "đã dùng bao nhiêu" chuyển hẳn từ khóa-theo-ngày
    (ảo, không đụng `quantity_total`) sang trừ-thật (`quantity_total` giảm vĩnh viễn cho tới khi có hàng
    về qua "Xác nhận hoàn kho", `quantityTotal: { increment: goodQuantity + damagedQuantity }`,
    `inventory.repository.ts:240`).
  - **Xác nhận lại bug ở mục (ar) bằng source thật (không còn là suy luận)**: nhánh không-`force`
    (`order.repository.ts:574-580`) dùng `updateMany({ where: { itemId, quantityTotal: { gte: delta } },
    data: { decrement: delta } })` — điều kiện `gte` trong `WHERE` đảm bảo **không bao giờ âm** (an
    toàn thật). Nhánh `force` (dòng 552, 558-573) **bỏ qua thẳng điều kiện** `available < delta` và update
    không kèm `gte` → xác nhận 100% đây là nguyên nhân gây âm kho, đúng như đã suy luận ở mục (ar). Quyết
    định bỏ nút "Vẫn xuất" ở mục (ar.1) **vẫn đúng, giữ nguyên**.
  - **Gap nhỏ phát hiện thêm**: điều kiện thiếu-tồn-kho bên trong `export-equipment`
    (`order.repository.ts:551`: `available = inventoryByItem.get(itemId)?.quantityTotal ?? 0`) chỉ so
    với `quantityTotal` thô, **không trừ `quantityDamaged` lẫn `lockedQty`** — khác công thức
    `GET /inventory` hiển thị cho Manager (`total - damaged - lockedQty`). Nghĩa là 2 nơi tính "khả dụng"
    khác nhau: màn hình tồn kho trừ luôn phần đã khóa bởi lịch trình đơn khác, nhưng lúc thật sự "Xuất
    thiết bị" lại không trừ phần đó — có thể dẫn tới xuất được dù tồn kho hiển thị "không đủ" (do lockedQty
    của đơn khác), hoặc ngược lại. Đây là gap thật của Backend, ghi nhận ở đây, chưa yêu cầu sửa (cần bàn
    thêm với Product xem có phải bug hay cố ý).
- **Đã REVERT thay đổi ở `CreateSchedulePlanModal.tsx` (mục ar.1)**: gỡ bỏ hoàn toàn việc gọi
  `orderApiService.exportEquipment()` khi tạo lịch trình "Lắp đặt thiết bị" — không cần thiết vì Backend
  đã tự động khóa theo ngày ngay khi lịch trình SETUP tồn tại, không cần đợi tới lúc tạo lịch mới trừ kho.
  Gọi `export-equipment` sớm (ngay lúc tạo lịch, có thể trước ngày lắp đặt thật rất lâu) sẽ trừ thẳng
  `quantity_total` **quá sớm** — sai bản chất (thiết bị vẫn còn nằm trong kho vật lý cho tới đúng ngày).
  Nút "Xuất thiết bị" ở trang báo giá (không force) giữ nguyên, dùng đúng lúc thiết bị thật sự rời kho.
- **Vẫn đúng, không đổi**: quyết định bỏ nút "Vẫn xuất" (mục ar.1) — bug âm kho ở nhánh `force` là có
  thật, xác nhận lại bằng source. Quyết định KHÔNG dùng `/inventory/adjust` để giả lập "nhả khóa" (mục
  as) — cũng đúng, vì thực ra không cần nhả khóa thủ công nào cả, Backend đã tự làm.
- **Trạng thái**: đã revert `CreateSchedulePlanModal.tsx` về đúng hành vi gốc (chỉ tạo lịch trình, không
  gọi export-equipment). `npx tsc --noEmit` sạch. Tính năng "khóa/nhả khóa theo ngày" **đã hoạt động đúng
  từ phía Backend, không cần FE làm gì thêm** — chỉ cần Manager tạo đúng 2 lịch trình SETUP/COLLECT với
  giờ bắt đầu chính xác cho mỗi đơn.

## (au) 2026-07-31 — Bug thật + ĐÃ SỬA ở Backend: `getLockedQuantityByDate` cộng nguyên `order_items.quantity` vào "đã khóa", không trừ phần đã thuê bù NCC, gây "khả dụng" âm sai (vd `ORD-026`/"Thảm sân khấu màu đỏ": khóa 799 dù tổng tồn chỉ 43)

- **Phát hiện qua dữ liệu thật (màn Admin "Tồn kho doanh nghiệp")**: item "Thảm sân khấu màu đỏ (khổ
  2m)" hiện `Tổng khả dụng = -756`, `Số lượng đã khóa = 799`, `Tổng số lượng = 43`. Đối chiếu MySQL
  (read-only) xác nhận: đơn `ORD-026` (IN_PROGRESS, `picked_up_at = null`) có `order_items.quantity =
  799` (source INTERNAL) cho item này, nhưng **đã có sẵn giao dịch thuê NCC `STX-018` (RENTAL, PENDING)
  đúng 756 cái** — khớp chính xác `799 − 43 = 756` (đúng phần thiếu so với tồn kho thật, đã được bù từ
  NCC). Đây chính là trường hợp "mixed sourcing" đã ghi nhận là giới hạn kiến trúc chưa xử lý ở mục (ar.1)
  — nay xảy ra thật với số liệu đủ lớn để lộ rõ vấn đề.
- **Nguyên nhân xác định qua source Backend thật** (`inventory.repository.ts`, hàm
  `getLockedQuantityByDate`, dòng 97 cũ): với mỗi đơn thỏa điều kiện khóa theo ngày (mục (at)), hàm cộng
  **nguyên `order_items.quantity`** (799) vào tổng "đã khóa" — không trừ đi phần đã có giao dịch thuê NCC
  che phủ (756) — nên "đã khóa" bị tính vượt xa cả tổng tồn kho, kéo "khả dụng" xuống âm rất sâu dù thực
  tế đơn chỉ dùng đúng 43/43 tồn kho nội bộ (không thiếu, không âm).
- **Đã sửa trực tiếp ở `D:\sep490-backend-api\src\modules\inventory\inventory.repository.ts`** (theo yêu
  cầu của người dùng — sửa thẳng Backend, không chỉ ghi doc, vì code đã đọc/hiểu rõ và có quyền truy cập):
  thêm bước truy vấn `supplier_transaction_items` (qua `prisma.supplierTransactionItem`) cho đúng `itemId`
  và các `orderId` liên quan, lọc `transaction.status != CANCELLED`, gộp tổng theo từng đơn
  (`supplierCoveredByOrder`). Khi cộng dồn "đã khóa" cho 1 đơn, dùng
  `Math.max(orderNeed - supplierCovered, 0)` thay vì `orderNeed` thô — đúng ý người dùng "chỉ khóa số
  lượng không thuê ngoài thôi".
- **Đã xác minh lại qua `curl` thật ngay sau khi sửa** (server dev tự reload): `GET /inventory?itemId=...`
  cho "Thảm sân khấu màu đỏ" đổi từ `quantityReserved: 799, quantityAvailable: -756` →
  **`quantityReserved: 43, quantityAvailable: 0`** — đúng như kỳ vọng (toàn bộ 43 tồn kho đang phục vụ
  đơn `ORD-026`, không còn âm).
- **Giới hạn còn lại (chưa đụng tới trong đợt sửa này)**: `export-equipment`'s check nội bộ
  (`order.repository.ts:551`, `available = quantityTotal` thô) **vẫn chưa trừ** phần đã thuê bù NCC —
  nghĩa là nếu Manager thật sự bấm "Xuất thiết bị" cho `ORD-026`, endpoint này sẽ vẫn đòi đủ 799 từ kho
  nội bộ (chỉ có 43) và trả lỗi thiếu tồn kho, dù về logic đã đủ (43 nội bộ + 756 thuê NCC = 799). Đây là
  gap riêng, khác hàm `getLockedQuantityByDate` vừa sửa — cần sửa thêm ở `order.repository.ts` nếu muốn
  đồng bộ hoàn toàn cách tính "đủ hàng" giữa 2 nơi; chưa làm trong đợt này vì người dùng chỉ yêu cầu sửa
  phần hiển thị "đã khóa" ở tồn kho.
- **`npx tsc --noEmit` ở Backend chạy sạch (exit code 0)** sau khi sửa.

## (av) 2026-08-03 — ĐẢO NGƯỢC LẦN NỮA (at)/(au): "Xuất thiết bị" không còn trừ tồn kho thật, chỉ đồng bộ order_items theo quotation_items

- **Bối cảnh**: gặp lỗi thật khi bấm "Xác nhận xuất kho" ở `admin/inventory/outbound/page.tsx` cho 1
  đơn — báo giá liên kết yêu cầu 300 "Bàn hội nghị chữ nhật 1m2" nhưng kho khả dụng chỉ 137 →
  `export-equipment` chặn 400 đúng theo thiết kế đã chốt ở mục (at) ("Xuất thiết bị" cố ý trừ thật
  `quantity_total`, đại diện lúc thiết bị rời kho vật lý, tách biệt khỏi khóa-ảo-theo-ngày).
- **Đã nhắc lại đầy đủ lý do của (at)/(au) cho người dùng trước khi đổi** (2 cơ chế song song: khóa ảo
  theo ngày qua lịch SETUP/COLLECT vs. trừ thật lúc xuất — xem lại (at)) — người dùng **vẫn xác nhận
  muốn đổi lại**: nút "Xuất thiết bị" **không được trừ tồn kho thật nữa**, chỉ đồng bộ `order_items`
  theo `quotation_items` của báo giá liên kết (giữ nguyên Bước 1 ở
  `docs/xuatthietbi_tubaogia_api.md` mục 4.1, bỏ hẳn Bước 2 — chi tiết đầy đủ + lý do ở
  `docs/xuatthietbi_tubaogia_api.md` mục 8, đã viết lại đồng bộ).
- **Hệ quả cần biết** (đã nói rõ với người dùng, chấp nhận đánh đổi): sau thay đổi này, **toàn hệ
  thống không còn hành động nào trừ thật `items.quantity_total`** — chỉ còn khóa ảo theo ngày (không
  đụng `quantity_total`, tự hết hạn qua ngày Thu hồi). Gap "check nội bộ chưa trừ phần thuê bù NCC" ghi
  ở mục (au) coi như **hết ý nghĩa** vì cả nhánh kiểm tra tồn kho trong `export-equipment` bị bỏ luôn,
  không cần sửa gap đó nữa.
- **Việc Backend cần làm**: sửa `order.service.ts`/`order.repository.ts` hàm `exportEquipment` — bỏ
  hẳn Bước 2 (mục 4.1 cũ): không còn tính `net_exported`/`delta`, không `SELECT ... FOR UPDATE` trên
  `inventory`, không `quantityTotal: { decrement }`, không tạo `inventory_movements`; đổi điều kiện set
  `picked_up_at`/`picked_up_by` sang "có ≥ 1 thay đổi thực ở Bước 1" thay vì "có movement". Chi tiết đầy
  đủ từng điểm ở `docs/xuatthietbi_tubaogia_api.md` mục 8.2.
- **Trạng thái: ĐÃ SỬA XONG cả Backend lẫn FE (2026-08-03, cùng phiên)** — không còn dừng ở mức tài
  liệu như ghi nhận trước đó trong mục này. Backend (`D:\sep490-backend-api`): đã sửa
  `order.repository.ts`/`order.service.ts`/`order.controller.ts`/`order.validators.ts`/`order.routes.ts`
  đúng theo mục 8.2 ở `docs/xuatthietbi_tubaogia_api.md`, xoá luôn class `InsufficientStockError`, viết
  lại test tích hợp — `npx tsc --noEmit` sạch, `npx jest src/modules/sales/` 139/139 pass. FE: gỡ modal
  "Tồn kho không đủ để xuất thiết bị" + state `stockShortage` + tham số `force` ở
  `quotations/[id]/page.tsx`, dọn nhánh hiển thị `details.items` ở `admin/inventory/outbound/page.tsx`,
  xoá `ExportEquipmentShortageItem`/`force` khỏi `types/order.ts`. Chi tiết đầy đủ:
  `docs/xuatthietbi_tubaogia_api.md` mục 8.5.

## (aw) 2026-08-03 — Backend đã thêm cột `orders.end_date` nhưng CHƯA có API nào cho phép ghi giá trị này

- **Bối cảnh**: migration `add_order_end_date_and_schedule_lat_lng` (2026-08-03,
  `D:\sep490-backend-api\prisma\migrations\`) thêm `orders.end_date TIMESTAMP(0) NULL`. `order.service.ts`
  (`mapListItem`) đã map field này vào response — `GET /api/v1/orders` và `GET /api/v1/orders/:id` **đã
  trả `endDate`** (nullable) cho mọi order thật.
- **Vấn đề**: `createOrderBodySchema`/`CreateOrderBody` (`order.validators.ts`) **chưa khai báo `endDate`**
  — `POST /api/v1/orders` không nhận field này (zod bỏ qua field lạ do không dùng `.strict()`, không lỗi
  400 nhưng cũng không lưu). Cũng **chưa có endpoint cập nhật thông tin đơn** (`eventDate`/`eventName`/
  `location`/`endDate`...) sau khi tạo — các PUT/PATCH hiện có trên `orders` chỉ sửa
  `status`/`items`/`live-checklist`/`quotation`/`close`. Nghĩa là hiện tại **không có cách nào set
  `endDate` khác NULL qua API thật**.
- **FE đã làm trước khi có API ghi** (theo yêu cầu người dùng 2026-08-03 — "chỗ nào có start-date thì
  cũng có end-date, cả tạo đơn cũng thêm mục end-date"): thêm `Order.endDate`/`CreateOrderPayload.endDate`
  vào `types/order.ts`, thêm input "Ngày kết thúc" (optional, validate `endDate >= eventDate`) vào
  `CreateOrderModal.tsx`, `CreateOrderFromQuotationModal.tsx`, wizard mock
  `admin/quotations/[id]/create-order/page.tsx`; hiển thị `endDate` (khi có) cạnh mọi chỗ đang hiển thị
  `eventDate` của Order thật: `OrderDetailHeader`, `EventOverviewCard`, `OrderQuickViewModal`,
  `CancelOrderModal`, danh sách đơn (`manager/orders`, `admin/orders_audit`), chi tiết đơn
  (`manager/orders/[id]`, `admin/orders_audit/[id]`), `DepositDetailView`, `SettlementDetailView`,
  `admin/inventory/outbound`, `admin/inventory/availability`, `manager/inventory/picklists`. Do gap trên,
  form tạo đơn hiện gửi `endDate` lên `POST /orders` nhưng backend sẽ **âm thầm bỏ qua** — mọi order tạo
  mới vẫn có `endDate = null` cho tới khi Backend làm xong 2 việc dưới đây.
- **Việc Backend cần làm**: (1) thêm `endDate: z.coerce.date().optional()` vào `createOrderBodySchema` +
  truyền qua `orderRepository.create()` (hiện `createOrder()` ở `order.service.ts` dòng ~288-302 không có
  `endDate` trong object truyền cho repository); (2) cân nhắc thêm 1 endpoint cập nhật thông tin sự kiện
  của order đã tồn tại (tối thiểu `endDate`, lý tưởng gồm cả `eventDate`/`eventName`/`location`/
  `guestCount`) vì hiện tại sau khi tạo đơn không có cách nào sửa lại các field này qua API — cần Product
  xác nhận có cho sửa `eventDate` sau khi đã tạo đơn (ảnh hưởng lịch trình/khóa kho đã lập) hay chỉ cho
  sửa `endDate`.
- **Phạm vi KHÔNG đổi trong đợt này**: các trang dùng dữ liệu mock riêng không liên quan `Order` thật
  (`RecentOrdersCard`/`adminDashboard.ts`, `admin/contracts` + `adminContractsMock.ts`,
  `admin/coordination/planning`, `manager/schedule/plans`, `manager/field-ops/progress` — các trang này
  đọc `eventDate` từ `SchedulePlan`/`AdminOrderRow` mock, không phải `Order.endDate` thật) — không thêm
  `endDate` vào các pipeline mock này vì không phản ánh cột DB thật nào tương ứng.

## (ax) 2026-08-03 — Chốt lại công thức khóa/nhả kho theo ngày: min/max mốc thời gian (Order + Lịch trình) ± 6 tiếng

- **Bối cảnh**: `getLockedQuantityByDate` (`D:\sep490-backend-api\src\modules\inventory\inventory.repository.ts`)
  đã bị đổi công thức **3 lần trong cùng ngày 2026-08-03** (đối chiếu `git log` trên file này):
  1. `8924984` — bỏ hẳn cột `reserved`/`available` tĩnh, chuyển sang tính động theo ngày mỗi lần đọc.
  2. `8eaad5e` — tính `lockStart`/`lockEnd` từ `schedule_plans` join `work_tasks.taskCode`: `lockStart` =
     giờ bắt đầu lịch có `taskCode = 'SETUP'` (fallback: giờ bắt đầu sớm nhất trong các lịch của đơn nếu
     không có SETUP); `lockEnd` = giờ bắt đầu lịch có `taskCode = 'COLLECT'` (fallback `Infinity` nếu
     chưa có lịch Thu hồi); gate `orderStatus ∈ {CONFIRMED, IN_PROGRESS}`. Đây là công thức đã được ghi ở
     mục (at)/(au) — **nay đã lỗi thời**, không còn khớp code thật.
  3. `7d619f0` (mới nhất, cùng ngày) — bỏ hẳn `schedule_plans` khỏi hàm này: `lockStart = order.eventDate`
     (không buffer), `lockEnd = order.endDate ? order.endDate + 6 giờ : Infinity`, thu hẹp gate còn đúng
     `orderStatus = 'CONFIRMED'`. Bản này không dùng lịch trình thật (SETUP/COLLECT) nữa, và chỉ cộng
     buffer 6 giờ ở đầu ra (release), không trừ buffer ở đầu vào (lock).
  - Do `endDate` mới có cột DB (mục (aw)) nhưng **chưa có API nào ghi được**, bản `7d619f0` hiện tại sẽ
    khiến hầu hết order thật có `endDate = null` → `lockEnd = Infinity` (khóa vô thời hạn) cho tới khi
    (aw) được Backend xử lý xong.
- **Yêu cầu chính thức từ người dùng (2026-08-03)**: gộp cả 2 nguồn mốc thời gian (Order **và** Lịch
  trình) thay vì chỉ dùng 1 nguồn như 2 bản trên, cộng thêm khoảng đệm an toàn ("GAP") 6 tiếng ở **cả hai
  đầu** (không chỉ đầu ra như `7d619f0`). **Cập nhật cùng ngày**: các `schedule_plans` đưa vào tập hợp
  mốc thời gian **chỉ được tính nếu diễn ra SAU thời điểm đơn chuyển sang `CONFIRMED`** — lịch trình nào
  có mốc thời gian trước lúc đơn được confirm (vd buổi khảo sát hiện trường đã diễn ra từ giai đoạn báo
  giá, trước khi đơn tồn tại/được chốt) thì loại khỏi tập hợp, không tính vào `min`/`max`. Ví dụ người
  dùng đưa ra: đơn chuyển `CONFIRMED` (xác nhận cọc) ngày 16/7 → chỉ xét các lịch trình có mốc sau 16/7.

  ```pseudocode
  // "thời điểm order chuyển CONFIRMED" KHÔNG có cột riêng trong DB (xem phần phát hiện bên dưới) —
  // đã CHỐT (2026-08-03) dùng Deposit.approvedAt sớm nhất của đơn làm giá trị xấp xỉ, KHÔNG thêm cột
  // orders.confirmed_at mới.
  confirmedAtProxy = MIN(deposit.approvedAt) trong số deposits(order) có approvedAt IS NOT NULL
  // nếu đơn CONFIRMED nhưng chưa có deposit nào được duyệt (chưa xác nhận cọc) → không có mốc nào để so
  // sánh, coi như KHÔNG lọc (giữ nguyên toàn bộ schedule_plans, không loại cái nào)

  candidates = [order.eventDate]
  if order.endDate: candidates.push(order.endDate)
  for plan in schedulePlans(order):
    if confirmedAtProxy is null OR plan.startTime >= confirmedAtProxy:
      candidates.push(plan.startTime)
      if plan.endTime: candidates.push(plan.endTime)

  lockStart = min(candidates) - 6 giờ
  lockEnd   = max(candidates) + 6 giờ

  // gate: orderStatus IN ('CONFIRMED', 'IN_PROGRESS') — ĐÃ CHỐT LẠI 2026-08-03, xem phần dưới
  ```

  **⚠️ Phát hiện quan trọng khi tra cứu để viết mục này**: "thời điểm order chuyển CONFIRMED" **không có
  sẵn ở bất kỳ đâu trong DB thật**. Đã đối chiếu `prisma/schema.prisma` (`D:\sep490-backend-api`, chỉ
  đọc) — model `Order` **không có cột `confirmed_at`** (3 chỗ có cột `confirmed_at` trong schema là của 3
  model khác hẳn: `SurveyReport`, `Settlement`, `CollectedEquipmentReport` — không liên quan tới việc
  order chuyển trạng thái). Đối chiếu `order.service.ts`/`order.repository.ts` cũng xác nhận: **không có
  đoạn code nào tự động chuyển `orderStatus` sang `CONFIRMED`** khi duyệt cọc — việc đổi sang `CONFIRMED`
  chỉ xảy ra khi Manager tự gọi `PUT /orders/:orderId/status` (hàm `updateOrderStatus`, generic cho mọi
  trạng thái), **độc lập hoàn toàn** với việc duyệt cọc (`Deposit.approvedAt`). Cũng không có bảng lịch sử
  đổi trạng thái (`order_status_history`/`audit_log`) nào trong schema để tra ngược lại thời điểm đổi.
  `order.updatedAt` (Prisma `@updatedAt`) **không dùng được thay thế** vì nó bị ghi đè bởi MỌI lần update
  sau đó (link báo giá, sửa items, xuất thiết bị, đóng đơn...), không riêng gì lần đổi status.

  **Đã CHỐT (2026-08-03, theo yêu cầu người dùng)**: dùng thẳng **`Deposit.approvedAt`** (lấy khoản cọc
  được duyệt **sớm nhất** của đơn) làm giá trị xấp xỉ thay cho "thời điểm confirmed" — **không thêm cột
  `orders.confirmed_at` mới**. Chấp nhận đánh đổi độ chính xác (về nguyên tắc Manager có thể đổi status
  độc lập với việc duyệt cọc, nên 2 mốc này có thể lệch nhau) để tránh phải thêm migration/cột mới. Nếu
  đơn `CONFIRMED` nhưng chưa từng có deposit nào được duyệt (Manager tự đổi status tay, không qua luồng
  cọc) → không có mốc `approvedAt` nào để so sánh, xử lý bằng cách **không lọc gì cả** (coi mọi
  `schedule_plans` của đơn đều hợp lệ), tránh loại nhầm toàn bộ lịch trình chỉ vì thiếu dữ liệu cọc.

  Lý do gộp cả 2 nguồn: lịch trình thật (lắp đặt/thu hồi) thường diễn ra **trước** `eventDate` và **sau**
  `endDate` (vd lắp đặt trước 1 ngày, thu hồi hôm sau) — nếu chỉ dùng `eventDate`/`endDate` như `7d619f0`
  thì thiếu phần đệm thi công thật; nếu chỉ dùng `schedule_plans` như `8eaad5e` thì đơn đã `CONFIRMED`
  nhưng chưa lên lịch nhân sự nào sẽ không bị khóa gì cả (sai, vì giữ chỗ thiết bị đã có hiệu lực ngay khi
  `CONFIRMED`, không phụ thuộc đã lên lịch hay chưa). Lấy min/max của cả 2 nguồn xử lý đúng cả 2 tình
  huống, và khoảng đệm 6 tiếng ở cả 2 đầu (không chỉ đầu ra) tránh 2 đơn liền kề tranh chấp thiết bị khi
  vận chuyển/dọn dẹp thực tế chưa kịp xong đúng giờ.
- **Điểm cần Backend/Product xác nhận thêm trước khi code** (nêu để hỏi, chưa tự chốt thay):
  - Khi đơn `CONFIRMED` nhưng **chưa có `endDate` và chưa có `schedule_plans` nào** (mới confirm, chưa
    lên lịch gì) → theo công thức trên `candidates = [eventDate]` nên `lockStart = eventDate - 6h`,
    `lockEnd = eventDate + 6h` — chỉ khóa đúng 12 tiếng quanh giờ tổ chức. Bản `8eaad5e` cũ dùng
    `Infinity` cho tình huống tương tự (an toàn hơn, khóa vô thời hạn tới khi có lịch Thu hồi) — cần xác
    nhận có giữ fallback `Infinity` cho đúng trường hợp "chưa có `endDate` lẫn chưa có lịch trình nào"
    hay chấp nhận cửa sổ ngắn 12 tiếng theo công thức thuần túy ở trên.
  - ~~Có phục hồi lại `orderStatus ∈ {CONFIRMED, IN_PROGRESS}` như `8eaad5e` không~~ — **ĐÃ CHỐT
    (2026-08-03)**: giữ nguyên `{CONFIRMED, IN_PROGRESS}` như code thật hiện tại (`a28c8a4`) — đơn đã
    chuyển `IN_PROGRESS` (đang thi công, thiết bị đang ở hiện trường) **vẫn tính vào "đã khóa"**, không
    quay lại giới hạn "chỉ `CONFIRMED`" đã ghi ở lần chốt trước đó trong mục này. Không cần Backend sửa gì
    thêm ở điểm này.
  - Phần trừ số lượng đã có giao dịch thuê Supplier che phủ (`supplierCoveredByOrder`, đã sửa đúng ở mục
    (au) và vẫn còn giữ nguyên ở `7d619f0`/`a28c8a4`) — không liên quan tới cách tính
    `lockStart`/`lockEnd` ở trên, giữ nguyên logic đó, chỉ thay phần tính `lockStart`/`lockEnd`.
- **Việc Backend cần làm**: sửa `getLockedQuantityByDate` theo đúng pseudocode trên — thêm truy vấn lấy
  `MIN(deposit.approvedAt)` (deposits đã duyệt) của từng đơn làm `confirmedAtProxy`, dùng giá trị này để
  lọc `schedule_plans` theo `startTime >= confirmedAtProxy` (bỏ qua lọc nếu `confirmedAtProxy` null) rồi
  mới tính `min`/`max` trên toàn bộ tập hợp còn lại. **Không cần thêm cột/migration mới** (đã chốt dùng
  `Deposit.approvedAt` sẵn có thay vì `orders.confirmed_at`).
- **Trạng thái implement thật (2026-08-03, cập nhật sau khi Backend báo đã sửa)**: đã đối chiếu code ở
  commit `a28c8a4 fix(inventory): update inventory locking formula to merge order and schedule dates with
  6h buffer` (`D:\sep490-backend-api\src\modules\inventory\inventory.repository.ts`, chỉ đọc — không sửa
  từ phiên FE này):
  - ✅ Đã gộp đúng 2 nguồn mốc thời gian (Order + toàn bộ `schedule_plans`) và cộng/trừ buffer 6 tiếng ở
    **cả hai đầu** (khác `7d619f0` cũ chỉ buffer 1 đầu) — đúng yêu cầu "GAP".
  - ✅ Vẫn giữ fallback `Infinity` khi không có tín hiệu "kết thúc" nào (không `endDate`, không plan nào
    có `endTime`) — an toàn, đúng hướng đã trao đổi.
  - ✅ Gate trạng thái `orderStatus: { in: ['CONFIRMED', 'IN_PROGRESS'] }` — **giữ nguyên, đã được người
    dùng xác nhận lại** (2026-08-03), không cần sửa nữa (đảo ngược lại quyết định "chỉ `CONFIRMED`" ghi ở
    bản chốt đầu tiên của mục này).
  - ❌ **Chưa lọc `schedule_plans` theo mốc "order chuyển CONFIRMED"** (`confirmedAtProxy`/
    `Deposit.approvedAt`) — code hiện tính toàn bộ `schedule_plans` của đơn không phân biệt thời điểm,
    vì tại lúc code phần này Backend chưa có hướng dẫn dùng `Deposit.approvedAt` (mới chốt ở mục này).
    Cần Backend áp dụng tiếp phần lọc theo đúng pseudocode đã cập nhật ở trên.
- **Phạm vi KHÔNG đổi trong đợt này**: chỉ ghi đặc tả ở mục này — **không sửa code** ở
  `D:\sep490-backend-api` (repo backend trong phiên làm việc FE này chỉ để đọc đối chiếu, theo CLAUDE.md).
  Tab "Chuẩn bị kho" ở `manager/orders/[id]/page.tsx` (đang dùng heuristic riêng phía client
  `[eventDate - 1 ngày, eventDate]`, xem mục (aw)) **vẫn là ước tính độc lập**, chưa đồng bộ với công thức
  min/max ± 6h này — để dành cho đợt sau nếu cần khớp chính xác giữa preview FE và lock thật của Backend.
  - **Cập nhật 2026-08-03 — đã đồng bộ**: theo yêu cầu người dùng ("check tồn kho tương ứng ngày khóa
    kho"), khoảng ngày mặc định của tab "Chuẩn bị kho" đổi từ heuristic `[eventDate - 1 ngày, eventDate]`
    sang lấy đúng `orderLockWindow` (`utils/inventoryLock.ts` — cùng công thức min/max ±6h mirror ở trên,
    dùng `order.eventDate`/`order.endDate` + `schedulePlans` SETUP/COLLECT). Nút "Đặt lại mặc định" và cờ
    "đang ở khoảng mặc định" cũng đổi theo cùng công thức này. Manager vẫn có thể tự chỉnh khoảng ngày —
    hành vi không ghi đè khoảng đã tự chỉnh khi reload (trừ khi đổi đơn/eventDate/endDate) giữ nguyên như
    cũ. Chỉ sửa phía FE (`manager/orders/[id]/page.tsx`, `utils/formatDate.ts` — thêm `toDateInputValue`),
    không đụng Backend.

## (ay) 2026-08-06 — Thêm "Xem/Tải lên bằng chứng" ở Đặt cọc + Quyết toán (Manager) — phần xem nối API thật, phần upload làm MOCK do thiếu endpoint gắn evidenceId [ĐÃ XỬ LÝ cùng ngày — xem cập nhật cuối mục]

- **Yêu cầu người dùng**: trang "Đặt cọc" (`manager/payments/deposits/[id]`) và "Quyết toán"
  (`manager/payments/settlements/[id]`) cần có cả xem và tải lên bằng chứng, giống field `evidenceId` đã
  có sẵn trên bảng `deposits`/`settlements` thật (`prisma/schema.prisma`, `D:\sep490-backend-api`).
- **Đã làm (FE, component dùng chung `src/components/payments/EvidenceBlock.tsx`, gắn vào
  `DepositDetailView.tsx` theo từng hồ sơ cọc và `SettlementDetailView.tsx` theo bản ghi quyết toán)**:
  - **Xem bằng chứng**: nối thật `GET /api/v1/evidence/:id` (cùng pattern đã dùng ở
    `SurveyDetailDrawer.tsx`/`inventory/returns/[id]/page.tsx`/`inventory/picklists/page.tsx`) — hoạt động
    đầy đủ vì `Deposit.evidenceId`/`Settlement.evidenceId` là field thật, chỉ chưa từng có UI đọc ra.
  - **Tải lên bằng chứng**: làm THUẦN MOCK theo yêu cầu người dùng — chọn file chỉ preview cục bộ qua
    `URL.createObjectURL`, KHÔNG gọi `evidenceApiService.uploadEvidence()` (dù endpoint này chạy thật, xem
    `evidence.service.ts`) và có disclaimer in nghiêng màu cảnh báo ngay dưới nút. Lý do không gọi API
    thật: xem mục dưới.
- **Vướng Backend (đã ghi từ trước, nhắc lại ở đây cho rõ ngữ cảnh)**: theo `types/payment.ts` (dòng
  11–15, re-test qua curl 2026-07-21) và `types/settlement.ts`, `PUT /deposits/:id` chỉ thật sự ghi được
  field `status` — `evidenceId` gửi kèm bị bỏ qua hoàn toàn; luồng settlement
  (`RecordSettlementPayload`/`ConfirmSettlementPayload`) cũng chưa từng có field `evidenceId`. Tức là dù
  `POST /evidence/upload` chạy thật và trả về `evidenceId` hợp lệ, **không có cách nào lưu lại liên kết
  evidenceId ↔ deposit/settlement** — đây chính là lý do UI "gắn chứng từ" từng bị bỏ hẳn khỏi
  `DepositDetailView.tsx` trước đó (xem mục (z), dòng ~1061).
- **Việc Backend cần làm** (để gỡ mock, nối thật luồng upload):
  1. `PUT /api/v1/deposits/:id` — nhận thêm field `evidenceId` (đã có trên schema, chỉ cần bỏ qua bước lọc
     field hiện đang loại field này ở service/validator).
  2. Luồng settlement — thêm field `evidenceId` vào `RecordSettlementPayload` (`POST
     /orders/:orderId/settlement`) hoặc `ConfirmSettlementPayload` (`PUT /settlements/:id/confirm`), tùy
     Backend chọn gắn bằng chứng ở bước lập biên bản hay bước xác nhận.
  3. Xác nhận lại role được phép gọi 2 endpoint trên với field `evidenceId` mới — theo đúng ranh giới đã
     chốt ở CLAUDE.md mục 1 (chỉ Manager, không phải Admin).
- **Phạm vi KHÔNG đổi trong đợt này**: không sửa gì ở `D:\sep490-backend-api` (chỉ đọc đối chiếu). Khi
  Backend làm xong 2 endpoint trên, cập nhật `EvidenceBlock.tsx` để gọi thật
  `evidenceApiService.uploadEvidence()` rồi `PUT`/`POST` gắn `evidenceId` trả về, gỡ khối mock +
  disclaimer.

- **Cập nhật 2026-08-06 (cùng ngày, sau khi đối chiếu lại Backend) — ĐÃ XỬ LÝ, gỡ mock**: Backend đã
  làm xong ở commit `d0db32a` ("feat: migrate evidence attachment from single to multiple (1:N) for
  deposits and settlements") — nhưng đổi shape khác doc gốc: thay vì thêm field `evidenceId` đơn vào
  `PUT /deposits/:id`/`PUT /settlements/:id/confirm` như yêu cầu ban đầu, Backend đổi hẳn quan hệ
  `Deposit`/`Settlement` → `Evidence` từ 1 field sang **1:N** (`evidenceIds: string[]`, xem
  `payment.validators.ts`/`payment.repository.ts`). Cả 2 endpoint chỉ nhận `evidenceIds` **cùng lúc
  đổi `status`** (không có API gắn bằng chứng riêng lẻ khi không đổi trạng thái — do cả 2 endpoint chỉ
  cho gọi khi bản ghi còn ở trạng thái mở/UNPAID). Đã cập nhật FE khớp theo:
  `src/components/payments/EvidenceBlock.tsx` (tách `EvidenceBlock` xem mảng evidenceIds + component
  mới `EvidenceUploadField`/hàm `uploadPaymentEvidence` chọn & upload file ngay trong bước xác nhận),
  `DepositDetailView.tsx` (chọn ảnh trong modal "Xác nhận đã nhận cọc"),
  `SettlementDetailView.tsx` (chọn ảnh ngay trước nút "Xác nhận thu nốt & Quyết toán"),
  `types/payment.ts` + `types/settlement.ts` (`evidenceIds: string[]` thay `evidenceId?: string`). Gỡ
  hẳn khối mock/disclaimer cũ.

## (az) 2026-08-06 — 🔴 Bug thật ở Backend: xác nhận quyết toán (`PUT /settlements/:id/confirm`) KHÔNG cascade `orders.payment_status = 'PAID'` — ORD-014 minh chứng thật [ĐÃ FIX cùng ngày — xem cập nhật cuối mục, còn thiếu backfill dữ liệu cũ]

- **Hiện tượng thật**: đơn ORD-014 đã "Xác nhận thu nốt & Quyết toán" xong trên UI (`settlement.status =
  'PAID'`, hiển thị "Đã xác nhận quyết toán" ở trang Thanh toán), nhưng ở trang "Danh sách đơn đặt", cột
  THANH TOÁN vẫn hiện "Đã cọc" (`orders.payment_status = 'DEPOSITED'`) thay vì "Đã thanh toán" (`PAID`).
- **Đã đọc thẳng source thật để xác nhận nguyên nhân** (`D:\sep490-backend-api`, chỉ đọc, không sửa):
  - `src/modules/sales/payment.repository.ts` dòng 92–97, hàm `confirmSettlement(settlementId,
    confirmedBy)`: chỉ update `settlement.status/confirmedBy/confirmedAt` — **không có bất kỳ update nào
    lên bảng `orders`**.
  - So sánh với luồng Đặt cọc cùng file, dòng 66–86, hàm `updateStatus` (deposit): khi `status = 'PAID'`
    có làm đúng trong 1 `prisma.$transaction`: vừa update deposit vừa `prisma.order.update({...,
    data: { paymentStatus: 'DEPOSITED' } })` — **luồng Settlement thiếu hẳn bước tương đương để set
    `'PAID'`**.
  - `src/modules/sales/order.validators.ts` dòng 54–62, `updateOrderStatusBodySchema` (dùng cho `PUT
    /orders/:id/status`) chỉ nhận `{ orderStatus, cancelReason }` — **không có field `paymentStatus`** —
    nên FE cũng không có cách nào tự gửi lên sửa field này qua endpoint hiện có, kể cả muốn làm workaround
    tạm ở FE.
  - FE (`SettlementDetailView.tsx` hàm `handleConfirmSettlement`) có gọi thêm `PUT /orders/:id/status
    {orderStatus:'COMPLETED'}` ngay sau khi confirm settlement, nhưng lệnh này chỉ đổi `orderStatus`,
    không đụng `paymentStatus` — không bù được gap này.
  - Đây chính là điều `docs/tiendosukien_api.md` mục 6 bước 4 từng đánh dấu là **giả định chưa verify**
    ("không chờ giả định backend tự cập nhật `orders.payment_status = 'PAID'`... khác hẳn deposit đã ghi
    rõ") — nay đã có bằng chứng thật (ORD-014) xác nhận giả định đó **sai**.
- **Hệ quả nghiêm trọng hơn phát hiện thêm khi đối chiếu**: `src/modules/sales/order.service.ts` dòng
  599 — hàm đóng đơn (`closeOrder`) bắt buộc `existing.orderStatus === 'COMPLETED' &&
  existing.paymentStatus === 'PAID'` mới cho đóng. Với gap này, **không đơn nào quyết toán qua UI có thể
  đóng được** (`paymentStatus` không bao giờ tự lên `PAID`), dù `orderStatus` đã đúng `COMPLETED`.
- **Việc Backend cần làm** (đúng pattern đã áp dụng cho deposit, dòng 66–86 cùng file):
  1. Sửa `paymentRepository.confirmSettlement` (`payment.repository.ts:92-97`) — bọc trong
     `prisma.$transaction`, thêm `prisma.order.update({ where: { orderId: settlement.orderId }, data: {
     paymentStatus: 'PAID' } })` cùng lúc với update settlement. Cần lấy `orderId` từ `settlement` object
     (đã có sẵn field này, xem `findSettlementById`).
  2. Cân nhắc áp dụng tương tự cho `markSettlementPaid` (`payment.repository.ts:99-104`, dòng
     `PUT /settlements/:settlementId/mark-paid` — Leader xác nhận tại hiện trường) nếu luồng đó cũng cần
     phản ánh `paymentStatus = 'PAID'` ngay khi Leader ghi nhận (chưa chốt — cần hỏi lại nghiệp vụ có muốn
     `paymentStatus` lên `PAID` ngay ở bước Leader ghi nhận hay chỉ khi Manager `confirmSettlement` chính
     thức).
  3. Sau khi sửa, cần backfill lại dữ liệu cũ đã bị kẹt sai do gap này (ít nhất ORD-014 và mọi đơn khác đã
     quyết toán PAID nhưng `orders.payment_status` vẫn `DEPOSITED`/`UNPAID`) — không tự chạy migration/UPDATE
     trực tiếp DB từ phiên FE này, cần Backend rà soát và xử lý.
- **Phạm vi KHÔNG đổi trong đợt này**: chỉ ghi đặc tả bug ở mục này — không sửa code ở
  `D:\sep490-backend-api` (chỉ đọc đối chiếu, theo CLAUDE.md), không sửa gì ở FE (gọi `PUT
  /orders/:id/status {orderStatus:'COMPLETED'}` ở `SettlementDetailView.tsx` giữ nguyên, vì bản thân bước
  đó đúng — vấn đề nằm ở thiếu cascade phía Backend, không phải FE gọi sai/thiếu endpoint nào).

- **Cập nhật 2026-08-06 (cùng ngày, sau khi đối chiếu lại Backend) — ĐÃ FIX việc 1**: commit `d0db32a`
  (cùng commit xử lý mục (ay)) đã sửa đúng như yêu cầu — `confirmSettlement` (`payment.repository.ts:
  101-120`) và luôn cả `markSettlementPaid` (dòng 122-141, việc 2 ở trên) nay đều bọc
  `prisma.$transaction` kèm `prisma.order.update({ paymentStatus: 'PAID' })`. Xác nhận qua
  `git log -S"paymentStatus: 'PAID'"` — dòng cascade này chỉ xuất hiện từ đúng commit `d0db32a`. **Việc
  3 (backfill dữ liệu cũ, ít nhất ORD-014) CHƯA thấy làm** — diff commit không đụng tới
  `docs/migrations/*.sql` theo hướng backfill `payment_status`; cần hỏi lại Backend đã backfill thủ
  công ngoài migration hay chưa, hoặc nhắc Backend xử lý nếu còn sót.

## (ba) 2026-08-06 — 🔴 Bug thật ở Backend: `GET /orders/:orderId/deposits` và `GET /orders/:orderId/settlement` KHÔNG include quan hệ `evidences` — ảnh bằng chứng đã gắn thành công vẫn không hiển thị lại

- **Hiện tượng**: sau khi làm xong FE nối API thật cho upload bằng chứng ở mục (ay) (chọn ảnh trong
  modal "Xác nhận đã nhận cọc" / trước nút "Xác nhận thu nốt & Quyết toán", gọi `POST /evidence/upload`
  rồi gửi `evidenceIds` kèm `PUT /deposits/:id` hoặc `PUT /settlements/:id/confirm`) — người dùng test
  thật báo "chưa nhận được ảnh upload lên": xác nhận cọc/quyết toán vẫn chạy được (status chuyển PAID
  bình thường), nhưng sau khi tải lại trang, khối "Bằng chứng thanh toán" vẫn hiện trống, dù ảnh đã
  chọn lúc xác nhận.
- **Đã đọc thẳng source thật để xác nhận nguyên nhân** (`D:\sep490-backend-api`, chỉ đọc, không sửa):
  - `PUT /deposits/:id` (`payment.repository.ts:70-95`, hàm `updateStatus`) và
    `PUT /settlements/:id/confirm` (`payment.repository.ts:101-120`, hàm `confirmSettlement`) đều GHI
    ĐÚNG — có `evidences: { deleteMany: {}, create: evidenceIds.map(...) }` trong transaction, bảng
    join `deposit_evidences`/`settlement_evidences` (prisma/schema.prisma dòng 918-927) được ghi thật
    sự. Bước ghi (upload + gắn) **không có vấn đề gì**.
  - Vấn đề nằm ở bước ĐỌC LẠI: `src/modules/sales/order.repository.ts:251-257` hàm `findDeposits`
    (dùng cho `GET /orders/:orderId/deposits` — đúng endpoint `DepositDetailView.tsx` gọi ở `load()`)
    — `prisma.deposit.findMany({ where: { orderId }, orderBy, skip, take })` **KHÔNG có
    `include: { evidences: true }`**. Tương tự `order.repository.ts:294-296` hàm `findLatestSettlement`
    (dùng cho `GET /orders/:orderId/settlement`) cũng **thiếu `include: { evidences: true }`**.
  - Hệ quả: `mapDeposit`/`mapSettlement` ở `order.service.ts` (dòng ~380/~415, cùng logic
    `evidenceIds: (row as any).evidences ? ... : []`) luôn rơi vào nhánh `: []` vì `row.evidences` là
    `undefined` — API trả `evidenceIds: []` bất kể database đã có bản ghi join thật. Đây là bug thuần
    Backend (thiếu `include` ở đúng 2 chỗ), không phải lỗi FE — khác với payload GHI (`PUT`) đã đối
    chiếu đúng ở mục (ay)/(az), lỗi này nằm ở payload ĐỌC.
  - Đối chiếu: `payment.repository.ts` (module `sales`, dùng cho `GET /deposits` gộp toàn hệ thống qua
    `findManyDeposits`/`findDepositById`) **CÓ** include đúng (`depositListInclude` dòng 22-24, và dòng
    45). Chỉ riêng 2 hàm ở `order.repository.ts` (đọc theo `orderId`, chính là API `DepositDetailView.tsx`/
    `SettlementDetailView.tsx` đang dùng) là thiếu.
- **Việc Backend cần làm**:
  1. `order.repository.ts:251-257` (`findDeposits`) — thêm `include: { evidences: true }` vào
     `prisma.deposit.findMany(...)`, đúng pattern `depositListInclude` đã có ở `payment.repository.ts`.
  2. `order.repository.ts:294-296` (`findLatestSettlement`) — thêm `include: { evidences: true }` vào
     `prisma.settlement.findFirst(...)`.
  3. Rà soát các hàm đọc `Deposit`/`Settlement` khác theo `orderId` trong cùng file (nếu có) để không sót
     chỗ nào tương tự.
- **Phạm vi KHÔNG đổi trong đợt này**: chỉ ghi đặc tả bug ở mục này — không sửa code ở
  `D:\sep490-backend-api` (chỉ đọc đối chiếu, theo CLAUDE.md). FE giữ nguyên như đã làm ở (ay) (upload +
  gửi `evidenceIds` đúng payload) — không cần đổi gì thêm phía FE, chỉ cần Backend thêm `include` là ảnh
  sẽ hiện đúng ngay mà không phải sửa lại FE.

- **Cập nhật 2026-08-13 — ĐÃ FIX**: đối chiếu lại `order.repository.ts` (`D:\sep490-backend-api`), cả
  `findDeposits` (dòng 321-329) lẫn `findLatestSettlement` (dòng 372-378) nay đều đã có
  `include: { evidences: { select: { evidenceId: true } } }` — đúng như yêu cầu. Ảnh minh chứng cọc/quyết
  toán hiển thị đúng qua `DepositDetailView.tsx`/`SettlementDetailView.tsx` mà không cần sửa gì thêm ở FE.

## (bb) 2026-08-13 — `GET /survey-reports` (danh sách) chưa map `evidenceIds` vào response, chỉ endpoint chi tiết `/survey-reports/:id` mới có

- **Bối cảnh**: theo yêu cầu Frontend xử lý hiển thị ảnh minh chứng ở 3 khu vực Khảo sát/Đặt cọc/Thu hồi
  thiết bị, phần fallback "dùng ảnh khảo sát khi đặt cọc chưa có ảnh riêng" (`DepositDetailView.tsx`,
  cũng dùng ở `orders/[id]/page.tsx` cho `surveyReport`) cần `SurveyReportListItem.evidenceIds` từ kết quả
  `GET /survey-reports?search=...`.
- **Đã đọc thẳng source thật để xác nhận** (`D:\sep490-backend-api`, chỉ đọc, không sửa):
  `src/modules/operations/survey.service.ts` — hàm `mapListItem` (dòng 53-67, dùng cho `listSurveyReports`
  → backend cho endpoint LIST) **không** có field `evidenceIds` trong object trả về. Trong khi đó hàm
  `mapDetail` (dòng 81, dùng cho `getSurveyReportById` → endpoint DETAIL `/survey-reports/:id`) đã có
  `evidenceIds: row.evidences ? row.evidences.map((e) => e.evidenceId) : []`. Dữ liệu join `evidences` vẫn
  được Prisma fetch ở cả 2 trường hợp (`survey.repository.ts:49`, `detailInclude` có `include: {
  evidences: {...} }`) — chỉ riêng bước map sang JSON ở `mapListItem` là thiếu đúng 1 dòng.
- **Hệ quả phía FE**: `SurveyReportListItem.evidenceIds` (đã thêm field này vào `types/survey.ts` theo
  yêu cầu Frontend) sẽ luôn là `undefined` khi lấy qua danh sách — phần fallback ảnh khảo sát ở
  `DepositDetailView.tsx` vẫn code đúng nhưng sẽ không hiển thị được ảnh nào trên thực tế cho tới khi
  Backend sửa xong mục dưới đây.
- **Việc Backend cần làm**: `survey.service.ts` hàm `mapListItem` (dòng 53-67) — thêm đúng 1 dòng
  `evidenceIds: row.evidences ? row.evidences.map((e) => e.evidenceId) : []` giống hệt `mapDetail` đã có.
- **Phạm vi KHÔNG đổi trong đợt này**: chỉ ghi đặc tả gap ở mục này — không sửa code ở
  `D:\sep490-backend-api` (chỉ đọc đối chiếu, theo CLAUDE.md). FE vẫn giữ nguyên logic fallback đã viết
  (đúng yêu cầu) — không cần đổi gì thêm phía FE, chỉ cần Backend bổ sung dòng map trên là ảnh khảo sát sẽ
  tự hiện đúng ở phần fallback mà không phải sửa lại FE.

## (bc) 2026-08-25 — [ĐÃ XONG] Nút "Chỉnh sửa đơn đặt" (chi tiết đơn, tab header) đã dựng lại giao diện đúng nội dung form tạo đơn, nhưng CHƯA có API để sửa `eventName`/`eventType`/`guestCount`/`location`/`notes` của Order đã tồn tại

> **Cập nhật cùng ngày 2026-08-25**: Backend đã bổ sung `PATCH /api/v1/orders/:orderId`
> (`order.routes.ts` dòng 64-69, `updateOrderInfoBodySchema` ở `order.validators.ts`, controller/service/
> repository method `updateInfo`) — đúng shape đã đề xuất bên dưới (mọi field optional, chặn 400 nếu đơn
> đã ở trạng thái kết thúc qua `assertNotTerminal`). FE đã nối xong: thêm `orderApiService.updateOrderInfo`
> (`order.service.ts`) + type `UpdateOrderInfoPayload` (`types/order.ts`), sửa `EditOrderModal.tsx` gọi API
> thật (bỏ optimistic `onSaved`, đổi sang `onSuccess` reload lại trang qua `load()` giống pattern
> `RescheduleOrderModal`), xử lý lỗi qua `parseApiError`. Lưu ý nhỏ (không chặn FE): route
> `PATCH /:orderId` ở backend hiện **không** có `validate(orderIdParamSchema, 'params')` như các route
> khác cùng file (chỉ validate body) — không ảnh hưởng hành vi vì `orderId` vẫn lấy đúng từ `req.params`,
> chỉ là thiếu 1 lớp validate hình thức, không cần FE xử lý gì thêm.

- **Bối cảnh**: nút "Chỉnh sửa đơn đặt" ở `manager/orders/[id]/page.tsx` trước đây bị khóa cứng
  (`disabled`) vì modal cũ `BookingFormModal.tsx` theo shape mock lỗi thời, không tương thích `OrderDetail`
  thật (xem `docs/taodondatlichtiecmoi_api.md`). Theo yêu cầu người dùng 2026-08-24, đã dựng lại modal mới
  `src/components/orders/EditOrderModal.tsx` — nội dung/bố cục copy đúng theo form "Tạo đơn hàng mới"
  thật (`CreateOrderModal.tsx`: khối thông tin khách hàng + Tên sự kiện/Loại sự kiện/Số lượng khách/Địa
  điểm tổ chức/Ghi chú) — nhưng **chỉ dựng giao diện theo yêu cầu người dùng ở bước đó**, bấm "Lưu thay
  đổi" hiện chỉ cập nhật state hiển thị tại chỗ trên trang (optimistic, mất khi tải lại), chưa gọi API
  thật.
- **Đã đọc thẳng source thật để xác nhận gap** (`D:\sep490-backend-api`, chỉ đọc, không sửa):
  `src/modules/sales/order.routes.ts` — toàn bộ các route `PUT`/`PATCH` trên `/orders/:orderId/*` hiện có
  chỉ xử lý riêng lẻ: `/status`, `/items`, `/dates` (đã có sẵn — dùng cho nút "Đổi ngày"/
  `RescheduleOrderModal.tsx`, xử lý `eventDate`/`endDate`), `/items/confirm-prepared`,
  `/items/:orderItemId`, `/live-checklist`, `/quotation`, `/picklist/picked-up`, `/close`. **Không có
  route nào sửa `eventName`/`eventType`/`guestCount`/`location`/`latitude`/`longitude`/`notes`** của 1
  Order đã tồn tại. Đối chiếu `prisma/schema.prisma` (model `Order`, dòng 457+): các cột này đều là cột
  đơn giản trên bảng `orders`, không có ràng buộc/side-effect phức tạp như `eventDate`/`endDate` (vốn ảnh
  hưởng cửa sổ khóa kho theo ngày — lý do cố tình KHÔNG gộp các field này vào form Chỉnh sửa đơn đặt, giữ
  riêng với "Đổi ngày" để tránh xung đột luồng khóa kho, xem comment cuối `EditOrderModal.tsx`).
  Đây là phần còn lại của việc (2) đã nêu ở mục (aw) ("cân nhắc thêm 1 endpoint cập nhật thông tin sự
  kiện của order đã tồn tại") — phần `endDate`/`eventDate` của việc đó đã được Backend làm xong riêng
  (route `/dates` kể trên), nhưng phần còn lại (`eventName`/`eventType`/`guestCount`/`location`/`notes`)
  vẫn chưa có.
- **Việc Backend cần làm**: thêm 1 endpoint mới, ví dụ `PATCH /api/v1/orders/:orderId` (Manager), nhận
  body toàn bộ optional — chỉ gửi field nào đổi:

  ```json
  {
    "eventName": "Lễ cưới Nguyễn Minh Trí",
    "eventType": "Tiệc cưới",
    "guestCount": 200,
    "location": "Riverside Palace (Sảnh Hera)",
    "latitude": 10.7629,
    "longitude": 106.6602,
    "notes": "Ghi chú thêm"
  }
  ```

  Response trả lại `Order` đầy đủ, theo đúng pattern `PUT /orders/:id/dates` đang trả `OrderWithDetails`
  (`order.repository.ts` hàm `updateDates`, dòng 270). Theo pattern đã có, cần thêm: Zod schema (ví dụ
  `updateOrderInfoBodySchema`, validate `guestCount >= 0` như comment ở `schema.prisma`) ở
  `order.validators.ts`, route ở `order.routes.ts`, controller method ở `order.controller.ts`, service +
  repository method update các cột tương ứng — không đụng `eventDate`/`endDate` (đã có endpoint riêng).
- **Việc FE cần làm sau khi Backend có endpoint**: thêm `updateOrderInfo` vào `order.service.ts`, thêm
  type payload tương ứng vào `types/order.ts`, sửa `EditOrderModal.tsx` — thay đoạn gọi `onSaved(...)`
  optimistic hiện tại bằng gọi API thật + xử lý lỗi (400 validate, 404, 403 không phải Manager), gỡ dòng
  toast "chưa nối API thật".
- **Phạm vi KHÔNG đổi trong đợt này**: chỉ ghi yêu cầu ở mục này — không sửa code ở
  `D:\sep490-backend-api` (chỉ đọc đối chiếu, theo CLAUDE.md), không sửa gì thêm ở FE ngoài
  `EditOrderModal.tsx`/nút "Chỉnh sửa đơn đặt" đã dựng theo yêu cầu người dùng ở bước trước.
