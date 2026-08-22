import api from './api';
import type { GetQuotationsQuery, SaveQuotationPayload, UpdateQuotationStatusPayload } from '@/types/quotation';

export const quotationApiService = {
  /** GET /api/v1/quotations — danh sách báo giá xuyên mọi khách hàng, dùng cho màn "Danh sách báo giá" */
  async getQuotations(params?: GetQuotationsQuery) {
    const response = await api.get('/quotations', { params });
    return response.data;
  },

  /** GET /api/v1/customers/{customerId}/quotations */
  async getCustomerQuotations(customerId: string, params?: { page?: number; limit?: number }) {
    const response = await api.get(`/customers/${customerId}/quotations`, { params });
    return response.data;
  },

  /** GET /api/v1/quotations/{id} — kèm items */
  async getQuotation(id: string) {
    const response = await api.get(`/quotations/${id}`);
    return response.data;
  },

  /** POST /api/v1/customers/{customerId}/quotations */
  async createQuotation(customerId: string, payload: SaveQuotationPayload) {
    const response = await api.post(`/customers/${customerId}/quotations`, payload);
    return response.data;
  },

  /** PUT /api/v1/quotations/{id} — chỉ sửa được khi status còn DRAFT */
  async updateQuotation(id: string, payload: SaveQuotationPayload) {
    const response = await api.put(`/quotations/${id}`, payload);
    return response.data;
  },

  /** PATCH /api/v1/quotations/{id}/status */
  async updateQuotationStatus(id: string, payload: UpdateQuotationStatusPayload) {
    const response = await api.patch(`/quotations/${id}/status`, payload);
    return response.data;
  },

  /** PUT /api/v1/quotations/{id}/view — đánh dấu Manager/Admin đã xem báo giá (không cần body) */
  async markQuotationViewed(id: string) {
    const response = await api.put(`/quotations/${id}/view`);
    return response.data;
  },

  /** DELETE /api/v1/quotations/{id} — chỉ xoá được khi chưa APPROVED */
  async deleteQuotation(id: string) {
    const response = await api.delete(`/quotations/${id}`);
    return response.data;
  },
};
