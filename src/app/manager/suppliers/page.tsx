'use client';

import { useMemo, useState } from 'react';
import { Truck, Search, Eye, Pencil, Lock, LockOpen, MapPin, Phone, Plus } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SupplierDetailModal } from '@/components/suppliers/SupplierDetailModal';
import { SupplierFormModal } from '@/components/suppliers/SupplierFormModal';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  AdminSupplier,
  createAdminSupplier,
  getAdminSuppliers,
  toggleAdminSupplierStatus,
  updateAdminSupplier,
} from '@/mocks/db/suppliers';
import type { SupplierStatus } from '@/types/supplier';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminSuppliersMock.ts. Khớp ảnh mẫu "Danh
// sách Nhà cung cấp đối tác": tìm kiếm + lọc trạng thái, bảng đối tác kèm công nợ, modal thêm/sửa và
// modal xem chi tiết. Thêm/sửa/khóa chỉ cập nhật state cục bộ (mất khi tải lại trang).
// Mirror của src/app/admin/suppliers/page.tsx cho vai trò Manager — dùng chung mock/service/UI.

type StatusFilter = '' | SupplierStatus;

export default function Page() {
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>(() => getAdminSuppliers());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; supplier: AdminSupplier | null } | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<AdminSupplier | null>(null);

  const refresh = () => setSuppliers(getAdminSuppliers());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!term) return true;
      return s.supplierName.toLowerCase().includes(term) || s.phone.toLowerCase().includes(term);
    });
  }, [suppliers, search, statusFilter]);

  const handleToggleStatus = (supplier: AdminSupplier) => {
    const message =
      supplier.status === 'ACTIVE'
        ? `Khóa đối tác "${supplier.supplierName}"? Đối tác sẽ không được chọn cho giao dịch mới.`
        : `Mở khóa đối tác "${supplier.supplierName}"?`;
    if (!window.confirm(message)) return;
    toggleAdminSupplierStatus(supplier.supplierId);
    refresh();
  };

  const handleSubmitForm = (rawValues: any) => {
    // Map SupplierFormValues to AdminSupplierFormValues by falling back undefined to empty strings
    const values = {
      ...rawValues,
      contactPerson: rawValues.contactPerson ?? '',
      phone: rawValues.phone ?? '',
      address: rawValues.address ?? '',
    };
    if (formModal?.mode === 'edit' && formModal.supplier) {
      updateAdminSupplier(formModal.supplier.supplierId, values);
    } else {
      createAdminSupplier(values);
    }
    refresh();
    setFormModal(null);
  };

  const columns: TableColumn<AdminSupplier>[] = [
    { key: 'supplierCode', label: 'ID', render: (s) => <span className="font-semibold text-slate-500">{s.supplierCode}</span> },
    {
      key: 'name',
      label: 'Tên & SĐT Đối Tác',
      render: (s) => (
        <div>
          <p className="font-bold text-slate-800">{s.supplierName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {s.phone}
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
            {s.address}
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
          <button
            type="button"
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            onClick={() => setDetailSupplier(s)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Chỉnh sửa"
            title="Chỉnh sửa"
            onClick={() => setFormModal({ mode: 'edit', supplier: s })}
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
        <Button onClick={() => setFormModal({ mode: 'create', supplier: null })}>
          <Plus className="h-4 w-4" />
          Thêm Đối Tác Mới
        </Button>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[280px] flex-1">
            <Input
              placeholder="Tìm đối tác theo tên nhà cung cấp hoặc số điện thoại..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.supplierId} />
        </div>
      </Reveal>

      <SupplierFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        supplier={(formModal?.supplier as any) ?? null}
        onClose={() => setFormModal(null)}
        onSubmit={handleSubmitForm}
      />

      <SupplierDetailModal supplier={(detailSupplier as any) ?? null} onClose={() => setDetailSupplier(null)} />
    </div>
  );
}
