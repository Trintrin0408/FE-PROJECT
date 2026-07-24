import type { AuthUser } from '@/types/auth';
import { FIELD_OPS_STAFF } from './db/employees';

// Backend thật hiện không đăng nhập được — Aiven cloud DB lệch schema so với `prisma/schema.prisma`
// (thiếu cột `internal_users.address` và nhiều cột khác, xem docs/more-require.md mục (jj)). Trong
// lúc chờ backend/DB owner đồng bộ lại, màn hình đăng nhập tạm dùng 2 tài khoản ảo cố định dưới đây
// thay vì gọi `POST /auth/login` thật — gỡ bỏ file này và quay lại `authApiService.login()`
// (src/app/auth/login/page.tsx) ngay khi backend đăng nhập được bình thường trở lại.

export interface MockAccount {
  username: string;
  password: string;
  user: AuthUser;
}

export const MOCK_TOKEN_PREFIX = 'mock-token-';

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    username: 'admin',
    password: 'Admin@123',
    user: {
      userId: 'mock-admin-1',
      username: 'admin',
      fullName: 'Quản trị viên hệ thống',
      role: { roleId: 'mock-role-admin', roleName: 'Admin' },
      status: 'active',
    },
  },
  {
    username: 'manager',
    password: 'Manager@123',
    user: {
      userId: 'mock-manager-1',
      username: 'manager',
      fullName: 'Trưởng phòng vận hành',
      role: { roleId: 'mock-role-manager', roleName: 'Manager' },
      status: 'active',
    },
  },
  // fullName khớp đúng FIELD_OPS_STAFF[0]/[1] (db/employees.ts) — để công việc/lịch/biên bản hiện
  // trường đã seed sẵn cho 2 người này (gán qua LEADER_STAFF_POOL, PLANNING_STAFF_POOL...) hiện đúng
  // trong app staff-mobile khi đăng nhập demo, không phải danh sách rỗng.
  {
    username: 'leader',
    password: 'Leader@123',
    user: {
      userId: 'mock-leader-1',
      username: 'leader',
      fullName: FIELD_OPS_STAFF[0].name,
      role: { roleId: 'mock-role-leader', roleName: 'LEADER_STAFF' },
      status: 'active',
    },
  },
  {
    username: 'nhanvien',
    password: 'Nhanvien@123',
    user: {
      userId: 'mock-technical-1',
      username: 'nhanvien',
      fullName: FIELD_OPS_STAFF[1].name,
      role: { roleId: 'mock-role-technical', roleName: 'TECHNICAL_STAFF' },
      status: 'active',
    },
  },
];

export function findMockAccount(username: string, password: string): MockAccount | undefined {
  return MOCK_ACCOUNTS.find((account) => account.username === username && account.password === password);
}
