import type { AdminUser } from '@/types/user';
import type { WorkTask } from '@/types/workTask';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { SurveyReport } from '@/types/survey';
import type { BusinessPolicy } from '@/types/policy';
import type { WageRecord } from '@/types/wage';
import type { OrderWarningSummary } from '@/types/order';
import type { Evidence } from '@/types/evidence';
import type { SupplierTransaction } from '@/types/procurement';
import { getAdminOrders } from '@/mocks/db/orders';
import { getAdminSuppliers } from '@/mocks/db/suppliers';

// Dữ liệu ảo dùng riêng cho lớp mock adapter (src/services/mockAdapter.ts) — phục vụ các màn hình
// còn gọi thẳng qua services/*.service.ts (chưa chuyển sang đọc trực tiếp từ src/mocks như phần lớn
// trang khác). Xem CLAUDE.md mục 0 — giai đoạn dựng giao diện thuần, không cần khớp backend thật.
//
// Customer và Order KHÔNG còn định nghĩa ở đây từ Task 13/14 (DEMO_CHECKLIST.md Giai đoạn 2) — đã
// hợp nhất về src/mocks/db/customers.ts + src/mocks/db/orders.ts (nguồn DUY NHẤT cho cả 2 entity
// này trong toàn app). mockAdapter.ts giờ đọc trực tiếp từ đó (có hàm map sang shape Customer/Order
// của types/customer.ts, types/order.ts) thay vì có mảng MOCK_CUSTOMERS/MOCK_ORDERS riêng ở đây.

const NOW = '2026-07-10T00:00:00Z';

// 2 đơn thật + 3 nhà cung cấp thật dùng làm dữ liệu mẫu bên dưới — lấy ĐỘNG từ getAdminOrders()/
// getAdminSuppliers() (db/orders.ts, db/suppliers.ts) thay vì hardcode literal 'DD0001'/'sup-1'/
// 'Ánh Sáng Pro' cố định như trước, để không lệch ngầm nếu seed đơn hàng/nhà cung cấp đổi sau này.
const ALL_ORDERS = getAdminOrders();
const ORDER_A_ID = (ALL_ORDERS[0]?.orderId ?? 'DD0001') as string;
const ORDER_C_ID = (ALL_ORDERS[2]?.orderId ?? 'DD0003') as string;
// Mock không có cột orderCode riêng — orderId chính là mã hiển thị (kiểu 'DD0001'). Dùng cho
// MOCK_SURVEY_REPORTS bên dưới (SurveyReport thật yêu cầu kèm orderCode/customerName join sẵn).
const ORDER_A_CODE = ORDER_A_ID;
const ORDER_A_CUSTOMER_NAME = ALL_ORDERS[0]?.customerName ?? 'Khách hàng';
const ORDER_C_CODE = ORDER_C_ID;
const ORDER_C_CUSTOMER_NAME = ALL_ORDERS[2]?.customerName ?? 'Khách hàng';

const ALL_SUPPLIERS = getAdminSuppliers();
const SUPPLIER_1 = ALL_SUPPLIERS.find((s) => s.supplierId === 'sup-1') ?? ALL_SUPPLIERS[0];
const SUPPLIER_3 = ALL_SUPPLIERS.find((s) => s.supplierId === 'sup-3') ?? ALL_SUPPLIERS[2];
const SUPPLIER_5 = ALL_SUPPLIERS.find((s) => s.supplierId === 'sup-5') ?? ALL_SUPPLIERS[4];

export const MOCK_USERS: AdminUser[] = [
  { userId: 'mock-admin-1', username: 'admin', fullName: 'Quản trị viên hệ thống', role: 'ADMIN', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
  { userId: 'mock-manager-1', username: 'manager', fullName: 'Trưởng phòng vận hành', role: 'MANAGER', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
  { userId: 'mock-leader-1', username: 'leader.long', fullName: 'Vũ Hoàng Long', role: 'STAFF', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
  { userId: 'mock-leader-2', username: 'leader.huong', fullName: 'Nguyễn Thị Hương', role: 'STAFF', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
  { userId: 'mock-tech-1', username: 'tech.dung', fullName: 'Lê Minh Dũng', role: 'STAFF', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
  { userId: 'mock-tech-2', username: 'tech.tuan', fullName: 'Trần Anh Tuấn', role: 'STAFF', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
  { userId: 'mock-tech-3', username: 'tech.mai', fullName: 'Phạm Thị Mai', role: 'STAFF', status: 'ACTIVE', email: null, phone: null, createdAt: NOW, updatedAt: NOW },
];

export const MOCK_WORK_TASKS: WorkTask[] = [
  { taskId: 'task-survey', taskCode: 'WT-01', taskName: 'Khảo sát hiện trường', isActive: true },
  { taskId: 'task-prep', taskCode: 'WT-02', taskName: 'Chuẩn bị & xuất kho', isActive: true },
  { taskId: 'task-transport', taskCode: 'WT-03', taskName: 'Vận chuyển', isActive: true },
  { taskId: 'task-setup', taskCode: 'WT-04', taskName: 'Thi công lắp đặt', isActive: true },
  { taskId: 'task-collect', taskCode: 'WT-05', taskName: 'Thu hồi thiết bị', isActive: true },
];

// SchedulePlan (khảo sát + thi công) cho src/components/orders/SurveyPersonnelTab.tsx — component
// này hiện chưa được trang nào import/render (grep "SurveyPersonnelTab" chỉ ra chính file nó), nên
// dữ liệu dưới đây chưa có tác dụng hiển thị thật cho tới khi có trang gắn lại component; giữ sẵn để
// không phải làm lại khi component được wire vào chi tiết đơn hàng. orderId trỏ đơn thật (2 đơn đầu
// tiên trong src/mocks/db/orders.ts, lấy động qua ORDER_A_ID/ORDER_C_ID ở đầu file — Task "System
// Testing" audit 2b-2) — trước đây hardcode literal 'DD0001'/'DD0003' cố định.
export const MOCK_SCHEDULE_PLANS: SchedulePlan[] = [
  { planId: 'plan-1', planCode: 'KH-001', orderId: ORDER_A_ID, taskId: 'task-survey', assignedTo: 'mock-leader-1', startTime: '2026-07-20T08:00:00Z', location: 'Sảnh Hera', status: 'COMPLETED', createdBy: 'mock-manager-1', createdAt: NOW, updatedAt: NOW, taskName: 'Khảo sát hiện trường', assigneeName: 'Vũ Hoàng Long' },
  { planId: 'plan-2', planCode: 'KH-002', orderId: ORDER_A_ID, taskId: 'task-setup', assignedTo: 'mock-tech-1', startTime: '2026-08-14T07:00:00Z', location: 'Sảnh Hera', status: 'CONFIRMED', createdBy: 'mock-manager-1', createdAt: NOW, updatedAt: NOW, taskName: 'Thi công lắp đặt', assigneeName: 'Lê Minh Dũng' },
  { planId: 'plan-3', planCode: 'KH-003', orderId: ORDER_C_ID, taskId: 'task-survey', assignedTo: 'mock-leader-2', startTime: '2026-07-15T08:00:00Z', location: 'Sảnh Zeus', status: 'COMPLETED', createdBy: 'mock-manager-1', createdAt: NOW, updatedAt: NOW, taskName: 'Khảo sát hiện trường', assigneeName: 'Nguyễn Thị Hương' },
  { planId: 'plan-4', planCode: 'KH-004', orderId: ORDER_C_ID, taskId: 'task-setup', assignedTo: 'mock-tech-2', startTime: '2026-07-24T07:00:00Z', location: 'Sảnh Zeus', status: 'IN_PROGRESS', createdBy: 'mock-manager-1', createdAt: NOW, updatedAt: NOW, taskName: 'Thi công lắp đặt', assigneeName: 'Trần Anh Tuấn' },
];

export const MOCK_SURVEY_REPORTS: SurveyReport[] = [
  {
    surveyId: 'survey-1',
    reportCode: 'KS-001',
    orderId: ORDER_A_ID,
    orderCode: ORDER_A_CODE,
    customerName: ORDER_A_CUSTOMER_NAME,
    planId: 'plan-1',
    evidenceIds: ['ev-1'],
    surveyDate: '2026-07-20T08:30:00Z',
    location: 'Sảnh Hera, 12 Lê Lợi, Q1',
    area: 250,
    length: 25,
    width: 10,
    entrance: 'Cổng chính rộng 4m, có thể chở hàng bằng xe tải nhỏ',
    siteConstraints: 'Trần cao 4.5m, không có cột giữa sảnh',
    additionalRequests: 'Khách yêu cầu thêm đèn trang trí trần',
    proposedItems: 'Bàn ghế Chiavari, phông nền hoa tươi, hệ thống âm thanh ánh sáng',
    notes: 'Mặt bằng thuận lợi, không cần thi công thêm kết cấu phụ',
    status: 'CONFIRMED',
    reportedBy: 'mock-leader-1',
    confirmedBy: 'mock-manager-1',
    confirmedAt: '2026-07-20T14:00:00Z',
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-20T14:00:00Z',
  },
  {
    surveyId: 'survey-2',
    reportCode: 'KS-002',
    orderId: ORDER_C_ID,
    orderCode: ORDER_C_CODE,
    customerName: ORDER_C_CUSTOMER_NAME,
    planId: 'plan-3',
    evidenceIds: [],
    surveyDate: '2026-07-15T08:30:00Z',
    location: 'Sảnh Zeus, 78 CMT8, Q3',
    area: 200,
    length: 20,
    width: 10,
    entrance: 'Cổng phụ rộng 3m',
    siteConstraints: 'Có 2 cột giữa sảnh cần tránh khi bố trí bàn',
    proposedItems: 'Bàn tròn 10 người, sân khấu nhỏ, phông chữ LED',
    status: 'SUBMITTED',
    reportedBy: 'mock-leader-2',
    createdAt: '2026-07-15T09:00:00Z',
    updatedAt: '2026-07-15T09:00:00Z',
  },
];

// Dữ liệu ảo cho các service CHƯA được trang nào gọi tới (DEMO_CHECKLIST.md Task 10) — chỉ để
// policyApiService/wageApiService/evidenceApiService/procurementApiService's GET route
// (getTransactions/getTransactionById) không còn rơi vào fallback rỗng chung một khi có trang mới
// gắn vào. policyValue/policyType phản ánh đúng "Quy tắc nghiệp vụ cốt lõi" đã ghi ở CLAUDE.md mục 1
// (đổi ngày, hoàn cọc, đền bù, tiền công) để nhất quán số liệu toàn site. MOCK_ORDER_WARNINGS giờ chỉ
// còn dùng để nhúng `OrderDetail.orderWarnings` (mockAdapter.ts) — endpoint riêng
// `GET/POST /orders/{id}/warnings` đã bị bỏ hẳn khỏi frontend (xem docs/more-require.md mục (an.2)).
export const MOCK_POLICIES: BusinessPolicy[] = [
  { policyId: 'pol-1', policyCode: 'HOAN-COC-30', policyName: 'Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện', policyType: 'CANCELLATION', policyValue: 100, unit: '%', description: 'Khách báo hủy trước ≥30 ngày so với ngày lắp đặt: hoàn 100% tiền cọc.', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-2', policyCode: 'HOAN-COC-7-30', policyName: 'Hoàn cọc khi hủy đơn 7–30 ngày trước sự kiện', policyType: 'CANCELLATION', policyValue: 50, unit: '%', description: 'Khách báo hủy trong khoảng 7–30 ngày trước ngày lắp đặt: hoàn 50% tiền cọc.', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-3', policyCode: 'HOAN-COC-DUOI-7', policyName: 'Hoàn cọc khi hủy đơn <7 ngày trước sự kiện', policyType: 'CANCELLATION', policyValue: 0, unit: '%', description: 'Khách báo hủy dưới 7 ngày trước ngày lắp đặt: không hoàn cọc.', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-4', policyCode: 'COC-TIEU-CHUAN', policyName: 'Tỉ lệ đặt cọc tiêu chuẩn', policyType: 'DEPOSIT', policyValue: 50, unit: '%', description: 'Tỉ lệ tiền cọc yêu cầu trên tổng giá trị báo giá khi xác nhận đơn.', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-5', policyCode: 'DEN-BU-HONG-MAT', policyName: 'Đền bù thiết bị hỏng/mất', policyType: 'COMPENSATION', policyValue: 100, unit: '% giá mua', description: 'Số tiền đền bù = giá mua thiết bị × số lượng hỏng/mất (tính theo giá mua, không theo giá thuê/bán).', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-6', policyCode: 'PHI-VC-PHATSINH', policyName: 'Ngưỡng miễn phí vận chuyển thiết bị bổ sung', policyType: 'FEE', policyValue: 2, unit: 'km', description: 'Chỉ tính phụ phí vận chuyển khi thêm thiết bị tại hiện trường nếu khoảng cách kho → địa điểm thi công > 2km.', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-7', policyCode: 'CONG-LEADER', policyName: 'Tiền công Leader Staff mỗi buổi', policyType: 'WAGE', policyValue: 350000, unit: 'VNĐ/buổi', description: 'Đơn giá công theo buổi cho Leader Staff, không tính phụ cấp ngoài giờ.', isActive: true, createdAt: NOW, updatedAt: NOW },
  { policyId: 'pol-8', policyCode: 'CONG-TECHNICAL', policyName: 'Tiền công Technical Staff mỗi buổi', policyType: 'WAGE', policyValue: 250000, unit: 'VNĐ/buổi', description: 'Đơn giá công theo buổi cho Technical Staff, không tính phụ cấp ngoài giờ.', isActive: true, createdAt: NOW, updatedAt: NOW },
];

export const MOCK_WAGES: WageRecord[] = [
  { wageId: 'wage-1', wageCode: 'CL-2026-07-001', orderId: ORDER_A_ID, userId: 'mock-leader-1', wageRole: 'LEADER', shifts: 2, wageRate: 350000, totalWage: 700000, status: 'CONFIRMED', confirmedBy: 'mock-manager-1', confirmedAt: '2026-08-15T09:00:00Z', notes: `Phụ trách khảo sát + thi công đơn ${ORDER_A_ID}`, createdAt: NOW, updatedAt: NOW },
  { wageId: 'wage-2', wageCode: 'CL-2026-07-002', orderId: ORDER_A_ID, userId: 'mock-tech-1', wageRole: 'SETUP', shifts: 1, wageRate: 250000, totalWage: 250000, status: 'PENDING', notes: 'Leader đã xác nhận điểm danh, chờ Manager duyệt lương', createdAt: NOW, updatedAt: NOW },
  { wageId: 'wage-3', wageCode: 'CL-2026-07-003', orderId: ORDER_C_ID, userId: 'mock-leader-2', wageRole: 'LEADER', shifts: 2, wageRate: 350000, totalWage: 700000, status: 'PAID', confirmedBy: 'mock-manager-1', confirmedAt: '2026-07-25T09:00:00Z', createdAt: NOW, updatedAt: NOW },
  { wageId: 'wage-4', wageCode: 'CL-2026-07-004', orderId: ORDER_C_ID, userId: 'mock-tech-2', wageRole: 'SOUND', shifts: 1, wageRate: 250000, totalWage: 250000, status: 'DRAFT', notes: 'Technical Staff mới check-in, chưa được Leader xác nhận', createdAt: NOW, updatedAt: NOW },
];

export const MOCK_ORDER_WARNINGS: OrderWarningSummary[] = [
  { warningId: 'warn-1', orderId: ORDER_A_ID, content: 'Thiếu 2 ghế Tiffany trắng so với hạng mục đã chốt trong báo giá.', isResolved: false, createdAt: '2026-07-18T10:00:00Z' },
  { warningId: 'warn-2', orderId: ORDER_A_ID, content: 'Khách yêu cầu đổi giờ thi công sớm hơn 1 tiếng, cần xác nhận lại với đội thi công.', isResolved: true, resolvedBy: 'mock-manager-1', resolvedAt: '2026-07-19T08:00:00Z', createdAt: '2026-07-18T15:00:00Z' },
  { warningId: 'warn-3', orderId: ORDER_C_ID, content: `Nhà cung cấp ${SUPPLIER_3.supplierName} báo trễ 1 ngày so với lịch giao thiết bị âm thanh.`, isResolved: false, createdAt: '2026-07-16T11:00:00Z' },
];

export const MOCK_EVIDENCE: Evidence[] = [
  { evidenceId: 'ev-1', fileUrl: 'https://picsum.photos/seed/bnwems-ev-1/800/600', description: 'Ảnh khảo sát Sảnh Hera — góc chính diện sân khấu', uploadedBy: 'mock-leader-1', createdAt: '2026-07-20T09:10:00Z' },
  { evidenceId: 'ev-2', fileUrl: 'https://picsum.photos/seed/bnwems-ev-2/800/600', description: 'Ảnh bàn giao nghiệm thu backdrop LED', uploadedBy: 'mock-tech-1', createdAt: '2026-08-14T18:30:00Z' },
  { evidenceId: 'ev-3', fileUrl: 'https://picsum.photos/seed/bnwems-ev-3/800/600', description: 'Ảnh ghế Tiffany bị nứt phát hiện lúc thu hồi', uploadedBy: 'mock-leader-2', createdAt: '2026-07-25T20:00:00Z' },
];

export const MOCK_SUPPLIER_TRANSACTIONS: SupplierTransaction[] = [
  {
    transactionId: 'st-1', transactionCode: 'PT-2026-001', supplierId: SUPPLIER_1.supplierId, supplierName: SUPPLIER_1.supplierName, orderId: ORDER_A_ID,
    transactionType: 'RENTAL', serviceTitle: 'Thuê dàn âm thanh ánh sáng sân khấu chính', estimatedCost: 12_500_000, depositAmount: 5_000_000,
    paymentStatus: 'DEPOSITED', status: 'APPROVED',
    items: [
      { stItemId: 'sti-1', itemName: 'Loa Full Array sân khấu lớn', quantity: 4, unitCost: 2_000_000, subtotal: 8_000_000, receivedQuantity: 0 },
      { stItemId: 'sti-2', itemName: 'Đèn Moving Head Beam 450W', quantity: 9, unitCost: 500_000, subtotal: 4_500_000, receivedQuantity: 0 },
    ],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    transactionId: 'st-2', transactionCode: 'PT-2026-002', supplierId: SUPPLIER_3.supplierId, supplierName: SUPPLIER_3.supplierName, orderId: ORDER_C_ID,
    transactionType: 'RENTAL', serviceTitle: 'Thuê hệ thống âm thanh biểu diễn ngoài trời', estimatedCost: 6_000_000, depositAmount: 0,
    paymentStatus: 'UNPAID', status: 'PENDING',
    items: [{ stItemId: 'sti-3', itemName: 'Hệ thống âm thanh biểu diễn ngoài trời', quantity: 1, unitCost: 6_000_000, subtotal: 6_000_000, receivedQuantity: 0 }],
    createdAt: NOW, updatedAt: NOW,
  },
  {
    transactionId: 'st-3', transactionCode: 'PT-2026-003', supplierId: SUPPLIER_5.supplierId, supplierName: SUPPLIER_5.supplierName, orderId: ORDER_A_ID,
    transactionType: 'PURCHASE', serviceTitle: 'Mua hoa tươi trang trí phông nền', estimatedCost: 3_200_000, depositAmount: 3_200_000,
    paymentStatus: 'PAID', status: 'COMPLETED',
    items: [{ stItemId: 'sti-4', itemName: 'Hoa lan hồ điệp trang trí phông nền', quantity: 20, unitCost: 160_000, subtotal: 3_200_000, receivedQuantity: 20 }],
    createdAt: NOW, updatedAt: NOW,
  },
];
