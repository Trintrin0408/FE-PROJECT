// Lõi Mock Data + Mock API thống nhất cho toàn bộ UI — xem kế hoạch chi tiết ở DEMO_CHECKLIST.md
// mục "1b. Giai đoạn 2 — Hợp nhất Mock Data + Mock API cho toàn bộ UI (Task 12+)".
//
// Mục tiêu: MỘT nguồn dữ liệu giả lập duy nhất, có quan hệ chéo thật (Order trỏ đúng Customer thật,
// Quotation trỏ đúng Order/Customer thật, SchedulePlan/SurveyReport/ChangeRequest trỏ đúng Order
// thật...) thay cho 21 file trong src/mocks/ + seed.ts + apiFixtures.ts hiện đang tự đánh số ID
// riêng, không tham chiếu chéo nhau (chi tiết từng chỗ lệch: xem báo cáo audit trong lịch sử task).
//
// Import DUY NHẤT từ đây (`@/mocks/db`) cho mọi entity domain — không import trực tiếp từ file lẻ
// bên trong thư mục này ở nơi khác ngoài chính src/mocks/db/.
//
// Tiến độ migrate từng entity (cập nhật khi hoàn thành từng Task ở DEMO_CHECKLIST.md):
//   [x] Task 13 Customer         -> ./customers   (nguồn cũ: adminCustomersMock.ts, apiFixtures.MOCK_CUSTOMERS — đã xóa cả 2)
//   [x] Task 14 Order            -> ./orders       (nguồn cũ: adminOrdersMock.ts, apiFixtures.MOCK_ORDERS — đã xóa cả 2; đã thêm customerId FK thật)
//   [x] Task 15 Quotation        -> ./quotations   (nguồn cũ: adminQuotationsMock.ts — đã xóa; đã thêm customerId FK thật + wire CreateOrderFromQuotationModal vào addAdminOrder())
//   [x] Task 16 Catalog+Inventory-> ./catalog       (nguồn cũ: catalogMocks.ts, adminEquipmentMock.ts — đã xóa cả 2; gộp 71 item, sửa EQUIPMENT_CATEGORY_OPTIONS thiếu 3/11 danh mục)
//   [x] Task 17 Supplier         -> ./suppliers     (nguồn cũ: adminSuppliersMock.ts, adminSupplierReturnsMock.ts — đã xóa cả 2; orderLinkCode trỏ DD0001 thật, hợp nhất "RENTAL_ORDERS" vào transactions[])
//   [x] Task 18 SchedulePlan/Employee -> ./schedulePlans, ./employees (nguồn cũ: adminSchedulePlansMock.ts, adminEmployeesMock.ts + 5 pool tên rời rạc — đã xóa file cũ, 5 pool giờ derive từ FIELD_OPS_STAFF dùng chung)
//   [x] Task 19 Payments         -> ./payments      (nguồn cũ: adminOrderPaymentsMock.ts — đã xóa; Deposit/Settlement giờ là bản ghi riêng trỏ orderId thật)
//   [x] Task 20 ChangeRequest/SurveyReport -> ./changeRequests, ./surveyReports (nguồn cũ: managerFieldOpsMock.ts — đã xóa; seed.ts + 2 route handler mock riêng đã xóa; adminSurveyReportsMock.ts — đã xóa, SURVEY_TARGET_ORDERS giờ trỏ đơn NEW thật)
//   [x] Task 21 Dashboard aggregates -> derive từ các entity trên thay vì số liệu tĩnh (adminDashboard.ts/managerDashboard.ts KHÔNG chuyển vào db/, chỉ đổi cách tính bên trong)
//   [x] Task 22 Contract         -> vẫn ở src/mocks/adminContractsMock.ts (KHÔNG chuyển vào db/ — quyết định giữ nguyên vị trí, chỉ sửa data: customerName/Phone/Email/Address/eventName/guestCount/weddingDate/venue/packageType/subTotal giờ lấy thật từ quotation theo quotationId thay vì tự sinh độc lập)
//
// Entity RBAC User (đăng nhập) và WorkTask (danh mục loại việc tĩnh) đã tương đối thống nhất qua
// src/mocks/apiFixtures.ts + src/mocks/authAccounts.ts — sẽ dọn nốt vào db/ ở Task 13/18 khi tiện,
// không phải ưu tiên (không có xung đột ID nghiêm trọng như Order/Customer/Quotation).

export { createMockStore, nextSequentialId, paginate } from './utils';
export type { MockStore, MockApiEnvelope, MockApiMeta } from './utils';

export * from './customers';
export * from './employees';
export * from './quotations';
export * from './orders';
export * from './catalog';
export * from './suppliers';
export * from './schedulePlans';
export * from './payments';
export * from './changeRequests';
export * from './surveyReports';

// Entity modules còn lại sẽ export tại đây theo từng Task ở trên.
