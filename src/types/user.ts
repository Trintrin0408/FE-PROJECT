// docs/api/02-users-roles.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Role enum raw
// KHÔNG có hậu tố _STAFF (ADMIN/MANAGER/STAFF); GET /auth/profile và login mới map sang dạng hiển
// thị {roleName} khác (xem types/auth.ts) — 2 định dạng khác nhau cho cùng field.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (enum Role/UserStatus), user.validator.ts,
// user.service.ts.
// Backend refactor 2026-07-26 (commit 4157a7f): gộp LEADER/TECHNICAL thành 1 role STAFF chung —
// Leader/Technical không còn là vai trò tài khoản, giờ chỉ là vai trò gán theo từng schedule_plan
// (PlanMemberRole: 'LEAD'|'TECHNICAL', xem types/schedulePlan.ts, không đổi).

export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// GET /api/v1/users — KHÔNG có email/phone/bio/avatarUrl (chỉ có ở GET /auth/profile)
export interface AdminUser {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/users
export interface CreateUserPayload {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  email?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
}

// PUT /api/v1/users/:id — tất cả optional
export interface UpdateUserPayload {
  fullName?: string;
  role?: UserRole;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

// PATCH /api/v1/users/:id/status
export interface UpdateUserStatusPayload {
  status: UserStatus;
}

// POST /api/v1/users/:id/reset-password
export interface ResetPasswordPayload {
  newPassword: string;
}
