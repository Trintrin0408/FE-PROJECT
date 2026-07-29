export type PermissionKey = 'master-data:manage' | 'orders:manage' | 'inventory:confirm-return';

// Quyền tối thiểu theo role (xem CLAUDE.md mục "Vai trò & phân quyền").
// Sẽ chi tiết hóa theo từng UC khi code tới module tương ứng.
export const PERMISSIONS: Record<PermissionKey, string[]> = {
  'master-data:manage': ['Admin'],
  'orders:manage': ['Manager'],
  // PUT /api/v1/inventory/return-reports/:id/confirm — backend chỉ role MANAGER gọi được (403 với
  // Admin), đúng nguyên tắc "Admin không xử lý vận hành hằng ngày".
  'inventory:confirm-return': ['Manager'],
};
