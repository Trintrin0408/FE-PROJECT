import api from './api';
import type { ApiEnvelope, ApiListMeta } from './customer.service';
import type { 
  CreateSupplierPayload, 
  GetSuppliersQuery, 
  UpdateSupplierPayload,
  SupplierItem,
  AssignSupplierItemPayload,
  UpdateSupplierItemPayload,
  UpdateSupplierStatusPayload,
  ListSupplierTransactionsQuery,
  SupplierTransactionListResult,
  CreateSupplierTransactionPayload,
  UpdateSupplierTransactionPayload,
  SupplierTransaction,
  Supplier
} from '@/types/supplier';

export const supplierApiService = {
  /** GET /api/v1/suppliers */
  async getSuppliers(params?: GetSuppliersQuery) {
    const response = await api.get<ApiEnvelope<Supplier[], ApiListMeta>>('/suppliers', { params });
    return response.data;
  },

  /** GET /api/v1/suppliers/:id */
  async getSupplier(id: string) {
    const response = await api.get<ApiEnvelope<Supplier>>(`/suppliers/${id}`);
    return response.data;
  },

  /** GET /api/v1/suppliers/next-code */
  async getNextSupplierCode() {
    const response = await api.get('/suppliers/next-code');
    return response.data?.data?.code || response.data?.code || response.data;
  },

  /** GET /api/v1/suppliers/:id */
  async getSupplierById(id: string) {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  /** POST /api/v1/suppliers */
  async createSupplier(payload: CreateSupplierPayload) {
    const response = await api.post<ApiEnvelope<Supplier>>('/suppliers', payload);
    return response.data;
  },

  /** PUT /api/v1/suppliers/:id — không có endpoint status riêng, đổi status qua PUT chung (chấp nhận body chỉ {status}) */
  async updateSupplier(id: string, payload: UpdateSupplierPayload) {
    const response = await api.put<ApiEnvelope<Supplier>>(`/suppliers/${id}`, payload);
    return response.data;
  },

  /** PATCH /api/v1/suppliers/:id/status */
  async updateSupplierStatus(id: string, payload: UpdateSupplierStatusPayload) {
    const response = await api.patch(`/suppliers/${id}/status`, payload);
    return response.data;
  },

  /** GET /api/v1/suppliers/:id/items */
  async getSupplierItems(id: string): Promise<SupplierItem[]> {
    const response = await api.get(`/suppliers/${id}/items`);
    return response.data;
  },

  /** POST /api/v1/suppliers/:id/items */
  async assignSupplierItem(id: string, payload: AssignSupplierItemPayload): Promise<SupplierItem> {
    const response = await api.post(`/suppliers/${id}/items`, payload);
    return response.data;
  },

  /** PUT /api/v1/suppliers/:id/items/:itemId */
  async updateSupplierItem(id: string, itemId: string, payload: UpdateSupplierItemPayload): Promise<SupplierItem> {
    const response = await api.put(`/suppliers/${id}/items/${itemId}`, payload);
    return response.data;
  },

  /** DELETE /api/v1/suppliers/:id/items/:itemId */
  async removeSupplierItem(id: string, itemId: string) {
    const response = await api.delete(`/suppliers/${id}/items/${itemId}`);
    return response.data;
  },

  /** GET /api/v1/supplier-transactions */
  async getSupplierTransactions(params?: ListSupplierTransactionsQuery): Promise<SupplierTransactionListResult> {
    const response = await api.get('/supplier-transactions', { params });
    return response.data;
  },

  /** POST /api/v1/supplier-transactions */
  async createSupplierTransaction(payload: CreateSupplierTransactionPayload): Promise<SupplierTransaction> {
    const response = await api.post('/supplier-transactions', payload);
    return response.data;
  },

  /** GET /api/v1/supplier-transactions/:id */
  async getTransactionById(id: string): Promise<SupplierTransaction> {
    const response = await api.get(`/supplier-transactions/${id}`);
    return response.data;
  },

  /** PUT /api/v1/supplier-transactions/:id */
  async updateSupplierTransaction(id: string, payload: UpdateSupplierTransactionPayload): Promise<SupplierTransaction> {
    const response = await api.put(`/supplier-transactions/${id}`, payload);
    return response.data;
  },

  /** DELETE /api/v1/supplier-transactions/:id */
  async deleteSupplierTransaction(id: string) {
    const response = await api.delete(`/supplier-transactions/${id}`);
    return response.data;
  },

  /** PATCH /api/v1/supplier-transactions/:id/status */
  async updateTransactionStatus(id: string, status: string): Promise<SupplierTransaction> {
    const response = await api.patch(`/supplier-transactions/${id}/status`, { status });
    return response.data;
  },

  /** PATCH /api/v1/supplier-transactions/:id/payment-status */
  async updateTransactionPaymentStatus(id: string, paymentStatus: string): Promise<SupplierTransaction> {
    const response = await api.patch(`/supplier-transactions/${id}/payment-status`, { paymentStatus });
    return response.data;
  }
};
