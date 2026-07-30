import { BOOKING_STATUS_META, BookingStatus, getAdminOrderById, getAdminOrders, updateAdminOrder } from './orders';
import { getAdminQuotations } from './quotations';
import { createMockStore, nextSequentialId } from './utils';

// Nguồn Deposit/Settlement DUY NHẤT cho toàn bộ UI (Admin + Manager) — trước đây là
// src/mocks/adminOrderPaymentsMock.ts (đã xóa, DEMO_CHECKLIST.md Task 19). Khác bản gốc ở điểm quan
// trọng nhất: mỗi hồ sơ cọc/quyết toán giờ là 1 bản ghi RIÊNG trỏ `orderId` THẬT tới db/orders.ts
// (trước đây `orderId` trong AdminOrderPayment là chuỗi tự bịa 'order-1'..'order-5', không khớp bất
// kỳ đơn nào trong db/orders.ts — chỉ 5 đơn có hồ sơ thanh toán, 77 đơn còn lại không tra được).

export type DepositStatus = 'RECEIVED' | 'PENDING';
export type SettlementStatus = 'UNSETTLED' | 'SETTLED';

export const DEPOSIT_STATUS_META: Record<DepositStatus, { label: string; badgeClass: string }> = {
  RECEIVED: { label: 'Đã nhận cọc', badgeClass: 'bg-emerald-100 text-emerald-700' },
  PENDING: { label: 'Chờ thanh toán', badgeClass: 'bg-amber-100 text-amber-700' },
};

export const SETTLEMENT_STATUS_META: Record<SettlementStatus, { label: string; badgeClass: string }> = {
  UNSETTLED: { label: 'Chưa quyết toán', badgeClass: 'bg-slate-100 text-slate-500' },
  SETTLED: { label: 'Đã thanh toán', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Chuyển khoản Ngân hàng' },
  { value: 'cash', label: 'Tiền mặt' },
];

export interface DepositEvidence {
  fileName: string;
  note: string;
}

export interface Deposit {
  depositId: string; // DC0001
  /** FK thật tới AdminOrderRow.orderId (db/orders.ts) — DD0001. */
  orderId: string;
  depositCode: string;
  amount: number;
  /** true = số tiền cọc chỉ là ước tính từ báo giá, chưa có yêu cầu cọc thật (chưa có phương thức). */
  isEstimated: boolean;
  estimatedLabel?: string;
  dueDate: string;
  paymentDate?: string;
  status: DepositStatus;
  paymentMethod: string | null;
  evidence?: DepositEvidence;
  accountantNote?: string;
}

export interface Settlement {
  settlementId: string; // ST0001
  /** FK thật tới AdminOrderRow.orderId (db/orders.ts). */
  orderId: string;
  status: SettlementStatus;
  /** Phụ thu phát sinh tại hiện trường (vd thêm thiết bị/dịch vụ ngoài báo giá gốc — xem
   * FieldChangeRequest ở db/changeRequests.ts) — Manager nhập tay khi lập quyết toán, khớp field thật
   * `Settlement.additionalFee` (types/settlement.ts). */
  additionalFee: number;
  /** Tiền đền bù thiết bị hỏng/mất do khách gây ra (mục 1 CLAUDE.md: giá mua × số lượng hỏng/mất) —
   * Manager nhập tay khi lập quyết toán, khớp field thật `Settlement.compensation`. */
  compensation: number;
  paymentMethod: string | null;
  evidence?: DepositEvidence;
  note?: string;
  settledAt?: string;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Trạng thái thanh toán của đơn (AdminOrderRow.paymentStatus) đã mô phỏng hợp lý sẵn từ Task 14 —
// dùng lại để sinh hồ sơ cọc/quyết toán khớp, không phải quy tắc nghiệp vụ thật.
function generateSeedDeposits(): Deposit[] {
  const today = new Date('2026-07-10');
  return getAdminOrders().map((row, index) => {
    const depositId = `DC${String(index + 1).padStart(4, '0')}`;
    const depositCode = `DEP-${String(index + 1).padStart(3, '0')}`;
    const dueDate = addDays(today, -25 + (index % 20));

    if (row.paymentStatus === 'UNPAID') {
      return {
        depositId,
        orderId: row.orderId,
        depositCode,
        amount: row.depositAmount,
        isEstimated: true,
        estimatedLabel: 'Dự kiến 30%',
        dueDate,
        status: 'PENDING',
        paymentMethod: null,
      };
    }

    return {
      depositId,
      orderId: row.orderId,
      depositCode,
      amount: row.depositAmount,
      isEstimated: false,
      dueDate,
      paymentDate: addDays(today, -22 + (index % 20)),
      status: 'RECEIVED',
      paymentMethod: index % 3 === 0 ? 'cash' : 'bank_transfer',
      evidence: index % 3 === 0 ? undefined : { fileName: `UNC_${row.orderId}.pdf`, note: 'Ủy nhiệm chi ngân hàng' },
      accountantNote: `Khách hàng ${row.customerName} đã chuyển khoản cọc, đã đối soát khớp số tiền.`,
    };
  });
}

function generateSeedSettlements(): Settlement[] {
  const today = new Date('2026-07-10');
  return getAdminOrders().map((row, index) => {
    const settlementId = `ST${String(index + 1).padStart(4, '0')}`;
    if (row.paymentStatus === 'PAID') {
      return {
        settlementId,
        orderId: row.orderId,
        status: 'SETTLED',
        additionalFee: 0,
        compensation: 0,
        paymentMethod: index % 3 === 0 ? 'cash' : 'bank_transfer',
        note: 'Đã quyết toán đủ 100% giá trị hợp đồng, không phát sinh phụ phí.',
        settledAt: addDays(today, -(5 + (index % 15))),
      };
    }
    return { settlementId, orderId: row.orderId, status: 'UNSETTLED', additionalFee: 0, compensation: 0, paymentMethod: null };
  });
}

const depositStore = createMockStore<Deposit>('deposits', generateSeedDeposits(), 'depositId');
const settlementStore = createMockStore<Settlement>('settlements', generateSeedSettlements(), 'settlementId');

export function getDeposits(): Deposit[] {
  return depositStore.getAll();
}

export function getDepositByOrderId(orderId: string): Deposit | undefined {
  return depositStore.getAll().find((d) => d.orderId === orderId);
}

/** Tự sinh hồ sơ cọc cho đơn chưa có hồ sơ — đơn tạo sau lúc sinh seed (vd qua BookingFormModal /
 * CreateOrderFromQuotationModal) không có sẵn trong generateSeedDeposits(). Tự lưu lại (persist) để
 * lần sau tra đúng bản ghi cũ thay vì tạo lại mỗi lần.
 *
 * Trạng thái khởi tạo khớp theo `order.paymentStatus` hiện tại (giống hệt nhánh trong
 * generateSeedDeposits()) thay vì luôn cố định PENDING — vì cả 2 form tạo đơn đều cho phép đánh dấu
 * "khách hàng đã đặt cọc trước khi lập đơn" ngay lúc khởi tạo (`paymentStatus: 'DEPOSITED'`). Trước
 * đây hàm này luôn tạo hồ sơ PENDING bất kể `paymentStatus` của đơn, khiến Mốc 2 ở "Tiến độ sự kiện"
 * (đọc `paymentStatus`) báo "Đã cọc" trong khi màn "Đặt cọc" (đọc hồ sơ Deposit) vẫn báo "Chờ thanh
 * toán" cho đến khi ai đó bấm xác nhận cọc thủ công lần nữa — 2 nguồn lệch nhau ngay từ lúc tạo đơn. */
export function getOrCreateDepositForOrder(orderId: string): Deposit | undefined {
  const existing = getDepositByOrderId(orderId);
  if (existing) return existing;
  const order = getAdminOrderById(orderId);
  if (!order) return undefined;
  const depositId = nextSequentialId(depositStore.getAll(), 'depositId', 'DC', 4);
  const isAlreadyDeposited = order.paymentStatus === 'DEPOSITED' || order.paymentStatus === 'PAID';
  const deposit: Deposit = {
    depositId,
    orderId,
    depositCode: `DEP-${depositId.replace(/\D/g, '')}`,
    amount: order.depositAmount,
    isEstimated: !isAlreadyDeposited,
    estimatedLabel: isAlreadyDeposited ? undefined : 'Dự kiến 30%',
    dueDate: addDays(new Date(order.weddingDate), -14),
    status: isAlreadyDeposited ? 'RECEIVED' : 'PENDING',
    paymentDate: isAlreadyDeposited ? new Date().toISOString().slice(0, 10) : undefined,
    paymentMethod: null,
  };
  depositStore.add(deposit);
  return deposit;
}

export function getSettlementByOrderId(orderId: string): Settlement | undefined {
  return settlementStore.getAll().find((s) => s.orderId === orderId);
}

/** Tương tự getOrCreateDepositForOrder nhưng cho hồ sơ quyết toán. */
export function getOrCreateSettlementForOrder(orderId: string): Settlement | undefined {
  const existing = getSettlementByOrderId(orderId);
  if (existing) return existing;
  if (!getAdminOrderById(orderId)) return undefined;
  const settlementId = nextSequentialId(settlementStore.getAll(), 'settlementId', 'ST', 4);
  const settlement: Settlement = { settlementId, orderId, status: 'UNSETTLED', additionalFee: 0, compensation: 0, paymentMethod: null };
  settlementStore.add(settlement);
  return settlement;
}

export function getDepositTransferContent(deposit: Pick<Deposit, 'depositCode'>, orderCode: string): string {
  return `${deposit.depositCode} CHUYEN KHOAN DAT COC ${orderCode}`;
}

// Chỉ cho sửa số tiền cọc khi hồ sơ còn "Chờ thanh toán" (PENDING) — cọc đã nhận (RECEIVED) thì khóa
// số tiền vì đã đối soát/lưu vết kế toán, tương tự ràng buộc ở khối "Xác nhận đã nhận cọc".
export function updateDepositAmount(orderId: string, amount: number): void {
  const deposit = getDepositByOrderId(orderId);
  if (deposit && deposit.status === 'PENDING') {
    depositStore.update(deposit.depositId, { amount });
  }
}

export function confirmDeposit(orderId: string, paymentMethod: string): void {
  const deposit = getOrCreateDepositForOrder(orderId);
  if (!deposit) return;
  const today = new Date().toISOString().slice(0, 10);
  depositStore.update(deposit.depositId, {
    status: 'RECEIVED',
    isEstimated: false,
    paymentMethod,
    paymentDate: deposit.paymentDate ?? today,
  });
  // Đồng bộ ngược sang AdminOrderRow.paymentStatus (trang "Đơn đặt" đọc field này, không đọc Deposit
  // store) — trước đây xác nhận cọc ở trang "Đặt cọc & thanh toán" chỉ cập nhật Deposit, khiến trạng
  // thái thanh toán bên "Đơn đặt" không đổi. Chỉ nâng từ UNPAID lên DEPOSITED, không hạ ngược PAID
  // (trường hợp đơn đã quyết toán xong mà vẫn còn thao tác xác nhận cọc, dù hiếm khi xảy ra trên UI).
  // Đã cọc thì đơn coi như được xác nhận — nâng luôn status NEW -> CONFIRMED cùng lúc, tránh lệch
  // pha "Thanh toán: Đã cọc" / "Đơn hàng: Mới" trên bảng danh sách đơn.
  const order = getAdminOrderById(orderId);
  if (order?.paymentStatus === 'UNPAID') {
    updateAdminOrder(orderId, {
      paymentStatus: 'DEPOSITED',
      status: order.status === 'NEW' ? 'CONFIRMED' : order.status,
    });
  }
}

export interface SettlementAdjustments {
  /** Phụ thu phát sinh (thêm thiết bị/dịch vụ ngoài báo giá gốc tại hiện trường). */
  additionalFee?: number;
  /** Tiền đền bù thiết bị hỏng/mất do khách gây ra. */
  compensation?: number;
  paymentMethod?: string;
  note?: string;
}

export function confirmSettlement(orderId: string, adjustments?: SettlementAdjustments): void {
  const settlement = getOrCreateSettlementForOrder(orderId);
  if (!settlement) return;
  settlementStore.update(settlement.settlementId, {
    status: 'SETTLED',
    additionalFee: adjustments?.additionalFee ?? settlement.additionalFee,
    compensation: adjustments?.compensation ?? settlement.compensation,
    paymentMethod: adjustments?.paymentMethod ?? settlement.paymentMethod,
    note: adjustments?.note ?? settlement.note,
    settledAt: settlement.settledAt ?? new Date().toISOString().slice(0, 10),
  });
}

export function getSettlementTransferContent(settlement: Pick<Settlement, 'settlementId'>, orderCode: string): string {
  return `${settlement.settlementId} QUYET TOAN ${orderCode}`;
}

// ---------------------------------------------------------------------------
// Dùng cho route mock POST /orders/:id/deposits + PUT /deposits/:id (src/services/mockAdapter.ts) —
// trước Task 19 các route này chỉ echo id giả, không ghi vào đâu cả. Đây là luồng "ghi nhận cọc" của
// payment.service.ts/RecordDepositModal.tsx — component hiện KHÔNG được trang nào import/render
// (component mồ côi, giống SurveyPersonnelTab đã ghi ở Task 8), nhưng vẫn wire route cho đúng vì
// route đã tồn tại và có thể được gắn vào màn hình sau này.
// ---------------------------------------------------------------------------

export function createDepositForMockRoute(orderId: string, amount: number, paymentMethod: string, notes?: string): Deposit {
  const depositId = nextSequentialId(depositStore.getAll(), 'depositId', 'DC', 4);
  const deposit: Deposit = {
    depositId,
    orderId,
    depositCode: `DEP-${depositId.replace(/\D/g, '')}`,
    amount,
    isEstimated: false,
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'PENDING',
    paymentMethod,
    accountantNote: notes,
  };
  depositStore.add(deposit);
  return deposit;
}

export function markDepositStatusForMockRoute(depositId: string, status: 'RECEIVED' | 'PENDING'): void {
  const today = new Date().toISOString().slice(0, 10);
  depositStore.update(depositId, status === 'RECEIVED' ? { status, paymentDate: today } : { status });
}

// ---------------------------------------------------------------------------
// View tổng hợp dùng chung cho cả 2 màn "Đặt cọc" (/admin/orders_audit/payments,
// /manager/payments/deposits) và "Thanh toán" (/admin/orders_audit/settlements,
// /manager/payments/settlements, tách riêng theo yêu cầu người dùng — trước đây gộp 1 màn có tab) —
// ghép Order + Deposit + Settlement thành 1 view model duy nhất, dùng chung cho cả 2 role thay vì mỗi
// trang tự query rời rạc. Trước Task 19 đây là field lồng sẵn trong AdminOrderPayment
// (adminOrderPaymentsMock.ts, chỉ 5 bản ghi bịa) — giờ derive thật từ 3 nguồn.
// ---------------------------------------------------------------------------

export interface OrderPaymentView {
  orderId: string;
  orderCode: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  eventStatus: string;
  /** Trạng thái đơn hàng THẬT (khác `eventStatus` chỉ là nhãn hiển thị) — dùng để chặn quyết toán
   * cuối kỳ khi đơn còn chưa thi công (xem DEMO_CHECKLIST.md mục "Lỗi màn tạo quyết toán"). */
  orderStatus: BookingStatus;
  managerName: string;
  customerName: string;
  customerPhone: string;
  totalValue: number;
  depositAmount: number;
  depositCode: string;
  depositDueDate: string;
  depositPaymentDate?: string;
  depositStatus: DepositStatus;
  paymentMethod: string | null;
  depositEvidence?: DepositEvidence;
  accountantNote?: string;
  settlementId: string;
  settlementStatus: SettlementStatus;
  settlementNote?: string;
  /** Ngày quyết toán thực tế (Settlement.settledAt) — thêm ở Task 21 để dashboard doanh thu tính theo
   * ngày THU TIỀN thật (deposit.paymentDate / settlement.settledAt) thay vì ngày tổ chức sự kiện
   * (eventDate), vốn không phản ánh đúng thời điểm ghi nhận doanh thu. */
  settlementSettledAt?: string;
  /** Phụ thu phát sinh đã ghi nhận khi quyết toán (0 nếu chưa quyết toán). */
  settlementAdditionalFee: number;
  /** Tiền đền bù hỏng/mất đã ghi nhận khi quyết toán (0 nếu chưa quyết toán). */
  settlementCompensation: number;
  settlementPaymentMethod: string | null;
  settlementEvidence?: DepositEvidence;
}

export function getOrderPaymentViews(): OrderPaymentView[] {
  return getAdminOrders()
    .map((row): OrderPaymentView | undefined => {
      const deposit = getOrCreateDepositForOrder(row.orderId);
      const settlement = getOrCreateSettlementForOrder(row.orderId);
      if (!deposit || !settlement) return undefined;
      return {
        orderId: row.orderId,
        orderCode: row.orderId,
        eventTitle: `Lễ cưới ${row.customerName}`,
        eventDate: row.weddingDate,
        venue: row.venue,
        eventStatus: BOOKING_STATUS_META[row.status].label,
        orderStatus: row.status,
        managerName: row.coordinatorName,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        totalValue: row.totalPrice,
        depositAmount: deposit.amount,
        depositCode: deposit.depositCode,
        depositDueDate: deposit.dueDate,
        depositPaymentDate: deposit.paymentDate,
        depositStatus: deposit.status,
        paymentMethod: deposit.paymentMethod,
        depositEvidence: deposit.evidence,
        accountantNote: deposit.accountantNote,
        settlementId: settlement.settlementId,
        settlementStatus: settlement.status,
        settlementNote: settlement.note,
        settlementSettledAt: settlement.settledAt,
        settlementAdditionalFee: settlement.additionalFee,
        settlementCompensation: settlement.compensation,
        settlementPaymentMethod: settlement.paymentMethod,
        settlementEvidence: settlement.evidence,
      };
    })
    .filter((view): view is OrderPaymentView => Boolean(view));
}

export function getOrderPaymentViewById(orderId: string): OrderPaymentView | undefined {
  return getOrderPaymentViews().find((v) => v.orderId === orderId);
}

/** Số tiền đã thu / còn lại của 1 đơn — dùng chung cho cả 2 màn "Đặt cọc" và "Thanh toán" (trước đây
 * mỗi trang chi tiết tự tính riêng công thức này, không tính tới `settlementAdditionalFee`/
 * `settlementCompensation` khi đơn đã quyết toán). Sau khi quyết toán, đơn coi là đã thu đủ (kể cả
 * phụ thu/đền bù) nên `remainingAmount` luôn = 0, không trừ ngược ra số âm. */
export function computeOrderFinancials(view: OrderPaymentView): { paidAmount: number; remainingAmount: number } {
  if (view.settlementStatus === 'SETTLED') {
    return { paidAmount: view.totalValue + view.settlementAdditionalFee + view.settlementCompensation, remainingAmount: 0 };
  }
  const paidAmount = view.depositStatus === 'RECEIVED' ? view.depositAmount : 0;
  return { paidAmount, remainingAmount: view.totalValue - paidAmount };
}

// ---------------------------------------------------------------------------
// Báo giá đã duyệt nhưng CHƯA có đơn đặt thật — dùng cho màn "Đặt cọc" (theo yêu cầu người dùng: hiện
// cả báo giá, dù đã cọc hay chưa). Theo nghiệp vụ, cọc chỉ chốt được sau khi có đơn đặt thật (xem
// CLAUDE.md "Quotation cuối + yêu cầu cọc → xác nhận cọc"), nên các báo giá này không thể có hồ sơ
// Deposit thật — luôn coi là "Chưa cọc" và không có thao tác xác nhận cọc ngay tại đây; bấm vào phải
// dẫn sang trang chi tiết báo giá (nơi có nút "Tạo đơn") thay vì trang chi tiết đặt cọc.
// ---------------------------------------------------------------------------

export interface QuotationAwaitingDeposit {
  quotationId: string;
  quotationCode: string;
  eventTitle: string;
  customerName: string;
  customerPhone: string;
  totalValue: number;
  /** Số tiền cọc ước tính (30%, khớp công thức sinh `AdminOrderRow.depositAmount` ở db/orders.ts) —
   * chỉ mang tính tham khảo vì báo giá chưa có yêu cầu cọc thật. */
  estimatedDepositAmount: number;
}

export function getQuotationsAwaitingDeposit(): QuotationAwaitingDeposit[] {
  const linkedQuotationIds = new Set(getAdminOrders().filter((o) => o.quotationId).map((o) => o.quotationId));
  return getAdminQuotations()
    .filter((q) => q.status === 'approved' && !linkedQuotationIds.has(q.quotationId))
    .map((q) => ({
      quotationId: q.quotationId,
      quotationCode: q.code,
      eventTitle: `Báo giá ${q.code}`,
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      totalValue: q.totalAmount,
      estimatedDepositAmount: Math.round(q.totalAmount * 0.3),
    }));
}
