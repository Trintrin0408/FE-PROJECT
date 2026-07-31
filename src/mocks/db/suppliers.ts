import type { SupplierStatus } from '@/types/supplier';
import { createMockStore } from './utils';
import { getAdminOrders } from './orders';

// Nguồn Supplier DUY NHẤT cho toàn bộ UI (Admin + Manager) — trước đây là 2 file riêng biệt theo
// DEMO_CHECKLIST.md Task 17 (Giai đoạn 2 — hợp nhất mock data):
//   - src/mocks/adminSuppliersMock.ts (7 đối tác `sup-1`..`sup-7`, mỗi đối tác có `transactions[]`
//     lồng sẵn — canonical, giữ nguyên ID/cấu trúc)
//   - src/mocks/adminSupplierReturnsMock.ts (phiếu trả thiết bị NCC — có "RENTAL_ORDERS" riêng, dùng
//     mã `NCC-RENT-2026-00xx` VÀ đối chiếu nhà cung cấp bằng SO KHỚP TÊN CHUỖI `supplierName`, hoàn
//     toàn tách biệt khỏi `transactions[]` ở file kia dù cùng mô tả giao dịch thuê thiết bị)
// 2 vấn đề thật tìm thấy khi gộp (đúng như Task 17 dự đoán):
//   (1) `orderLinkCode` trong mọi transaction trước đây là chuỗi giả `ORD001`..`ORD008` (sinh độc lập
//       bằng `nextOrderLinkCode()`, không trỏ đơn nào có thật) — đã sửa trỏ THẬT tới `db/orders.ts`
//       (cycle qua danh sách order thật), đồng thời `customerLabel` đổi sang lấy TÊN KHÁCH THẬT của
//       đúng order đó thay vì tên đôi uyên ương tự bịa độc lập trước đây (nếu chỉ sửa `orderLinkCode`
//       mà giữ nguyên `customerLabel` giả thì 2 field sẽ mâu thuẫn nhau trên UI — vd nhãn "Lễ cưới
//       Minh Anh - Thu Hà (DD0023)" trong khi DD0023 thật lại thuộc khách khác).
//   (2) 1/5 "RENTAL_ORDERS" cũ (`NCC-RENT-2026-0012`, đối tác Ánh Sáng Pro) có `items`/số lượng
//       KHỚP CHÍNH XÁC với transaction `P0250601-001` đã có sẵn của `sup-1` — hai cơ chế mock đang mô
//       tả CÙNG 1 giao dịch bằng 2 mã khác nhau. Đã trỏ thẳng phiếu trả liên quan (`THNCC-026`,
//       `THNCC-001`) về `requestCode` thật của transaction đó thay vì tạo bản ghi trùng lặp. 4/5
//       "RENTAL_ORDERS" còn lại có items/số lượng KHÁC với mọi transaction hiện có của cùng đối tác
//       (không phải bản ghi trùng) — đã chuyển thành transaction RENT/RECEIVED mới thật trong
//       `transactions[]` của đối tác tương ứng (định dạng mã `P<ngày>-<seq>` thống nhất, không còn mã
//       `NCC-RENT-*` riêng), giữ nguyên item/số lượng gốc.
// `getSupplierRentalOrders()`/`getSupplierRentalOrderByCode()` (dùng cho dropdown "Chọn đơn thuê" khi
// tạo phiếu trả) giờ suy ra TRỰC TIẾP từ `transactions` đã hợp nhất (lọc RENT + RECEIVED) thay vì đọc
// 1 danh sách rời rạc riêng — đúng 1 nguồn duy nhất cho khái niệm "đơn thuê ngoài của 1 đối tác".

export type SupplierTransactionStatus = 'NEW' | 'RECEIVED' | 'CANCELLED';

export const SUPPLIER_TRANSACTION_STATUS_META: Record<SupplierTransactionStatus, { label: string; badgeClass: string }> = {
  NEW: { label: 'Mới', badgeClass: 'bg-amber-100 text-amber-700' },
  RECEIVED: { label: 'Đã nhận hàng', badgeClass: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Đã hủy', badgeClass: 'bg-slate-100 text-slate-500' },
};

export type SupplierOrderType = 'RENT' | 'BUY';

export const SUPPLIER_ORDER_TYPE_META: Record<SupplierOrderType, { label: string; fullLabel: string; badgeClass: string }> = {
  RENT: { label: 'Thuê', fullLabel: 'Thuê mướn', badgeClass: 'bg-blue-100 text-blue-700' },
  BUY: { label: 'Mua', fullLabel: 'Mua sắm', badgeClass: 'bg-violet-100 text-violet-700' },
};

export interface SupplierTransactionLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface SupplierTransactionSummary {
  requestCode: string;
  title: string;
  customerLabel: string;
  /** FK thật tới AdminOrderRow.orderId (db/orders.ts) — Task 17, trước đây là chuỗi giả `ORD00N`. */
  orderLinkCode: string;
  /** Ngày đặt / ngày thực hiện yêu cầu — hiển thị "Ngày thực hiện" ở hồ sơ đối tác, "Ngày đặt" ở trang đơn thuê/mua. */
  executionDate: string;
  /** Ngày dự kiến giao/hoàn thành — chỉ hiển thị ở trang đơn thuê/mua. */
  expectedDate: string;
  orderType: SupplierOrderType;
  value: number;
  status: SupplierTransactionStatus;
  lineItems: SupplierTransactionLineItem[];
  /** Số tiền đã trả cho NCC (giảm dư nợ) — dùng ở modal chi tiết đơn hàng và trang công nợ. */
  paidAmount: number;
  /** Bồi thường PHÁT SINH THÊM cho NCC (VD: mình làm hỏng thiết bị của họ) — TĂNG dư nợ. Chỉ hiển thị
   * ở modal chi tiết đơn hàng (purchase-orders). Khác chiều với `supplierDeduction`. */
  compensationAmount: number;
  /** Đền bù/giảm trừ TỪ phía NCC (VD: họ giao thiếu/trễ/lỗi) — GIẢM dư nợ phải trả. Chỉ hiển thị ở
   * trang Công nợ nhà cung cấp (/admin/reports/debts). */
  supplierDeduction: number;
}

/** Dư nợ còn lại của 1 giao dịch NCC = giá trị đơn + bồi thường phát sinh - đền bù từ NCC - đã trả. */
export function getSupplierTransactionRemainingDebt(t: SupplierTransactionSummary): number {
  return t.value + t.compensationAmount - t.supplierDeduction - t.paidAmount;
}

/** Bỏ tiền tố "KH: " khỏi customerLabel khi hiển thị — tiền tố này chỉ dùng để nhận diện trong data,
 * không hiển thị ra UI (bảng đơn thuê/mua, modal chi tiết, form tạo/sửa). */
export function customerLabelOf(t: { customerLabel: string }): string {
  return t.customerLabel.replace(/^KH:\s*/, '');
}

export interface SupplierCatalogItem {
  itemCode: string;
  itemName: string;
  price: number;
  unit: string;
}

export interface AdminSupplier {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  serviceType: string;
  /** Không đọc trực tiếp field này trên store — luôn bị `getAdminSuppliers`/`getAdminSupplierById`
   * ghi đè bằng tổng tính động từ `transactions` (xem `computeDebtBalance`), để không lệch dần khi
   * `recordSupplierPayment`/`approveSupplierReturnSlip` cập nhật paidAmount/compensationAmount. */
  debtBalance: number;
  status: SupplierStatus;
  transactions: SupplierTransactionSummary[];
  catalogItems: SupplierCatalogItem[];
}

// customerLabel/orderLinkCode của mọi transaction (seed lẫn tạo mới) đều lấy TỪ 1 order thật trong
// db/orders.ts — cycle qua danh sách order theo index cố định (không phụ thuộc vào tổng số order hiện
// có, tự bọc vòng), khớp đúng pattern "customerId FK thật" đã dùng ở Task 14/15.
const realOrders = getAdminOrders();
function orderAt(index: number) {
  return realOrders[index % realOrders.length];
}
function customerLabelFromOrder(index: number): string {
  return `KH: Lễ cưới ${orderAt(index).customerName}`;
}
function orderLinkCodeAt(index: number): string {
  return orderAt(index).orderId;
}

const SEED_SUPPLIERS: AdminSupplier[] = [
  {
    supplierId: 'sup-1',
    supplierCode: 'SUP002',
    supplierName: 'Ánh Sáng Pro',
    contactPerson: 'Trần Văn Hùng',
    phone: '0978 123 456',
    email: 'proline.av@yahoo.com',
    address: 'Hoàng Mai, Hà Nội',
    serviceType: 'Âm thanh biểu diễn',
    debtBalance: 0, // bỏ qua khi đọc — luôn tính lại từ transactions[] (withComputedDebtBalance)
    status: 'ACTIVE',
    transactions: [
      {
        requestCode: 'P0250601-001',
        title: 'Bộ âm thanh ánh sáng tiệc cưới chuyên nghiệp',
        customerLabel: customerLabelFromOrder(0),
        orderLinkCode: orderLinkCodeAt(0),
        executionDate: '2025-06-01',
        expectedDate: '2025-06-12',
        orderType: 'RENT',
        value: 12_500_000,
        status: 'NEW',
        lineItems: [
          { name: 'Loa Full Array sân khấu lớn', quantity: 4, unitPrice: 2_000_000 },
          { name: 'Đèn Moving Head Beam 450W', quantity: 9, unitPrice: 500_000 },
        ],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
      {
        requestCode: 'P0250607-008',
        title: 'Hệ thống âm thanh biểu diễn ngoài trời công suất cao',
        customerLabel: customerLabelFromOrder(1),
        orderLinkCode: orderLinkCodeAt(1),
        executionDate: '2025-06-07',
        expectedDate: '2025-06-14',
        orderType: 'RENT',
        value: 55_050_000,
        status: 'NEW',
        lineItems: [{ name: 'Hệ thống âm thanh biểu diễn ngoài trời công suất cao', quantity: 1, unitPrice: 55_050_000 }],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [
      { itemCode: 'TB-0001', itemName: 'Bàn tiệc tròn 1.6m', price: 120_000, unit: 'cái' },
      { itemCode: 'TB-0002', itemName: 'Ghế Tiffany', price: 45_000, unit: 'cái' },
    ],
  },
  {
    supplierId: 'sup-2',
    supplierCode: 'SUP_TL',
    supplierName: 'Tùng Lâm Decor',
    contactPerson: 'Nguyễn Thị Lâm',
    phone: '0987 654 321',
    email: 'tunglamdecor@gmail.com',
    address: 'Thanh Xuân, Hà Nội',
    serviceType: 'Hoa tươi cắm tiệc',
    debtBalance: 0, // bỏ qua khi đọc — luôn tính lại từ transactions[] (withComputedDebtBalance)
    status: 'ACTIVE',
    transactions: [
      {
        requestCode: 'P0250602-002',
        title: 'Trang trí hoa cổng và sảnh tiệc cưới',
        customerLabel: customerLabelFromOrder(2),
        orderLinkCode: orderLinkCodeAt(2),
        executionDate: '2025-06-02',
        expectedDate: '2025-06-10',
        orderType: 'BUY',
        value: 8_750_000,
        status: 'NEW',
        lineItems: [
          { name: 'Cổng hoa lụa cao cấp', quantity: 1, unitPrice: 1_500_000 },
          { name: 'Trang trí hoa tươi sảnh tiệc cưới', quantity: 1, unitPrice: 7_250_000 },
        ],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
      // Trước đây là "RENTAL_ORDERS" NCC-RENT-2026-0013 ở adminSupplierReturnsMock.ts (item/số lượng
      // khác transaction P0250602-002 ở trên — không phải bản ghi trùng) — chuyển thành transaction
      // RENT/RECEIVED thật, giữ nguyên item gốc, để phiếu trả THNCC-002 có nguồn thật để trỏ tới.
      {
        requestCode: 'P0250526-009',
        title: 'Thuê cổng hoa và trang trí bàn tiệc',
        customerLabel: customerLabelFromOrder(8),
        orderLinkCode: orderLinkCodeAt(8),
        executionDate: '2026-05-26',
        expectedDate: '2026-05-30',
        orderType: 'RENT',
        value: 950_000,
        status: 'RECEIVED',
        lineItems: [
          { name: 'Cổng hoa lụa cao cấp', quantity: 2, unitPrice: 300_000 },
          { name: 'Bàn tiệc trang trí hoa tươi', quantity: 3, unitPrice: 116_667 },
        ],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [
      { itemCode: 'HD-0001', itemName: 'Cổng hoa lụa cao cấp', price: 1_500_000, unit: 'bộ' },
      { itemCode: 'HD-0002', itemName: 'Hoa cầm tay cô dâu', price: 350_000, unit: 'bó' },
    ],
  },
  {
    supplierId: 'sup-3',
    supplierCode: 'SUP_HD',
    supplierName: 'Hoàng Duy Audio',
    contactPerson: 'Lê Hoàng Duy',
    phone: '0912 345 678',
    email: 'hoangduyaudio@gmail.com',
    address: 'Hai Bà Trưng, Hà Nội',
    serviceType: 'Âm thanh biểu diễn',
    debtBalance: 0, // bỏ qua khi đọc — luôn tính lại từ transactions[] (withComputedDebtBalance)
    status: 'ACTIVE',
    transactions: [
      {
        requestCode: 'P0250603-003',
        title: 'Dàn âm thanh sân khấu ngoài trời',
        customerLabel: customerLabelFromOrder(3),
        orderLinkCode: orderLinkCodeAt(3),
        executionDate: '2025-06-03',
        expectedDate: '2025-06-18',
        orderType: 'RENT',
        value: 20_000_000,
        status: 'RECEIVED',
        lineItems: [{ name: 'Dàn âm thanh sân khấu ngoài trời', quantity: 1, unitPrice: 20_000_000 }],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 2_500_000,
      },
      // Trước đây "RENTAL_ORDERS" NCC-RENT-2026-0014 — item khác transaction P0250603-003, chuyển
      // thành transaction RENT/RECEIVED thật cho phiếu trả THNCC-003.
      {
        requestCode: 'P0250528-010',
        title: 'Thuê loa monitor rước dâu và bộ âm thanh ban nhạc',
        customerLabel: customerLabelFromOrder(9),
        orderLinkCode: orderLinkCodeAt(9),
        executionDate: '2026-05-28',
        expectedDate: '2026-05-31',
        orderType: 'RENT',
        value: 2_850_000,
        status: 'RECEIVED',
        lineItems: [
          { name: 'Loa monitor JBL rước dâu', quantity: 2, unitPrice: 600_000 },
          { name: 'Trọn gói thiết bị âm thanh ban nhạc', quantity: 1, unitPrice: 1_650_000 },
        ],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [{ itemCode: 'AT-0001', itemName: 'Loa full đôi JBL', price: 2_800_000, unit: 'bộ' }],
  },
  {
    supplierId: 'sup-4',
    supplierCode: 'SUP_NC',
    supplierName: 'Nội Thất Ngọc Châu',
    contactPerson: 'Phạm Ngọc Châu',
    phone: '0902 456 679',
    email: 'ngocchaunoithat@gmail.com',
    address: 'Ba Đình, Hà Nội',
    serviceType: 'Yến tiệc cưới ẩm thực',
    debtBalance: 0,
    status: 'ACTIVE',
    transactions: [
      {
        requestCode: 'P0250603-004',
        title: 'Bàn tròn 10 người phục vụ tiệc cưới',
        customerLabel: customerLabelFromOrder(4),
        orderLinkCode: orderLinkCodeAt(4),
        executionDate: '2025-06-03',
        expectedDate: '2025-06-15',
        orderType: 'BUY',
        value: 6_200_000,
        status: 'RECEIVED',
        lineItems: [{ name: 'Bàn tròn 10 người phục vụ tiệc cưới', quantity: 1, unitPrice: 6_200_000 }],
        paidAmount: 6_200_000,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [{ itemCode: 'BG-0001', itemName: 'Bàn tròn 10 người', price: 180_000, unit: 'cái' }],
  },
  {
    supplierId: 'sup-5',
    supplierCode: 'SUP_MP',
    supplierName: 'Minh Phát Flowers',
    contactPerson: 'Đỗ Minh Phát',
    phone: '0933 789 123',
    email: 'minhphatflowers@gmail.com',
    address: 'Cầu Giấy, Hà Nội',
    serviceType: 'Hoa tươi cắm tiệc',
    debtBalance: 0,
    status: 'ACTIVE',
    transactions: [
      {
        requestCode: 'P0250604-005',
        title: 'Trang trí hoa tươi tiệc cưới trọn gói',
        customerLabel: customerLabelFromOrder(5),
        orderLinkCode: orderLinkCodeAt(5),
        executionDate: '2025-06-04',
        expectedDate: '2025-06-23',
        orderType: 'RENT',
        value: 7_800_000,
        status: 'RECEIVED',
        lineItems: [{ name: 'Trang trí hoa tươi tiệc cưới trọn gói', quantity: 1, unitPrice: 7_800_000 }],
        paidAmount: 7_800_000,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
      // Trước đây "RENTAL_ORDERS" NCC-RENT-2026-0015 — chuyển thành transaction RENT/RECEIVED thật
      // cho phiếu trả THNCC-004.
      {
        requestCode: 'P0250527-011',
        title: 'Thuê trang trí hoa tươi sảnh tiệc',
        customerLabel: customerLabelFromOrder(10),
        orderLinkCode: orderLinkCodeAt(10),
        executionDate: '2026-05-27',
        expectedDate: '2026-05-31',
        orderType: 'RENT',
        value: 450_000,
        status: 'RECEIVED',
        lineItems: [{ name: 'Trang trí hoa tươi sảnh tiệc', quantity: 1, unitPrice: 450_000 }],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [{ itemCode: 'HD-0003', itemName: 'Trang trí bàn tiệc hoa tươi', price: 250_000, unit: 'bàn' }],
  },
  {
    supplierId: 'sup-6',
    supplierCode: 'SUP_VP',
    supplierName: 'Việt Phát Furniture',
    contactPerson: 'Hoàng Việt Phát',
    phone: '0977 234 567',
    email: 'vietphatfurniture@gmail.com',
    address: 'Đống Đa, Hà Nội',
    serviceType: 'Nội thất bàn ghế',
    debtBalance: 0, // bỏ qua khi đọc — luôn tính lại từ transactions[] (withComputedDebtBalance)
    status: 'ACTIVE',
    transactions: [
      {
        requestCode: 'P0250620-006',
        title: 'Bàn ghế tiệc cưới trọn gói 40 bàn',
        customerLabel: customerLabelFromOrder(6),
        orderLinkCode: orderLinkCodeAt(6),
        executionDate: '2025-06-20',
        expectedDate: '2025-06-28',
        orderType: 'BUY',
        value: 9_450_000,
        status: 'NEW',
        lineItems: [{ name: 'Bàn ghế tiệc cưới trọn gói 40 bàn', quantity: 1, unitPrice: 9_450_000 }],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
      // Trước đây "RENTAL_ORDERS" NCC-RENT-2026-0016 — chuyển thành transaction RENT/RECEIVED thật
      // cho phiếu trả THNCC-005.
      {
        requestCode: 'P0250527-012',
        title: 'Thuê ghế Chiavari vàng',
        customerLabel: customerLabelFromOrder(11),
        orderLinkCode: orderLinkCodeAt(11),
        executionDate: '2026-05-27',
        expectedDate: '2026-05-30',
        orderType: 'RENT',
        value: 675_000,
        status: 'RECEIVED',
        lineItems: [{ name: 'Ghế Chiavari vàng', quantity: 50, unitPrice: 13_500 }],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [
      { itemCode: 'BG-0002', itemName: 'Ghế Chiavari vàng', price: 45_000, unit: 'cái' },
      { itemCode: 'BG-0003', itemName: 'Bàn chữ nhật 1.8m', price: 150_000, unit: 'cái' },
    ],
  },
  {
    supplierId: 'sup-7',
    supplierCode: 'SUP_TT',
    supplierName: 'Thiên Trường Rạp Cưới',
    contactPerson: 'Vũ Thiên Trường',
    phone: '0966 345 678',
    email: 'thientruongrap@gmail.com',
    address: 'Long Biên, Hà Nội',
    serviceType: 'Khung rạp & bạt che',
    debtBalance: 0, // bỏ qua khi đọc — luôn tính lại từ transactions[] (withComputedDebtBalance)
    status: 'INACTIVE',
    transactions: [
      {
        requestCode: 'P0250510-007',
        title: 'Nhà rạp che sân sự kiện 6x12m',
        customerLabel: customerLabelFromOrder(7),
        orderLinkCode: orderLinkCodeAt(7),
        executionDate: '2025-05-10',
        expectedDate: '2025-05-16',
        orderType: 'RENT',
        value: 4_200_000,
        status: 'CANCELLED',
        lineItems: [{ name: 'Nhà rạp che sân sự kiện 6x12m', quantity: 1, unitPrice: 4_200_000 }],
        paidAmount: 0,
        compensationAmount: 0,
        supplierDeduction: 0,
      },
    ],
    catalogItems: [{ itemCode: 'KR-0001', itemName: 'Khung sắt 2.5m', price: 50_000, unit: 'cái' }],
  },
];

const supplierStore = createMockStore<AdminSupplier>('suppliers', SEED_SUPPLIERS, 'supplierId');

let supplierSeq = SEED_SUPPLIERS.length;
let transactionSeq = SEED_SUPPLIERS.reduce((sum, s) => sum + s.transactions.length, 0);

/** Tổng dư nợ hiện tại = tổng dư nợ còn lại của từng giao dịch (mục 3.1 docs/supplier_api.md,
 * hướng (2) được khuyến nghị) — tính lại mỗi lần đọc thay vì tin field `debtBalance` lưu tĩnh, để
 * luôn khớp `paidAmount`/`compensationAmount`/`supplierDeduction` mới nhất của đối tác. */
function withComputedDebtBalance(supplier: AdminSupplier): AdminSupplier {
  const debtBalance = supplier.transactions.reduce((sum, t) => sum + getSupplierTransactionRemainingDebt(t), 0);
  return { ...supplier, debtBalance };
}

export function getAdminSuppliers(): AdminSupplier[] {
  return supplierStore.getAll().map(withComputedDebtBalance);
}

export function getAdminSupplierById(id: string): AdminSupplier | undefined {
  const supplier = supplierStore.getById(id);
  return supplier ? withComputedDebtBalance(supplier) : undefined;
}

/** Nhà cung cấp có khai báo `itemName` (so khớp tên, không phân biệt hoa/thường) trong catalogItems —
 * dùng để lọc gợi ý NCC khi tạo đơn thuê/mua từ CTA "Thiếu hàng" trên Đơn hàng (purchase-orders/page.tsx).
 * So khớp TÊN là giải pháp tạm thời — catalogItems mock hiện chưa có FK itemId thật tới db/catalog.ts. */
export function getSuppliersCarryingItem(suppliers: AdminSupplier[], itemName: string): AdminSupplier[] {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return [];
  return suppliers.filter((s) => s.catalogItems.some((ci) => ci.itemName.trim().toLowerCase() === normalized));
}

export interface AdminSupplierFormValues {
  supplierCode: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  address: string;
  serviceType: string;
}

export function createAdminSupplier(values: AdminSupplierFormValues): AdminSupplier {
  supplierSeq += 1;
  const supplier: AdminSupplier = {
    supplierId: `sup-${supplierSeq}`,
    supplierCode: values.supplierCode,
    supplierName: values.supplierName,
    contactPerson: values.contactPerson,
    phone: values.phone,
    email: '',
    address: values.address,
    serviceType: values.serviceType,
    debtBalance: 0,
    status: 'ACTIVE',
    transactions: [],
    catalogItems: [],
  };
  supplierStore.add(supplier);
  return supplier;
}

export function updateAdminSupplier(id: string, values: AdminSupplierFormValues): void {
  supplierStore.update(id, values);
}

export function toggleAdminSupplierStatus(id: string): void {
  const supplier = supplierStore.getById(id);
  if (!supplier) return;
  supplierStore.update(id, { status: supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
}

export interface FlatSupplierTransaction extends SupplierTransactionSummary {
  supplierId: string;
  supplierName: string;
}

/** Danh sách gộp toàn bộ giao dịch thuê/mua ngoài của mọi đối tác — dùng cho trang purchase-orders. */
export function getAllSupplierTransactions(): FlatSupplierTransaction[] {
  return supplierStore.getAll().flatMap((s) => s.transactions.map((t) => ({ ...t, supplierId: s.supplierId, supplierName: s.supplierName })));
}

export interface SupplierTransactionItemInput {
  itemId?: string;
  itemName: string;
  quantity: number;
  unitCost: number;
}

export interface SupplierTransactionFormValues {
  supplierId: string;
  title: string;
  customerLabel: string;
  /** FK thật tới order (db/orders.ts) khi tạo từ luồng "thiếu hàng trên Đơn hàng → thuê NCC" — để
   * trống thì giữ hành vi cũ (tự gán 1 order kế tiếp qua `nextOrderLinkCode()`), không phá luồng tạo
   * thủ công cũ (Admin/Manager nhập tay sự kiện, không chọn đơn cụ thể). */
  orderId?: string;
  executionDate: string;
  expectedDate: string;
  orderType: SupplierOrderType;
  value: number;
  status: SupplierTransactionStatus;
  paidAmount: number;
  compensationAmount: number;
  supplierDeduction: number;
  /** Danh sách hạng mục thuê/mua — để trống thì giữ hành vi cũ (1 dòng duy nhất suy từ title/value). */
  items?: SupplierTransactionItemInput[];
}

function nextTransactionCode(executionDate: string): string {
  transactionSeq += 1;
  const d = new Date(executionDate);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `P${yy}${mm}${dd}-${String(transactionSeq).padStart(3, '0')}`;
}

/** Đơn thuê/mua tạo mới qua form không có sẵn order liên kết cụ thể trong form (chỉ nhập tên sự kiện
 * tự do) — gán tạm order thật kế tiếp theo vòng lặp để `orderLinkCode` luôn hợp lệ, nhất quán với cách
 * seed data ở trên tham chiếu order thật thay vì sinh mã giả như `nextOrderLinkCode()` cũ. */
let manualOrderLinkSeq = 12;
function nextOrderLinkCode(): string {
  manualOrderLinkSeq += 1;
  return orderLinkCodeAt(manualOrderLinkSeq);
}

function lineItemsFromFormValues(values: SupplierTransactionFormValues): SupplierTransactionLineItem[] {
  if (values.items && values.items.length > 0) {
    return values.items.map((it) => ({ name: it.itemName, quantity: it.quantity, unitPrice: it.unitCost }));
  }
  return [{ name: values.title, quantity: 1, unitPrice: values.value }];
}

export function createSupplierTransaction(values: SupplierTransactionFormValues): FlatSupplierTransaction {
  const requestCode = nextTransactionCode(values.executionDate);
  const lineItems = lineItemsFromFormValues(values);
  const transaction: SupplierTransactionSummary = {
    requestCode,
    title: values.title,
    customerLabel: values.customerLabel,
    orderLinkCode: values.orderId || nextOrderLinkCode(),
    executionDate: values.executionDate,
    expectedDate: values.expectedDate,
    orderType: values.orderType,
    value: values.value,
    status: values.status,
    lineItems,
    paidAmount: values.paidAmount,
    compensationAmount: values.compensationAmount,
    supplierDeduction: values.supplierDeduction,
  };
  const supplier = supplierStore.getById(values.supplierId);
  supplierStore.update(values.supplierId, { transactions: [transaction, ...(supplier?.transactions ?? [])] });
  return { ...transaction, supplierId: values.supplierId, supplierName: supplier?.supplierName ?? '' };
}

export function updateSupplierTransaction(supplierId: string, requestCode: string, values: SupplierTransactionFormValues): void {
  const supplier = supplierStore.getById(supplierId);
  if (!supplier) return;
  const transactions = supplier.transactions.map((t) =>
    t.requestCode === requestCode
      ? {
          ...t,
          title: values.title,
          customerLabel: values.customerLabel,
          orderLinkCode: values.orderId || t.orderLinkCode,
          executionDate: values.executionDate,
          expectedDate: values.expectedDate,
          orderType: values.orderType,
          value: values.value,
          status: values.status,
          // Chỉ ghi đè lineItems khi form có gửi items[] (luồng picker mới) — giữ nguyên lineItems gốc
          // khi sửa qua form cũ (chỉ có title/value) để không mất breakdown nhiều dòng đã seed sẵn.
          lineItems: values.items && values.items.length > 0 ? lineItemsFromFormValues(values) : t.lineItems,
          paidAmount: values.paidAmount,
          compensationAmount: values.compensationAmount,
          supplierDeduction: values.supplierDeduction,
        }
      : t,
  );
  supplierStore.update(supplierId, { transactions });
}

export interface RecordSupplierPaymentInput {
  amount: number;
  date: string;
  evidenceFileName: string;
}

/** Ghi nhận thêm 1 khoản đã trả cho NCC ở 1 giao dịch — cộng dồn vào `paidAmount` hiện có. */
export function recordSupplierPayment(supplierId: string, requestCode: string, input: RecordSupplierPaymentInput): void {
  const supplier = supplierStore.getById(supplierId);
  if (!supplier) return;
  const transactions = supplier.transactions.map((t) => (t.requestCode === requestCode ? { ...t, paidAmount: t.paidAmount + input.amount } : t));
  supplierStore.update(supplierId, { transactions });
}

// ===== Phiếu trả thiết bị NCC (trước đây src/mocks/adminSupplierReturnsMock.ts) =====

export type SupplierReturnStatus = 'NEW' | 'APPROVED';

export const SUPPLIER_RETURN_STATUS_META: Record<SupplierReturnStatus, { listLabel: string; detailLabel: string; badgeClass: string }> = {
  NEW: { listLabel: 'Mới', detailLabel: 'Chờ duyệt (Mới)', badgeClass: 'bg-amber-100 text-amber-700' },
  APPROVED: { listLabel: 'Đã duyệt', detailLabel: 'Đã duyệt', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

export interface SupplierRentalOrderItemRef {
  itemName: string;
  quantityRented: number;
  unitReplacementValue: number;
}

export interface SupplierRentalOrderRef {
  code: string;
  eventName: string;
  supplierName: string;
  rentalStart: string;
  rentalEnd: string;
  items: SupplierRentalOrderItemRef[];
}

/** Đơn thuê ngoài của NCC có thể tạo phiếu trả — suy ra TRỰC TIẾP từ `transactions` đã hợp nhất
 * (lọc RENT + đã RECEIVED), không còn là 1 danh sách rời rạc riêng như `RENTAL_ORDERS` cũ. */
export function getSupplierRentalOrders(): SupplierRentalOrderRef[] {
  return getAllSupplierTransactions()
    .filter((t) => t.orderType === 'RENT' && t.status === 'RECEIVED')
    .map((t) => ({
      code: t.requestCode,
      eventName: t.customerLabel.replace(/^KH:\s*/, ''),
      supplierName: t.supplierName,
      rentalStart: t.executionDate,
      rentalEnd: t.expectedDate,
      items: t.lineItems.map((li) => ({ itemName: li.name, quantityRented: li.quantity, unitReplacementValue: li.unitPrice })),
    }));
}

export function getSupplierRentalOrderByCode(code: string): SupplierRentalOrderRef | undefined {
  return getSupplierRentalOrders().find((o) => o.code === code);
}

export interface SupplierReturnItem {
  itemName: string;
  quantityRented: number;
  intact: number;
  damaged: number;
  lost: number;
  compensationAmount: number;
}

export interface SupplierReturnSlip {
  id: string;
  orderCode: string;
  orderName: string;
  supplierName: string;
  status: SupplierReturnStatus;
  createdAt: string;
}

// orderCode trỏ requestCode thật trong transactions[] ở trên (không còn mã NCC-RENT-2026-00xx riêng):
// THNCC-026/THNCC-001 trỏ P0250601-001 (transaction gốc của sup-1, đã tồn tại sẵn — 2 phiếu trả cùng
// tham chiếu 1 đơn thuê là tình huống thật, vd trả theo nhiều đợt); THNCC-002..005 trỏ 4 transaction
// RENT/RECEIVED mới thêm ở sup-2/sup-3/sup-5/sup-6 phía trên.
const SEED_SLIPS: (SupplierReturnSlip & { items: SupplierReturnItem[] })[] = [
  {
    id: 'THNCC-026',
    orderCode: 'P0250601-001',
    orderName: 'Bộ âm thanh ánh sáng tiệc cưới chuyên nghiệp',
    supplierName: 'Ánh Sáng Pro',
    status: 'NEW',
    createdAt: '2026-07-12T18:28:00',
    items: [
      { itemName: 'Loa Full Array sân khấu lớn', quantityRented: 4, intact: 4, damaged: 0, lost: 0, compensationAmount: 0 },
      { itemName: 'Đèn Moving Head Beam 450W', quantityRented: 9, intact: 9, damaged: 0, lost: 0, compensationAmount: 0 },
    ],
  },
  {
    id: 'THNCC-001',
    orderCode: 'P0250601-001',
    orderName: 'Bộ âm thanh ánh sáng tiệc cưới chuyên nghiệp',
    supplierName: 'Ánh Sáng Pro',
    status: 'NEW',
    createdAt: '2026-05-28T09:15:00',
    items: [
      { itemName: 'Loa Full Array sân khấu lớn', quantityRented: 4, intact: 4, damaged: 0, lost: 0, compensationAmount: 0 },
      { itemName: 'Đèn Moving Head Beam 450W', quantityRented: 9, intact: 9, damaged: 0, lost: 0, compensationAmount: 0 },
    ],
  },
  {
    id: 'THNCC-002',
    orderCode: 'P0250526-009',
    orderName: 'Thuê cổng hoa và trang trí bàn tiệc',
    supplierName: 'Tùng Lâm Decor',
    status: 'APPROVED',
    createdAt: '2026-05-28T10:30:00',
    items: [
      { itemName: 'Cổng hoa lụa cao cấp', quantityRented: 2, intact: 2, damaged: 0, lost: 0, compensationAmount: 0 },
      { itemName: 'Bàn tiệc trang trí hoa tươi', quantityRented: 3, intact: 3, damaged: 0, lost: 0, compensationAmount: 0 },
    ],
  },
  {
    id: 'THNCC-003',
    orderCode: 'P0250528-010',
    orderName: 'Thuê loa monitor rước dâu và bộ âm thanh ban nhạc',
    supplierName: 'Hoàng Duy Audio',
    status: 'NEW',
    createdAt: '2026-05-28T11:05:00',
    items: [
      { itemName: 'Loa monitor JBL rước dâu', quantityRented: 2, intact: 2, damaged: 0, lost: 0, compensationAmount: 0 },
      { itemName: 'Trọn gói thiết bị âm thanh ban nhạc', quantityRented: 1, intact: 1, damaged: 0, lost: 0, compensationAmount: 0 },
    ],
  },
  {
    id: 'THNCC-004',
    orderCode: 'P0250527-011',
    orderName: 'Thuê trang trí hoa tươi sảnh tiệc',
    supplierName: 'Minh Phát Flowers',
    status: 'APPROVED',
    createdAt: '2026-05-28T13:20:00',
    items: [{ itemName: 'Trang trí hoa tươi sảnh tiệc', quantityRented: 1, intact: 1, damaged: 0, lost: 0, compensationAmount: 0 }],
  },
  {
    id: 'THNCC-005',
    orderCode: 'P0250527-012',
    orderName: 'Thuê ghế Chiavari vàng',
    supplierName: 'Việt Phát Furniture',
    status: 'NEW',
    createdAt: '2026-05-28T14:45:00',
    items: [{ itemName: 'Ghế Chiavari vàng', quantityRented: 50, intact: 48, damaged: 2, lost: 0, compensationAmount: 90_000 }],
  },
];

const returnSlipStore = createMockStore<SupplierReturnSlip & { items: SupplierReturnItem[] }>('supplier_return_slips', SEED_SLIPS, 'id');

export function getSupplierReturnSlips(): SupplierReturnSlip[] {
  return returnSlipStore.getAll();
}

export function getSupplierReturnSlipById(id: string): (SupplierReturnSlip & { items: SupplierReturnItem[] }) | undefined {
  return returnSlipStore.getById(id);
}

function nextSlipId(): string {
  const maxNum = returnSlipStore.getAll().reduce((max, s) => Math.max(max, Number(s.id.replace(/\D/g, '')) || 0), 0);
  return `THNCC-${String(maxNum + 1).padStart(3, '0')}`;
}

export interface CreateSupplierReturnSlipInput {
  orderCode: string;
  orderName: string;
  items: SupplierReturnItem[];
}

export function createSupplierReturnSlip(input: CreateSupplierReturnSlipInput): SupplierReturnSlip {
  const order = getSupplierRentalOrderByCode(input.orderCode);
  const slip: SupplierReturnSlip & { items: SupplierReturnItem[] } = {
    id: nextSlipId(),
    orderCode: input.orderCode,
    orderName: input.orderName,
    supplierName: order?.supplierName ?? '',
    status: 'NEW',
    createdAt: new Date().toISOString(),
    items: input.items,
  };
  returnSlipStore.add(slip);
  return slip;
}

export function approveSupplierReturnSlip(id: string): void {
  returnSlipStore.update(id, { status: 'APPROVED' });
}
