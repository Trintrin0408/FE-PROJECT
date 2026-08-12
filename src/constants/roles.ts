// Backend refactor 2026-07-26 (commit 4157a7f): gộp LEADER_STAFF/TECHNICAL_STAFF thành 1 role STAFF
// chung — không còn phân biệt Leader/Technical ở cấp tài khoản (xem types/user.ts).
export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'STAFF',
} as const;

// STAFF không dùng web (đã chuyển sang app Flutter riêng) — không có route dashboard web. Bỏ entry STAFF
// khiến đăng nhập hiện lỗi "Vai trò không được hỗ trợ trên web" thay vì điều hướng tới route 404 /staff-mobile.
export const ROLE_DASHBOARD_PATH: Record<string, string> = {
  Admin: '/admin/settings/users',
  Manager: '/manager/dashboard',
};

// Không còn endpoint GET /roles — role là enum cố định. Dùng cho AuthProfile.role.roleName
// (GET /auth/profile, POST /auth/login) — dạng đã map, KHÔNG dùng cho GET /users (xem
// USER_ROLE_OPTIONS bên dưới, dùng raw enum Role thật của Prisma).
export const ROLE_OPTIONS = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Manager', label: 'Manager' },
  { value: 'STAFF', label: 'Staff' },
];

// GET/POST/PUT /users trả role RAW enum (không hậu tố _STAFF) — khác ROLE_OPTIONS ở trên.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma enum Role.
export const USER_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Quản trị viên' },
  { value: 'MANAGER', label: 'Quản lý' },
  { value: 'STAFF', label: 'Nhân viên' },
];
