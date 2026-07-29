import api from './api';
import type { ApiEnvelope, ApiListMeta } from './customer.service';
import type {
  CreateSupplierTransactionPayload,
  GetSupplierTransactionsQuery,
  ReceiveSupplierTransactionPayload,
  SupplierTransaction,
  UpdateSupplierTransactionPaymentStatusPayload,
  UpdateSupplierTransactionStatusPayload,
} from '@/types/procurement';

export const procurementApiService = {
  /** GET /api/v1/supplier-transactions */
  async getTransactions(params?: GetSupplierTransactionsQuery) {
    const response = await api.get<ApiEnvelope<SupplierTransaction[], ApiListMeta>>('/supplier-transactions', { params });
    return response.data;
  },

  /** GET /api/v1/supplier-transactions/:id */
  async getTransactionById(id: string) {
    const response = await api.get<ApiEnvelope<SupplierTransaction>>(`/supplier-transactions/${id}`);
    return response.data;
  },

  /** POST /api/v1/supplier-transactions */
  async createTransaction(payload: CreateSupplierTransactionPayload) {
    const response = await api.post('/supplier-transactions', payload);
    return response.data;
  },

  /** PATCH /api/v1/supplier-transactions/:id/status */
  async updateTransactionStatus(id: string, payload: UpdateSupplierTransactionStatusPayload) {
    const response = await api.patch(`/supplier-transactions/${id}/status`, payload);
    return response.data;
  },

  /** PATCH /api/v1/supplier-transactions/:id/payment-status */
  async updateTransactionPaymentStatus(id: string, payload: UpdateSupplierTransactionPaymentStatusPayload) {
    const response = await api.patch(`/supplier-transactions/${id}/payment-status`, payload);
    return response.data;
  },

  /** POST /api/v1/supplier-transactions/:id/receive */
  async receiveTransaction(id: string, payload: ReceiveSupplierTransactionPayload) {
    const response = await api.post(`/supplier-transactions/${id}/receive`, payload);
    return response.data;
  },
};
