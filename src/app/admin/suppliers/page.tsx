'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Search, Eye, MapPin, Phone, Plus } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SupplierFormModal } from '@/components/suppliers/SupplierFormModal';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { supplierApiService } from '@/services/supplier.service';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import type { Supplier, SupplierStatus } from '@/types/supplier';
import { Pagination } from '@/components/ui/Pagination';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as any).response;
    if (res?.data?.message) return res.data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminSuppliersMock.ts. Khớp ảnh mẫu "Danh
// sách Nhà cung cấp đối tác": tìm kiếm + lọc trạng thái, bảng đối tác kèm công nợ, modal thêm/sửa và
// modal xem chi tiết. Thêm/sửa/khóa chỉ cập nhật state cục bộ (mất khi tải lại trang).

type StatusFilter = '' | SupplierStatus;

export default function Page() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const { pagination, setPage, updatePagination } = usePagination(10);
  const router = useRouter();

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; supplier: Supplier | null } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await supplierApiService.getSuppliers({
        page: pagination.currentPage,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      setSuppliers(res.data ?? []);
      updatePagination({
        totalItems: res.meta.totalItems,
        totalPages: Math.max(1, res.meta.totalPages),
      });
    } catch (error) {
      console.error('Failed to fetch suppliers', error);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [pagination.currentPage, pagination.limit, debouncedSearch, statusFilter]);



  const handleSubmitForm = async (values: any) => {
    try {
      if (formModal?.mode === 'edit' && formModal.supplier) {
        await supplierApiService.updateSupplier(formModal.supplier.supplierId, values);
      } else {
        await supplierApiService.createSupplier(values);
      }
      setFormModal(null);
      fetchData();
    } catch (error) {
      alert(getErrorMessage(error, 'Lỗi khi lưu nhà cung cấp'));
    }
  };

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
            {s.phone}
          </p>
        </div>
      ),
    },
    {
      key: 'address',
      label: 'Địa Chỉ & Chuyên Cung Cấp',
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
            {s.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
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
            onClick={() => router.push(`/admin/suppliers/${s.supplierId}`)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
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
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={suppliers} rowKey={(row) => row.supplierId} isLoading={isLoading} />
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex justify-end">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
            />
          </div>
        )}
      </Reveal>

      <SupplierFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        supplier={formModal?.supplier ?? null}
        onClose={() => setFormModal(null)}
        onSubmit={handleSubmitForm}
      />

    </div>
  );
}
