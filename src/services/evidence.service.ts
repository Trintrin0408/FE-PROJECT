import api from './api';
import type { UploadEvidencePayload } from '@/types/evidence';

export const evidenceApiService = {
  /** POST /api/v1/evidence/upload — multipart/form-data. Bắt buộc phải override header
   * Content-Type ở đây (dù giá trị 'multipart/form-data' không có boundary) — instance `api` mặc định
   * `Content-Type: application/json` (xem services/api.ts); nếu không override, bước
   * `transformRequest` của axios thấy `hasJSONContentType = true` và sẽ JSON.stringify luôn cái
   * FormData (mất hẳn file nhị phân) thay vì giữ nguyên để gửi multipart. Sau bước này axios tự dò
   * thấy `data` vẫn là FormData và tự set lại header đúng kèm boundary trước khi gửi thật (browser env,
   * `resolveConfig.js`), nên giá trị placeholder ở đây không cần đúng boundary. */
  async uploadEvidence({ file, folder, description }: UploadEvidencePayload) {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    if (description) formData.append('description', description);
    const response = await api.post('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** GET /api/v1/evidence/:id */
  async getEvidenceById(id: string) {
    const response = await api.get(`/evidence/${id}`);
    return response.data;
  },
};
