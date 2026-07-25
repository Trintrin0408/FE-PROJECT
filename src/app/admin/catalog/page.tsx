'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Eye, Pencil, Trash2, Plus, Calculator, ImageIcon } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { CatalogItemFormModal, CatalogItemFormValues } from '@/components/catalog/CatalogItemFormModal';
import { CatalogItemDetailModal } from '@/components/catalog/CatalogItemDetailModal';
import Reveal from '@/components/ui/Reveal';
import { catalogApiService } from '@/services/catalog.service';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Item, ItemStatus, ItemType, ItemCategory } from '@/types/catalog';

const STATUS_LABEL: Record<ItemStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  MAINTENANCE: 'Bảo trì',
};

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'MAINTENANCE', label: 'Bảo trì' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
];

export default function Page() {
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [items, setItems] = useState<Item[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Draft filters
  const [draftSearch, setDraftSearch] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftType, setDraftType] = useState('');
  const [draftStatus, setDraftStatus] = useState('');

  // Applied filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { pagination, setPage, updatePagination } = usePagination(10);

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; item: Item | null } | null>(null);
  const [formError, setFormError] = useState('');

  const [detailItem, setDetailItem] = useState<Item | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, typesRes, catRes] = await Promise.all([
        catalogApiService.getItems(),
        catalogApiService.getTypes(),
        catalogApiService.getCategories(),
      ]);
      setItems(itemsRes.data ?? []);
      setTypes(typesRes.data ?? []);
      setCategories(catRes.data ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilters = () => {
    setSearch(draftSearch);
    setCategoryFilter(draftCategory);
    setTypeFilter(draftType);
    setStatusFilter(draftStatus);
    setPage(1);
  };

  const handleResetFilters = () => {
    setDraftSearch('');
    setDraftCategory('');
    setDraftType('');
    setDraftStatus('');
    setSearch('');
    setCategoryFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  // Build type options based on selected category
  const typeOptions = useMemo(() => {
    const filteredTypes = draftCategory 
      ? types.filter(t => t.categoryId === draftCategory)
      : types;
    return [
      { value: '', label: 'Tất cả nhóm' },
      ...filteredTypes.map(t => ({ value: t.typeId, label: t.typeName }))
    ];
  }, [types, draftCategory]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      // Find item's type to check category
      const itemType = types.find(t => t.typeId === item.typeId);
      
      if (categoryFilter && itemType?.categoryId !== categoryFilter) return false;
      if (typeFilter && item.typeId !== typeFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (term && !(item.itemName.toLowerCase().includes(term) || item.itemCode.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [items, search, categoryFilter, typeFilter, statusFilter, types]);

  useEffect(() => {
    updatePagination({
      totalItems: filteredItems.length,
      totalPages: Math.max(1, Math.ceil(filteredItems.length / pagination.limit)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, pagination.limit]);

  const pageItems = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.limit;
    return filteredItems.slice(start, start + pagination.limit);
  }, [filteredItems, pagination.currentPage, pagination.limit]);

  const handleCreateSubmit = async (values: CatalogItemFormValues) => {
    setIsSubmitting(true);
    setFormError('');
    try {
      await catalogApiService.createItem(values);
      await fetchData();
      setFormModal(null);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Có lỗi xảy ra khi tạo thiết bị'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (values: CatalogItemFormValues, item: Item) => {
    setIsSubmitting(true);
    setFormError('');
    try {
      await catalogApiService.updateItem(item.itemId, values);
      await fetchData();
      setFormModal(null);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Có lỗi xảy ra khi cập nhật thiết bị'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`Xóa sản phẩm "${item.itemName}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await catalogApiService.updateItemStatus(item.itemId, { status: 'INACTIVE' });
      await fetchData();
    } catch (error) {
      alert(getErrorMessage(error, 'Có lỗi xảy ra khi xóa thiết bị'));
    }
  };

  const renderStatusBadge = (status: ItemStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center rounded bg-green-50 px-2.5 py-1 text-[13px] font-medium text-green-700 border border-green-100">Đang hoạt động</span>;
      case 'MAINTENANCE':
        return <span className="inline-flex items-center rounded bg-orange-50 px-2.5 py-1 text-[13px] font-medium text-orange-600 border border-orange-100">Bảo trì</span>;
      case 'INACTIVE':
        return <span className="inline-flex items-center rounded bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-600 border border-slate-200">Ngừng hoạt động</span>;
      default:
        return <span className="inline-flex items-center rounded bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-600 border border-slate-200">{status}</span>;
    }
  };

  const columns: TableColumn<Item>[] = [
    {
      key: 'image',
      label: 'Ảnh',
      render: (row) => (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.itemName} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-300" />
          )}
        </div>
      ),
    },
    { 
      key: 'itemCode', 
      label: 'Mã thiết bị', 
      render: (row) => <span className="text-slate-600">{row.itemCode}</span> 
    },
    {
      key: 'itemName',
      label: 'Tên thiết bị',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDetailItem(row)}
          className="text-left font-medium text-slate-900 hover:text-blue-600"
        >
          {row.itemName}
        </button>
      ),
    },
    {
      key: 'itemType',
      label: 'Loại hàng',
      render: (row) => {
        const isBom = row.unit.toLowerCase() === 'bộ';
        return isBom ? (
          <span className="inline-flex items-center rounded bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">Ghép bộ</span>
        ) : (
          <span className="inline-flex items-center rounded bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">Đơn lẻ</span>
        );
      }
    },
    { key: 'typeName', label: 'Thuộc nhóm', render: (row) => <span className="text-slate-600">{row.typeName ?? '—'}</span> },
    { key: 'unit', label: 'Đơn vị', render: (row) => <span className="text-slate-600">{row.unit}</span> },
    { key: 'rentalPrice', label: 'Giá cho thuê', render: (row) => <span className="text-slate-900">{formatCurrency(row.rentalPrice)}</span> },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            onClick={() => setDetailItem(row)}
            className="inline-flex rounded-md p-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          {canManage && (
            <>
              <button
                type="button"
                aria-label="Chỉnh sửa"
                title="Chỉnh sửa"
                onClick={() => setFormModal({ mode: 'edit', item: row })}
                className="inline-flex rounded-md p-1.5 border border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Xóa"
                title="Xóa"
                onClick={() => handleDelete(row)}
                className="inline-flex rounded-md p-1.5 border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Danh sách thiết bị</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý thiết bị đơn lẻ và combo cấu kiện</p>
        </div>
        {canManage && (
          <Button onClick={() => setFormModal({ mode: 'create', item: null })} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 px-4 py-2">
            <Plus className="h-4 w-4" />
            Thêm thiết bị
          </Button>
        )}
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col gap-4">
        {/* Filters Row */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-white invisible">Tìm kiếm</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã hoặc tên thiết bị..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="w-[180px]">
            <Select
              label="Danh mục"
              value={draftCategory}
              onChange={(e) => {
                setDraftCategory(e.target.value);
                setDraftType(''); // Reset type when category changes
              }}
              options={[{ value: '', label: 'Tất cả danh mục' }, ...categories.map((c) => ({ value: c.categoryId, label: c.categoryName }))]}
            />
          </div>

          <div className="w-[180px]">
            <Select
              label="Nhóm thiết bị"
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              options={typeOptions}
            />
          </div>

          <div className="w-[160px]">
            <Select
              label="Trạng thái"
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
              options={[{ value: '', label: 'Tất cả trạng thái' }, ...STATUS_OPTIONS]}
            />
          </div>

          <div className="flex gap-2 mb-0.5">
            <Button type="button" onClick={handleApplyFilters} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-[38px] px-5">
              Áp dụng
            </Button>
            <Button type="button" variant="secondary" onClick={handleResetFilters} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg h-[38px] px-5">
              Đặt lại
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <Table columns={columns} rows={pageItems} rowKey={(row) => row.itemId} isLoading={isLoading} />
        </div>

        {/* Pagination */}
        <Pagination 
          pagination={pagination} 
          onPageChange={setPage} 
          onLimitChange={(limit) => updatePagination({ limit })}
          itemName="thiết bị"
        />
      </Reveal>

      <CatalogItemFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        item={formModal?.item}
        types={types}
        isSubmitting={isSubmitting}
        errorMessage={formError}
        onClose={() => {
          setFormModal(null);
          setFormError('');
        }}
        onSubmit={(values) => {
          if (formModal?.mode === 'edit' && formModal.item) {
            handleEditSubmit(values, formModal.item);
          } else {
            handleCreateSubmit(values);
          }
        }}
      />

      <CatalogItemDetailModal isOpen={!!detailItem} item={detailItem} onClose={() => setDetailItem(null)} />
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
