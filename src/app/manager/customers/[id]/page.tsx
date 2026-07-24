'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import { motion } from 'framer-motion';
import {
  AlertCircle, Clock, Eye, Loader2, Mail, MapPin,
  MoreHorizontal, Pencil, Phone, Search, ShoppingCart, User,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import CustomerFormModal, { type CustomerFormValues } from '@/components/customers/CustomerFormModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { CUSTOMER_STATUS_META } from '@/constants/customer-status';
import { customerApiService, type ApiListMeta } from '@/services/customer.service';
import type { CustomerOrderStatus, CustomerOrderSummary, CustomerSummary } from '@/types/customer';
import { BOOKING_STATUS_META as CUSTOMER_ORDER_STATUS_META } from '@/mocks/db/orders';

// Trang chi tiết khách hàng — nối API thật theo docs/khach_hang_api.md mục 2.6/2.7. Đã bỏ
// clientType/tier/source/coordinatorName (cấp Customer) và contract/signedContractsCount theo
// quyết định 3+4 (mục 3 của doc) — hệ thống không có dữ liệu/khái niệm thật đứng sau các trường này.

type ServiceFilter = 'all' | 'wedding' | 'corporate';

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosError = err as AxiosError<{ message?: string; error?: { message?: string } }>;
  return axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message ?? fallback;
}

export default function ManagerCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [ordersMeta, setOrdersMeta] = useState<ApiListMeta>({ page: 1, limit: 6, totalItems: 0, totalPages: 1 });
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<CustomerOrderStatus | 'all'>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 6;

  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoadingSummary(true);
    setSummaryError(null);
    customerApiService
      .getCustomerSummary(id)
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch((err) => {
        if (!cancelled) setSummaryError(extractErrorMessage(err, 'Không tải được thông tin khách hàng.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSummary(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadTick]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset trang khi đổi bộ lọc/tìm kiếm
    setPage(1);
  }, [search, statusFilter, serviceFilter]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoadingOrders(true);
    setOrdersError(null);
    customerApiService
      .getCustomerOrders(id, {
        search: search || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        serviceFilter: serviceFilter === 'all' ? undefined : serviceFilter,
        page,
        limit,
      })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.data);
        if (res.meta) setOrdersMeta(res.meta);
      })
      .catch((err) => {
        if (!cancelled) setOrdersError(extractErrorMessage(err, 'Không tải được danh sách đơn hàng.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, search, statusFilter, serviceFilter, page, reloadTick]);

  const handleEditSubmit = async (values: CustomerFormValues) => {
    if (!summary) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await customerApiService.updateCustomer(summary.customer.customerId, values);
      setIsEditOpen(false);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể lưu hồ sơ khách hàng. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSummary) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải thông tin khách hàng...
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {summaryError ?? 'Không tìm thấy khách hàng.'}
        </div>
        <Link href="/manager/customers" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const { customer } = summary;
  const paginationState: PaginationState = { currentPage: ordersMeta.page, totalPages: ordersMeta.totalPages, totalItems: ordersMeta.totalItems, limit: ordersMeta.limit };

  return (
    <div className="p-6 print:p-0">
      <Breadcrumb
        items={[
          { label: 'Khách hàng' },
          { label: 'Danh sách khách hàng', href: '/manager/customers' },
          { label: customer.customerId },
        ]}
      />

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton href="/manager/customers" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chi tiết khách hàng</h1>
            <p className="mt-1 text-sm text-slate-500">Theo dõi thông tin hồ sơ khách hàng, lịch sử giao dịch và danh sách đơn hàng liên quan.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            onClick={() => {
              setFormError(null);
              setIsEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Chỉnh sửa khách hàng
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={customer.customerName} size="lg" />
            <div>
              <p className="text-lg font-bold text-slate-900">{customer.customerId}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Mã khách hàng</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tên khách hàng</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{customer.customerName}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày tạo</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatDate(summary.createdAt)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Trạng thái</p>
            <div className="mt-1">
              <Badge variant={CUSTOMER_STATUS_META[customer.status].variant}>{CUSTOMER_STATUS_META[customer.status].label}</Badge>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tổng giá trị giao dịch</p>
            <p className="mt-0.5 text-xl font-bold text-blue-600">{formatCurrency(summary.totalValue)}</p>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <User className="h-4 w-4 text-blue-600" />
              Thông tin khách hàng
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Người liên hệ</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{customer.customerName}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Số điện thoại</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{customer.phone}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Email</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{customer.email || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Địa chỉ</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{customer.address || '—'}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ghi chú cụ thể</p>
              <p className="mt-1.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{customer.notes || 'Không có ghi chú.'}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              Danh sách đơn hàng của khách hàng
            </h2>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo mã đơn / sự kiện..."
                  className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-44">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as CustomerOrderStatus | 'all')}
                  options={[
                    { value: 'all', label: 'Tất cả trạng thái' },
                    ...(Object.keys(CUSTOMER_ORDER_STATUS_META) as CustomerOrderStatus[]).map((s) => ({
                      value: s,
                      label: CUSTOMER_ORDER_STATUS_META[s].label,
                    })),
                  ]}
                />
              </div>
              <div className="w-52">
                <Select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value as ServiceFilter)}
                  options={[
                    { value: 'all', label: 'Tất cả loại dịch vụ' },
                    { value: 'wedding', label: 'Gói tiệc cưới/đính hôn' },
                    { value: 'corporate', label: 'Gói sự kiện doanh nghiệp' },
                  ]}
                />
              </div>
            </div>

            {ordersError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {ordersError}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Mã đơn</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Sự kiện / Gói dịch vụ</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Ngày tổ chức</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Giá trị</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Phụ trách</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        Không tìm thấy đơn hàng nào.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.orderId} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-500">{order.orderId}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{order.event}</td>
                        <td className="px-3 py-2.5 text-slate-500">{formatDate(order.date)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(order.value)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={CUSTOMER_ORDER_STATUS_META[order.status].variant}>{CUSTOMER_ORDER_STATUS_META[order.status].label}</Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={order.coordinator} size="sm" />
                            <span className="whitespace-nowrap text-xs font-medium text-slate-700">{order.coordinator}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/manager/orders/${order.orderId}`}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                              aria-label="Xem đơn hàng"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Thêm thao tác">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination pagination={paginationState} onPageChange={setPage} />

            <Link href="/manager/customers" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline print:hidden">
              ← Quay lại danh sách khách hàng
            </Link>
          </motion.div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h2 className="text-sm font-semibold text-slate-900">Hồ sơ nhanh</h2>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={customer.customerName} size="lg" />
              <div className="min-w-0 space-y-0.5 text-xs">
                <p className="truncate text-sm font-bold text-slate-900">{customer.customerName}</p>
                <p className="flex items-center gap-1.5 text-slate-600">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </p>
                <p className="flex items-center gap-1.5 truncate text-slate-600">
                  <Mail className="h-3 w-3" /> {customer.email || '—'}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Địa chỉ giao dịch</p>
                  <p className="mt-0.5 font-medium text-slate-700">{customer.address || '—'}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
          >
            <h2 className="text-sm font-semibold text-slate-900">Tổng quan giao dịch</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tổng đơn hàng</p>
                <p className="mt-1 font-mono text-lg font-bold text-blue-600">{customer.totalBookings}</p>
                <div className="mt-1 flex justify-end">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đang hoạt động</p>
                <p className="mt-1 font-mono text-lg font-bold text-amber-600">{summary.activeOrdersCount}</p>
                <div className="mt-1 flex justify-end">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Công nợ còn lại</p>
                <p className="mt-1.5 font-mono text-sm font-bold text-red-600">{formatCurrency(summary.remainingDebt)}</p>
                <div className="mt-1 flex justify-end">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs print:hidden"
          >
            <h2 className="text-sm font-semibold text-slate-900">Công nợ & thanh toán</h2>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Tỷ lệ thanh toán</span>
                <span className="text-blue-600">{summary.paymentRate}%</span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${summary.paymentRate}%` }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đã thanh toán</p>
                <p className="mt-1 font-mono text-xs font-bold text-emerald-600">{formatCurrency(summary.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Còn lại</p>
                <p className="mt-1 font-mono text-xs font-bold text-red-600">{formatCurrency(summary.remainingDebt)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tổng công nợ giao dịch</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-800">{formatCurrency(summary.totalValue)}</p>
            </div>
          </motion.div>
        </div>
      </div>

      <CustomerFormModal
        isOpen={isEditOpen}
        editingCustomer={customer}
        isSubmitting={isSubmitting}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEditSubmit}
      />
      {formError && isEditOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white shadow-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {formError}
        </div>
      )}
    </div>
  );
}
