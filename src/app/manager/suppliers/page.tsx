'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import { Truck, Search, Eye, Pencil, Lock, LockOpen, MapPin, Phone, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { SupplierFormModal, type SupplierFormValues } from '@/components/suppliers/SupplierFormModal';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { supplierApiService } from '@/services/supplier.service';
import type { CreateSupplierPayload, Supplier, SupplierStatus, UpdateSupplierPayload } from '@/types/supplier';

// Khớp ảnh mẫu "Danh sách Nhà cung cấp đối tác": tìm kiếm + lọc trạng thái, bảng đối tác kèm công nợ,
// modal thêm/sửa và modal xem chi tiết — nối dữ liệu thật qua supplierApiService (docs/supplier_api.md,
// backend xác nhận hoạt động 2026-07-21).
// Mirror của src/app/admin/suppliers/page.tsx cho vai trò Manager — dùng chung component/service.

type StatusFilter = '' | SupplierStatus;

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosError = err as AxiosError<{ message?: string; error?: { message?: string } }>;
  return axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message ?? fallback;
}

function toCreatePayload(values: SupplierFormValues): CreateSupplierPayload {
  return {
    supplierCode: values.supplierCode.trim(),
    supplierName: values.supplierName.trim(),
    serviceType: values.serviceType.trim(),
    contactPerson: values.contactPerson.trim() || undefined,
    phone: values.phone.trim() || undefined,
    address: values.address.trim() || undefined,
    rating: values.rating.trim() ? Number(values.rating) : undefined,
  };
}

function toUpdatePayload(values: SupplierFormValues): UpdateSupplierPayload {
  return {
    supplierName: values.supplierName.trim(),
    serviceType: values.serviceType.trim(),
    contactPerson: values.contactPerson.trim() || undefined,
    phone: values.phone.trim() || undefined,
    address: values.address.trim() || undefined,
    rating: values.rating.trim() ? Number(values.rating) : undefined,
  };
}

export default function Page() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; supplier: Supplier | null } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset trang khi đổi bộ lọc/tìm kiếm
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoading(true);
    setLoadError(null);
    supplierApiService
      .getSuppliers({ search: search || undefined, status: statusFilter || undefined, page, limit })
      .then((res) => {
        if (cancelled) return;
        setSuppliers(res.data);
        if (res.meta) setMeta(res.meta);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(extractErrorMessage(err, 'Không tải được danh sách nhà cung cấp. Vui lòng thử lại.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, page, reloadTick]);

  const reload = () => setReloadTick((t) => t + 1);

  const handleToggleStatus = async (supplier: Supplier) => {
    const nextStatus: SupplierStatus = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const message =
      supplier.status === 'ACTIVE'
        ? `Khóa đối tác "${supplier.supplierName}"? Đối tác sẽ không được chọn cho giao dịch mới.`
        : `Mở khóa đối tác "${supplier.supplierName}"?`;
    if (!window.confirm(message)) return;
    try {
      await supplierApiService.updateSupplier(supplier.supplierId, { status: nextStatus });
      reload();
    } catch (err) {
      window.alert(extractErrorMessage(err, 'Không thể đổi trạng thái đối tác. Vui lòng thử lại.'));
    }
  };

  const handleSubmitForm = async (values: SupplierFormValues) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (formModal?.mode === 'edit' && formModal.supplier) {
        await supplierApiService.updateSupplier(formModal.supplier.supplierId, toUpdatePayload(values));
      } else {
        await supplierApiService.createSupplier(toCreatePayload(values));
      }
      setFormModal(null);
      reload();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể lưu hồ sơ đối tác. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const paginationState: PaginationState = { currentPage: meta.page, totalPages: meta.totalPages, totalItems: meta.totalItems, limit: meta.limit };

  const columns: TableColumn<Supplier>[] = [
    { key: 'supplierCode', label: 'ID', render: (s) => <span className="font-semibold text-slate-500">{s.supplierCode}</span> },
    {
      key: 'name',
      label: 'Tên & SĐT Đối Tác',
      render: (s) => (
        <div>
          <p className="font-bold text-slate-800">{s.supplierName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {s.phone || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'address',
      label: 'Địa Chỉ & Phân Loại',
      render: (s) => (
        <div>
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {s.address || '—'}
          </p>
          <span className="mt-1.5 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
            {s.serviceType}
          </span>
        </div>
      ),
    },
    {
      key: 'debtBalance',
      label: 'Dư Nợ Công Nợ',
      render: (s) => <span className="font-bold text-red-500">{formatCurrency(s.debtBalance)}</span>,
    },
    {
      key: 'status',
      label: 'Trạng Thái',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span className={`h-2 w-2 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-400'}`} />
          <span className={s.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-500'}>
            {s.status === 'ACTIVE' ? 'Đang hợp tác' : 'Ngừng hợp tác'}
          </span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao Tác',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/manager/suppliers/${s.supplierId}`}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <button
            type="button"
            aria-label="Chỉnh sửa"
            title="Chỉnh sửa"
            onClick={() => {
              setFormError(null);
              setFormModal({ mode: 'edit', supplier: s });
            }}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={s.status === 'ACTIVE' ? 'Khóa đối tác' : 'Mở khóa đối tác'}
            title={s.status === 'ACTIVE' ? 'Khóa đối tác' : 'Mở khóa đối tác'}
            onClick={() => handleToggleStatus(s)}
            className={
              s.status === 'ACTIVE'
                ? 'inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                : 'inline-flex rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
            }
          >
            {s.status === 'ACTIVE' ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <Truck className="h-6 w-6 text-blue-600" />
            Danh sách Nhà cung cấp đối tác
          </h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý hồ sơ đối tác ngoài, phân loại thế mạnh và theo dõi công nợ, giao dịch lịch sử</p>
        </div>
        <Button
          onClick={() => {
            setFormError(null);
            setFormModal({ mode: 'create', supplier: null });
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm Đối Tác Mới
        </Button>
      </div>

      <Reveal className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[280px] flex-1">
            <Input
              placeholder="Tìm đối tác theo tên nhà cung cấp hoặc số điện thoại..."
              icon={<Search className="h-4 w-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="w-56">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang hợp tác' },
                { value: 'INACTIVE', label: 'Ngừng hợp tác' },
              ]}
            />
          </div>
        </div>

        {loadError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {loadError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải danh sách nhà cung cấp...
            </div>
          ) : (
            <Table columns={columns} rows={suppliers} rowKey={(row) => row.supplierId} />
          )}
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </Reveal>

      <SupplierFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        supplier={formModal?.supplier ?? null}
        isSubmitting={isSubmitting}
        submitError={formError}
        onClose={() => setFormModal(null)}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}
