import type { UserRole } from '@/types/auth';

interface RoleBadgeProps {
  roleName: UserRole;
  className?: string;
}

/** Badge nhận diện vai trò trong app staff-mobile — Leader Purple cho LEADER_STAFF, Primary Light
 * (xanh) cho TECHNICAL_STAFF, theo bảng màu người dùng cung cấp cho khu vực này. */
export default function RoleBadge({ roleName, className = '' }: Readonly<RoleBadgeProps>) {
  const isLeader = roleName === 'LEADER_STAFF';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isLeader ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
      } ${className}`}
    >
      {isLeader ? 'Trưởng nhóm' : 'Kỹ thuật viên'}
    </span>
  );
}
