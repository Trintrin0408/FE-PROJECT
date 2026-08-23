'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, MoreHorizontal } from 'lucide-react';
import { catalogApiService } from '@/services/catalog.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { ItemTypeFormModal, ItemTypeFormValues } from '@/components/catalog/ItemTypeFormModal';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import type { ItemType, ItemCategory } from '@/types/catalog';

export default function Page() {
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [types, setTypes] = useState<ItemType[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const { pagination, setPage, updatePagination } = usePagination(10);

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; type: ItemType | null } | null>(null);
  
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState('');

  const [refreshToken, setRefreshToken] = useState(0);
  const refetchData = () => setRefreshToken((t) => t + 1);

  // Load categories once for filter and form
  useEffect(() => {
    catalogApiService.getCategories({ limit: 1000 })
      .then((res) => {
        setCategories(res.data);
      })
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  // Load types
  useEffect(() => {
    setIsLoading(true);
    catalogApiService.getTypes({
      page: pagination.currentPage,
      limit: pagination.limit,
      search: debouncedSearch || undefined,
      categoryId: categoryFilter || undefined,
    })
      .then((res) => {
        setTypes(res.data);
        const totalItems = res.meta?.totalItems ?? res.data.length ?? 0;
        const limit = res.meta?.limit ?? pagination.limit;
        updatePagination({
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        });
      })
      .catch((err) => {
        console.error('Failed to fetch types', err);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit, debouncedSearch, categoryFilter, refreshToken]);

  const handleCreateTypeSubmit = async (values: ItemTypeFormValues) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await catalogApiService.createType(values);
      setFormModal(null);
      refetchData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Tạo nhóm thiết bị thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleEditTypeSubmit = async (values: ItemTypeFormValues, type: ItemType) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await catalogApiService.updateType(type.typeId, values);
      setFormModal(null);
      refetchData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Cập nhật nhóm thiết bị thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const columns: TableColumn<ItemType>[] = [
    {
      key: 'name',
      label: 'Tên nhóm',
      render: (row) => (
        <span className="font-medium text-slate-800">{row.typeName}</span>
      ),
    },
    {
      key: 'category',
      label: 'Thuộc danh mục',
      render: (row) => {
        const catName = row.categoryName || categories.find((c) => c.categoryId === row.categoryId)?.categoryName || '-';
        return <span className="text-slate-600">{catName}</span>;
      },
    },
    {
      key: 'description',
      label: 'Mô tả',
      render: (row) => (
        <span className="text-slate-500">{row.description || '-'}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'w-[120px]',
      render: (row) => (
        <div className="flex items-center gap-1">
          {canManage && (
            <>
              <button
                type="button"
                aria-label="Chỉnh sửa"
                title="Chỉnh sửa"
                onClick={(e) => {
                  e.stopPropagation();
                  setFormModal({ mode: 'edit', type: row });
                }}
                className="inline-flex rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Tùy chọn"
                title="Tùy chọn"
                className="inline-flex rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <MoreHorizontal className="h-4 w-4" />
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
        title="Nhóm thiết bị"
        description="Quản lý các nhóm thiết bị thuộc từng danh mục lớn"
        actions={
          canManage && (
            <Button onClick={() => setFormModal({ mode: 'create', type: null })}>
              <Plus className="h-4 w-4" />
              Thêm nhóm thiết bị
            </Button>
          )
        }
      />

      <FilterBar>
        <FilterRow>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              width="fixed"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Tìm theo mã hoặc tên nhóm..."
            />

            <div className="w-56">
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'Tất cả danh mục' },
                  ...categories.map((c) => ({ value: c.categoryId, label: c.categoryName })),
                ]}
              />
            </div>
          </div>

          <div className="text-sm text-slate-500">{pagination.totalItems} nhóm thiết bị</div>
        </FilterRow>

        <div className="mt-4 overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full py-10">Đang tải dữ liệu...</div>
          ) : (
            <Table columns={columns} rows={types} rowKey={(row) => row.typeId} />
          )}
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />
      </FilterBar>

      <ItemTypeFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        type={formModal?.type}
        categories={categories}
        isSubmitting={isSubmittingForm}
        errorMessage={formError}
        onClose={() => {
          setFormModal(null);
          setFormError('');
        }}
        onSubmit={(values) => {
          if (formModal?.mode === 'edit' && formModal.type) {
            handleEditTypeSubmit(values, formModal.type);
          } else {
            handleCreateTypeSubmit(values);
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
