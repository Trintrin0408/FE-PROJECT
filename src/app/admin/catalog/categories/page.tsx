'use client';

import { useEffect, useState } from 'react';
import { Search, Pencil, Plus, MoreHorizontal } from 'lucide-react';
import { catalogApiService } from '@/services/catalog.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CategoryFormModal, CategoryFormValues } from '@/components/catalog/CategoryFormModal';
import Reveal from '@/components/ui/Reveal';
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Danh mục lớn</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý các danh mục cấp cao của thiết bị và phụ kiện</p>
        </div>
        {canManage && (
          <Button onClick={() => setFormModal({ mode: 'create', category: null })} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 px-4 py-2">
            <Plus className="h-4 w-4" />
            Thêm danh mục
          </Button>
        )}
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo mã hoặc tên danh mục..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full py-10">Đang tải dữ liệu...</div>
          ) : (
            <Table columns={columns} rows={categories} rowKey={(row) => row.categoryId} />
          )}
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />
      </Reveal>

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
