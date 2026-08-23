'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, MoreHorizontal } from 'lucide-react';
import { catalogApiService } from '@/services/catalog.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { CategoryFormModal, CategoryFormValues } from '@/components/catalog/CategoryFormModal';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import type { ItemCategory } from '@/types/catalog';

export default function Page() {
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { pagination, setPage, updatePagination } = usePagination(10);

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; category: ItemCategory | null } | null>(null);
  
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState('');

  const [refreshToken, setRefreshToken] = useState(0);
  const refetchData = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    setIsLoading(true);
    catalogApiService.getCategories({
      page: pagination.currentPage,
      limit: pagination.limit,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        setCategories(res.data);
        const totalItems = res.meta?.totalItems ?? res.data.length ?? 0;
        const limit = res.meta?.limit ?? pagination.limit;
        updatePagination({
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        });
      })
      .catch((err) => {
        console.error('Failed to fetch categories', err);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit, debouncedSearch, refreshToken]);

  const handleCreateCategorySubmit = async (values: CategoryFormValues) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await catalogApiService.createCategory(values);
      setFormModal(null);
      refetchData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Tạo danh mục thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleEditCategorySubmit = async (values: CategoryFormValues, category: ItemCategory) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await catalogApiService.updateCategory(category.categoryId, values);
      setFormModal(null);
      refetchData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Cập nhật danh mục thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const columns: TableColumn<ItemCategory>[] = [

    {
      key: 'name',
      label: 'Tên danh mục',
      render: (row) => (
        <span className="font-medium text-slate-800">{row.categoryName}</span>
      ),
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
                  setFormModal({ mode: 'edit', category: row });
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
        title="Danh mục lớn"
        description="Quản lý các danh mục cấp cao của thiết bị và phụ kiện"
        actions={
          canManage && (
            <Button onClick={() => setFormModal({ mode: 'create', category: null })}>
              <Plus className="h-4 w-4" />
              Thêm danh mục
            </Button>
          )
        }
      />

      <FilterBar>
        <FilterRow>
          <SearchInput
            width="fixed"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm theo mã hoặc tên danh mục..."
          />
        </FilterRow>

        <div className="mt-4 overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full py-10">Đang tải dữ liệu...</div>
          ) : (
            <Table columns={columns} rows={categories} rowKey={(row) => row.categoryId} />
          )}
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />
      </FilterBar>

      <CategoryFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        category={formModal?.category}
        isSubmitting={isSubmittingForm}
        errorMessage={formError}
        onClose={() => {
          setFormModal(null);
          setFormError('');
        }}
        onSubmit={(values) => {
          if (formModal?.mode === 'edit' && formModal.category) {
            handleEditCategorySubmit(values, formModal.category);
          } else {
            handleCreateCategorySubmit(values);
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
