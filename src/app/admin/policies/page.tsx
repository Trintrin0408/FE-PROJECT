'use client';

import { useEffect, useState } from 'react';
import { Search, Pencil, Plus, RotateCw, Power } from 'lucide-react';
import { policyApiService } from '@/services/policy.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Reveal from '@/components/ui/Reveal';
import { PolicyFormModal, PolicyFormValues } from '@/components/policies/PolicyFormModal';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import type { BusinessPolicy, PolicyType } from '@/types/policy';

// Trang mới — trước đây route /admin/policies chỉ là stub "Tính năng đang được phát triển". Tầng
// service (policyApiService) + mockAdapter.ts (GET/POST/PUT /policies) đã được nối sẵn từ trước (xem
// DEMO_CHECKLIST.md Task 10) nhưng chưa có màn hình nào gọi tới — trang này là màn hình đầu tiên dùng
// domain BusinessPolicy thật. Bố cục tham khảo admin/catalog/categories (danh sách + modal tạo/sửa).

const POLICY_TYPE_META: Record<PolicyType, { label: string; badge: 'info' | 'error' | 'warning' | 'success' | 'neutral' }> = {
  DEPOSIT: { label: 'Đặt cọc', badge: 'info' },
  CANCELLATION: { label: 'Hủy đơn & hoàn cọc', badge: 'warning' },
  COMPENSATION: { label: 'Đền bù thiết bị', badge: 'error' },
  FEE: { label: 'Phụ phí', badge: 'neutral' },
  WAGE: { label: 'Tiền công nhân sự', badge: 'success' },
};

const POLICY_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả loại chính sách' },
  ...Object.entries(POLICY_TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang áp dụng' },
  { value: 'false', label: 'Ngừng áp dụng' },
];

export default function Page() {
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [policies, setPolicies] = useState<BusinessPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { pagination, setPage, updatePagination } = usePagination(10);

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; policy: BusinessPolicy | null } | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState('');

  const [refreshToken, setRefreshToken] = useState(0);
  const refetchPolicies = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag toggled before/after the fetch below, not a render loop
    setIsLoading(true);
    policyApiService
      .getPolicies({
        policyType: (typeFilter || undefined) as PolicyType | undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'true',
        search: debouncedSearch || undefined,
        page: pagination.currentPage,
        limit: pagination.limit,
      })
      .then((res) => {
        setPolicies(res.data);
        const totalItems = res.meta?.totalItems ?? res.data.length ?? 0;
        const limit = res.meta?.limit ?? pagination.limit;
        updatePagination({
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        });
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit, debouncedSearch, typeFilter, statusFilter, refreshToken]);

  const handleCreateSubmit = async (values: PolicyFormValues) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await policyApiService.createPolicy({
        policyCode: values.policyCode,
        policyName: values.policyName,
        policyType: values.policyType,
        policyValue: values.policyValue,
        unit: values.unit,
        description: values.description || undefined,
      });
      setFormModal(null);
      refetchPolicies();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Tạo chính sách thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleEditSubmit = async (values: PolicyFormValues, policy: BusinessPolicy) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await policyApiService.updatePolicy(policy.policyId, {
        policyValue: values.policyValue,
        unit: values.unit,
        description: values.description || undefined,
        isActive: values.isActive,
      });
      setFormModal(null);
      refetchPolicies();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Cập nhật chính sách thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleToggleActive = async (policy: BusinessPolicy) => {
    await policyApiService.updatePolicy(policy.policyId, { isActive: !policy.isActive });
    refetchPolicies();
  };

  const columns: TableColumn<BusinessPolicy>[] = [
    { key: 'policyCode', label: 'Mã chính sách', className: 'font-mono' },
    {
      key: 'policyName',
      label: 'Tên chính sách',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.policyName}</p>
          {row.description && <p className="mt-0.5 max-w-md text-xs text-slate-400">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'policyType',
      label: 'Loại',
      render: (row) => <Badge variant={POLICY_TYPE_META[row.policyType].badge}>{POLICY_TYPE_META[row.policyType].label}</Badge>,
    },
    {
      key: 'policyValue',
      label: 'Giá trị',
      render: (row) => (
        <span className="font-semibold text-slate-800">
          {row.policyValue.toLocaleString('vi-VN')} {row.unit}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Trạng thái',
      render: (row) => <Badge variant={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Đang áp dụng' : 'Ngừng áp dụng'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) =>
        canManage && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Chỉnh sửa"
              title="Chỉnh sửa"
              onClick={() => setFormModal({ mode: 'edit', policy: row })}
              className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={row.isActive ? 'Ngừng áp dụng' : 'Kích hoạt lại'}
              title={row.isActive ? 'Ngừng áp dụng' : 'Kích hoạt lại'}
              onClick={() => handleToggleActive(row)}
              className={`inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 ${row.isActive ? 'hover:text-red-600' : 'hover:text-emerald-600'}`}
            >
              <Power className="h-4 w-4" />
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Chính sách nghiệp vụ</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý các chính sách đặt cọc, hoàn cọc, đền bù thiết bị, phụ phí và tiền công nhân sự áp dụng toàn hệ thống.</p>
        </div>
        {canManage && (
          <Button onClick={() => setFormModal({ mode: 'create', policy: null })}>
            <Plus className="h-4 w-4" />
            Tạo chính sách
          </Button>
        )}
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Tìm theo mã hoặc tên chính sách..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              options={POLICY_TYPE_FILTER_OPTIONS}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
          <button
            type="button"
            aria-label="Làm mới"
            title="Làm mới"
            onClick={refetchPolicies}
            className="rounded-md border border-gray-300 bg-white p-2 text-slate-500 hover:bg-slate-50"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <Table columns={columns} rows={policies} rowKey={(row) => row.policyId} isLoading={isLoading} emptyText="Không tìm thấy chính sách phù hợp." />
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </Reveal>

      <PolicyFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        policy={formModal?.policy}
        isSubmitting={isSubmittingForm}
        errorMessage={formError}
        onClose={() => {
          setFormModal(null);
          setFormError('');
        }}
        onSubmit={(values) => {
          if (formModal?.mode === 'edit' && formModal.policy) {
            handleEditSubmit(values, formModal.policy);
          } else {
            handleCreateSubmit(values);
          }
        }}
      />
    </div>
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}
