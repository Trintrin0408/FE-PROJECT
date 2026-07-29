import api from './api';
import type { ChangeRequest, CreateChangeRequestPayload } from '@/types/changeRequest';

export interface GetChangeRequestsQuery {
  orderId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ChangeRequestListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// UC 2.27 — Backend đã bổ sung đủ 3 route theo đúng yêu cầu ở docs/more-require.md mục (an)
// (`D:\sep490-backend-api\src\modules\sales\changeRequest.routes.ts` +
// `order.routes.ts:143` cho route tạo).
export const changeRequestApiService = {
  async getChangeRequests(params?: GetChangeRequestsQuery) {
    const response = await api.get('/change-requests', { params });
    return response.data as { success: boolean; data: ChangeRequest[]; meta: ChangeRequestListMeta };
  },

  async createChangeRequest(orderId: string, payload: CreateChangeRequestPayload) {
    const response = await api.post(`/orders/${orderId}/change-requests`, payload);
    return response.data as { success: boolean; data: ChangeRequest };
  },

  async approveChangeRequest(id: string, status: 'approved' | 'rejected') {
    const response = await api.put(`/change-requests/${id}/approve`, { status });
    return response.data as { success: boolean; data: ChangeRequest };
  },
};
