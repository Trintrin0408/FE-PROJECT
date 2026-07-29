import { getAdminOrders } from './orders';
import { LEADER_STAFF_POOL } from './employees';

// Nguồn Handover/ChangeRequest DUY NHẤT cho các màn hình "Vận hành hiện trường" của Manager (route
// /manager/field-ops/*) — trước đây là src/mocks/managerFieldOpsMock.ts (đã đúng orderId thật từ
// db/orders.ts từ trước, chỉ cần đổi vị trí file vào db/ — DEMO_CHECKLIST.md Task 20). Trang thuần
// giao diện theo mục 0 CLAUDE.md, CHƯA có màn hình admin/coordination tương ứng để mirror (các route
// đó bên Admin vẫn là placeholder "đang phát triển"). Mô phỏng đúng luồng nghiệp vụ mục 1 CLAUDE.md:
// Leader Staff (mobile) ghi nhận biên bản/change request tại hiện trường trước — Manager chỉ xác nhận
// (confirm) trên web. Store module-scope, mất khi tải lại trang (giống các mock khác trong dự án ở
// giai đoạn UI-first này — khác các entity ở db/ khác vốn đã persist qua localStorage, domain này
// chưa cần vì chỉ phục vụ 2 trang field-ops thuần giao diện, chưa có luồng cross-page nào cần giữ).

// ---------------------------------------------------------------------------
// Nghiệm thu & bàn giao — biên bản do Leader Staff ghi nhận tại hiện trường, Manager xác nhận trên web
// ---------------------------------------------------------------------------

export type HandoverType = 'HANDOVER' | 'ACCEPTANCE';
export type HandoverStatus = 'PENDING_CONFIRM' | 'CONFIRMED';

export const HANDOVER_TYPE_META: Record<HandoverType, { label: string; badgeClass: string }> = {
  HANDOVER: { label: 'Bàn giao thiết bị', badgeClass: 'bg-blue-100 text-blue-700' },
  ACCEPTANCE: { label: 'Nghiệm thu hoàn thành', badgeClass: 'bg-purple-100 text-purple-700' },
};

export const HANDOVER_STATUS_META: Record<HandoverStatus, { label: string; badgeClass: string }> = {
  PENDING_CONFIRM: { label: 'Chờ Manager xác nhận', badgeClass: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Đã xác nhận', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

export interface FieldHandoverRecord {
  id: string;
  orderId: string;
  customerName: string;
  eventName: string;
  type: HandoverType;
  submittedBy: string;
  submittedAt: string;
  location: string;
  notes: string;
  evidencePhotoName?: string;
  status: HandoverStatus;
  confirmedBy?: string;
  confirmedAt?: string;
}

function generateHandovers(): FieldHandoverRecord[] {
  const eligibleOrders = getAdminOrders().filter((o) => o.status === 'IN_PROGRESS' || o.status === 'COMPLETED');
  return eligibleOrders.slice(0, 10).map((order, index) => {
    const type: HandoverType = index % 2 === 0 ? 'HANDOVER' : 'ACCEPTANCE';
    const isConfirmed = order.status === 'COMPLETED' && index % 3 !== 0;
    return {
      id: `BB-${order.orderId}-${index + 1}`,
      orderId: order.orderId,
      customerName: order.customerName,
      eventName: `Lễ cưới ${order.customerName}`,
      type,
      submittedBy: LEADER_STAFF_POOL[index % LEADER_STAFF_POOL.length],
      submittedAt: order.weddingDate,
      location: order.venue,
      notes:
        type === 'HANDOVER'
          ? 'Đã bàn giao đầy đủ thiết bị theo hạng mục báo giá, khách hàng kiểm tra và đồng ý bằng lời.'
          : 'Chương trình diễn ra suôn sẻ, không phát sinh sự cố. Khách hàng xác nhận hài lòng, đề nghị nghiệm thu hoàn tất.',
      evidencePhotoName: index % 2 === 0 ? `bien-ban-${order.orderId}.jpg` : undefined,
      status: isConfirmed ? 'CONFIRMED' : 'PENDING_CONFIRM',
      confirmedBy: isConfirmed ? 'Quản lý vận hành' : undefined,
      confirmedAt: isConfirmed ? order.weddingDate : undefined,
    };
  });
}

let handoverStore: FieldHandoverRecord[] = generateHandovers();

export function getFieldHandovers(): FieldHandoverRecord[] {
  return handoverStore;
}

export function confirmFieldHandover(id: string, confirmedBy: string): void {
  handoverStore = handoverStore.map((h) =>
    h.id === id ? { ...h, status: 'CONFIRMED', confirmedBy, confirmedAt: new Date().toISOString().slice(0, 10) } : h,
  );
}

/** Leader Staff ghi nhận 1 biên bản mới tại hiện trường (mobile) — Manager xác nhận sau trên web
 * qua confirmFieldHandover(). */
export function createFieldHandover(input: {
  orderId: string;
  customerName: string;
  eventName: string;
  type: HandoverType;
  submittedBy: string;
  location: string;
  notes: string;
  evidencePhotoName?: string;
}): FieldHandoverRecord {
  const record: FieldHandoverRecord = {
    ...input,
    id: `BB-${input.orderId}-${handoverStore.length + 1}-${Date.now().toString(36)}`,
    submittedAt: new Date().toISOString().slice(0, 10),
    status: 'PENDING_CONFIRM',
  };
  handoverStore = [record, ...handoverStore];
  return record;
}

/** Danh sách biên bản do 1 Leader Staff cụ thể ghi nhận — dùng cho trang "Ghi nhận hiện trường" của
 * staff-mobile (chỉ hiện việc do chính người đó submit, không phải toàn bộ như trang Manager). */
export function getFieldHandoversBySubmitter(submittedBy: string): FieldHandoverRecord[] {
  return handoverStore.filter((h) => h.submittedBy === submittedBy);
}

// ---------------------------------------------------------------------------
// Change Request — thêm/bớt/đổi thiết bị tại hiện trường (mục 1 CLAUDE.md: quy tắc tính lại hóa đơn)
// ---------------------------------------------------------------------------

export type ChangeRequestType = 'ADD' | 'REMOVE' | 'REPLACE';
export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const CHANGE_REQUEST_TYPE_META: Record<ChangeRequestType, { label: string; badgeClass: string }> = {
  ADD: { label: 'Thêm thiết bị', badgeClass: 'bg-blue-100 text-blue-700' },
  REMOVE: { label: 'Bớt thiết bị', badgeClass: 'bg-rose-100 text-rose-700' },
  REPLACE: { label: 'Thay thiết bị', badgeClass: 'bg-amber-100 text-amber-700' },
};

export const CHANGE_REQUEST_STATUS_META: Record<ChangeRequestStatus, { label: string; badgeClass: string }> = {
  PENDING: { label: 'Chờ duyệt', badgeClass: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Đã duyệt', badgeClass: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Từ chối', badgeClass: 'bg-rose-100 text-rose-700' },
};

/** Phụ phí vận chuyển cố định khi khoảng cách kho → địa điểm thi công > 2km (mục 1 CLAUDE.md: "Thêm
 * thiết bị tại hiện trường... phụ phí vận chuyển nếu khoảng cách kho → địa điểm > 2km"). */
export const FIELD_TRANSPORT_FEE = 150_000;

export interface ChangeRequestItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface FieldChangeRequest {
  id: string;
  orderId: string;
  customerName: string;
  eventName: string;
  type: ChangeRequestType;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  addItem?: ChangeRequestItem;
  distanceKm?: number;
  removeItem?: ChangeRequestItem;
  oldItem?: ChangeRequestItem;
  newItem?: ChangeRequestItem;
  status: ChangeRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
}

/** Số tiền thay đổi trên hóa đơn theo đúng công thức mục 1 CLAUDE.md — dương = thu thêm, âm = hoàn/giảm. */
export function computeChangeRequestDelta(cr: FieldChangeRequest): number {
  if (cr.type === 'ADD') {
    const itemCost = (cr.addItem?.unitPrice ?? 0) * (cr.addItem?.quantity ?? 0);
    const transportFee = (cr.distanceKm ?? 0) > 2 ? FIELD_TRANSPORT_FEE : 0;
    return itemCost + transportFee;
  }
  if (cr.type === 'REMOVE') {
    return -((cr.removeItem?.unitPrice ?? 0) * (cr.removeItem?.quantity ?? 0));
  }
  const newCost = (cr.newItem?.unitPrice ?? 0) * (cr.newItem?.quantity ?? 0);
  const oldCost = (cr.oldItem?.unitPrice ?? 0) * (cr.oldItem?.quantity ?? 0);
  return newCost - oldCost;
}

function generateChangeRequests(): FieldChangeRequest[] {
  const eligibleOrders = getAdminOrders().filter((o) => o.status === 'IN_PROGRESS' || o.status === 'CONFIRMED');
  const templates: Array<Omit<FieldChangeRequest, 'id' | 'orderId' | 'customerName' | 'eventName' | 'requestedAt' | 'requestedBy' | 'status'>> = [
    {
      type: 'ADD',
      reason: 'Khách yêu cầu bổ sung thêm bàn tiệc cho khách mời phát sinh ngoài dự kiến.',
      addItem: { name: 'Bàn tiệc Chavari Gold', quantity: 2, unitPrice: 850_000 },
      distanceKm: 3.2,
    },
    {
      type: 'REMOVE',
      reason: 'Khách hủy bớt 1 dàn đèn trang trí do thay đổi concept sảnh vào phút chót.',
      removeItem: { name: 'Đèn Moving Head Beam 450', quantity: 1, unitPrice: 1_200_000 },
    },
    {
      type: 'REPLACE',
      reason: 'Đổi micro không dây do thiết bị cũ nhiễu sóng tại hiện trường.',
      oldItem: { name: 'Micro không dây UHF đơn', quantity: 2, unitPrice: 400_000 },
      newItem: { name: 'Micro không dây UHF đôi cao cấp', quantity: 2, unitPrice: 650_000 },
    },
    {
      type: 'ADD',
      reason: 'Bổ sung quạt phun sương do thời tiết nắng nóng bất thường.',
      addItem: { name: 'Quạt phun sương công suất lớn', quantity: 4, unitPrice: 300_000 },
      distanceKm: 1.4,
    },
  ];

  return eligibleOrders.slice(0, templates.length).map((order, index) => {
    const template = templates[index % templates.length];
    return {
      ...template,
      id: `CR-${order.orderId}-${index + 1}`,
      orderId: order.orderId,
      customerName: order.customerName,
      eventName: `Lễ cưới ${order.customerName}`,
      requestedBy: LEADER_STAFF_POOL[index % LEADER_STAFF_POOL.length],
      requestedAt: order.weddingDate,
      status: index % 3 === 2 ? 'APPROVED' : 'PENDING',
    };
  });
}

let changeRequestStore: FieldChangeRequest[] = generateChangeRequests();

export function getFieldChangeRequests(): FieldChangeRequest[] {
  return changeRequestStore;
}

export function getFieldChangeRequestById(id: string): FieldChangeRequest | undefined {
  return changeRequestStore.find((cr) => cr.id === id);
}

export function reviewFieldChangeRequest(id: string, decision: 'APPROVED' | 'REJECTED', reviewedBy: string): void {
  changeRequestStore = changeRequestStore.map((cr) =>
    cr.id === id ? { ...cr, status: decision, reviewedBy, reviewedAt: new Date().toISOString().slice(0, 10) } : cr,
  );
}

/** Leader Staff tạo 1 Change Request mới tại hiện trường (mobile) — Manager duyệt sau trên web qua
 * reviewFieldChangeRequest(). */
export function createFieldChangeRequest(
  input: Omit<FieldChangeRequest, 'id' | 'requestedAt' | 'status'>,
): FieldChangeRequest {
  const record: FieldChangeRequest = {
    ...input,
    id: `CR-${input.orderId}-${changeRequestStore.length + 1}-${Date.now().toString(36)}`,
    requestedAt: new Date().toISOString().slice(0, 10),
    status: 'PENDING',
  };
  changeRequestStore = [record, ...changeRequestStore];
  return record;
}

/** Danh sách Change Request do 1 Leader Staff cụ thể tạo — dùng cho trang "Ghi nhận hiện trường" của
 * staff-mobile. */
export function getFieldChangeRequestsBySubmitter(requestedBy: string): FieldChangeRequest[] {
  return changeRequestStore.filter((cr) => cr.requestedBy === requestedBy);
}
