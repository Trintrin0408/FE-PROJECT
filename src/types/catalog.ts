// docs/api/03-catalog.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Kiến trúc thật là 3
// tầng Category → Type → Item (không còn itemType enum SERVICE/EQUIPMENT/MATERIAL/PACKAGE hay
// basePrice). Equipment (bảng riêng cũ) đã gộp hẳn vào Item — xem docs/more-require.md.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (ItemCategory/ItemType/Item/ItemTypeSpec),
// catalog.route.ts, catalog.validator.ts, catalog.service.ts.
//
// ⚠️ 2026-07-07: phát hiện thêm 1 schema tham chiếu MỚI HƠN nữa trên MySQL local (db "bnwems",
// KHÔNG phải Aiven cloud DB mà backend .env đang trỏ tới) — 4 tầng
// equipment_categories → equipment_type_details → equipment_type_configs → catalog_items, xem
// docs/database.md mục 3 và docs/more-require.md mục (ii). Backend (mọi branch, kể cả
// feature/align-new-api-contracts-and-test) CHƯA có model/route nào cho type_details/type_configs.
// Các field bên dưới đã được MỞ RỘNG (optional, không phá vỡ code cũ) để phản ánh schema mới này:
// `ItemType` nay tương đương `equipment_type_details` (thêm typeCode/imageUrl/isActive),
// `EquipmentTypeConfig` là type MỚI tương đương `equipment_type_configs` (chưa có UI quản lý riêng —
// chưa có nhu cầu/endpoint), `Item.description` ưu tiên hiển thị nhưng khi trống thì báo giá sẽ
// fallback sang mô tả loại thiết bị (`typeDetailDescription`, xem src/utils/catalogItemContent.ts).

export type ItemStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

// GET /api/v1/catalog/categories — KHÔNG có isActive (cột không tồn tại trong DB)
export interface ItemCategory {
  categoryId: string;
  categoryName: string;
  categoryCode?: string; // equipment_categories.category_code (schema mới 2026-07-07, chưa có ở backend hiện tại)
  description?: string;
}

export interface CreateItemCategoryPayload {
  categoryName: string;
  description?: string;
}

export type UpdateItemCategoryPayload = CreateItemCategoryPayload;

// PATCH /api/v1/catalog/categories/:id/status — backend hiện là NO-OP STUB (không có cột isActive
// trên ItemCategory), chỉ trả {success:true} chứ không đổi gì thật — xem docs/more-require.md.
export interface UpdateItemCategoryStatusPayload {
  isActive: boolean;
}

// GET /api/v1/catalog/types — tương đương `equipment_type_details` ở schema mới (typeId ~
// type_detail_id). `typeCode`/`imageUrl`/`isActive` là field mới, backend hiện tại chưa trả.
export interface ItemType {
  typeId: string;
  categoryId: string;
  typeCode?: string;
  typeName: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  categoryName?: string; // join thêm khi GET
}

// Tương đương `equipment_type_configs` (schema mới 2026-07-07) — 1 loại thiết bị chi tiết (ItemType)
// có thể có nhiều cấu hình cụ thể (vd "Bộ bàn Chavari 6 ghế" vs "8 ghế"), mỗi Item bán/cho thuê thực
// tế gắn với đúng 1 config. Backend CHƯA có model/endpoint nào cho tầng này (docs/more-require.md
// mục (ii)) — type khai báo trước để sẵn sàng khi backend bổ sung, chưa có trang quản lý riêng.
export interface EquipmentTypeConfig {
  configId: string;
  typeId: string; // FK tới ItemType (equipment_type_details.type_detail_id)
  configCode?: string;
  configName: string;
  configDetail?: string;
  unit: string;
  note?: string;
  isDefault?: boolean;
  isActive?: boolean;
  typeName?: string; // join thêm khi GET
}

export interface CreateItemTypePayload {
  categoryId: string;
  typeName: string;
  description?: string;
}

export interface UpdateItemTypePayload {
  categoryId?: string;
  typeName: string;
  description?: string;
}

// GET/POST /api/v1/catalog/types/:id/specs — BOM (cấu hình linh kiện con của 1 loại thiết bị)
export interface ItemTypeSpec {
  specId?: string;
  typeId: string;
  componentItemId: string;
  componentName?: string; // join thêm khi GET (tên của componentItem)
  quantity: number;
  note?: string;
}

// POST .../specs — thay TOÀN BỘ danh sách specs của 1 type
export interface UpdateTypeSpecsPayload {
  specs: { componentItemId: string; quantity: number; note?: string }[];
}

// GET /api/v1/catalog/items
export interface Item {
  itemId: string;
  itemCode: string;
  itemName: string;
  typeId: string;
  description?: string;
  unit: string;
  rentalPrice: number;
  purchasePrice?: number; // catalog_items.purchase_price (schema mới) — dùng tính bồi thường hỏng/mất
  priceValidFrom?: string;
  priceValidTo?: string;
  imageUrl?: string;
  status: ItemStatus;
  typeName?: string; // join thêm khi GET
  configId?: string; // FK equipment_type_configs (schema mới, backend chưa trả)
  configName?: string; // join thêm khi GET (schema mới)
  typeDetailDescription?: string; // equipment_type_details.description (schema mới) — nội dung dùng làm fallback trên báo giá, xem src/utils/catalogItemContent.ts
  inventory?: { quantityTotal: number; quantityAvailable: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemPayload {
  itemCode: string;
  itemName: string;
  typeId: string;
  description?: string;
  unit: string;
  rentalPrice: number;
  priceValidFrom?: string;
  imageUrl?: string;
  status?: ItemStatus;
}

export interface UpdateItemPayload {
  itemName?: string;
  description?: string;
  typeId?: string;
  unit?: string;
  rentalPrice?: number;
  priceValidFrom?: string;
  imageUrl?: string;
  status?: ItemStatus;
}

// PATCH /api/v1/catalog/items/:id/status
export interface UpdateItemStatusPayload {
  status: ItemStatus;
}

export interface ItemSupplierDetails {
  itemId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  suppliedPrice: number;
  isActive: boolean;
  minQuantity: number | null;
  supplierItemCode: string | null;
  createdAt: string;
  updatedAt: string;
}

