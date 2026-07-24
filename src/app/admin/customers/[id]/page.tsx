'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle, Building, Clock, Eye, FileText, Filter, Mail, MapPin,
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
import CustomerFormModal from '@/components/customers/CustomerFormModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { CUSTOMER_STATUS_META, AdminCustomer, updateAdminCustomer } from '@/mocks/db/customers';
import { BOOKING_STATUS_META as CUSTOMER_ORDER_STATUS_META, getAdminCustomerDetail, type BookingStatus } from '@/mocks/db/orders';

// Trang thuần giao diện — port từ docs/components/CustomerDetailView.tsx, xem giải thích ở đầu
// src/mocks/adminCustomersMock.ts.

type ServiceFilter = 'all' | 'wedding' | 'corporate';

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState(() => getAdminCustomerDetail(id));
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 6;

  const filteredOrders = useMemo(() => {
    if (!detail) return [];
    const term = search.trim().toLowerCase();
    return detail.orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (serviceFilter === 'wedding' && !/(cưới|đính hôn)/i.test(o.event)) return false;
      if (serviceFilter === 'corporate' && !/(hội nghị|kỷ niệm|gala)/i.test(o.event)) return false;
      if (!term) return true;
      return o.id.toLowerCase().includes(term) || o.event.toLowerCase().includes(term);
    });
  }, [detail, search, statusFilter, serviceFilter]);

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Không tìm thấy khách hàng.</p>
        <Link href="/admin/customers" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const { customer } = detail;

  const handleEditSubmit = (values: Omit<AdminCustomer, 'customerId' | 'totalBookings' | 'totalSpent'>) => {
    updateAdminCustomer(customer.customerId, values);
    setDetail(getAdminCustomerDetail(id));
    setIsEditOpen(false);
  };

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageOrders = filteredOrders.slice((safePage - 1) * limit, safePage * limit);
  const paginationState: PaginationState = { currentPage: safePage, totalPages, totalItems: filteredOrders.length, limit };

  return (
    <div className="p-6 print:p-0">
      <Breadcrumb
        items={[
          { label: 'Khách hàng' },
          { label: 'Danh sách khách hàng', href: '/admin/customers' },
          { label: customer.customerId },
        ]}
      />

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton href="/admin/customers" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chi tiết khách hàng</h1>
            <p className="mt-1 text-sm text-slate-500">Theo dõi thông tin hồ sơ khách hàng, lịch sử giao dịch và danh sách đơn hàng liên quan.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button onClick={() => setIsEditOpen(true)}>
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
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Loại khách hàng</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{detail.clientType}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày tạo</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatDate(detail.createdAt)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Phụ trách</p>
            <div className="mt-0.5 flex items-center gap-2">
              <Avatar name={detail.coordinatorName} size="sm" />
              <span className="text-sm font-semibold text-slate-800">{detail.coordinatorName}</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Trạng thái</p>
            <div className="mt-1">
              <Badge variant={CUSTOMER_STATUS_META[customer.status].variant}>{CUSTOMER_STATUS_META[customer.status].label}</Badge>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tổng giá trị giao dịch</p>
            <p className="mt-0.5 text-xl font-bold text-blue-600">{formatCurrency(detail.totalValue)}</p>
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
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Nguồn khách</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{detail.source}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Địa chỉ</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{customer.address}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Hạng khách hàng</p>
                <div className="mt-1">
                  <Badge variant={detail.tier === 'VIP' ? 'warning' : 'neutral'}>{detail.tier}</Badge>
                </div>
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
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm theo mã đơn / sự kiện..."
                  className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="w-44">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as BookingStatus | 'all');
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Tất cả trạng thái' },
                    ...(Object.keys(CUSTOMER_ORDER_STATUS_META) as BookingStatus[]).map((s) => ({
                      value: s,
                      label: CUSTOMER_ORDER_STATUS_META[s].label,
                    })),
                  ]}
                />
              </div>
              <div className="w-52">
                <Select
                  value={serviceFilter}
                  onChange={(e) => {
                    setServiceFilter(e.target.value as ServiceFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Tất cả loại dịch vụ' },
                    { value: 'wedding', label: 'Gói tiệc cưới/đính hôn' },
                    { value: 'corporate', label: 'Gói sự kiện doanh nghiệp' },
                  ]}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setServiceFilter('all');
                }}
              >
                <Filter className="h-4 w-4" />
                Bộ lọc
              </Button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Mã đơn</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Sự kiện / Gói dịch vụ</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Ngày tổ chức</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Giá trị</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Hợp đồng</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Phụ trách</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pageOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                        Không tìm thấy đơn hàng nào.
                      </td>
                    </tr>
                  ) : (
                    pageOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-500">{order.id}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{order.event}</td>
                        <td className="px-3 py-2.5 text-slate-500">{formatDate(order.date)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(order.value)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={CUSTOMER_ORDER_STATUS_META[order.status].variant}>{CUSTOMER_ORDER_STATUS_META[order.status].label}</Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{order.contract}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={order.coordinator} size="sm" />
                            <span className="whitespace-nowrap text-xs font-medium text-slate-700">{order.coordinator}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600" aria-label="Xem đơn hàng">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
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

            <Link href="/admin/customers" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline print:hidden">
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
                <Building className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Doanh nghiệp / Đơn vị</p>
                  <p className="mt-0.5 font-medium text-slate-700">{detail.clientType === 'Doanh nghiệp' ? 'Có liên kết doanh nghiệp' : 'Hộ gia đình'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Địa chỉ giao dịch</p>
                  <p className="mt-0.5 font-medium text-slate-700">{customer.address}</p>
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
                <p className="mt-1 font-mono text-lg font-bold text-blue-600">{detail.orders.length}</p>
                <div className="mt-1 flex justify-end">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đang hoạt động</p>
                <p className="mt-1 font-mono text-lg font-bold text-amber-600">{detail.activeOrdersCount}</p>
                <div className="mt-1 flex justify-end">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hợp đồng đã ký</p>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-600">{detail.signedContractsCount}</p>
                <div className="mt-1 flex justify-end">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Công nợ còn lại</p>
                <p className="mt-1.5 font-mono text-xs font-bold text-red-600">{formatCurrency(detail.remainingDebt)}</p>
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
                <span className="text-blue-600">{detail.paymentRate}%</span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${detail.paymentRate}%` }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đã thanh toán</p>
                <p className="mt-1 font-mono text-xs font-bold text-emerald-600">{formatCurrency(detail.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Còn lại</p>
                <p className="mt-1 font-mono text-xs font-bold text-red-600">{formatCurrency(detail.remainingDebt)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tổng công nợ giao dịch</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-800">{formatCurrency(detail.totalValue)}</p>
            </div>
          </motion.div>
        </div>
      </div>

      <CustomerFormModal isOpen={isEditOpen} editingCustomer={customer} onClose={() => setIsEditOpen(false)} onSubmit={handleEditSubmit} />
    </div>
  );
}
