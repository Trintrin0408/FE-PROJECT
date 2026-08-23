'use client';

import { useMemo, useState } from 'react';
import { Boxes, Eye, Package, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import EquipmentDetailModal from '@/components/catalog/EquipmentDetailModal';
import EquipmentFormModal from '@/components/catalog/EquipmentFormModal';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { usePermission } from '@/hooks/usePermission';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  AdminEquipment,
  CreateEquipmentInput,
  EQUIPMENT_STATUS_META,
  StockLogType,
  adjustAdminEquipmentStock,
  createAdminEquipment,
  deleteAdminEquipment,
  getAdminEquipment,
  updateAdminEquipment,
} from '@/mocks/db/catalog';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminEquipmentMock.ts. Bố cục port từ
// docs/components/ProductsAndEquipmentView.tsx do người dùng cung cấp: KPI tổng quan, lọc theo danh
// mục/trạng thái/tìm kiếm, bảng danh sách sản phẩm & thiết bị, modal xem chi tiết (thông số + tồn kho +
// điều chỉnh kho + nhật ký biến động) và modal thêm/sửa. Rút gọn so với bản gốc (bỏ chế độ lưới, chọn
// hàng loạt, mô phỏng tồn kho theo ngày) để phù hợp quy mô danh mục thật của dự án — vẫn giữ đúng luồng
// nghiệp vụ cốt lõi: quản lý danh mục + tồn kho + lịch sử biến động cho từng sản phẩm/thiết bị.

export default function AdminEquipmentCatalogPage() {
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [equipment, setEquipment] = useState<AdminEquipment[]>(() => getAdminEquipment());
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [viewingEquipment, setViewingEquipment] = useState<AdminEquipment | null>(null);
  const [formModal, setFormModal] = useState<{ equipment: AdminEquipment | null } | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<AdminEquipment | null>(null);

  const refresh = () => setEquipment(getAdminEquipment());

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    equipment.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
  }, [equipment]);

  const kpis = useMemo(() => {
    const totalValue = equipment.reduce((sum, e) => sum + e.price * e.totalStock, 0);
    const active = equipment.filter((e) => e.status === 'active').length;
    const needsMaintenance = equipment.filter((e) => e.maintenanceStock > 0).length;
    return { totalValue, active, needsMaintenance };
  }, [equipment]);

  const kpiItems: KpiCardItem[] = [
    { label: 'Tổng sản phẩm & thiết bị', value: equipment.length, icon: Boxes, iconColor: 'blue' },
    { label: 'Đang hoạt động', value: kpis.active, icon: Package, iconColor: 'green' },
    { label: 'Cần bảo trì', value: kpis.needsMaintenance, icon: Wrench, iconColor: 'amber' },
    { label: 'Tổng giá trị tồn kho', value: formatCurrency(kpis.totalValue), icon: Boxes, iconColor: 'pink' },
  ];

  const filteredEquipment = useMemo(() => {
    const term = search.trim().toLowerCase();
    return equipment.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!term) return true;
      return e.id.toLowerCase().includes(term) || e.name.toLowerCase().includes(term) || e.category.toLowerCase().includes(term);
    });
  }, [equipment, search, categoryFilter, statusFilter]);

  const handleCreateOrUpdate = (values: CreateEquipmentInput) => {
    if (formModal?.equipment) {
      updateAdminEquipment(formModal.equipment.id, values);
    } else {
      createAdminEquipment(values);
    }
    refresh();
    setFormModal(null);
  };

  const handleAdjustStock = (type: StockLogType, quantity: number, reason: string) => {
    if (!viewingEquipment) return;
    adjustAdminEquipmentStock(viewingEquipment.id, type, quantity, reason, 'Điều chỉnh thủ công');
    refresh();
    setViewingEquipment(getAdminEquipment().find((e) => e.id === viewingEquipment.id) ?? null);
  };

  const handleDeleteConfirm = () => {
    if (!deletingEquipment) return;
    deleteAdminEquipment(deletingEquipment.id);
    setDeletingEquipment(null);
    refresh();
  };

  const columns: TableColumn<AdminEquipment>[] = [
    {
      key: 'id',
      label: 'Mã',
      render: (row) => <span className="font-mono text-sm font-semibold text-blue-600">{row.id}</span>,
    },
    {
      key: 'name',
      label: 'Tên sản phẩm & thiết bị',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-400">{row.category}</p>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Đơn giá',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium text-slate-700">
          {formatCurrency(row.price)} <span className="text-xs text-slate-400">/{row.unit.toLowerCase()}</span>
        </span>
      ),
    },
    {
      key: 'stock',
      label: 'Tồn kho (Khả dụng / Đi tiệc / Bảo trì)',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{row.availableStock}</span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{row.rentedStock}</span>
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">{row.maintenanceStock}</span>
          <span className="text-slate-400">/ {row.totalStock} {row.unit}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge variant={EQUIPMENT_STATUS_META[row.status].variant}>{EQUIPMENT_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            onClick={() => setViewingEquipment(row)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          {canManage && (
            <>
              <button
                type="button"
                aria-label="Chỉnh sửa"
                title="Chỉnh sửa"
                onClick={() => setFormModal({ equipment: row })}
                className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Xóa"
                title="Xóa"
                onClick={() => setDeletingEquipment(row)}
                className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Gói sản phẩm & dịch vụ"
        description="Danh mục sản phẩm & thiết bị sự kiện cưới của doanh nghiệp, kèm tồn kho theo từng mặt hàng."
        actions={
          canManage && (
            <Button onClick={() => setFormModal({ equipment: null })}>
              <Plus className="h-4 w-4" />
              Thêm sản phẩm
            </Button>
          )
        }
      />

      <div className="mt-6">
        <DashboardStats items={kpiItems} />
      </div>

      <FilterBar>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({equipment.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategoryFilter(c.category)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                categoryFilter === c.category ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.category} ({c.count})
            </button>
          ))}
        </div>

        <div className="mt-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            width="grow"
            className="sm:max-w-sm"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Tìm theo mã, tên sản phẩm..."
          />
          <div className="flex items-center gap-1.5">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'Tất cả trạng thái' : EQUIPMENT_STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Table columns={columns} rows={filteredEquipment} rowKey={(row) => row.id} />
        </div>
      </FilterBar>

      <EquipmentDetailModal
        isOpen={Boolean(viewingEquipment)}
        onClose={() => setViewingEquipment(null)}
        equipment={viewingEquipment}
        onAdjustStock={handleAdjustStock}
      />

      <EquipmentFormModal
        isOpen={Boolean(formModal)}
        onClose={() => setFormModal(null)}
        equipment={formModal?.equipment ?? null}
        onSubmit={handleCreateOrUpdate}
      />

      <Modal
        isOpen={Boolean(deletingEquipment)}
        onClose={() => setDeletingEquipment(null)}
        title="Xóa sản phẩm & thiết bị"
        subtitle={deletingEquipment ? `Bạn có chắc muốn xóa "${deletingEquipment.name}"? Hành động này không thể hoàn tác.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingEquipment(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Xóa
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}
