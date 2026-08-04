import api from './api';
import type { CreateOrderDepositPayload, Deposit, DepositStatus, UpdateDepositStatusPayload } from '@/types/payment';

export interface GetDepositsQuery {
  status?: DepositStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DepositListItem extends Deposit {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  eventName: string;
}

export interface DepositListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const paymentApiService = {
  /**
   * GET /api/v1/deposits — danh sách cọc gộp toàn hệ thống (Manager + Admin), bổ sung 2026-08-03 ở
   * backend thật (trước đây chỉ có GET /orders/:orderId/deposits theo từng đơn — xem comment cũ ở
   * types/payment.ts). Dùng cho KPI/hàng đợi "chờ xác nhận" ở trang Tổng quan thay vì phải N+1 qua
   * từng đơn như DepositListView.tsx vẫn đang làm tạm.
   */
  async getDeposits(params?: GetDepositsQuery) {
    const response = await api.get('/deposits', { params });
    return response.data as { success: boolean; data: DepositListItem[]; meta: DepositListMeta };
  },

  /** GET /api/v1/orders/{orderId}/deposits */
  async getOrderDeposits(orderId: string) {
    const response = await api.get(`/orders/${orderId}/deposits`);
    return response.data;
  },

  /** POST /api/v1/orders/{orderId}/deposits */
  async createOrderDeposit(orderId: string, payload: CreateOrderDepositPayload) {
    const response = await api.post(`/orders/${orderId}/deposits`, payload);
    return response.data;
  },

  /** PUT /api/v1/deposits/{depositId} */
  async updateDepositStatus(depositId: string, payload: UpdateDepositStatusPayload) {
    const response = await api.put(`/deposits/${depositId}`, payload);
    return response.data;
  },
};
