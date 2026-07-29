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
   * POST /api/v1/orders/{id}/export-equipment — xuất thiết bị theo đơn (transaction trừ kho + movement
   * OUTBOUND + set picked_up_at), docs/xuatthietbi_tubaogia_api.md mục 4. Lỗi cần xử lý riêng ở UI:
   * 409 đã xuất trước đó, 400 thiếu tồn kho (details.items: ExportEquipmentShortageItem[]).
   */
  async exportEquipment(id: string, payload: ExportEquipmentPayload = {}) {
    const response = await api.post<{ data: ExportEquipmentResult }>(`/orders/${id}/export-equipment`, payload);
    return response.data;
  },
};
