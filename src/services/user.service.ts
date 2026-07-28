import api from './api';
import type { CreateUserPayload, ResetPasswordPayload, UpdateUserPayload, UpdateUserStatusPayload } from '@/types/user';

export interface GetUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export const userApiService = {
  /** GET /api/v1/users */
  async getUsers(params?: GetUsersQuery) {
    const response = await api.get('/users', { params });
    return response.data;
  },

  /** GET /api/v1/users/{id} */
  async getUserById(id: string) {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  /** POST /api/v1/users */
  async createUser(payload: CreateUserPayload) {
    const response = await api.post('/users', payload);
    return response.data;
  },

  /** PUT /api/v1/users/{id} */
  async updateUser(id: string, payload: UpdateUserPayload) {
    const response = await api.put(`/users/${id}`, payload);
    return response.data;
  },

  /** PATCH /api/v1/users/{id}/status */
  async updateUserStatus(id: string, payload: UpdateUserStatusPayload) {
    const response = await api.patch(`/users/${id}/status`, payload);
    return response.data;
  },

  /** POST /api/v1/users/{id}/reset-password */
  async resetPassword(id: string, payload: ResetPasswordPayload) {
    const response = await api.post(`/users/${id}/reset-password`, payload);
    return response.data;
  },

  /** POST /api/v1/users/{id}/avatar — multipart, chỉ ADMIN sửa avatar người khác */
  async updateAvatar(id: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/users/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
