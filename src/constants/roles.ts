export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  LEADER_STAFF: 'LEADER_STAFF',
  TECHNICAL_STAFF: 'TECHNICAL_STAFF',
} as const;

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
  { value: 'LEADER_STAFF', label: 'Leader Staff' },
  { value: 'TECHNICAL_STAFF', label: 'Technical Staff' },
];

// GET/POST/PUT /users trả role RAW enum (không hậu tố _STAFF) — khác ROLE_OPTIONS ở trên.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma enum Role.
export const USER_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'STAFF', label: 'Nhân viên' },
];
