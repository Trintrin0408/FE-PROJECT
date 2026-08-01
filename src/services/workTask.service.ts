import api from './api';
import type { GetWorkTasksQuery, CreateWorkTaskBody, UpdateWorkTaskBody, WorkTask } from '@/types/workTask';

export const workTaskApiService = {
  async getWorkTasks(params?: GetWorkTasksQuery) {
    const response = await api.get('/work-tasks', { params });
    return response.data;
  },

  async createWorkTask(body: CreateWorkTaskBody): Promise<WorkTask> {
    const response = await api.post('/work-tasks', body);
    return response.data;
  },

  async updateWorkTask(taskId: string, body: UpdateWorkTaskBody): Promise<WorkTask> {
    const response = await api.put(`/work-tasks/${taskId}`, body);
    return response.data;
  },

  async deleteWorkTask(taskId: string): Promise<{ taskId: string }> {
    const response = await api.delete(`/work-tasks/${taskId}`);
    return response.data;
  },
};
