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
import BusinessServiceFormModal from '@/components/catalog/BusinessServiceFormModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import {
  BUSINESS_SERVICE_CATEGORY_OPTIONS,
  BUSINESS_SERVICE_STATUS_META,
  BusinessServicePackage,
  BusinessServiceStatus,
  addBusinessService,
  deleteBusinessService,
  getBusinessServices,
  updateBusinessService,
} from '@/mocks/db/catalog';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/businessServicesMock.ts.

export default function BusinessServicesPage() {
  const [services, setServices] = useState<BusinessServicePackage[]>(() => getBusinessServices());
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<BusinessServiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<BusinessServicePackage | null>(null);
  const [deletingService, setDeletingService] = useState<BusinessServicePackage | null>(null);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (!term) return true;
      return s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term);
    });
  }, [services, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredServices.slice((safePage - 1) * limit, safePage * limit);
  const paginationState: PaginationState = { currentPage: safePage, totalPages, totalItems: filteredServices.length, limit };

  const activeCount = services.filter((s) => s.status === 'active').length;
  const pausedCount = services.filter((s) => s.status === 'paused').length;
  const stoppedCount = services.filter((s) => s.status === 'stopped').length;

  const kpiItems: KpiCardItem[] = [
    { label: 'Tổng dịch vụ', value: services.length, icon: Package, iconColor: 'blue', changeLabel: '+4 dịch vụ mới', changeDirection: 'up' },
    { label: 'Đang cung cấp', value: activeCount, icon: CheckCircle2, iconColor: 'green', changeLabel: '+12.5% so với tháng trước', changeDirection: 'up' },
    { label: 'Tạm ngừng', value: pausedCount, icon: Pause, iconColor: 'amber', changeLabel: '20% so với tháng trước', changeDirection: 'down' },
    { label: 'Ngừng cung cấp', value: stoppedCount, icon: Archive, iconColor: 'pink', changeLabel: '0% so với tháng trước', changeDirection: 'up' },
  ];

  const openCreateModal = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const openEditModal = (service: BusinessServicePackage) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleSubmit = (values: Omit<BusinessServicePackage, 'id' | 'updatedAt'>) => {
    const today = '2026-07-10';
    if (editingService) {
      updateBusinessService(editingService.id, { ...values, updatedAt: today });
    } else {
      addBusinessService({ id: `biz-${Date.now()}`, updatedAt: today, ...values });
    }
    setServices(getBusinessServices());
    setIsFormOpen(false);
    setEditingService(null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingService) return;
    deleteBusinessService(deletingService.id);
    setServices((prev) => prev.filter((s) => s.id !== deletingService.id));
    setDeletingService(null);
  };

  const columns: TableColumn<BusinessServicePackage>[] = [
    {
      key: 'name',
      label: 'Dịch vụ',
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
      key: 'category',
      label: 'Danh mục',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{row.category}</span>,
    },
    {
      key: 'shortDescription',
      label: 'Mô tả ngắn',
      className: 'max-w-[260px]',
      render: (row) => <span className="line-clamp-2 text-slate-500">{row.shortDescription}</span>,
    },
    {
      key: 'priceFrom',
      label: 'Giá từ (VNĐ)',
      className: 'text-right font-semibold text-slate-900',
      render: (row) => formatCurrency(row.priceFrom),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge variant={BUSINESS_SERVICE_STATUS_META[row.status].variant}>{BUSINESS_SERVICE_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'updatedAt',
      label: 'Ngày cập nhật',
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
        title="Dịch vụ doanh nghiệp"
        description="Quản lý các gói dịch vụ, ưu đãi và giải pháp dành cho khách hàng doanh nghiệp."
      />

      <div className="mt-6">
        <DashboardStats items={kpiItems} />
      </div>

      <FilterBar>
        <FilterRow>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput width="fixed" value={searchInput} onChange={setSearchInput} placeholder="Tìm kiếm dịch vụ..." />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Danh mục</span>
              <div className="w-44">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[{ value: '', label: 'Tất cả' }, ...BUSINESS_SERVICE_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))]}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trạng thái</span>
              <div className="w-44">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as BusinessServiceStatus | '')}
                  options={[
                    { value: '', label: 'Tất cả' },
                    ...(Object.keys(BUSINESS_SERVICE_STATUS_META) as BusinessServiceStatus[]).map((s) => ({
                      value: s,
                      label: BUSINESS_SERVICE_STATUS_META[s].label,
                    })),
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary">
              <Download className="h-4 w-4" />
              Xuất Excel
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Thêm dịch vụ
            </Button>
          </div>
        </FilterRow>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={pageRows} rowKey={(row) => row.id} />
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </FilterBar>

      <BusinessServiceFormModal
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
        title="Xóa dịch vụ"
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
