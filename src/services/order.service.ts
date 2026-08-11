import api from './api';
import type {
  CloseOrderPayload,
  CreateOrderPayload,
  ExportEquipmentPayload,
  ExportEquipmentResult,
  Order,
  OrderListMeta,
  UpdateLiveChecklistPayload,
  UpdateOrderQuotationPayload,
  UpdateOrderStatusPayload,
  UpdateOrderItemsPayload,
} from '@/types/order';
import type { ApiEnvelope } from './customer.service';

export interface GetOrdersQuery {
  page?: number;
  limit?: number;
  orderStatus?: string;
  paymentStatus?: string;
  search?: string;
}

export const orderApiService = {
  /** GET /api/v1/orders */
  async getOrders(params?: GetOrdersQuery) {
    const response = await api.get<ApiEnvelope<Order[], OrderListMeta>>('/orders', { params });
    return response.data;
  },

  /** GET /api/v1/orders/{id} — kèm orderItems/orderWarnings/deposits/settlements */
  async getOrder(id: string) {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  /** POST /api/v1/orders — trả về {orderId, orderCode}, không trả full object */
  async createOrder(payload: CreateOrderPayload) {
    const response = await api.post('/orders', payload);
    return response.data;
  },

  /** PUT /api/v1/orders/{id}/status — dùng chung cho mọi chuyển trạng thái, kể cả hủy đơn */
  async updateOrderStatus(id: string, payload: UpdateOrderStatusPayload) {
    const response = await api.put(`/orders/${id}/status`, payload);
    return response.data;
  },

  /** PUT /api/v1/orders/{id}/items — thay TOÀN BỘ danh sách item */
  async updateOrderItems(id: string, payload: UpdateOrderItemsPayload) {
    const response = await api.put(`/orders/${id}/items`, payload);
    return response.data;
  },

  /** PUT /api/v1/orders/{id}/dates — đổi ngày sự kiện (đơn đã chốt tự dời cửa sổ giữ chỗ, 409 nếu thiếu). */
  async updateOrderDates(id: string, payload: { eventDate: string; endDate?: string }) {
    const response = await api.put(`/orders/${id}/dates`, payload);
    return response.data;
  },

  /** PUT /api/v1/orders/{id}/picklist/picked-up — đánh dấu đơn đã xuất kho (set orders.picked_up_at).
   *  Backend chặn nếu đã xuất kho rồi hoặc chưa chuẩn bị đủ (preparedQty < quantity). */
  async markPicklistPickedUp(id: string) {
    const response = await api.put(`/orders/${id}/picklist/picked-up`);
    return response.data;
  },

  /** PUT /api/v1/orders/{id}/items/confirm-prepared — ghi nhận số lượng đã chuẩn bị cho từng order_item
   *  (điều kiện tiên quyết của bước "Đánh dấu xuất kho": cần preparedQty >= quantity mọi dòng).
   *  Backend đã hoạt động đúng — xác nhận qua test E2E 2026-08-11. */
  async confirmPreparedItems(id: string, payload: { items: { orderItemId: string; preparedQty: number }[] }) {
    const response = await api.put(`/orders/${id}/items/confirm-prepared`, payload);
    return response.data;
  },

  /** PATCH /api/v1/orders/{id}/live-checklist — trả lại object checklist đầy đủ mới nhất */
  async updateLiveChecklist(id: string, payload: UpdateLiveChecklistPayload) {
    const response = await api.patch(`/orders/${id}/live-checklist`, payload);
    return response.data;
  },

  /** PUT /api/v1/orders/{id}/close — backend chặn 400 nếu chưa COMPLETED+PAID hoặc đã đóng rồi */
  async closeOrder(id: string, payload: CloseOrderPayload = {}) {
    const response = await api.put(`/orders/${id}/close`, payload);
    return response.data;
  },

  /** PATCH /api/v1/orders/{id}/quotation — liên kết/hủy liên kết báo giá, xác nhận hoạt động thật qua curl */
  async updateOrderQuotation(id: string, payload: UpdateOrderQuotationPayload) {
    const response = await api.patch(`/orders/${id}/quotation`, payload);
    return response.data;
  },

  /**
   * POST /api/v1/orders/{id}/export-equipment — đồng bộ order_items theo quotation_items của báo giá
   * liên kết, KHÔNG đụng tồn kho thật (docs/xuatthietbi_tubaogia_api.md mục 8, CLAUDE.md mục "Xuất
   * thiết bị"). Lỗi cần xử lý riêng ở UI: 404 đơn không tồn tại, 409 đơn đã kết thúc/chưa liên kết
   * báo giá, 403 không phải Manager.
   */
  async exportEquipment(id: string, payload: ExportEquipmentPayload = {}) {
    const response = await api.post<{ data: ExportEquipmentResult }>(`/orders/${id}/export-equipment`, payload);
    return response.data;
  },
};
