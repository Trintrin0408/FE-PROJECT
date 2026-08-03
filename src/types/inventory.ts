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
