'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import UserFormModal, { UserFormValues } from '@/components/users/UserFormModal';
import UserDetailModal from '@/components/users/UserDetailModal';
import { userApiService } from '@/services/user.service';
import type { AdminUser, UserRole } from '@/types/user';
import { USER_ROLE_OPTIONS } from '@/constants/roles';

// Mapping role colors matching employee mock style
const ROLE_BADGE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  ADMIN: 'warning',
  MANAGER: 'info',
  STAFF: 'neutral',
};

const STATUS_META: Record<string, { label: string; variant: 'success' | 'neutral' | 'warning' | 'error' }> = {
  ACTIVE: { label: 'Đang hoạt động', variant: 'success' },
  INACTIVE: { label: 'Vô hiệu hóa', variant: 'neutral' },
  SUSPENDED: { label: 'Đình chỉ', variant: 'error' },
};

function randomAvatarColor(): string {
  const AVATAR_COLOR_POOL = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-slate-600'];
  return AVATAR_COLOR_POOL[Math.floor(Math.random() * AVATAR_COLOR_POOL.length)];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 500);
  const [roleTab, setRoleTab] = useState<UserRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [loadingEditUserId, setLoadingEditUserId] = useState<string | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<AdminUser | null>(null);
  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await userApiService.getUsers({
        page,
        limit,
        search: search.trim() || undefined,
        role: roleTab === 'all' ? undefined : roleTab,
      });
      if (res.success && res.data) {
        setUsers(res.data);
        setTotalItems(res.meta?.totalItems || res.data.length);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, limit, search, roleTab]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const paginationState: PaginationState = { currentPage: page, totalPages, totalItems, limit };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormError(undefined);
    setIsFormOpen(true);
  };

  const openEditModal = async (user: AdminUser) => {
    setFormError(undefined);
    setLoadingEditUserId(user.userId);
    try {
      const res = await userApiService.getUserById(user.userId);
      const detail: AdminUser = res.data ?? res;
      setEditingUser(detail);
    } catch {
      // Fallback về object list nếu fetch detail thất bại
      setEditingUser(user);
    } finally {
      setLoadingEditUserId(null);
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true);
    setFormError(undefined);
    try {
      if (editingUser) {
        await userApiService.updateUser(editingUser.userId, {
          fullName: values.fullName,
          role: values.role,
          email: values.email || null,
          phone: values.phone || null,
        });
      } else {
        await userApiService.createUser({
          username: values.username,
          password: values.password!,
          fullName: values.fullName,
          role: values.role,
          email: values.email || undefined,
          phone: values.phone || undefined,
        });
      }
      setIsFormOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivatingUser) return;
    try {
      await userApiService.updateUserStatus(deactivatingUser.userId, { status: 'INACTIVE' });
      loadUsers();
    } catch (err) {
      console.error('Failed to deactivate user', err);
    } finally {
      setDeactivatingUser(null);
    }
  };

  const roleTabs = [
    { value: 'all', label: 'Tất cả' },
    { value: 'ADMIN', label: 'Quản trị viên' },
    { value: 'MANAGER', label: 'Quản lý' },
    { value: 'STAFF', label: 'Nhân viên' },
  ];

  const columns: TableColumn<AdminUser>[] = [
    {
      key: 'username',
      label: 'Tên đăng nhập',
      render: (row) => <span className="font-mono text-xs font-semibold text-slate-500">{row.username}</span>,
    },
    {
      key: 'fullName',
      label: 'Họ và tên',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${randomAvatarColor()}`}>
            {(() => {
              const parts = row.fullName.trim().split(/\s+/);
              if (!parts.length || !parts[0]) return 'U';
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            })()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{row.fullName}</p>
            <p className="truncate text-xs text-slate-400">ID: {row.userId.split('-')[0]}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Vai trò',
      render: (row) => <Badge variant={ROLE_BADGE[row.role]}>{USER_ROLE_OPTIONS.find(o => o.value === row.role)?.label || row.role}</Badge>,
    },
    {
      key: 'contact',
      label: 'Thông tin liên hệ',
      render: (row) => (
        <div className="text-xs text-slate-500">
          {row.phone && (
            <p className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> {row.phone}
            </p>
          )}
          {row.email && (
            <p className="mt-0.5 flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {row.email}
            </p>
          )}
          {!row.phone && !row.email && <span className="italic text-slate-400">Chưa cập nhật</span>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      className: 'text-center',
      render: (row) => {
        const meta = STATUS_META[row.status] || STATUS_META['ACTIVE'];
        return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-300'}`} />
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </span>
      )},
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewingUser(row)}
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            title="Sửa tài khoản"
            disabled={loadingEditUserId !== null}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingEditUserId === row.userId ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </button>
          {row.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => setDeactivatingUser(row)}
              title="Khóa tài khoản"
              className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tài khoản người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý tài khoản đăng nhập hệ thống và phân quyền truy cập.</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {roleTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => { setRoleTab(tab.value as UserRole | 'all'); setPage(1); }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  roleTab === tab.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên đăng nhập, tên..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full py-10">Đang tải dữ liệu...</div>
          ) : (
            <Table columns={columns} rows={users} rowKey={(row) => row.userId} />
          )}
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </motion.div>

      <UserFormModal
        isOpen={isFormOpen}
        mode={editingUser ? 'edit' : 'create'}
        user={editingUser}
        isSubmitting={isSubmitting || loadingEditUserId !== null}
        errorMessage={formError}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <Modal
        isOpen={Boolean(deactivatingUser)}
        onClose={() => setDeactivatingUser(null)}
        title="Khóa tài khoản"
        subtitle={deactivatingUser ? `Bạn có chắc muốn vô hiệu hóa tài khoản "@${deactivatingUser.username}"?` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeactivatingUser(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDeactivateConfirm}>
              Xác nhận khóa
            </Button>
          </>
        }
      >
        <div />
      </Modal>

      <UserDetailModal
        isOpen={Boolean(viewingUser)}
        onClose={() => setViewingUser(null)}
        user={viewingUser}
      />
    </div>
  );
}
