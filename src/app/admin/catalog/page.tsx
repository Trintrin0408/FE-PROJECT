'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Trash2, Plus, Calculator, ImageIcon } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
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
  const router = useRouter();

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
      key: 'itemName',
      label: 'Tên thiết bị',
      render: (row) => (
        <button
          type="button"
          onClick={() => router.push(`/admin/catalog/${row.itemId}`)}
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
        return row.isCombo ? (
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
            onClick={() => router.push(`/admin/catalog/${row.itemId}`)}
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
                onClick={() => router.push(`/admin/catalog/${row.itemId}/edit`)}
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
      <PageHeader
        title="Danh sách thiết bị"
        description="Quản lý thiết bị đơn lẻ và combo cấu kiện"
        actions={
          canManage && (
            <Button onClick={() => router.push('/admin/catalog/create')}>
              <Plus className="h-4 w-4" />
              Thêm thiết bị
            </Button>
          )
        }
      />

      <FilterBar className="flex flex-col gap-4">
        <FilterRow layout="end">
          <SearchInput value={draftSearch} onChange={setDraftSearch} placeholder="Tìm theo mã hoặc tên thiết bị..." />

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
            <Button type="button" onClick={handleApplyFilters}>
              Áp dụng
            </Button>
            <Button type="button" variant="secondary" onClick={handleResetFilters}>
              Đặt lại
            </Button>
          </div>
        </FilterRow>

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
      </FilterBar>
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
