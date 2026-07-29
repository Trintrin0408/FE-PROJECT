import api from './api';
import type { AdjustInventoryPayload, GetInventoryMovementsQuery, GetInventoryQuery } from '@/types/inventory';
import type { GetReturnReportsQuery } from '@/types/collectedEquipmentReport';

export const inventoryApiService = {
  /** GET /api/v1/inventory */
  async getInventory(params?: GetInventoryQuery) {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  /** POST /api/v1/inventory/adjust */
  async adjustInventory(payload: AdjustInventoryPayload) {
    const response = await api.post('/inventory/adjust', payload);
    return response.data;
  },

  /** GET /api/v1/inventory/movements */
  async getMovements(params?: GetInventoryMovementsQuery) {
    const response = await api.get('/inventory/movements', { params });
    return response.data;
  },

  /** GET /api/v1/inventory/return-reports — chỉ role MANAGER/ADMIN gọi được (403 với role khác). */
  async getReturnReports(params?: GetReturnReportsQuery) {
    const response = await api.get('/inventory/return-reports', { params });
    return response.data;
  },

  /** GET /api/v1/inventory/return-reports/:id — chỉ role MANAGER/ADMIN gọi được. */
  async getReturnReport(reportId: string) {
    const response = await api.get(`/inventory/return-reports/${reportId}`);
    return response.data;
  },

  /** PUT /api/v1/inventory/return-reports/:id/confirm — chỉ role MANAGER gọi được (Admin nhận 403). */
  async confirmReturnReport(reportId: string, notes?: string) {
    const response = await api.put(`/inventory/return-reports/${reportId}/confirm`, { notes });
    return response.data;
  },
};
