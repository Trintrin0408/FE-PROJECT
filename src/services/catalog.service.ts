import api from './api';
import type {
  CreateItemCategoryPayload,
  CreateItemPayload,
  CreateItemTypePayload,
  UpdateItemCategoryPayload,
  UpdateItemCategoryStatusPayload,
  UpdateItemPayload,
  UpdateItemStatusPayload,
  UpdateItemTypePayload,
  UpdateTypeSpecsPayload,
} from '@/types/catalog';

export interface GetItemsQuery {
  page?: number;
  limit?: number;
  status?: ItemStatus;
  typeId?: string;
  categoryId?: string;
  search?: string;
  isCombo?: boolean;
}

export interface GetItemTypesQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
}

export interface GetItemCategoriesQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export const catalogApiService = {
  // ===== Categories =====
  /** GET /api/v1/catalog/categories */
  async getCategories(params?: GetItemCategoriesQuery) {
    const response = await api.get('/catalog/categories', { params });
    return response.data;
  },

  /** GET /api/v1/catalog/categories/{id} */
  async getCategory(id: string) {
    const response = await api.get(`/catalog/categories/${id}`);
    return response.data;
  },

  /** POST /api/v1/catalog/categories */
  async createCategory(payload: CreateItemCategoryPayload) {
    const response = await api.post('/catalog/categories', payload);
    return response.data;
  },

  /** PUT /api/v1/catalog/categories/{id} */
  async updateCategory(id: string, payload: UpdateItemCategoryPayload) {
    const response = await api.put(`/catalog/categories/${id}`, payload);
    return response.data;
  },

  /**
   * PATCH /api/v1/catalog/categories/{id}/status — backend hiện là no-op stub (không có cột
   * isActive trên ItemCategory), gọi vẫn trả 200 nhưng không đổi gì thật.
   */
  async updateCategoryStatus(id: string, payload: UpdateItemCategoryStatusPayload) {
    const response = await api.patch(`/catalog/categories/${id}/status`, payload);
    return response.data;
  },

  // ===== Types =====
  /** GET /api/v1/catalog/types */
  async getTypes(params?: GetItemTypesQuery) {
    const response = await api.get('/catalog/types', { params });
    return response.data;
  },

  /** POST /api/v1/catalog/types */
  async createType(payload: CreateItemTypePayload) {
    const response = await api.post('/catalog/types', payload);
    return response.data;
  },

  /** PUT /api/v1/catalog/types/{id} */
  async updateType(id: string, payload: UpdateItemTypePayload) {
    const response = await api.put(`/catalog/types/${id}`, payload);
    return response.data;
  },

  // ===== Type Specs (BOM) =====
  /** GET /api/v1/catalog/types/{id}/specs */
  async getTypeSpecs(typeId: string) {
    const response = await api.get(`/catalog/types/${typeId}/specs`);
    return response.data;
  },

  /** POST /api/v1/catalog/types/{id}/specs — thay TOÀN BỘ danh sách specs */
  async updateTypeSpecs(typeId: string, payload: UpdateTypeSpecsPayload) {
    const response = await api.post(`/catalog/types/${typeId}/specs`, payload);
    return response.data;
  },

  // ===== Items =====
  /** GET /api/v1/catalog/items */
  async getItems(params?: GetItemsQuery) {
    const response = await api.get('/catalog/items', { params });
    return response.data;
  },

  /** GET /api/v1/catalog/items/{id} */
  async getItem(id: string) {
    const response = await api.get(`/catalog/items/${id}`);
    return response.data;
  },

  /** POST /api/v1/catalog/items */
  async createItem(payload: CreateItemPayload) {
    const response = await api.post('/catalog/items', payload);
    return response.data;
  },

  /** PUT /api/v1/catalog/items/{id} */
  async updateItem(id: string, payload: UpdateItemPayload) {
    const response = await api.put(`/catalog/items/${id}`, payload);
    return response.data;
  },

  /** PATCH /api/v1/catalog/items/{id}/status */
  async updateItemStatus(id: string, payload: UpdateItemStatusPayload) {
    const response = await api.patch(`/catalog/items/${id}/status`, payload);
    return response.data;
  },

  /** GET /api/v1/catalog/items/{id}/suppliers */
  async getItemSuppliers(itemId: string) {
    const response = await api.get(`/catalog/items/${itemId}/suppliers`);
    return response.data;
  },

  /** GET /api/v1/catalog/items/{id}/components */
  async getItemComponents(itemId: string) {
    const response = await api.get(`/catalog/items/${itemId}/components`);
    return response.data;
  },
};
