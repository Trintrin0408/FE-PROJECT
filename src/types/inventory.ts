// docs/api/05-warehouse-inventory.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Không còn
// khái niệm nhiều kho (warehouseId) — Inventory giờ khoá 1-1 theo itemId duy nhất.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model Inventory/InventoryMovement),
// inventory.route.ts, inventory.validator.ts, inventory.service.ts.
// Cập nhật 2026-07-20 (theo docs/tonkhodoanhnghiep_api.md + docs/more-require.md mục (u)): bảng
// `inventory` thật ra ĐÃ được tạo (tin mới hơn ghi nhận cũ ở mục (b) — xác nhận qua curl), nhưng khác
// giả định của doc gốc ở 2 điểm: (1) `onlyDamaged`/`categoryId` KHÔNG có tác dụng (backend nhận nhưng
// bỏ qua); (2) `POST /inventory/adjust` dùng field `deltaTotal` (bắt buộc, khác 0) + `deltaDamaged`
// (optional) — KHÔNG phải `movementType`/`quantityChange` như doc gốc đề xuất; (3) `performedBy` trong
// `InventoryMovement` là OBJECT `{userId, fullName}`, không phải string.
// ĐÍNH CHÍNH 2026-07-31 (docs/more-require.md mục (at)/(au), đọc thẳng source Backend thật): `date` giờ
// ĐÃ có tác dụng thật — `quantityReserved`/`quantityAvailable` được tính lại mỗi lần gọi theo cơ chế
// khóa tồn kho theo ngày (`getLockedQuantityByDate`, dựa trên lịch trình SETUP/COLLECT của các đơn khác
// đang giữ chỗ item này). Nhận định "date KHÔNG ảnh hưởng" ở trên đã lỗi thời, chỉ còn đúng với
// `onlyDamaged`/`categoryId`.

// GET /api/v1/inventory
export interface InventoryRow {
  itemId: string;
  quantityTotal: number;
  quantityDamaged: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityOnHand?: number; // tồn vật lý đang trong kho = total − damaged − (đang cho mượn ngoài); thêm 2026-08
  itemName?: string; // join thêm khi GET
  itemCode?: string; // join thêm khi GET
  unit?: string; // join thêm khi GET
  categoryName?: string; // join thêm khi GET
  typeName?: string; // join thêm khi GET
  // Xác nhận qua curl thật ngày 2026-07-21: /inventory giờ trả kèm 2 field giá thật (khớp
  // items.rental_price/items.purchase_price) — không còn phải fix cứng giá cho modal Tạo báo giá.
  rentalPrice?: number;
  purchasePrice?: number;
  updatedAt: string;
}

export interface GetInventoryQuery {
  itemId?: string;
  search?: string; // hoạt động thật (khớp itemName/itemCode)
  categoryId?: string; // BE nhận nhưng KHÔNG lọc — xem more-require.md mục (u)
  date?: string; // Đã hoạt động đúng — lọc quantityReserved/quantityAvailable theo ngày, xem mục (at)/(au)
  onlyDamaged?: boolean; // BE nhận nhưng KHÔNG lọc — xem more-require.md mục (u)
  // Loại trừ reservation của 1 đơn khỏi phần "đã giữ chỗ" — trang chi tiết đơn truyền orderId của chính
  // nó để khả dụng phản ánh "cho đơn này" (không tự trừ phần đơn đã CONFIRMED giữ).
  excludeOrderId?: string;
  page?: number;
  limit?: number;
}

// POST /api/v1/inventory/adjust — deltaTotal bắt buộc và phải khác 0 (xác nhận qua curl thật);
// deltaDamaged optional, cộng thêm vào quantity_damaged song song deltaTotal.
export interface AdjustInventoryPayload {
  itemId: string;
  deltaTotal: number;
  deltaDamaged?: number;
  notes?: string;
}

// POST /inventory/repair (sửa xong: damaged−) · POST /inventory/scrap (thanh lý: damaged−, total−)
export interface RepairInventoryPayload {
  itemId: string;
  quantity: number;
  notes?: string;
}
export type ScrapInventoryPayload = RepairInventoryPayload;

// GET /inventory/:itemId/reservations — lịch bận thiết bị (từng khoảng giữ chỗ của item)
export interface ItemReservation {
  reservationId: string;
  itemId: string;
  orderId: string | null;
  orderCode: string | null;
  customerName: string | null;
  eventDate: string | null;
  endDate: string | null;
  startAt: string;
  endAt: string;
  quantity: number;
  status: string;
}
export interface GetItemReservationsQuery {
  from?: string;
  to?: string;
}

// GET /inventory/reservations-timeline — reservation mọi item trong [from,to], gom theo item + over-committed
export interface TimelineReservation {
  reservationId: string;
  orderId: string | null;
  orderCode: string | null;
  customerName: string | null;
  quantity: number;
  startAt: string;
  endAt: string;
  status: string;
}
export interface TimelineItem {
  itemId: string;
  itemName: string;
  itemCode: string;
  quantityTotal: number;
  quantityDamaged: number;
  capacity: number; // total − damaged
  maxConcurrent: number; // đỉnh reservation chồng nhau
  overCommitted: boolean; // maxConcurrent > capacity
  reservations: TimelineReservation[];
}
export interface EquipmentTimeline {
  from: string;
  to: string;
  items: TimelineItem[];
}
export interface GetReservationsTimelineQuery {
  from?: string;
  to?: string;
  categoryId?: string;
}

// GET /inventory/reconcile — đối soát on_hand từ inventory_movements
export interface ReconcileItem {
  itemId: string;
  itemName: string;
  quantityTotal: number;
  quantityDamaged: number;
  outbound: number;
  inbound: number;
  outstanding: number;
  onHand: number;
  flags: string[];
}
export interface ReconcileResult {
  checkedAt: string;
  totalItems: number;
  anomalyCount: number;
  anomalies: ReconcileItem[];
  items: ReconcileItem[];
}

export type MovementType = 'OUTBOUND' | 'INBOUND' | 'ADJUSTMENT';

// GET /api/v1/inventory/movements
export interface InventoryMovement {
  movementId: string;
  itemId: string;
  orderId?: string | null;
  reportId?: string | null;
  movementType: MovementType;
  quantity: number;
  performedBy?: { userId: string; fullName: string };
  notes?: string;
  itemName?: string;
  unit?: string;
  createdAt: string;
}

export interface GetInventoryMovementsQuery {
  itemId?: string;
  movementType?: MovementType;
  page?: number;
  limit?: number;
}

// GET /api/v1/inventory/picklist/:orderId — tồn kho của từng item trong đơn,
// dùng để hiển thị cột "Khả dụng" trong trang Xuất kho và Khả dụng theo đơn.
export interface PicklistItem {
  orderItemId: string;
  itemId: string;
  itemName: string;
  unit: string;
  source: 'INTERNAL' | 'SUPPLIER';
  quantityOrdered: number;
  quantityAvailable: number | null; // null nếu chưa có bản ghi inventory
}
