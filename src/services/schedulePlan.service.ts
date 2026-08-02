import api from './api';
import type {
  AddScheduleAssigneePayload,
  CreateSchedulePlanPayload,
  GetSchedulePlansQuery,
  UpdateSchedulePlanPayload,
  UpdateSchedulePlanStatusPayload,
} from '@/types/schedulePlan';

export const schedulePlanApiService = {
  /** GET /api/v1/schedule-plans */
  async getSchedulePlans(params?: GetSchedulePlansQuery) {
    const response = await api.get('/schedule-plans', { params });
    return response.data;
  },

  /** GET /api/v1/schedule-plans/:planId */
  async getSchedulePlanById(planId: string) {
    const response = await api.get(`/schedule-plans/${planId}`);
    return response.data;
  },

  /** POST /api/v1/schedule-plans */
  async createSchedulePlan(payload: CreateSchedulePlanPayload) {
    const response = await api.post('/schedule-plans', payload);
    return response.data;
  },

  /** PUT /api/v1/schedule-plans/:id — chỉ khi status khác IN_PROGRESS/COMPLETED */
  async updateSchedulePlan(planId: string, payload: UpdateSchedulePlanPayload) {
    const response = await api.put(`/schedule-plans/${planId}`, payload);
    return response.data;
  },

  /** PATCH /api/v1/schedule-plans/:id/status */
  async updateSchedulePlanStatus(planId: string, payload: UpdateSchedulePlanStatusPayload) {
    const response = await api.patch(`/schedule-plans/${planId}/status`, payload);
    return response.data;
  },

  /** POST /api/v1/schedule-plans/:id/assignees — gán 1 người vào kế hoạch, trả lại full SchedulePlan */
  async addAssignee(planId: string, payload: AddScheduleAssigneePayload) {
    const response = await api.post(`/schedule-plans/${planId}/assignees`, payload);
    return response.data;
  },
};
