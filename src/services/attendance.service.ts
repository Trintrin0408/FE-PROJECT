import api from './api';
import type { CheckInPayload, CheckOutPayload, AttendanceListItem, ListAttendancesMeta } from '@/types/attendance';
import type { ApiEnvelope } from './customer.service';

export const attendanceApiService = {
  /** GET /api/v1/schedule-plans/attendances */
  async getAttendances(params?: { orderId?: string; taskId?: string; search?: string; page?: number; limit?: number }) {
    const response = await api.get<ApiEnvelope<AttendanceListItem[], ListAttendancesMeta>>('/schedule-plans/attendances', { params });
    return response.data;
  },

  /** POST /api/v1/attendance/check-in */
  async checkIn(payload: CheckInPayload) {
    const response = await api.post('/attendance/check-in', payload);
    return response.data;
  },

  /** PUT /api/v1/attendance/:id/check-out */
  async checkOut(attendanceId: string, payload: CheckOutPayload) {
    const response = await api.put(`/attendance/${attendanceId}/check-out`, payload);
    return response.data;
  },
};
