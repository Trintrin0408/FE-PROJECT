import api from './api';
import type {
  AdjustInventoryPayload,
  EquipmentTimeline,
  GetInventoryMovementsQuery,
  GetInventoryQuery,
  GetItemReservationsQuery,
  GetReservationsTimelineQuery,
  ItemReservation,
  PicklistItem,
  ReconcileResult,
  RepairInventoryPayload,
  ScrapInventoryPayload,
} from '@/types/inventory';
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

  /** POST /api/v1/inventory/repair — sửa xong hàng hỏng (damaged−, total giữ nguyên). MANAGER/ADMIN. */
  async repairInventory(payload: RepairInventoryPayload) {
    const response = await api.post('/inventory/repair', payload);
    return response.data;
  },

  /** POST /api/v1/inventory/scrap — thanh lý hàng hỏng (damaged−, total−). MANAGER/ADMIN. */
  async scrapInventory(payload: ScrapInventoryPayload) {
    const response = await api.post('/inventory/scrap', payload);
    return response.data;
  },

  /** GET /api/v1/inventory/:itemId/reservations — lịch bận thiết bị (các khoảng giữ chỗ của item). */
  async getItemReservations(itemId: string, params?: GetItemReservationsQuery): Promise<{ data: ItemReservation[] }> {
    const response = await api.get(`/inventory/${itemId}/reservations`, { params });
    return response.data;
  },

  /** GET /api/v1/inventory/reservations-timeline — reservation mọi item trong [from,to] + cờ over-committed. */
  async getReservationsTimeline(params?: GetReservationsTimelineQuery): Promise<{ data: EquipmentTimeline }> {
    const response = await api.get('/inventory/reservations-timeline', { params });
    return response.data;
  },

  /** GET /api/v1/inventory/reconcile — đối soát on_hand từ inventory_movements (Manager/Admin). */
  async getReconcile(): Promise<{ data: ReconcileResult }> {
    const response = await api.get('/inventory/reconcile');
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

  /**
   * GET /api/v1/inventory/picklist/:orderId — tồn kho của từng item trong đơn.
   * Trả về mảng PicklistItem với quantityAvailable theo từng item (source=INTERNAL).
   * Supplier items trả quantityAvailable=null.
   */
  async getPicklist(orderId: string): Promise<{ data: PicklistItem[] }> {
    const response = await api.get(`/inventory/picklist/${orderId}`);
    return response.data;
  },
};
