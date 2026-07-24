import type { AxiosAdapter, AxiosResponse, AxiosResponseHeaders, InternalAxiosRequestConfig } from 'axios';
import { AxiosHeaders } from 'axios';
import { MOCK_CATEGORIES, MOCK_TYPES, getAdminEquipment, getCatalogItemsAsApiItems } from '@/mocks/db/catalog';
import {
  MOCK_USERS,
  MOCK_WORK_TASKS,
  MOCK_SCHEDULE_PLANS,
  MOCK_SURVEY_REPORTS,
  MOCK_POLICIES,
  MOCK_WAGES,
  MOCK_ORDER_WARNINGS,
  MOCK_EVIDENCE,
  MOCK_SUPPLIER_TRANSACTIONS,
} from '@/mocks/apiFixtures';
import {
  getAdminCustomers,
  getAdminCustomerById,
  addAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer,
  nextAdminCustomerId,
  getAdminCustomerDetail,
  getOrdersByCustomerId,
  addAdminOrder,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrder,
  nextAdminOrderId,
  buildOrderItems,
  paginate,
  createDepositForMockRoute,
  markDepositStatusForMockRoute,
  confirmSettlement,
  getAdminQuotations,
  type AdminCustomer,
  type AdminOrderRow,
  type MockApiMeta,
} from '@/mocks/db';
import type { QuotationListItem, QuotationListStatus } from '@/types/quotation';
import type { ItemCategory } from '@/types/catalog';
import type { InventoryRow } from '@/types/inventory';
import type { AuthProfile, AuthUser } from '@/types/auth';
import type {
  Customer,
  CreateCustomerPayload,
  UpdateCustomerPayload,
  CustomerSummary,
  CustomerOrderSummary,
} from '@/types/customer';
import type { Order, OrderStatus, OrderPaymentStatus } from '@/types/order';
import type { PolicyType } from '@/types/policy';

// Customer/Order lấy THẲNG từ src/mocks/db/ (nguồn duy nhất, dùng chung với mọi trang admin/manager
// đọc trực tiếp từ đó) thay vì có mảng MOCK_CUSTOMERS/MOCK_ORDERS riêng — xem DEMO_CHECKLIST.md Task
// 13/14. 2 hàm map bên dưới chỉ đổi shape (AdminCustomer/AdminOrderRow -> Customer/Order theo
// types/customer.ts, types/order.ts) để khớp response mà *ApiService mong đợi, KHÔNG phải 2 nguồn
// dữ liệu khác nhau — cùng 1 bản ghi gốc.
const FIXED_TIMESTAMP = '2026-01-01T00:00:00Z';

function mapCustomerToApi(c: AdminCustomer): Customer {
  return {
    customerId: c.customerId,
    customerName: c.customerName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    notes: c.notes,
    status: c.status,
    totalBookings: c.totalBookings,
    totalSpent: c.totalSpent,
  };
}

function mapOrderToApi(o: AdminOrderRow): Order {
  return {
    orderId: o.orderId,
    orderCode: o.orderId,
    customerId: o.customerId,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    quotationId: o.quotationId,
    eventType: 'Đám cưới',
    eventName: `Lễ cưới ${o.customerName}`,
    eventDate: o.weddingDate,
    location: o.venue,
    guestCount: o.guestCount,
    totalAmount: o.totalPrice,
    paymentStatus: o.paymentStatus as OrderPaymentStatus,
    orderStatus: o.status as OrderStatus,
    notes: o.notes,
    createdBy: { userId: 'mock-manager-1', fullName: 'Trưởng phòng vận hành', role: 'MANAGER' },
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}

// Backend thật không chạy trong giai đoạn demo/dựng giao diện thuần (CLAUDE.md mục 0) — adapter này
// thay thế toàn bộ tầng network của axios (không gọi ra ngoài) cho các services còn lại chưa được
// từng trang chuyển sang đọc thẳng từ src/mocks/*. Chỉ implement chi tiết cho các route thực sự
// được UI hiện tại gọi tới (đối chiếu qua grep `ApiService\.` trong src/app và src/components); mọi
// route khác rơi vào fallback GET rỗng / mutation thành công chung để không làm vỡ luồng thao tác.
// Bật/tắt qua NEXT_PUBLIC_MOCK_MODE trong .env.local — trả lại api.ts gọi backend thật khi cần.

let mockIdSeq = 1;
function nextId(prefix: string): string {
  return `mock-${prefix}-${Date.now().toString(36)}-${mockIdSeq++}`;
}

function envelope(data: unknown, meta?: MockApiMeta, message = 'Thao tác thành công (dữ liệu mô phỏng)') {
  return { success: true, code: 'MOCK-OK', message, data, ...(meta ? { meta } : {}) };
}

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (part !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function currentAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('bnwems_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// quantityDamaged đọc THẬT từ maintenanceStock của db/catalog.ts (Task 16) thay vì heuristic
// `itemId.endsWith('01')` cũ — cùng 1 nguồn tồn kho với trang "Gói sản phẩm & dịch vụ"/"Tồn kho
// doanh nghiệp", không phải số liệu bịa riêng cho trang Bảo trì.
function inventoryFromItems(): InventoryRow[] {
  return getAdminEquipment().map((item) => ({
    inventoryId: `inv-${item.id}`,
    itemId: item.id,
    itemName: item.name,
    quantityTotal: item.totalStock,
    quantityAvailable: item.availableStock,
    quantityReserved: 0,
    quantityDamaged: item.maintenanceStock,
    updatedAt: item.updatedAt,
  }));
}

interface MockResult {
  status: number;
  data: unknown;
}

function resolve(method: string, path: string, params: Record<string, unknown>, body: unknown): MockResult {
  const m = method.toUpperCase();

  // ===== Auth =====
  if (m === 'GET' && path === '/auth/profile') {
    const user = currentAuthUser();
    const profile: AuthProfile = {
      userId: user?.userId ?? 'mock-user',
      username: user?.username ?? 'user',
      fullName: user?.fullName ?? 'Người dùng',
      role: user?.role ?? { roleId: 'mock-role-manager', roleName: 'Manager' },
      status: user?.status ?? 'active',
      email: `${user?.username ?? 'user'}@bnwems.vn`,
      phone: '0900000000',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    return { status: 200, data: envelope(profile) };
  }
  if (m === 'PUT' && path === '/auth/change-password') {
    return { status: 200, data: envelope(null, undefined, 'Đổi mật khẩu thành công (dữ liệu mô phỏng)') };
  }
  if (m === 'POST' && path === '/auth/forgot-password') {
    return { status: 200, data: envelope(null, undefined, 'Yêu cầu đặt lại mật khẩu đã được ghi nhận (dữ liệu mô phỏng)') };
  }

  // ===== Users =====
  if (m === 'GET' && path === '/users') {
    const { data, meta } = paginate(MOCK_USERS, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }

  // ===== Work tasks =====
  if (m === 'GET' && path === '/work-tasks') {
    const isActive = params.isActive;
    const list = isActive === undefined ? MOCK_WORK_TASKS : MOCK_WORK_TASKS.filter((t) => t.isActive === (isActive === 'true' || isActive === true));
    return { status: 200, data: envelope(list, { page: 1, limit: list.length, totalCount: list.length }) };
  }

  // ===== Customers (docs/khach_hang_api.md) =====
  if (m === 'GET' && path === '/customers') {
    const statusFilter = params.status as AdminCustomer['status'] | undefined;
    const search = (params.search as string | undefined)?.trim().toLowerCase();
    const all = getAdminCustomers();
    const filtered = all.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!search) return true;
      return (
        c.customerName.toLowerCase().includes(search) ||
        c.customerId.toLowerCase().includes(search) ||
        c.phone.includes(search) ||
        c.email.toLowerCase().includes(search)
      );
    });
    const page = (params.page as number) || 1;
    const limit = (params.limit as number) || 10;
    const { data } = paginate(filtered, page, limit);
    return {
      status: 200,
      data: {
        success: true,
        code: 'MOCK-OK',
        message: 'Thao tác thành công (dữ liệu mô phỏng)',
        data: data.map(mapCustomerToApi),
        meta: {
          page,
          limit,
          totalItems: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          counts: {
            all: all.length,
            active: all.filter((c) => c.status === 'active').length,
            inactive: all.filter((c) => c.status === 'inactive').length,
          },
        },
      },
    };
  }
  if (m === 'POST' && path === '/customers') {
    const payload = body as CreateCustomerPayload;
    const created: AdminCustomer = {
      customerId: nextAdminCustomerId(),
      customerName: payload.customerName,
      phone: payload.phone,
      email: payload.email ?? '',
      address: payload.address ?? '',
      notes: payload.notes ?? '',
      status: payload.status ?? 'active',
      totalBookings: 0,
      totalSpent: 0,
    };
    addAdminCustomer(created);
    return { status: 201, data: envelope(mapCustomerToApi(created)) };
  }
  {
    const summaryParams = matchPath('/customers/:customerId/summary', path);
    if (m === 'GET' && summaryParams) {
      const detail = getAdminCustomerDetail(summaryParams.customerId);
      if (!detail) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy khách hàng' } };
      const summary: CustomerSummary = {
        customer: mapCustomerToApi(detail.customer),
        createdAt: detail.createdAt,
        totalValue: detail.totalValue,
        paidAmount: detail.paidAmount,
        remainingDebt: detail.remainingDebt,
        paymentRate: detail.paymentRate,
        activeOrdersCount: detail.activeOrdersCount,
      };
      return { status: 200, data: envelope(summary) };
    }
  }
  {
    const ordersParams = matchPath('/customers/:customerId/orders', path);
    if (m === 'GET' && ordersParams) {
      const detail = getAdminCustomerDetail(ordersParams.customerId);
      if (!detail) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy khách hàng' } };
      const search = (params.search as string | undefined)?.trim().toLowerCase();
      const status = params.status as string | undefined;
      const serviceFilter = params.serviceFilter as string | undefined;
      const filtered = detail.orders.filter((o) => {
        if (status && o.status !== status) return false;
        if (serviceFilter && serviceFilter !== 'all') {
          if (serviceFilter === 'wedding' && !/(cưới|đính hôn)/i.test(o.event)) return false;
          if (serviceFilter === 'corporate' && !/(hội nghị|kỷ niệm|gala)/i.test(o.event)) return false;
        }
        if (!search) return true;
        return o.id.toLowerCase().includes(search) || o.event.toLowerCase().includes(search);
      });
      const page = (params.page as number) || 1;
      const limit = (params.limit as number) || 6;
      const mapped: CustomerOrderSummary[] = filtered.map((o) => ({
        orderId: o.id,
        event: o.event,
        date: o.date,
        value: o.value,
        status: o.status,
        coordinator: o.coordinator,
      }));
      const { data } = paginate(mapped, page, limit);
      return {
        status: 200,
        data: {
          success: true,
          code: 'MOCK-OK',
          message: 'Thao tác thành công (dữ liệu mô phỏng)',
          data,
          meta: { page, limit, totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
        },
      };
    }
  }
  {
    const customerIdParams = matchPath('/customers/:customerId', path);
    if (customerIdParams) {
      const found = getAdminCustomerById(customerIdParams.customerId);
      if (m === 'GET') {
        if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy khách hàng' } };
        return { status: 200, data: envelope(mapCustomerToApi(found)) };
      }
      if (m === 'PUT') {
        if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy khách hàng' } };
        const payload = body as UpdateCustomerPayload;
        updateAdminCustomer(customerIdParams.customerId, {
          customerName: payload.customerName,
          phone: payload.phone,
          email: payload.email ?? '',
          address: payload.address ?? '',
          notes: payload.notes ?? '',
          status: payload.status,
        });
        return { status: 200, data: envelope(mapCustomerToApi(getAdminCustomerById(customerIdParams.customerId)!)) };
      }
      if (m === 'DELETE') {
        if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy khách hàng' } };
        if (getOrdersByCustomerId(customerIdParams.customerId).length > 0) {
          return { status: 409, data: { success: false, code: 'MOCK-409', message: 'Không thể xóa khách hàng đã có đơn hàng' } };
        }
        deleteAdminCustomer(customerIdParams.customerId);
        return { status: 200, data: envelope({ customerId: customerIdParams.customerId }) };
      }
    }
  }

  // ===== Orders =====
  // GET/POST/PUT dưới đây đọc và GHI THẲNG vào src/mocks/db/orders.ts — đơn tạo qua CreateOrderModal
  // (services/order.service.ts) sẽ xuất hiện thật trong danh sách /admin/orders_audit và
  // /manager/orders (cùng 1 store, không phải 2 nguồn dữ liệu song song).
  if (m === 'GET' && path === '/orders') {
    const mapped = getAdminOrders().map(mapOrderToApi);
    const { data, meta } = paginate(mapped, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }
  if (m === 'POST' && path === '/orders') {
    const payload = body as {
      customerId: string;
      eventDate: string;
      location: string;
      guestCount?: number;
      items: { itemId: string; quantity: number; unitPrice: number }[];
    };
    const customer = getAdminCustomers().find((c) => c.customerId === payload.customerId);
    const orderId = nextAdminOrderId();
    const totalPrice = payload.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const catalogItems = getCatalogItemsAsApiItems();
    const items = payload.items.map((i, idx) => {
      const catalogItem = catalogItems.find((ci) => ci.itemId === i.itemId);
      return {
        id: `${orderId}-${idx + 1}`,
        category: catalogItem?.typeName ?? 'Khác',
        description: catalogItem?.itemName ?? i.itemId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        status: 'pending' as const,
        source: 'internal' as const,
        preparedQty: 0,
        preparedBy: '',
      };
    });
    addAdminOrder({
      orderId,
      customerId: payload.customerId,
      customerName: customer?.customerName ?? 'Khách hàng mới',
      customerPhone: customer?.phone ?? '',
      weddingDate: payload.eventDate.slice(0, 10),
      weddingEndDate: payload.eventDate.slice(0, 10),
      venue: payload.location,
      guestCount: payload.guestCount ?? 0,
      totalPrice,
      depositAmount: 0,
      status: 'NEW',
      paymentStatus: 'UNPAID',
      coordinatorName: 'Trưởng phòng vận hành',
      packageType: '',
      notes: '',
      checklist: [],
      items: items.length > 0 ? items : buildOrderItems(orderId, totalPrice, payload.location, 'NEW'),
      liveChecklist: {},
      disputeLogs: [],
    });
    return { status: 201, data: envelope({ orderId, orderCode: orderId }, undefined, 'Tạo đơn hàng thành công (dữ liệu mô phỏng)') };
  }
  {
    const params1 = matchPath('/orders/:id/status', path);
    if (m === 'PUT' && params1) {
      const payload = body as { orderStatus?: OrderStatus; cancelReason?: string };
      const existing = getAdminOrderById(params1.id);
      if (existing && payload.orderStatus) {
        updateAdminOrder(params1.id, { status: payload.orderStatus as AdminOrderRow['status'] });
      }
      return { status: 200, data: envelope({ orderId: params1.id, ...payload }, undefined, 'Cập nhật trạng thái đơn hàng thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const surveyReportsParams = matchPath('/orders/:orderId/survey-reports', path);
    if (m === 'GET' && surveyReportsParams) {
      const list = MOCK_SURVEY_REPORTS.filter((r) => r.orderId === surveyReportsParams.orderId);
      return { status: 200, data: envelope(list, { page: 1, limit: list.length || 1, totalCount: list.length }) };
    }
  }

  // ===== Inventory =====
  if (m === 'GET' && path === '/inventory') {
    const rows = inventoryFromItems();
    const { data, meta } = paginate(rows, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }

  // ===== Catalog: categories =====
  if (m === 'GET' && path === '/catalog/categories') {
    const search = (params.search as string | undefined)?.toLowerCase();
    const list = search ? MOCK_CATEGORIES.filter((c) => c.categoryName.toLowerCase().includes(search)) : MOCK_CATEGORIES;
    const { data, meta } = paginate(list, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }
  if (m === 'POST' && path === '/catalog/categories') {
    const payload = body as { categoryName: string; description?: string };
    const created: ItemCategory = { categoryId: nextId('cat'), categoryName: payload.categoryName, description: payload.description };
    MOCK_CATEGORIES.push(created);
    return { status: 201, data: envelope(created, undefined, 'Tạo danh mục thành công (dữ liệu mô phỏng)') };
  }
  {
    const catIdParams = matchPath('/catalog/categories/:id', path);
    if (m === 'GET' && catIdParams) {
      const found = MOCK_CATEGORIES.find((c) => c.categoryId === catIdParams.id);
      if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy danh mục' } };
      return { status: 200, data: envelope(found) };
    }
    if (m === 'PUT' && catIdParams) {
      const payload = body as { categoryName: string; description?: string };
      const idx = MOCK_CATEGORIES.findIndex((c) => c.categoryId === catIdParams.id);
      if (idx >= 0) MOCK_CATEGORIES[idx] = { ...MOCK_CATEGORIES[idx], ...payload };
      return { status: 200, data: envelope(MOCK_CATEGORIES[idx] ?? { categoryId: catIdParams.id, ...payload }, undefined, 'Cập nhật danh mục thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Catalog: types =====
  if (m === 'GET' && path === '/catalog/types') {
    const categoryId = params.categoryId as string | undefined;
    const list = categoryId ? MOCK_TYPES.filter((t) => t.categoryId === categoryId) : MOCK_TYPES;
    const { data, meta } = paginate(list, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }

  // ===== Catalog: items =====
  if (m === 'GET' && path === '/catalog/items') {
    const search = (params.search as string | undefined)?.toLowerCase();
    const typeId = params.typeId as string | undefined;
    let list = getCatalogItemsAsApiItems();
    if (search) list = list.filter((i) => i.itemName.toLowerCase().includes(search));
    if (typeId) list = list.filter((i) => i.typeId === typeId);
    const { data, meta } = paginate(list, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }

  // ===== Quotations =====
  // GET /quotations: theo docs/danhsachbaogia_api.md — Hướng A đã chốt (bỏ trạng thái 'surveying' khỏi
  // màn danh sách, đây là trạng thái Order-đang-khảo-sát-chưa-có-báo-giá, không phải Quotation thật).
  if (m === 'GET' && path === '/quotations') {
    const realRows = getAdminQuotations().filter((r) => r.status !== 'surveying');
    let mapped: QuotationListItem[] = realRows.map((r) => ({
      quotationId: r.quotationId,
      code: r.code,
      customerId: r.customerId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      version: `v${r.version}`,
      subtotal: r.subtotal,
      discount: r.discount,
      totalAmount: r.totalAmount,
      status: r.status as QuotationListStatus,
      createdAt: r.createdAt,
    }));
    const counts = {
      all: mapped.length,
      draft: mapped.filter((r) => r.status === 'draft').length,
      approved: mapped.filter((r) => r.status === 'approved').length,
      rejected: mapped.filter((r) => r.status === 'rejected').length,
      approvedValue: mapped.filter((r) => r.status === 'approved').reduce((sum, r) => sum + r.totalAmount, 0),
    };
    if (params.status) mapped = mapped.filter((r) => r.status === params.status);
    if (params.customerId) mapped = mapped.filter((r) => r.customerId === params.customerId);
    if (params.search) {
      const term = String(params.search).toLowerCase();
      mapped = mapped.filter((r) => r.code.toLowerCase().includes(term) || r.customerName.toLowerCase().includes(term));
    }
    const page = (params.page as number) || 1;
    const limit = (params.limit as number) || 10;
    const { data } = paginate(mapped, page, limit);
    return {
      status: 200,
      data: {
        success: true,
        code: 'MOCK-OK',
        message: 'Thao tác thành công (dữ liệu mô phỏng)',
        data,
        meta: { page, limit, totalItems: mapped.length, totalPages: Math.max(1, Math.ceil(mapped.length / limit)), counts },
      },
    };
  }
  {
    const quotationsParams = matchPath('/customers/:customerId/quotations', path);
    if (m === 'POST' && quotationsParams) {
      const quotationId = nextId('quotation');
      return { status: 201, data: envelope({ quotationId, quotationCode: `BG-MOCK-${mockIdSeq}` }, undefined, 'Tạo báo giá thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const quotationIdParams = matchPath('/quotations/:id', path);
    if (m === 'PUT' && quotationIdParams) {
      return { status: 200, data: envelope({ quotationId: quotationIdParams.id }, undefined, 'Cập nhật báo giá thành công (dữ liệu mô phỏng)') };
    }
    if (m === 'DELETE' && quotationIdParams) {
      return { status: 200, data: envelope(null, undefined, 'Xóa báo giá thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const quotationStatusParams = matchPath('/quotations/:id/status', path);
    if (m === 'PATCH' && quotationStatusParams) {
      return { status: 200, data: envelope({ quotationId: quotationStatusParams.id, ...(body as object) }, undefined, 'Cập nhật trạng thái báo giá thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Payments (deposits) =====
  // Ghi thật vào src/mocks/db/payments.ts (DEMO_CHECKLIST.md Task 19) — trước đây chỉ echo id giả,
  // không có store thật đứng sau. Cùng 1 store với trang "Đặt cọc & Thanh toán".
  {
    const depositsParams = matchPath('/orders/:orderId/deposits', path);
    if (m === 'POST' && depositsParams) {
      const payload = (body as { amount?: number; paymentMethod?: string; notes?: string }) ?? {};
      const deposit = createDepositForMockRoute(depositsParams.orderId, payload.amount ?? 0, payload.paymentMethod ?? 'cash', payload.notes);
      return { status: 201, data: envelope({ depositId: deposit.depositId, depositCode: deposit.depositCode, orderId: deposit.orderId }, undefined, 'Ghi nhận tiền cọc thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const depositIdParams = matchPath('/deposits/:depositId', path);
    if (m === 'PUT' && depositIdParams) {
      const payload = (body as { status?: string }) ?? {};
      markDepositStatusForMockRoute(depositIdParams.depositId, payload.status === 'SUCCESS' ? 'RECEIVED' : 'PENDING');
      return { status: 200, data: envelope({ depositId: depositIdParams.depositId, ...(body as object) }, undefined, 'Cập nhật trạng thái cọc thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Settlement =====
  {
    const settlementParams = matchPath('/orders/:orderId/settlement', path);
    if (m === 'POST' && settlementParams) {
      const payload = (body as { additionalFee?: number; compensation?: number; paymentMethod?: string; notes?: string }) ?? {};
      confirmSettlement(settlementParams.orderId, {
        additionalFee: payload.additionalFee,
        compensation: payload.compensation,
        paymentMethod: payload.paymentMethod,
        note: payload.notes,
      });
      const settlementId = nextId('settlement');
      return { status: 201, data: envelope({ settlementId, orderId: settlementParams.orderId }, undefined, 'Ghi nhận quyết toán thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Change requests (UC 2.27) =====
  // Backend thật (D:\sep490-backend-api) đã có route GET /change-requests, POST
  // /orders/:orderId/change-requests, PUT /change-requests/:id/approve (docs/more-require.md mục
  // (an)) — không cần mock nữa, để rơi vào fallback chung bên dưới nếu NEXT_PUBLIC_MOCK_MODE=true.

  // ===== Schedule plans =====
  if (m === 'GET' && path === '/schedule-plans') {
    const orderId = params.orderId as string | undefined;
    const assignedTo = params.assignedTo as string | undefined;
    const status = params.status as string | undefined;
    let list = MOCK_SCHEDULE_PLANS;
    if (orderId) list = list.filter((p) => p.orderId === orderId);
    if (assignedTo) list = list.filter((p) => p.assignedTo === assignedTo);
    if (status) list = list.filter((p) => p.status === status);
    const { data, meta } = paginate(list, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }
  if (m === 'POST' && path === '/schedule-plans') {
    const planId = nextId('plan');
    return { status: 201, data: envelope({ planId, planCode: `KH-MOCK-${mockIdSeq}` }, undefined, 'Tạo kế hoạch thành công (dữ liệu mô phỏng)') };
  }
  {
    const planIdParams = matchPath('/schedule-plans/:planId', path);
    if (m === 'PUT' && planIdParams) {
      return { status: 200, data: envelope({ planId: planIdParams.planId, ...(body as object) }, undefined, 'Cập nhật kế hoạch thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const planStatusParams = matchPath('/schedule-plans/:planId/status', path);
    if (m === 'PATCH' && planStatusParams) {
      return { status: 200, data: envelope({ planId: planStatusParams.planId, ...(body as object) }, undefined, 'Cập nhật trạng thái kế hoạch thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Suppliers =====
  if (m === 'POST' && path === '/suppliers') {
    const supplierId = nextId('supplier');
    return { status: 201, data: envelope({ supplierId, ...(body as object) }, undefined, 'Thêm nhà cung cấp thành công (dữ liệu mô phỏng)') };
  }

  // ===== Supplier transactions (procurement) =====
  if (m === 'GET' && path === '/supplier-transactions') {
    let list = MOCK_SUPPLIER_TRANSACTIONS;
    if (params.supplierId) list = list.filter((t) => t.supplierId === params.supplierId);
    if (params.paymentStatus) list = list.filter((t) => t.paymentStatus === params.paymentStatus);
    if (params.status) list = list.filter((t) => t.status === params.status);
    const { data, meta } = paginate(list, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }
  if (m === 'POST' && path === '/supplier-transactions') {
    const payload = body as {
      supplierId: string;
      orderId: string;
      transactionType: 'RENTAL' | 'PURCHASE';
      serviceTitle: string;
      depositAmount?: number;
      items: { itemId?: string; itemName: string; quantity: number; unitCost: number; notes?: string }[];
    };
    const transactionId = nextId('txn');
    const estimatedCost = payload.items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
    MOCK_SUPPLIER_TRANSACTIONS.push({
      transactionId,
      transactionCode: `PT-MOCK-${mockIdSeq}`,
      supplierId: payload.supplierId,
      orderId: payload.orderId,
      transactionType: payload.transactionType,
      serviceTitle: payload.serviceTitle,
      estimatedCost,
      depositAmount: payload.depositAmount ?? 0,
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      items: payload.items.map((i, idx) => ({ stItemId: `${transactionId}-${idx + 1}`, itemId: i.itemId, itemName: i.itemName, quantity: i.quantity, unitCost: i.unitCost, subtotal: i.unitCost * i.quantity, receivedQuantity: 0, notes: i.notes })),
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    });
    return { status: 201, data: envelope({ transactionId, ...(body as object) }, undefined, 'Khởi tạo đơn mua sắm thành công (dữ liệu mô phỏng)') };
  }
  {
    const txnIdParams = matchPath('/supplier-transactions/:id', path);
    if (m === 'GET' && txnIdParams) {
      const found = MOCK_SUPPLIER_TRANSACTIONS.find((t) => t.transactionId === txnIdParams.id);
      if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy đơn mua sắm' } };
      return { status: 200, data: envelope(found) };
    }
  }
  {
    const txnStatusParams = matchPath('/supplier-transactions/:id/status', path);
    if (m === 'PATCH' && txnStatusParams) {
      const idx = MOCK_SUPPLIER_TRANSACTIONS.findIndex((t) => t.transactionId === txnStatusParams.id);
      if (idx >= 0) MOCK_SUPPLIER_TRANSACTIONS[idx] = { ...MOCK_SUPPLIER_TRANSACTIONS[idx], ...(body as object), updatedAt: FIXED_TIMESTAMP };
      return { status: 200, data: envelope(MOCK_SUPPLIER_TRANSACTIONS[idx] ?? { transactionId: txnStatusParams.id, ...(body as object) }, undefined, 'Cập nhật trạng thái đơn mua sắm thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const txnPaymentParams = matchPath('/supplier-transactions/:id/payment-status', path);
    if (m === 'PATCH' && txnPaymentParams) {
      const idx = MOCK_SUPPLIER_TRANSACTIONS.findIndex((t) => t.transactionId === txnPaymentParams.id);
      if (idx >= 0) MOCK_SUPPLIER_TRANSACTIONS[idx] = { ...MOCK_SUPPLIER_TRANSACTIONS[idx], ...(body as object), updatedAt: FIXED_TIMESTAMP };
      return { status: 200, data: envelope(MOCK_SUPPLIER_TRANSACTIONS[idx] ?? { transactionId: txnPaymentParams.id, ...(body as object) }, undefined, 'Cập nhật trạng thái thanh toán thành công (dữ liệu mô phỏng)') };
    }
  }
  {
    const txnReceiveParams = matchPath('/supplier-transactions/:id/receive', path);
    if (m === 'POST' && txnReceiveParams) {
      const payload = body as { items: { stItemId: string; receivedQuantity: number }[] };
      const txn = MOCK_SUPPLIER_TRANSACTIONS.find((t) => t.transactionId === txnReceiveParams.id);
      if (txn?.items) {
        for (const received of payload.items) {
          const item = txn.items.find((i) => i.stItemId === received.stItemId);
          if (item) item.receivedQuantity = received.receivedQuantity;
        }
        txn.updatedAt = FIXED_TIMESTAMP;
      }
      return { status: 200, data: envelope(txn ?? { transactionId: txnReceiveParams.id }, undefined, 'Ghi nhận nhận hàng thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Policies =====
  if (m === 'GET' && path === '/policies') {
    let list = MOCK_POLICIES;
    if (params.policyType) list = list.filter((p) => p.policyType === params.policyType);
    if (params.isActive !== undefined) list = list.filter((p) => p.isActive === (params.isActive === 'true' || params.isActive === true));
    const search = (params.search as string | undefined)?.trim().toLowerCase();
    if (search) list = list.filter((p) => p.policyName.toLowerCase().includes(search) || p.policyCode.toLowerCase().includes(search));
    // page/limit optional (docs/admin_chinhsach_api.md mục 6.4) — không truyền thì trả nguyên danh sách
    // đã lọc trong 1 "trang" duy nhất, giữ tương thích ngược với chỗ gọi không phân trang (vd
    // quotations/[id]/page.tsx lấy toàn bộ chính sách active để hiển thị điều khoản chung).
    const { data, meta } =
      params.page || params.limit
        ? paginate(list, params.page as number, params.limit as number)
        : { data: list, meta: { page: 1, limit: list.length || 1, totalCount: list.length } };
    return { status: 200, data: envelope(data, meta) };
  }
  if (m === 'POST' && path === '/policies') {
    const payload = body as { policyCode: string; policyName: string; policyType: PolicyType; policyValue: number; unit: string; description?: string };
    const created = { policyId: nextId('policy'), isActive: true, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP, ...payload };
    MOCK_POLICIES.push(created);
    return { status: 201, data: envelope(created, undefined, 'Tạo chính sách thành công (dữ liệu mô phỏng)') };
  }
  {
    const policyIdParams = matchPath('/policies/:id', path);
    if (m === 'PUT' && policyIdParams) {
      const idx = MOCK_POLICIES.findIndex((p) => p.policyId === policyIdParams.id);
      if (idx >= 0) MOCK_POLICIES[idx] = { ...MOCK_POLICIES[idx], ...(body as object), updatedAt: FIXED_TIMESTAMP };
      return { status: 200, data: envelope(MOCK_POLICIES[idx] ?? { policyId: policyIdParams.id, ...(body as object) }, undefined, 'Cập nhật chính sách thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Wages =====
  if (m === 'GET' && path === '/wages') {
    let list = MOCK_WAGES;
    if (params.period) list = list.filter((w) => w.createdAt.startsWith(params.period as string));
    if (params.userId) list = list.filter((w) => w.userId === params.userId);
    if (params.status) list = list.filter((w) => w.status === params.status);
    const { data, meta } = paginate(list, params.page as number, params.limit as number);
    return { status: 200, data: envelope(data, meta) };
  }
  {
    const wageConfirmParams = matchPath('/wages/:id/confirm', path);
    if (m === 'POST' && wageConfirmParams) {
      const idx = MOCK_WAGES.findIndex((w) => w.wageId === wageConfirmParams.id);
      const user = currentAuthUser();
      if (idx >= 0) MOCK_WAGES[idx] = { ...MOCK_WAGES[idx], status: 'CONFIRMED', confirmedBy: user?.userId ?? 'mock-manager-1', confirmedAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP };
      return { status: 200, data: envelope(MOCK_WAGES[idx] ?? { wageId: wageConfirmParams.id, status: 'CONFIRMED' }, undefined, 'Xác nhận tiền công thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Evidence =====
  {
    const evidenceIdParams = matchPath('/evidence/:id', path);
    if (m === 'GET' && evidenceIdParams) {
      const found = MOCK_EVIDENCE.find((e) => e.evidenceId === evidenceIdParams.id);
      if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy ảnh minh chứng' } };
      return { status: 200, data: envelope(found) };
    }
  }
  if (m === 'POST' && path === '/evidence/upload') {
    const user = currentAuthUser();
    const created = { evidenceId: nextId('evidence'), fileUrl: `https://picsum.photos/seed/${nextId('seed')}/800/600`, uploadedBy: user?.userId ?? 'mock-user', createdAt: FIXED_TIMESTAMP };
    MOCK_EVIDENCE.push(created);
    return { status: 201, data: envelope(created, undefined, 'Tải ảnh minh chứng thành công (dữ liệu mô phỏng)') };
  }

  // ===== Attendance (mobile Leader/Technical Staff — ngoài phạm vi web, giữ lại để dữ liệu hiện
  // trường hiển thị đúng khi cần, xem CLAUDE.md mục 1) =====
  if (m === 'POST' && path === '/attendance/check-in') {
    const payload = body as { planId: string; checkInEvidenceId?: string; checkInAt: string };
    const user = currentAuthUser();
    const created = { attendanceId: nextId('attendance'), planId: payload.planId, userId: user?.userId ?? 'mock-user', checkInAt: payload.checkInAt, checkInEvidenceId: payload.checkInEvidenceId, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP };
    return { status: 201, data: envelope(created, undefined, 'Check-in thành công (dữ liệu mô phỏng)') };
  }
  {
    const checkOutParams = matchPath('/attendance/:id/check-out', path);
    if (m === 'PUT' && checkOutParams) {
      const payload = body as { checkOutAt: string; note?: string };
      return { status: 200, data: envelope({ attendanceId: checkOutParams.id, checkOutAt: payload.checkOutAt, note: payload.note }, undefined, 'Check-out thành công (dữ liệu mô phỏng)') };
    }
  }

  // ===== Reports (Admin/Manager) =====
  if (m === 'GET' && path === '/dashboard/admin') {
    const orders = getAdminOrders();
    return {
      status: 200,
      data: envelope({
        activeOrders: orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PROGRESS').length,
        totalRevenueMonth: orders.filter((o) => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.totalPrice, 0),
        unpaidSupplierDebt: MOCK_SUPPLIER_TRANSACTIONS.filter((t) => t.paymentStatus !== 'PAID').reduce((sum, t) => sum + (t.estimatedCost - t.depositAmount), 0),
        recentOrders: orders.slice(0, 5).map((o) => ({ orderId: o.orderId, orderStatus: o.status, eventName: `Lễ cưới ${o.customerName}` })),
      }),
    };
  }
  if (m === 'GET' && path === '/dashboard/manager') {
    const unresolvedWarnings = MOCK_ORDER_WARNINGS.filter((w) => !w.isResolved);
    return {
      status: 200,
      data: envelope({
        ordersInProgress: getAdminOrders().filter((o) => o.status === 'IN_PROGRESS').length,
        pendingWarnings: unresolvedWarnings.length,
        tasksToday: MOCK_SCHEDULE_PLANS.filter((p) => p.status === 'CONFIRMED' || p.status === 'IN_PROGRESS').length,
        alerts: unresolvedWarnings.map((w) => ({ type: 'warning' as const, warningId: w.warningId, content: w.content })),
      }),
    };
  }
  if (m === 'GET' && path === '/reports/revenue') {
    const startDate = params.startDate as string;
    const endDate = params.endDate as string;
    const inRange = getAdminOrders().filter((o) => o.weddingDate >= startDate && o.weddingDate <= endDate && o.paymentStatus === 'PAID');
    return {
      status: 200,
      // breakdownByMonth/topCustomers luôn rỗng — khớp hành vi backend thật hiện tại (chưa implement
      // group-by), xem ghi chú trong types/report.ts.
      data: envelope({ totalRevenue: inRange.reduce((sum, o) => sum + o.totalPrice, 0), breakdownByMonth: [], topCustomers: [] }),
    };
  }
  if (m === 'GET' && path === '/reports/inventory') {
    const rows = inventoryFromItems();
    return {
      status: 200,
      // mostUsedItems luôn rỗng — khớp hành vi backend thật hiện tại (chưa implement).
      data: envelope({ totalDamaged: rows.reduce((sum, r) => sum + r.quantityDamaged, 0), totalLost: 0, mostUsedItems: [] }),
    };
  }
  if (m === 'GET' && path === '/reports/verification') {
    const orderId = params.orderId as string;
    const plans = MOCK_SCHEDULE_PLANS.filter((p) => p.orderId === orderId);
    const tasksCompleted = plans.filter((p) => p.status === 'COMPLETED').length;
    return {
      status: 200,
      data: envelope({
        orderId,
        tasksCompleted,
        totalTasks: plans.length,
        // hardcode true — khớp hành vi backend thật hiện tại (chưa thật sự kiểm tra), xem types/report.ts.
        warningsResolved: true,
        damageLossRecorded: true,
        verificationStatus: plans.length > 0 && tasksCompleted === plans.length ? 'ready_for_settlement' : 'pending',
      }),
    };
  }
  if (m === 'GET' && path === '/manager/approvals') {
    return {
      status: 200,
      data: envelope({
        orderWarnings: MOCK_ORDER_WARNINGS.filter((w) => !w.isResolved).map((w) => ({ warningId: w.warningId, orderId: w.orderId, content: w.content, isResolved: w.isResolved, createdAt: w.createdAt })),
        surveyReports: MOCK_SURVEY_REPORTS.filter((r) => r.status === 'SUBMITTED').map((r) => ({ surveyId: r.surveyId, orderId: r.orderId, status: r.status, location: r.location, surveyDate: r.surveyDate })),
      }),
    };
  }

  // ===== Mobile field ops (Leader/Technical Staff — ngoài phạm vi web, giữ lại để dữ liệu hiện
  // trường hiển thị đúng khi cần, xem CLAUDE.md mục 1) =====
  if (m === 'GET' && path === '/mobile/schedule-plans') {
    const user = currentAuthUser();
    let list = MOCK_SCHEDULE_PLANS.filter((p) => p.assignedTo === user?.userId);
    if (params.status) list = list.filter((p) => p.status === params.status);
    if (params.date) list = list.filter((p) => p.startTime.startsWith(params.date as string));
    return { status: 200, data: envelope(list, { page: 1, limit: list.length || 1, totalCount: list.length }) };
  }
  {
    const mobileOrderParams = matchPath('/mobile/orders/:id', path);
    if (m === 'GET' && mobileOrderParams) {
      const found = getAdminOrderById(mobileOrderParams.id);
      if (!found) return { status: 404, data: { success: false, code: 'MOCK-404', message: 'Không tìm thấy đơn hàng' } };
      return { status: 200, data: envelope({ ...mapOrderToApi(found), items: found.items }) };
    }
  }

  // ===== Fallback: unmapped route =====
  // GET không xác định -> danh sách rỗng để UI hiển thị trạng thái "chưa có dữ liệu" thay vì crash.
  if (m === 'GET') {
    return { status: 200, data: envelope([], { page: 1, limit: 20, totalCount: 0 }) };
  }
  // Mutation không xác định -> coi như thành công chung, kèm id giả cho mọi field *Id hay gặp để
  // các bước tiếp theo (nếu có đọc lại id) không bị undefined.
  const genericId = nextId('entity');
  const idAliases = [
    'id', 'orderId', 'quotationId', 'depositId', 'settlementId', 'planId', 'supplierId',
    'transactionId', 'categoryId', 'itemId', 'typeId', 'customerId', 'userId',
  ];
  const idEcho = Object.fromEntries(idAliases.map((k) => [k, genericId]));
  return { status: 200, data: envelope({ ...idEcho, ...(typeof body === 'object' && body ? body : {}) }) };
}

const mockAdapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
  const method = config.method ?? 'get';
  const path = (config.url ?? '').split('?')[0];
  const params = (config.params ?? {}) as Record<string, unknown>;
  let body: unknown = undefined;
  if (typeof config.data === 'string') {
    try {
      body = JSON.parse(config.data);
    } catch {
      body = undefined;
    }
  } else if (config.data && typeof config.data === 'object') {
    body = config.data;
  }

  const result = resolve(method, path, params, body);
  const headers = new AxiosHeaders();

  const response: AxiosResponse = {
    data: result.data,
    status: result.status,
    statusText: result.status < 400 ? 'OK' : 'Error',
    headers: headers as unknown as AxiosResponseHeaders,
    config,
  };

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (result.status >= 400) {
        const error = new Error('Mock API error') as Error & {
          isAxiosError: boolean;
          response: AxiosResponse;
          config: InternalAxiosRequestConfig;
        };
        error.isAxiosError = true;
        error.response = response;
        error.config = config;
        reject(error);
        return;
      }
      resolve(response);
    }, 200);
  });
};

export default mockAdapter;
