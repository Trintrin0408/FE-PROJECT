'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AxiosError } from 'axios';
import { AlertCircle, Eye, Loader2, Mail, Pencil, Phone, Plus } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import CustomerFormModal, { type CustomerFormValues } from '@/components/customers/CustomerFormModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { CUSTOMER_STATUS_META } from '@/constants/customer-status';
import { customerApiService, type CustomerListMeta } from '@/services/customer.service';
import type { Customer, CustomerStatus } from '@/types/customer';

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosError = err as AxiosError<{ message?: string; error?: { message?: string } }>;
  return axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message ?? fallback;
}

const STATUS_TABS: { value: CustomerStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Tạm ngưng' },
];

const EMPTY_COUNTS = { all: 0, active: 0, inactive: 0 };

export default function ManagerCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<CustomerListMeta>({ page: 1, limit: 10, totalItems: 0, totalPages: 1, counts: EMPTY_COUNTS });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusTab, setStatusTab] = useState<CustomerStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset trang khi đổi bộ lọc/tìm kiếm
    setPage(1);
  }, [search, statusTab]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoading(true);
    setLoadError(null);
    customerApiService
      .getCustomers({ status: statusTab === 'all' ? undefined : statusTab, search: search || undefined, page, limit })
      .then((res) => {
        if (cancelled) return;
        setCustomers(res.data);
        if (res.meta) setMeta(res.meta);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(extractErrorMessage(err, 'Không tải được danh sách khách hàng. Vui lòng thử lại.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, statusTab, page, reloadTick]);

  const reload = () => setReloadTick((t) => t + 1);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (values: CustomerFormValues) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingCustomer) {
        await customerApiService.updateCustomer(editingCustomer.customerId, values);
      } else {
        await customerApiService.createCustomer(values);
      }
      setIsFormOpen(false);
      setEditingCustomer(null);
      reload();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể lưu hồ sơ khách hàng. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const paginationState: PaginationState = { currentPage: meta.page, totalPages: meta.totalPages, totalItems: meta.totalItems, limit: meta.limit };

  const columns: TableColumn<Customer>[] = [
    {
      key: 'customerName',
      label: 'Khách hàng',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.customerName} size="sm" />
          <div className="min-w-0">
            <Link href={`/manager/customers/${row.customerId}`} className="truncate font-medium text-blue-600 hover:underline block">
              {row.customerName}
            </Link>
            <p className="truncate text-xs text-slate-400">{row.address ? row.address.split(',').slice(-2).join(',').trim() : '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Liên hệ',
      render: (row) => (
        <div className="text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {row.phone}
          </p>
          {row.email && (
            <p className="mt-0.5 flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {row.email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'totalBookings',
      label: 'Đơn đặt / Chi tiêu',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.totalBookings} đơn</p>
          <p className="text-xs text-slate-500">{formatCurrency(row.totalSpent)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge variant={CUSTOMER_STATUS_META[row.status].variant}>{CUSTOMER_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'notes',
      label: 'Ghi chú',
      className: 'max-w-[200px]',
      render: (row) => (
        <span className="line-clamp-2 text-slate-500" title={row.notes ?? undefined}>
          {row.notes || 'Không có ghi chú'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/manager/customers/${row.customerId}`}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            aria-label="Sửa khách hàng"
            title="Sửa khách hàng"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Khách hàng"
        description="Quản lý hồ sơ khách hàng và lịch sử giao dịch."
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Thêm khách hàng
          </Button>
        }
      />

      <FilterBar>
        <FilterRow>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusTab(tab.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusTab === tab.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label} ({meta.counts[tab.value === 'all' ? 'all' : tab.value]})
              </button>
            ))}
          </div>
          <SearchInput width="fixed" value={searchInput} onChange={setSearchInput} placeholder="Tìm theo tên, SĐT, email..." />
        </FilterRow>

        {loadError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {loadError}
          </div>
        )}

        <div className="relative mt-4 overflow-x-auto">
          {isLoading && customers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải danh sách khách hàng...
            </div>
          ) : (
            <>
              <div className={isLoading ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
                <Table columns={columns} rows={customers} rowKey={(row) => row.customerId} />
              </div>
              {isLoading && (
                <div className="absolute inset-x-0 top-0 flex justify-center pt-6">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
              )}
            </>
          )}
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </FilterBar>

      <CustomerFormModal
        isOpen={isFormOpen}
        editingCustomer={editingCustomer}
        isSubmitting={isSubmitting}
        submitError={formError}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCustomer(null);
        }}
        onSubmit={handleSubmit}
      />
      {formError && isFormOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white shadow-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {formError}
        </div>
      )}
    </div>
  );
}
