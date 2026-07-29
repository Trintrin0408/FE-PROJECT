// docs/api/01-auth.md — một phần đã lỗi thời sau đợt backend refactor 2026-07-06 (thiếu
// email/phone trên AuthProfile, thiếu updateProfile/registerDeviceToken). Nguồn:
// D:\bnwems-backend-api auth.controller.ts, auth.route.ts, auth.validator.ts.

export type UserRole = 'Admin' | 'Manager' | 'LEADER_STAFF' | 'TECHNICAL_STAFF';
export type AuthUserStatus = 'active' | 'inactive' | 'locked';

export interface AuthUserRole {
  roleId: string;
  roleName: UserRole;
}

export interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  role: AuthUserRole;
  status: AuthUserStatus;
  mustChangePassword?: boolean;
}

// GET /api/v1/auth/profile
export interface AuthProfile extends AuthUser {
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// PUT /api/v1/auth/profile
export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
}

// POST /api/v1/auth/device-token — đăng ký FCM token cho push notification
export interface RegisterDeviceTokenPayload {
  deviceToken: string;
  deviceType: 'ANDROID' | 'IOS' | 'WEB';
}
