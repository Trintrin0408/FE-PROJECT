import type { BadgeVariant } from '@/components/ui/Badge';
import type { Item, ItemCategory, ItemType } from '@/types/catalog';
import { createMockStore } from './utils';

// Nguồn Catalog/Inventory DUY NHẤT cho toàn bộ UI (Admin + Manager) — trước đây là 2 file riêng biệt
// theo DEMO_CHECKLIST.md Task 16 (Giai đoạn 2 — hợp nhất mock data):
//   - src/mocks/catalogMocks.ts (71 item, cấu trúc 3 tầng Category→Type→Item đúng theo mô hình backend
//     thật, dùng cho mockAdapter.ts + trang báo giá)
//   - src/mocks/adminEquipmentMock.ts (chỉ 19/71 item có dữ liệu tồn kho chi tiết hơn: rentedStock/
//     maintenanceStock/location/specs/dimensions/material/replacementValue/installRequired/logs, dùng
//     cho các trang quản lý kho doanh nghiệp)
// Đối chiếu thủ công (Task 16) cho thấy số liệu tồn kho (price/totalStock/availableStock) của 19 item
// trùng ID giữa 2 file KHỚP NHAU HOÀN TOÀN (availableStock + rentedStock + maintenanceStock =
// totalStock đúng cho cả 19 item) — không có xung đột số liệu cần giải quyết. Khác biệt thật duy nhất:
// (1) 52 item còn lại trong catalogMocks.ts chưa từng có bản ghi tồn kho chi tiết — sinh thêm bằng quy
// tắc theo danh mục (xem EQUIPMENT_ZONE_BY_CATEGORY/EQUIPMENT_INSTALL_REQUIRED_CATEGORIES bên dưới),
// không phải số liệu thật do người dùng cung cấp như 19 item gốc; (2) EQUIPMENT_CATEGORY_OPTIONS cũ chỉ
// có 8/11 danh mục (thiếu "Mẩu sắt nối", "Phụ kiện gallery", "Phông ăn cưới hỏi" — 3 danh mục chỉ tồn
// tại trong catalogMocks.ts) — đã sửa dùng chung danh sách 11 danh mục đầy đủ.
//
// Giữ nguyên tên field/type cũ (`AdminEquipment`, `id`/`name`/`category`/`price`/`status` 'active'|
// 'inactive'...) để không phải sửa lại 7 file tiêu thụ hiện có (packages/stock-status/stock-check/
// outbound + 2 modal + adminWarehouseOutboundMock.ts) — chỉ đổi đường dẫn import. `toApiItem()`/
// `getCatalogItemsAsApiItems()` là lớp map sang shape `Item` chuẩn (types/catalog.ts, uppercase status)
// cho 3 nơi còn lại cần đúng shape đó (mockAdapter.ts, trang tạo báo giá) — cùng 1 nguồn dữ liệu, không
// phải 2 bảng song song như trước.

const CATEGORY_NAMES = [
  'Bàn ghế',
  'Khăn bàn & Áo ghế',
  'Ấm chén & Cốc',
  'Quạt',
  'Khung nhà rạp',
  'Mẩu sắt nối',
  'Bạt trắng & Rèm',
  'Đèn & Thảm',
  'Cổng hoa & Hoa giả',
  'Phụ kiện gallery',
  'Phông ăn cưới hỏi',
];

// Mutable trực tiếp (không qua createMockStore) — giữ nguyên cách mockAdapter.ts đang thao tác
// (MOCK_CATEGORIES.push(...), MOCK_CATEGORIES[idx] = ...) từ trước Task 16, chỉ đổi nguồn.
export const MOCK_CATEGORIES: ItemCategory[] = CATEGORY_NAMES.map((name, index) => ({
  categoryId: `cat-${index + 1}`,
  categoryName: name,
}));

// Mỗi nhóm sản phẩm ứng với đúng 1 loại thiết bị (không chia nhỏ theo type) để khớp cột
// "Nhóm sản phẩm" hiển thị trực tiếp trên UI.
export const MOCK_TYPES: ItemType[] = MOCK_CATEGORIES.map((category) => ({
  typeId: `type-${category.categoryId}`,
  categoryId: category.categoryId,
  typeName: category.categoryName,
  categoryName: category.categoryName,
}));

function typeIdOfCategory(categoryName: string): string {
  const category = MOCK_CATEGORIES.find((c) => c.categoryName === categoryName);
  return category ? `type-${category.categoryId}` : '';
}

export type EquipmentStatus = 'active' | 'inactive';

export const EQUIPMENT_STATUS_META: Record<EquipmentStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Đang hoạt động', variant: 'success' },
  inactive: { label: 'Ngừng kinh doanh', variant: 'neutral' },
};

export type StockLogType = 'nhap_kho' | 'xuat_kho' | 'bao_tri' | 'dieu_chinh';

export const STOCK_LOG_TYPE_META: Record<StockLogType, { label: string; variant: BadgeVariant }> = {
  nhap_kho: { label: 'Nhập kho', variant: 'success' },
  xuat_kho: { label: 'Xuất kho', variant: 'info' },
  bao_tri: { label: 'Đưa đi bảo trì', variant: 'warning' },
  dieu_chinh: { label: 'Điều chỉnh kiểm kê', variant: 'neutral' },
};

export interface StockLog {
  id: string;
  time: string; // YYYY-MM-DD HH:mm
  type: StockLogType;
  quantity: number;
  reason: string;
  reference: string;
}

// Đầy đủ 11 danh mục (trước đây EQUIPMENT_CATEGORY_OPTIONS ở adminEquipmentMock.ts chỉ có 8/11).
export const EQUIPMENT_CATEGORY_OPTIONS = CATEGORY_NAMES;

export interface AdminEquipment {
  id: string; // BG005
  name: string;
  category: string;
  unit: string;
  price: number;
  status: EquipmentStatus;
  totalStock: number;
  availableStock: number;
  rentedStock: number; // đang đi tiệc / đang xuất kho phục vụ sự kiện
  maintenanceStock: number; // hỏng / đang sửa chữa
  location: string;
  specs: string;
  dimensions: string;
  material: string;
  replacementValue: number;
  installRequired: boolean;
  createdAt: string; // YYYY-MM-DD
  updatedAt: string; // YYYY-MM-DD
  logs: StockLog[];
}

interface SeedProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  totalStock: number;
  availableStock: number;
}

// Danh mục sản phẩm & thiết bị cho thuê thực tế của Bliss (đối chiếu ảnh mẫu "Sản phẩm & thiết bị") —
// nguồn số lượng/đơn giá DUY NHẤT cho toàn bộ 71 item (trước đây trùng lặp giữa catalogMocks.ts và một
// phần của adminEquipmentMock.ts).
const SEED_PRODUCTS: SeedProduct[] = [
  // Bàn ghế
  { id: 'BG001', name: 'Bàn loại to (Hộp chữ nhật 1.8m x 0.9m)', category: 'Bàn ghế', unit: 'Cái', price: 150000, totalStock: 80, availableStock: 65 },
  { id: 'BG002', name: 'Bàn loại nhỏ (Hộp chữ nhật 1.2m x 0.6m)', category: 'Bàn ghế', unit: 'Cái', price: 100000, totalStock: 120, availableStock: 100 },
  { id: 'BG003', name: 'Ghế đẩu', category: 'Bàn ghế', unit: 'Cái', price: 15000, totalStock: 500, availableStock: 450 },
  { id: 'BG004', name: 'Ghế inox', category: 'Bàn ghế', unit: 'Cái', price: 20000, totalStock: 400, availableStock: 350 },
  { id: 'BG005', name: 'Ghế chiavari', category: 'Bàn ghế', unit: 'Cái', price: 120000, totalStock: 300, availableStock: 260 },

  // Khăn bàn & Áo ghế
  { id: 'KB001', name: 'Khăn bàn màu đỏ', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000, totalStock: 150, availableStock: 130 },
  { id: 'KB002', name: 'Khăn bàn màu vàng', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000, totalStock: 150, availableStock: 135 },
  { id: 'KB003', name: 'Khăn bàn màu trắng', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000, totalStock: 200, availableStock: 160 },
  { id: 'KB004', name: 'Khăn bàn màu xanh dương', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000, totalStock: 100, availableStock: 90 },
  { id: 'KB005', name: 'Khăn bàn màu rêu', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 50000, totalStock: 100, availableStock: 85 },
  { id: 'KB006', name: 'Runner (dải vải trải dọc giữa bàn)', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 30000, totalStock: 300, availableStock: 270 },
  { id: 'KB007', name: 'Áo ghế', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 15000, totalStock: 500, availableStock: 450 },
  { id: 'KB008', name: 'Nơ ghế', category: 'Khăn bàn & Áo ghế', unit: 'Cái', price: 10000, totalStock: 600, availableStock: 540 },

  // Ấm chén & Cốc
  { id: 'AC001', name: 'Cốc, chén, ấm nước', category: 'Ấm chén & Cốc', unit: 'Bộ', price: 250000, totalStock: 120, availableStock: 105 },

  // Quạt
  { id: 'QT001', name: 'Quạt công nghiệp', category: 'Quạt', unit: 'Cái', price: 200000, totalStock: 45, availableStock: 38 },
  { id: 'QT002', name: 'Quạt hơi nước', category: 'Quạt', unit: 'Cái', price: 400000, totalStock: 25, availableStock: 20 },

  // Khung nhà rạp
  { id: 'KR001', name: 'Thanh sắt 2.5m (Cột đứng rạp)', category: 'Khung nhà rạp', unit: 'Cái', price: 50000, totalStock: 200, availableStock: 170 },
  { id: 'KR002', name: 'Thanh sắt 3m (Thanh xà giằng)', category: 'Khung nhà rạp', unit: 'Cái', price: 60000, totalStock: 250, availableStock: 210 },
  { id: 'KR003', name: 'Thanh sắt 4m (Thanh xà dọc chính)', category: 'Khung nhà rạp', unit: 'Cái', price: 80000, totalStock: 150, availableStock: 130 },
  { id: 'KR004', name: 'Cột chống nhà rạp', category: 'Khung nhà rạp', unit: 'Cái', price: 100000, totalStock: 80, availableStock: 70 },
  { id: 'KR005', name: 'Kèo (Kèo lắp mái tam giác)', category: 'Khung nhà rạp', unit: 'Cái', price: 120000, totalStock: 60, availableStock: 52 },
  { id: 'KR006', name: 'Thanh sắt lắp nóc', category: 'Khung nhà rạp', unit: 'Cái', price: 70000, totalStock: 100, availableStock: 85 },

  // Mẩu sắt nối
  { id: 'MS001', name: 'Mẩu nối góc', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000, totalStock: 300, availableStock: 270 },
  { id: 'MS002', name: 'Mẩu dấu +', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000, totalStock: 250, availableStock: 230 },
  { id: 'MS003', name: 'Mẩu nối 2 thanh sắt', category: 'Mẩu sắt nối', unit: 'Cái', price: 10000, totalStock: 400, availableStock: 360 },
  { id: 'MS004', name: 'Mẩu nối thanh xà trên', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000, totalStock: 180, availableStock: 160 },
  { id: 'MS005', name: 'Mẩu lắp nóc', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000, totalStock: 120, availableStock: 105 },
  { id: 'MS006', name: 'Mẩu lắp kèo', category: 'Mẩu sắt nối', unit: 'Cái', price: 15000, totalStock: 120, availableStock: 110 },

  // Bạt trắng & Rèm
  { id: 'BT001', name: 'Bạt trắng (6x7)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 500000, totalStock: 30, availableStock: 26 },
  { id: 'BT002', name: 'Bạt trắng (6x9)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 600000, totalStock: 25, availableStock: 22 },
  { id: 'BT003', name: 'Bạt trắng (3x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 200000, totalStock: 50, availableStock: 45 },
  { id: 'BT004', name: 'Bạt trắng (4x5)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 300000, totalStock: 40, availableStock: 36 },
  { id: 'BT005', name: 'Bạt trắng (4x3)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 220000, totalStock: 40, availableStock: 35 },
  { id: 'BT006', name: 'Bạt trắng (4x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 250000, totalStock: 35, availableStock: 31 },
  { id: 'BT007', name: 'Bạt trắng (6x3)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 350000, totalStock: 30, availableStock: 25 },
  { id: 'BT008', name: 'Bạt trắng (6x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 400000, totalStock: 30, availableStock: 27 },
  { id: 'BT009', name: 'Bạt trắng (6x5)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 450000, totalStock: 30, availableStock: 25 },
  { id: 'BT010', name: 'Bạt trắng (8x3)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 500000, totalStock: 20, availableStock: 18 },
  { id: 'BT011', name: 'Bạt trắng (8x4)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 550000, totalStock: 20, availableStock: 17 },
  { id: 'BT012', name: 'Bạt trắng (8x5)', category: 'Bạt trắng & Rèm', unit: 'Tấm', price: 600000, totalStock: 20, availableStock: 16 },
  { id: 'BT013', name: 'Rèm quây xung quanh các màu', category: 'Bạt trắng & Rèm', unit: 'Bộ', price: 300000, totalStock: 80, availableStock: 70 },
  { id: 'BT014', name: 'Rèm tạo sóng', category: 'Bạt trắng & Rèm', unit: 'Bộ', price: 350000, totalStock: 60, availableStock: 52 },
  { id: 'BT015', name: 'Quây trần nhà rạp', category: 'Bạt trắng & Rèm', unit: 'Bộ', price: 800000, totalStock: 40, availableStock: 35 },

  // Đèn & Thảm
  { id: 'DT001', name: 'Đèn nhấp nháy', category: 'Đèn & Thảm', unit: 'Dây', price: 50000, totalStock: 200, availableStock: 175 },
  { id: 'DT002', name: 'Đèn chùm trang trí', category: 'Đèn & Thảm', unit: 'Cái', price: 300000, totalStock: 30, availableStock: 24 },
  { id: 'DT003', name: 'Đèn chạy dọc 20m', category: 'Đèn & Thảm', unit: 'Dây', price: 150000, totalStock: 50, availableStock: 42 },
  { id: 'DT004', name: 'Đèn chim', category: 'Đèn & Thảm', unit: 'Cái', price: 100000, totalStock: 60, availableStock: 52 },
  { id: 'DT005', name: 'Thảm cỏ', category: 'Đèn & Thảm', unit: 'm²', price: 40000, totalStock: 500, availableStock: 420 },
  { id: 'DT006', name: 'Thảm đỏ', category: 'Đèn & Thảm', unit: 'm²', price: 50000, totalStock: 400, availableStock: 350 },

  // Cổng hoa & Hoa giả
  { id: 'CH001', name: 'Khung cổng hình tròn', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 300000, totalStock: 15, availableStock: 13 },
  { id: 'CH002', name: 'Khung cổng hình vuông', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 300000, totalStock: 15, availableStock: 12 },
  { id: 'CH003', name: 'Khung cổng hình lục giác', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 350000, totalStock: 10, availableStock: 8 },
  { id: 'CH004', name: 'Cổng vòm bằng sắt để gắn hoa', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 400000, totalStock: 12, availableStock: 10 },
  { id: 'CH005', name: 'Cổng vòm bằng nhựa để gắn hoa', category: 'Cổng hoa & Hoa giả', unit: 'Cái', price: 300000, totalStock: 15, availableStock: 13 },
  { id: 'CH006', name: 'Hoa giả tone trắng', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 150000, totalStock: 120, availableStock: 100 },
  { id: 'CH007', name: 'Hoa giả tone hồng', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 150000, totalStock: 100, availableStock: 85 },
  { id: 'CH008', name: 'Hoa giả tone đỏ', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 150000, totalStock: 100, availableStock: 88 },
  { id: 'CH009', name: 'Hoa giả tone pastel', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 180000, totalStock: 80, availableStock: 68 },
  { id: 'CH010', name: 'Hoa giả tone sen đá', category: 'Cổng hoa & Hoa giả', unit: 'Cụm', price: 200000, totalStock: 50, availableStock: 45 },

  // Phụ kiện gallery
  { id: 'PK001', name: 'Khung ảnh trang trí', category: 'Phụ kiện gallery', unit: 'Cái', price: 15000, totalStock: 200, availableStock: 180 },
  { id: 'PK002', name: 'Hòm tiền mừng (hình ngôi nhà)', category: 'Phụ kiện gallery', unit: 'Cái', price: 150000, totalStock: 15, availableStock: 13 },
  { id: 'PK003', name: 'Hòm tiền mừng (hình hòm thư)', category: 'Phụ kiện gallery', unit: 'Cái', price: 150000, totalStock: 15, availableStock: 14 },
  { id: 'PK004', name: 'Hòm tiền mừng (hình hòm mica trong suốt)', category: 'Phụ kiện gallery', unit: 'Cái', price: 200000, totalStock: 12, availableStock: 10 },
  { id: 'PK005', name: 'Bình hoa thủy tinh đủ kích thước', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 50000, totalStock: 150, availableStock: 132 },
  { id: 'PK006', name: 'Khay 3 tầng', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 60000, totalStock: 30, availableStock: 26 },
  { id: 'PK007', name: 'Khay gỗ', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 40000, totalStock: 40, availableStock: 35 },
  { id: 'PK008', name: 'Khay 2 tầng sứ để bánh kẹo', category: 'Phụ kiện gallery', unit: 'Chiếc', price: 50000, totalStock: 30, availableStock: 26 },

  // Phông ăn cưới hỏi
  { id: 'PC001', name: 'Chữ trên phông', category: 'Phông ăn cưới hỏi', unit: 'Bộ', price: 200000, totalStock: 50, availableStock: 42 },
  { id: 'PC002', name: 'Đèn sân khấu', category: 'Phông ăn cưới hỏi', unit: 'Cái', price: 300000, totalStock: 40, availableStock: 32 },
  { id: 'PC003', name: 'Tráp ăn cưới hỏi', category: 'Phông ăn cưới hỏi', unit: 'Bộ', price: 1500000, totalStock: 10, availableStock: 8 },
  { id: 'PC004', name: 'Phông quây', category: 'Phông ăn cưới hỏi', unit: 'Bộ', price: 800000, totalStock: 25, availableStock: 21 },
];

// 19/71 item có dữ liệu tồn kho chi tiết THẬT do người dùng cung cấp (port từ docs/components/
// ProductsAndEquipmentView.tsx qua adminEquipmentMock.ts trước đây) — số price/totalStock/
// availableStock đã khớp với SEED_PRODUCTS ở trên (không lệch), chỉ bổ sung thêm rentedStock/
// maintenanceStock/location/specs/dimensions/material/replacementValue/installRequired/status/logs.
// 52 item còn lại KHÔNG có trong danh sách này — dùng generateDefaultDetails() sinh giá trị hợp lý.
type KnownDetail = Pick<
  AdminEquipment,
  'rentedStock' | 'maintenanceStock' | 'location' | 'specs' | 'dimensions' | 'material' | 'replacementValue' | 'installRequired' | 'status' | 'updatedAt'
> & { logs?: StockLog[] };

const KNOWN_EQUIPMENT_DETAILS: Record<string, KnownDetail> = {
  BG001: { rentedStock: 15, maintenanceStock: 0, location: 'Khu A - Tầng 1', specs: 'Mặt gỗ MDF phủ melamine chống nước, chân sắt gập tiện lợi', dimensions: '1.8m x 0.9m x 0.75m', material: 'Gỗ công nghiệp & Sắt', replacementValue: 1_200_000, installRequired: false, status: 'active', updatedAt: '2026-07-11' },
  BG002: { rentedStock: 20, maintenanceStock: 0, location: 'Khu A - Tầng 1', specs: 'Mặt gỗ trắng chân gấp gọn gàng, phù hợp bàn tiếp nước lễ ăn hỏi', dimensions: '1.2m x 0.6m x 0.75m', material: 'Gỗ & Sắt sơn tĩnh điện', replacementValue: 800_000, installRequired: false, status: 'active', updatedAt: '2026-07-11' },
  BG003: { rentedStock: 50, maintenanceStock: 0, location: 'Khu A - Tầng 1', specs: 'Ghế đẩu nhựa đúc tròn xếp chồng gọn gàng', dimensions: 'H: 45cm x D: 30cm', material: 'Nhựa PP cao cấp', replacementValue: 50_000, installRequired: false, status: 'active', updatedAt: '2026-07-11' },
  BG004: { rentedStock: 48, maintenanceStock: 2, location: 'Khu A - Tầng 1', specs: 'Ghế inox tròn có đệm hoặc inox trơn siêu bền', dimensions: 'H: 45cm x D: 30cm', material: 'Inox 304 không gỉ', replacementValue: 120_000, installRequired: false, status: 'active', updatedAt: '2026-07-11' },
  BG005: {
    rentedStock: 38, maintenanceStock: 2, location: 'Khu A - Tầng 1', specs: 'Ghế tiffany cao cấp sang trọng kèm đệm lót nỉ nhung êm ái', dimensions: 'H: 92cm x W: 40cm x D: 40cm', material: 'Sắt sơn tĩnh điện hoặc nhôm mạ', replacementValue: 1_200_000, installRequired: false, status: 'active', updatedAt: '2026-07-11',
    logs: [
      { id: 'BG005-L1', time: '2026-07-05 09:20', type: 'nhap_kho', quantity: 50, reason: 'Nhập bổ sung đầu quý', reference: 'PN-2607-01' },
      { id: 'BG005-L2', time: '2026-07-08 14:10', type: 'bao_tri', quantity: 2, reason: 'Sứt chân ghế sau tiệc', reference: 'HD2507-003' },
    ],
  },
  KB001: { rentedStock: 20, maintenanceStock: 0, location: 'Khu D - Kệ vải', specs: 'Vải gấm đỏ dày dặn dập nổi hoa văn rồng phượng tinh xảo', dimensions: '2.5m x 1.6m', material: 'Vải gấm cao cấp', replacementValue: 250_000, installRequired: false, status: 'active', updatedAt: '2026-07-10' },
  KB007: { rentedStock: 50, maintenanceStock: 0, location: 'Khu D - Kệ vải', specs: 'Áo bọc ghế co giãn vừa vặn các loại ghế chiavari hoặc ghế đệm vuông', dimensions: 'Co giãn tiêu chuẩn', material: 'Vải thun mút cao cấp co giãn 4 chiều', replacementValue: 60_000, installRequired: false, status: 'active', updatedAt: '2026-07-10' },
  AC001: { rentedStock: 14, maintenanceStock: 1, location: 'Khu E', specs: 'Bộ ấm sứ trắng viền vàng (1 ấm, 6 chén, 6 đĩa lót kèm bình thủy tinh đựng cốc nước tiếp khách)', dimensions: 'Tiêu chuẩn bàn trà 6 người', material: 'Sứ xương cao cấp & Thủy tinh chịu nhiệt', replacementValue: 600_000, installRequired: false, status: 'active', updatedAt: '2026-07-09' },
  QT001: {
    rentedStock: 6, maintenanceStock: 1, location: 'Khu B', specs: 'Quạt đứng sải cánh rộng công suất lớn làm mát nhanh chóng diện tích rộng', dimensions: 'Cao 1.5m, đường kính cánh 75cm', material: 'Thân thép sơn tĩnh điện, lồng sắt bảo vệ', replacementValue: 1_800_000, installRequired: false, status: 'active', updatedAt: '2026-07-08',
    logs: [{ id: 'QT001-L1', time: '2026-07-01 08:00', type: 'bao_tri', quantity: 1, reason: 'Motor kêu to bất thường', reference: 'Kiểm tra định kỳ' }],
  },
  QT002: { rentedStock: 4, maintenanceStock: 1, location: 'Khu B', specs: 'Quạt điều hòa làm mát bằng hơi nước, dung tích bình chứa lớn 60L', dimensions: 'Cao 1.2m x Rộng 0.6m', material: 'Vỏ nhựa ABS siêu bền, động cơ lõi đồng', replacementValue: 4_500_000, installRequired: false, status: 'active', updatedAt: '2026-07-08' },
  KR001: { rentedStock: 30, maintenanceStock: 0, location: 'Khu C - Bãi ngoài', specs: 'Thanh sắt tròn mạ kẽm phi 48 dày 1.8 ly chịu lực cao chống biến dạng', dimensions: 'Dài 2.5m x phi 48mm', material: 'Sắt mạ kẽm hòa phát', replacementValue: 200_000, installRequired: true, status: 'active', updatedAt: '2026-07-07' },
  KR004: { rentedStock: 10, maintenanceStock: 0, location: 'Khu C - Bãi ngoài', specs: 'Cột chống chịu lực có tăng đơ nâng hạ độ cao linh hoạt', dimensions: 'Cao tùy chỉnh 2.2m - 3.5m', material: 'Thép ống lồng mạ kẽm dày dặn', replacementValue: 500_000, installRequired: true, status: 'active', updatedAt: '2026-07-07' },
  BT001: { rentedStock: 4, maintenanceStock: 0, location: 'Khu C - Tầng lửng', specs: 'Vải bạt tapulin Hàn Quốc 3 lớp chống mưa tuyệt đối cách nhiệt tốt', dimensions: '6m x 7m', material: 'PVC Tarpaulin dày 0.38mm', replacementValue: 3_500_000, installRequired: true, status: 'active', updatedAt: '2026-07-06' },
  DT001: { rentedStock: 25, maintenanceStock: 0, location: 'Khu B - Kệ 3', specs: 'Dây đèn led đom đóm nhấp nháy chống nước thả rèm lấp lánh', dimensions: 'Dài 10m', material: 'Lõi đồng bọc silicon, bóng led tiết kiệm điện', replacementValue: 150_000, installRequired: true, status: 'active', updatedAt: '2026-07-06' },
  DT006: { rentedStock: 50, maintenanceStock: 0, location: 'Khu C - Tầng lửng', specs: 'Thảm nỉ đỏ tươi chuyên dụng cho lễ cưới lộng lẫy trải từ ngõ vào sảnh', dimensions: 'Khổ rộng 2m', material: 'Vải nỉ không dệt dai bền bắt mắt', replacementValue: 100_000, installRequired: true, status: 'active', updatedAt: '2026-07-05' },
  CH001: { rentedStock: 2, maintenanceStock: 0, location: 'Khu C - Bãi ngoài', specs: 'Khung sắt đôi hình tròn lắp ráp 4 mảnh sơn tĩnh điện làm cốt cắm cổng hoa', dimensions: 'Đường kính 2.4m', material: 'Sắt mạ kẽm hộp', replacementValue: 1_500_000, installRequired: true, status: 'active', updatedAt: '2026-07-04' },
  CH006: {
    rentedStock: 20, maintenanceStock: 0, location: 'Khu E', specs: 'Cụm hoa hồng, tú cầu, lan hồ điệp giả màu trắng tuyết dải cắm sẵn dây leo tự nhiên', dimensions: 'Dài 1.2m', material: 'Hoa lụa dập nổi chân thật, cành nhựa lõi thép', replacementValue: 400_000, installRequired: true, status: 'inactive', updatedAt: '2026-06-28',
    logs: [{ id: 'CH006-L1', time: '2026-06-28 10:00', type: 'dieu_chinh', quantity: 0, reason: 'Ngừng kinh doanh mẫu cũ, chờ thay mẫu 2026', reference: 'Quyết định danh mục' }],
  },
};

// Vị trí kho + yêu cầu lắp đặt mặc định theo danh mục — dùng để sinh dữ liệu hợp lý cho 52 item chưa
// có bản ghi chi tiết thật (KNOWN_EQUIPMENT_DETAILS), suy ra từ vị trí/đặc điểm của các item CÙNG danh
// mục đã có dữ liệu thật ở trên (vd Bàn ghế → 'Khu A - Tầng 1' khớp BG001-005).
const EQUIPMENT_ZONE_BY_CATEGORY: Record<string, string> = {
  'Bàn ghế': 'Khu A - Tầng 1',
  'Khăn bàn & Áo ghế': 'Khu D - Kệ vải',
  'Ấm chén & Cốc': 'Khu E',
  Quạt: 'Khu B',
  'Khung nhà rạp': 'Khu C - Bãi ngoài',
  'Mẩu sắt nối': 'Khu C - Bãi ngoài',
  'Bạt trắng & Rèm': 'Khu C - Tầng lửng',
  'Đèn & Thảm': 'Khu B - Kệ 3',
  'Cổng hoa & Hoa giả': 'Khu C - Bãi ngoài',
  'Phụ kiện gallery': 'Khu E',
  'Phông ăn cưới hỏi': 'Khu C - Tầng lửng',
};

const EQUIPMENT_INSTALL_REQUIRED_CATEGORIES = new Set([
  'Khung nhà rạp',
  'Mẩu sắt nối',
  'Bạt trắng & Rèm',
  'Đèn & Thảm',
  'Cổng hoa & Hoa giả',
  'Phông ăn cưới hỏi',
]);

const DEFAULT_UPDATED_AT = '2026-07-11';

function generateDefaultDetails(product: SeedProduct): KnownDetail {
  return {
    rentedStock: Math.max(0, product.totalStock - product.availableStock),
    maintenanceStock: 0,
    location: EQUIPMENT_ZONE_BY_CATEGORY[product.category] ?? 'Kho tổng',
    specs: `${product.name} — hạng mục ${product.category.toLowerCase()}, đạt tiêu chuẩn chất lượng cho thuê sự kiện.`,
    dimensions: '',
    material: '',
    replacementValue: Math.round((product.price * 6) / 10_000) * 10_000,
    installRequired: EQUIPMENT_INSTALL_REQUIRED_CATEGORIES.has(product.category),
    status: 'active',
    updatedAt: DEFAULT_UPDATED_AT,
  };
}

function generateMockEquipment(): AdminEquipment[] {
  return SEED_PRODUCTS.map((product) => {
    const detail = KNOWN_EQUIPMENT_DETAILS[product.id] ?? generateDefaultDetails(product);
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      status: detail.status,
      totalStock: product.totalStock,
      availableStock: product.availableStock,
      rentedStock: detail.rentedStock,
      maintenanceStock: detail.maintenanceStock,
      location: detail.location,
      specs: detail.specs,
      dimensions: detail.dimensions,
      material: detail.material,
      replacementValue: detail.replacementValue,
      installRequired: detail.installRequired,
      createdAt: detail.updatedAt,
      updatedAt: detail.updatedAt,
      logs: detail.logs ?? [],
    };
  });
}

const itemStore = createMockStore<AdminEquipment>('catalog_items', generateMockEquipment(), 'id');

export function getAdminEquipment(): AdminEquipment[] {
  return itemStore.getAll();
}

export function getAdminEquipmentById(id: string): AdminEquipment | undefined {
  return itemStore.getById(id);
}

export function getAdminEquipmentCategories(): { category: string; count: number }[] {
  const all = itemStore.getAll();
  return EQUIPMENT_CATEGORY_OPTIONS.map((category) => ({ category, count: all.filter((e) => e.category === category).length })).filter(
    (c) => c.count > 0,
  );
}

function nextEquipmentId(category: string): string {
  const prefix = category
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'TB';
  const all = itemStore.getAll();
  const existingNums = all.filter((e) => e.id.startsWith(prefix)).map((e) => Number(e.id.slice(prefix.length)) || 0);
  const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

export interface CreateEquipmentInput {
  name: string;
  category: string;
  unit: string;
  price: number;
  specs: string;
  dimensions: string;
  material: string;
  replacementValue: number;
  installRequired: boolean;
  status: EquipmentStatus;
  initialStock: number;
  location: string;
}

export function createAdminEquipment(input: CreateEquipmentInput): AdminEquipment {
  const id = nextEquipmentId(input.category);
  const today = new Date().toISOString().slice(0, 10);
  const equipment: AdminEquipment = {
    id,
    name: input.name,
    category: input.category,
    unit: input.unit,
    price: input.price,
    status: input.status,
    totalStock: input.initialStock,
    availableStock: input.initialStock,
    rentedStock: 0,
    maintenanceStock: 0,
    location: input.location,
    specs: input.specs,
    dimensions: input.dimensions,
    material: input.material,
    replacementValue: input.replacementValue,
    installRequired: input.installRequired,
    createdAt: today,
    updatedAt: today,
    logs: [{ id: `${id}-L1`, time: `${today} 00:00`, type: 'nhap_kho', quantity: input.initialStock, reason: 'Khởi tạo tồn kho ban đầu', reference: 'Thêm sản phẩm mới' }],
  };
  itemStore.add(equipment);
  return equipment;
}

export function updateAdminEquipment(id: string, patch: Partial<AdminEquipment>): void {
  const today = new Date().toISOString().slice(0, 10);
  itemStore.update(id, { ...patch, updatedAt: today });
}

export function deleteAdminEquipment(id: string): void {
  itemStore.remove(id);
}

/** Điều chỉnh tồn kho thủ công hoặc do xuất/hoàn kho tự động, đồng thời ghi log biến động. */
export function adjustAdminEquipmentStock(id: string, type: StockLogType, quantity: number, reason: string, reference: string): void {
  const equipment = itemStore.getById(id);
  if (!equipment) return;

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const timeStr = `${dateStr} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  let { availableStock, rentedStock, maintenanceStock, totalStock } = equipment;
  switch (type) {
    case 'nhap_kho':
      availableStock += quantity;
      totalStock += quantity;
      break;
    case 'xuat_kho':
      availableStock = Math.max(0, availableStock - quantity);
      rentedStock += quantity;
      break;
    case 'bao_tri':
      availableStock = Math.max(0, availableStock - quantity);
      maintenanceStock += quantity;
      break;
    case 'dieu_chinh':
      availableStock = Math.max(0, availableStock + quantity);
      totalStock = Math.max(0, totalStock + quantity);
      break;
  }
  const log: StockLog = { id: `${id}-L${equipment.logs.length + 1}-${Date.now()}`, time: timeStr, type, quantity, reason, reference };
  itemStore.update(id, { availableStock, rentedStock, maintenanceStock, totalStock, updatedAt: dateStr, logs: [log, ...equipment.logs] });
}

/** Trả thiết bị "đang đi tiệc" về lại kho khả dụng (dùng khi hoàn kho sau sự kiện). */
export function returnAdminEquipmentStock(id: string, quantity: number, reason: string, reference: string): void {
  const equipment = itemStore.getById(id);
  if (!equipment) return;

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const timeStr = `${dateStr} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const rentedStock = Math.max(0, equipment.rentedStock - quantity);
  const availableStock = equipment.availableStock + quantity;
  const log: StockLog = { id: `${id}-L${equipment.logs.length + 1}-${Date.now()}`, time: timeStr, type: 'nhap_kho', quantity, reason, reference };
  itemStore.update(id, { availableStock, rentedStock, updatedAt: dateStr, logs: [log, ...equipment.logs] });
}

// ===== Map sang shape `Item` chuẩn (types/catalog.ts) — dùng cho mockAdapter.ts (GET /catalog/items,
// inventoryFromItems) và 2 nơi trang báo giá "thêm nhanh từ danh mục kho" (admin/quotations/new,
// CreateQuotationWizardModal). Cùng 1 nguồn `itemStore` — không phải bảng song song. =====
function toApiItem(row: AdminEquipment): Item {
  return {
    itemId: row.id,
    itemCode: row.id,
    itemName: row.name,
    typeId: typeIdOfCategory(row.category),
    typeName: row.category,
    unit: row.unit,
    rentalPrice: row.price,
    status: row.status === 'active' ? 'ACTIVE' : 'INACTIVE',
    isCombo: false,
    inventory: { quantityTotal: row.totalStock, quantityAvailable: row.availableStock },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function getCatalogItemsAsApiItems(): Item[] {
  return itemStore.getAll().map(toApiItem);
}

// Snapshot tại thời điểm module được load (đúng hành vi cũ của catalogMocks.MOCK_ITEMS — 3/4 nơi dùng
// hằng số này vốn đã chỉ đọc 1 lần lúc mount/module-eval, không phản ứng lại theo thời gian thực).
export const MOCK_ITEMS: Item[] = getCatalogItemsAsApiItems();

// ===== Business Service Package (trang /admin/catalog/business-services, "Dịch vụ doanh nghiệp") —
// gộp vào đây từ src/mocks/businessServicesMock.ts (đã xóa) theo Task "System Testing" audit 2b-6.
// Đây là gói dịch vụ TRỌN GÓI bán cho khách doanh nghiệp (tiệc tất niên, hội nghị, team building...),
// khác bản chất với AdminEquipment (thiết bị cho thuê lẻ theo đơn vị/tồn kho) — không ép chung 1 type,
// KHÔNG dùng chung EQUIPMENT_CATEGORY_OPTIONS (loại thiết bị vật lý, vd "Bàn ghế") vì hệ phân loại theo
// use-case sự kiện doanh nghiệp (vd "Hội nghị", "Team Building") là khái niệm khác hẳn, ép chung sẽ sai
// nghĩa. Điểm được gộp thật: sống trong CÙNG 1 file/thư mục db/ (nguồn dữ liệu duy nhất của toàn app)
// thay vì đứng riêng ngoài src/mocks/ như trước — nhất quán với mọi domain catalog khác.

export type BusinessServiceStatus = 'active' | 'paused' | 'stopped';

export const BUSINESS_SERVICE_STATUS_META: Record<BusinessServiceStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Đang cung cấp', variant: 'success' },
  paused: { label: 'Tạm ngừng', variant: 'warning' },
  stopped: { label: 'Ngừng cung cấp', variant: 'error' },
};

export const BUSINESS_SERVICE_CATEGORY_OPTIONS = [
  'Tiệc & Sự kiện', 'Hội nghị', 'Team Building', 'Trang trí', 'Ẩm thực', 'Nghỉ dưỡng',
];

export interface BusinessServicePackage {
  id: string;
  code: string;
  name: string;
  category: string;
  shortDescription: string;
  detailDescription: string;
  priceFrom: number;
  status: BusinessServiceStatus;
  imageUrl: string;
  updatedAt: string; // YYYY-MM-DD
}

function addDaysStr(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const BUSINESS_SERVICE_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1511578314322-379afb47686e?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=200&h=200&fit=crop',
];

const EXTRA_BUSINESS_SERVICE_POOL = [
  { name: 'Gói Tiệc Cuối Năm Doanh Nghiệp', category: 'Tiệc & Sự kiện', code: 'BIZ-YEAREND', desc: 'Tổ chức tiệc tất niên trọn gói, sân khấu ánh sáng chuyên nghiệp.' },
  { name: 'Gói Hội Thảo Ra Mắt Sản Phẩm', category: 'Hội nghị', code: 'BIZ-LAUNCH', desc: 'Không gian ra mắt sản phẩm, hệ thống trình chiếu và âm thanh cao cấp.' },
  { name: 'Gói Du Lịch Kết Hợp Team Building', category: 'Team Building', code: 'BIZ-TRIP', desc: 'Kết hợp nghỉ dưỡng và hoạt động gắn kết đội nhóm ngoài trời.' },
  { name: 'Gói Trang Trí Sảnh Hội Nghị', category: 'Trang trí', code: 'BIZ-DECOR-HN', desc: 'Trang trí sảnh theo bộ nhận diện thương hiệu doanh nghiệp.' },
  { name: 'Gói Ẩm Thực Buffet Doanh Nghiệp', category: 'Ẩm thực', code: 'BIZ-BUFFET', desc: 'Thực đơn buffet đa dạng phục vụ số lượng lớn khách mời.' },
  { name: 'Gói Nghỉ Dưỡng Cuối Tuần', category: 'Nghỉ dưỡng', code: 'BIZ-RETREAT', desc: 'Chương trình nghỉ dưỡng kết hợp workshop nội bộ cho doanh nghiệp.' },
  { name: 'Gói Hội Nghị Khách Hàng', category: 'Hội nghị', code: 'BIZ-CLIENT', desc: 'Tổ chức hội nghị tri ân, chăm sóc khách hàng thân thiết.' },
  { name: 'Gói Tiệc Kỷ Niệm Thành Lập', category: 'Tiệc & Sự kiện', code: 'BIZ-ANNIV', desc: 'Tổ chức lễ kỷ niệm thành lập công ty quy mô lớn.' },
];

function generateMockBusinessServices(): BusinessServicePackage[] {
  const today = new Date('2026-07-10');

  const seeded: BusinessServicePackage[] = [
    {
      id: 'biz-1',
      code: 'BIZ-PREMIUM',
      name: 'Gói Tiệc Doanh Nghiệp Premium',
      category: 'Tiệc & Sự kiện',
      shortDescription: 'Gói tiệc cao cấp dành cho sự kiện doanh nghiệp. Quy mô từ 100 - 500 khách.',
      detailDescription: 'Gói tiệc cao cấp dành cho sự kiện doanh nghiệp, bao gồm thực đơn cao cấp, sân khấu, âm thanh ánh sáng chuyên nghiệp. Quy mô phục vụ từ 100 đến 500 khách.',
      priceFrom: 450_000,
      status: 'active',
      imageUrl: BUSINESS_SERVICE_IMAGE_POOL[0],
      updatedAt: addDaysStr(today, -2),
    },
    {
      id: 'biz-2',
      code: 'BIZ-CONFERENCE',
      name: 'Gói Hội Nghị Toàn Diện',
      category: 'Hội nghị',
      shortDescription: 'Dịch vụ tổ chức hội nghị, hội thảo trọn gói bao gồm thiết bị và nhân sự.',
      detailDescription: 'Dịch vụ tổ chức hội nghị, hội thảo trọn gói bao gồm thiết bị trình chiếu, âm thanh, và nhân sự hỗ trợ chuyên nghiệp trong suốt sự kiện.',
      priceFrom: 320_000,
      status: 'active',
      imageUrl: BUSINESS_SERVICE_IMAGE_POOL[2],
      updatedAt: addDaysStr(today, -3),
    },
    {
      id: 'biz-3',
      code: 'BIZ-TEAMBUILD',
      name: 'Gói Team Building',
      category: 'Team Building',
      shortDescription: 'Chương trình team building sáng tạo kết hợp du lịch và gala dinner.',
      detailDescription: 'Chương trình team building sáng tạo kết hợp các hoạt động du lịch trải nghiệm và tiệc gala dinner khép lại chương trình.',
      priceFrom: 280_000,
      status: 'paused',
      imageUrl: BUSINESS_SERVICE_IMAGE_POOL[3],
      updatedAt: addDaysStr(today, -5),
    },
    {
      id: 'biz-4',
      code: 'BIZ-DECOR',
      name: 'Gói Trang Trí Doanh Nghiệp',
      category: 'Trang trí',
      shortDescription: 'Trang trí sân khấu, không gian sự kiện theo nhận diện thương hiệu.',
      detailDescription: 'Trang trí sân khấu, không gian sự kiện theo đúng bộ nhận diện thương hiệu (màu sắc, logo, backdrop) của doanh nghiệp.',
      priceFrom: 150_000,
      status: 'active',
      imageUrl: BUSINESS_SERVICE_IMAGE_POOL[4],
      updatedAt: addDaysStr(today, -7),
    },
  ];

  // 18 đang cung cấp / 4 tạm ngừng / 2 ngừng cung cấp trên tổng 24 dịch vụ — đã dùng 3 active + 1
  // paused ở 4 dòng seed phía trên, phần còn lại (20 dòng) cần thêm 15 active + 3 paused + 2 stopped.
  const remainingStatuses: BusinessServiceStatus[] = [
    ...Array(15).fill('active'),
    ...Array(3).fill('paused'),
    ...Array(2).fill('stopped'),
  ];

  const generated: BusinessServicePackage[] = remainingStatuses.map((status, i) => {
    const base = EXTRA_BUSINESS_SERVICE_POOL[i % EXTRA_BUSINESS_SERVICE_POOL.length];
    const suffix = Math.floor(i / EXTRA_BUSINESS_SERVICE_POOL.length) + 1;
    return {
      id: `biz-${seeded.length + i + 1}`,
      code: suffix > 1 ? `${base.code}-${suffix}` : base.code,
      name: suffix > 1 ? `${base.name} ${suffix}` : base.name,
      category: base.category,
      shortDescription: base.desc,
      detailDescription: base.desc,
      priceFrom: 120_000 + ((i * 35_000) % 400_000),
      status,
      imageUrl: BUSINESS_SERVICE_IMAGE_POOL[i % BUSINESS_SERVICE_IMAGE_POOL.length],
      updatedAt: addDaysStr(today, -(8 + i * 3)),
    };
  });

  return [...seeded, ...generated];
}

let businessServiceStore: BusinessServicePackage[] = generateMockBusinessServices();

export function getBusinessServices(): BusinessServicePackage[] {
  return businessServiceStore;
}

export function addBusinessService(service: BusinessServicePackage): void {
  businessServiceStore = [service, ...businessServiceStore];
}

export function updateBusinessService(id: string, patch: Partial<BusinessServicePackage>): void {
  businessServiceStore = businessServiceStore.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function deleteBusinessService(id: string): void {
  businessServiceStore = businessServiceStore.filter((s) => s.id !== id);
}

export function nextBusinessServiceCode(): string {
  const year = 25;
  const seq = 20 + (businessServiceStore.length % 80);
  return `BIZ-${year}${seq}`;
}
