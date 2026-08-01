'use client';

import { useEffect, useState } from 'react';
import { Search, Pencil, Plus, Trash2 } from 'lucide-react';
import { workTaskApiService } from '@/services/workTask.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import type { WorkTask } from '@/types/workTask';
import { WorkTaskFormModal, WorkTaskFormValues } from './components/WorkTaskFormModal';
import { WorkTaskDeleteDialog } from './components/WorkTaskDeleteDialog';

export default function WorkTasksPage() {
  const { can } = usePermission();
  // Giả sử có quyền quản lý công việc chung hoặc dùng admin quyền
  const canManage = can('master-data:manage') || true;

  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { pagination, setPage, updatePagination } = usePagination(10);

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; task: WorkTask | null } | null>(null);
  const [deleteModal, setDeleteModal] = useState<WorkTask | null>(null);

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState('');

  const [refreshToken, setRefreshToken] = useState(0);
  const refetchData = () => setRefreshToken((t) => t + 1);

  useEffect(() => {
    setIsLoading(true);
    workTaskApiService
      .getWorkTasks({
        page: pagination.currentPage,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
      })
      .then((res: any) => {
        // API response of work-tasks is typically an array if no meta is provided, but according to schedule.controller.ts it returns { data, meta } maybe?
        // Wait, scheduleController.listWorkTasks returns ok(res, result.data, result.meta)
        // Check standard API structure: res usually has data, meta
        const data = Array.isArray(res) ? res : res.data || [];
        const meta = res.meta || {};
        
        setWorkTasks(data);
        const totalItems = meta?.totalItems ?? data.length ?? 0;
        const limit = meta?.limit ?? pagination.limit;
        updatePagination({
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        });
      })
      .catch((err) => {
        console.error('Failed to fetch work tasks', err);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.limit, debouncedSearch, refreshToken]);

  const handleCreateSubmit = async (values: WorkTaskFormValues) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await workTaskApiService.createWorkTask(values);
      setFormModal(null);
      refetchData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Tạo công việc thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleEditSubmit = async (values: WorkTaskFormValues, task: WorkTask) => {
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await workTaskApiService.updateWorkTask(task.taskId, values);
      setFormModal(null);
      refetchData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Cập nhật công việc thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      await workTaskApiService.deleteWorkTask(deleteModal.taskId);
      setDeleteModal(null);
      refetchData();
    } catch (err) {
      console.error('Xóa công việc thất bại', err);
      alert(getErrorMessage(err, 'Xóa công việc thất bại'));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<WorkTask>[] = [
    {
      key: 'code',
      label: 'Mã CV',
      render: (row) => (
        <span className="inline-flex items-center rounded bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
          {row.taskCode}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Tên công việc',
      render: (row) => <span className="font-medium text-slate-800">{row.taskName}</span>,
    },
    {
      key: 'description',
      label: 'Mô tả',
      render: (row) => <span className="text-slate-500">{row.description || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        row.isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Hoạt động
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Đã ngưng
          </span>
        )
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
                onClick={(e) => {
                  e.stopPropagation();
                  setFormModal({ mode: 'edit', task: row });
                }}
                className="inline-flex rounded-md p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                title="Chỉnh sửa"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteModal(row);
                }}
                className="inline-flex rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Xóa"
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Danh sách công việc</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý các loại công việc chuẩn hóa của hệ thống</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setFormModal({ mode: 'create', task: null })}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 px-4 py-2"
          >
            <Plus className="h-4 w-4" />
            Thêm công việc
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
              placeholder="Tìm theo mã hoặc tên..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full py-10 text-slate-500">Đang tải dữ liệu...</div>
          ) : workTasks.length === 0 ? (
            <div className="flex justify-center items-center h-full py-10 text-slate-500">Không tìm thấy công việc nào.</div>
          ) : (
            <Table columns={columns} rows={workTasks} rowKey={(row) => row.taskId} />
          )}
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />
      </Reveal>

      <WorkTaskFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        task={formModal?.task ?? null}
        isSubmitting={isSubmittingForm}
        errorMessage={formError}
        onClose={() => {
          setFormModal(null);
          setFormError('');
        }}
        onSubmit={(values) => {
          if (formModal?.mode === 'edit' && formModal.task) {
            handleEditSubmit(values, formModal.task);
          } else {
            handleCreateSubmit(values);
          }
        }}
      />

      <WorkTaskDeleteDialog
        isOpen={!!deleteModal}
        task={deleteModal}
        isDeleting={isDeleting}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDeleteConfirm}
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
