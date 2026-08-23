'use client';

import { useMemo, useState } from 'react';
import {
  Archive, CheckCircle2, Download, Eye, Package, Pause, Pencil, Plus, Trash2,
} from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import SupplierServiceFormModal from '@/components/catalog/SupplierServiceFormModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import {
  SUPPLIER_SERVICE_CATEGORY_OPTIONS,
  SUPPLIER_SERVICE_STATUS_META,
  SupplierServicePackage,
  SupplierServiceStatus,
  addSupplierService,
  deleteSupplierService,
  getSupplierServices,
  updateSupplierService,
} from '@/mocks/supplierServicesMock';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/supplierServicesMock.ts.

export default function SupplierServicesPage() {
  const [services, setServices] = useState<SupplierServicePackage[]>(() => getSupplierServices());
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierServiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<SupplierServicePackage | null>(null);
  const [deletingService, setDeletingService] = useState<SupplierServicePackage | null>(null);

  const supplierNames = useMemo(() => Array.from(new Set(services.map((s) => s.supplierName))).sort(), [services]);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (supplierFilter && s.supplierName !== supplierFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (!term) return true;
      return s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term) || s.supplierName.toLowerCase().includes(term);
    });
  }, [services, search, categoryFilter, supplierFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredServices.slice((safePage - 1) * limit, safePage * limit);
  const paginationState: PaginationState = { currentPage: safePage, totalPages, totalItems: filteredServices.length, limit };

  const activeCount = services.filter((s) => s.status === 'active').length;
  const pausedCount = services.filter((s) => s.status === 'paused').length;
  const stoppedCount = services.filter((s) => s.status === 'stopped').length;

  const kpiItems: KpiCardItem[] = [
    { label: 'Tổng dịch vụ NCC', value: services.length, icon: Package, iconColor: 'blue', changeLabel: '+6 dịch vụ mới', changeDirection: 'up' },
    { label: 'Đang hoạt động', value: activeCount, icon: CheckCircle2, iconColor: 'green', changeLabel: '8.7% so với tháng trước', changeDirection: 'up' },
    { label: 'Tạm ngừng', value: pausedCount, icon: Pause, iconColor: 'amber', changeLabel: '12.5% so với tháng trước', changeDirection: 'down' },
    { label: 'Ngừng cung cấp', value: stoppedCount, icon: Archive, iconColor: 'pink', changeLabel: '3.2% so với tháng trước', changeDirection: 'down' },
  ];

  const openCreateModal = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const openEditModal = (service: SupplierServicePackage) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleSubmit = (values: Omit<SupplierServicePackage, 'id' | 'updatedAt'>) => {
    const today = '2026-07-10';
    if (editingService) {
      updateSupplierService(editingService.id, { ...values, updatedAt: today });
    } else {
      addSupplierService({ id: `ncc-${Date.now()}`, updatedAt: today, ...values });
    }
    setServices(getSupplierServices());
    setIsFormOpen(false);
    setEditingService(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingService) return;
    deleteSupplierService(deletingService.id);
    setServices((prev) => prev.filter((s) => s.id !== deletingService.id));
    setDeletingService(null);
  };

  const columns: TableColumn<SupplierServicePackage>[] = [
    {
      key: 'name',
      label: 'Dịch vụ NCC',
      render: (row) => (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL ảnh minh họa mock, không thuộc domain đã cấu hình next/image */}
          <img src={row.imageUrl} alt={row.name} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{row.name}</p>
            <p className="text-xs font-medium uppercase text-slate-400">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'supplierName',
      label: 'Nhà cung cấp',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-700">{row.supplierName}</p>
          <p className="text-xs text-slate-400">{row.supplierPhone}</p>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Danh mục',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{row.category}</span>,
    },
    {
      key: 'unit',
      label: 'Đơn vị tính',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{row.unit}</span>,
    },
    {
      key: 'referencePrice',
      label: 'Giá tham khảo (VNĐ)',
      className: 'text-right font-semibold text-slate-900',
      render: (row) => formatCurrency(row.referencePrice),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge variant={SUPPLIER_SERVICE_STATUS_META[row.status].variant}>{SUPPLIER_SERVICE_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'updatedAt',
      label: 'Cập nhật cuối',
      render: (row) => <span className="whitespace-nowrap text-sm text-slate-500">{formatDate(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            aria-label="Sửa dịch vụ"
            title="Sửa dịch vụ"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingService(row)}
            aria-label="Xóa dịch vụ"
            title="Xóa dịch vụ"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Dịch vụ NCC"
        description="Quản lý các dịch vụ, hàng hóa và dịch vụ hỗ trợ từ nhà cung cấp."
      />

      <div className="mt-6">
        <DashboardStats items={kpiItems} />
      </div>

      <FilterBar>
        <FilterRow>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput width="fixed" value={searchInput} onChange={setSearchInput} placeholder="Tìm kiếm dịch vụ NCC..." />
            <div className="w-44">
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[{ value: '', label: 'Danh mục: Tất cả' }, ...SUPPLIER_SERVICE_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))]}
              />
            </div>
            <div className="w-48">
              <Select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                options={[{ value: '', label: 'Nhà cung cấp: Tất cả' }, ...supplierNames.map((s) => ({ value: s, label: s }))]}
              />
            </div>
            <div className="w-44">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SupplierServiceStatus | '')}
                options={[
                  { value: '', label: 'Trạng thái: Tất cả' },
                  ...(Object.keys(SUPPLIER_SERVICE_STATUS_META) as SupplierServiceStatus[]).map((s) => ({
                    value: s,
                    label: SUPPLIER_SERVICE_STATUS_META[s].label,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary">
              <Download className="h-4 w-4" />
              Xuất Excel
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Thêm dịch vụ NCC
            </Button>
          </div>
        </FilterRow>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={pageRows} rowKey={(row) => row.id} />
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </FilterBar>

      <SupplierServiceFormModal
        isOpen={isFormOpen}
        editingService={editingService}
        onClose={() => {
          setIsFormOpen(false);
          setEditingService(null);
        }}
        onSubmit={handleSubmit}
      />

      <Modal
        isOpen={Boolean(deletingService)}
        onClose={() => setDeletingService(null)}
        title="Xóa dịch vụ NCC"
        subtitle={deletingService ? `Bạn có chắc muốn xóa "${deletingService.name}"? Hành động này không thể hoàn tác.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingService(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Xóa dịch vụ
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}
