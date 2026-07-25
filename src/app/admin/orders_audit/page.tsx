'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Ban, Eye, Search } from 'lucide-react';
import { Badge, type BadgeVariant, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { customerApiService } from '@/services/customer.service';
import { ORDER_PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/constants/order-status';
import type { Order, OrderListMeta, OrderPaymentStatus, OrderStatus } from '@/types/order';
import type { Customer } from '@/types/customer';
import CreateOrderModal from '@/components/orders/CreateOrderModal';

// Nối API thật theo docs/danhsachdondat_api.md — mirror 1:1 với src/app/manager/orders/page.tsx, chỉ
// khác tiền tố route /admin/orders_audit. Xem comment đầy đủ ở file đó. GET /orders đã trả sẵn
// customerName/customerPhone (JOIN) + meta.counts (dùng thẳng cho 6 thẻ KPI). Các field mock không có
// cột thật trên `orders` (packageType/coordinatorName/depositAmount/weddingEndDate) đã BỎ khỏi màn này.
// Nút "Xóa đơn đặt" đổi thành "Hủy đơn" (PUT /orders/:id/status, không có DELETE thật). CLAUDE.md mục
// 1.4/doc mục 1.4 còn để ngỏ câu hỏi Admin có nên giữ quyền Tạo/Hủy như Manager hay không — CHƯA đổi gì
// ở đây, giữ nguyên hành vi cũ cho tới khi Product xác nhận (Admin vẫn có nút Tạo/Hủy y hệt Manager).
//
// Cập nhật 2026-07-20 — mở lại nút "Khởi tạo đơn đặt hàng" (theo docs/taodondatlichtiecmoi_api.md
// mục 3, Hướng A) — xem giải thích đầy đủ ở comment tương ứng trong manager/orders/page.tsx
// (backend thật đã có `GET /api/v1/catalog/items` trả kèm `rentalPrice`, không cần fix cứng giá).

const PAYMENT_BADGE_VARIANT: Record<OrderPaymentStatus, BadgeVariant> = {
  UNPAID: 'neutral',
  DEPOSITED: 'warning',
  PAID: 'success',
};

const CANCELLABLE_STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED', 'IN_PROGRESS'];

const emptyMeta: OrderListMeta = {
  page: 1,
  limit: 10,
  totalItems: 0,
  totalPages: 1,
  counts: { all: 0, new: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 },
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<OrderListMeta>(emptyMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [payFilter, setPayFilter] = useState<OrderPaymentStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [cancelingOrder, setCancelingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // limit tối đa backend thật chấp nhận cho /customers là 100 (400 VALIDATION_ERROR nếu vượt quá).
    customerApiService
      .getCustomers({ limit: 100 })
      .then((res) => setCustomers(res.data ?? []))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, payFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    orderApiService
      .getOrders({
        page,
        limit,
        search: search.trim() || undefined,
        orderStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        paymentStatus: payFilter !== 'ALL' ? payFilter : undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.data ?? []);
        setMeta(res.meta ?? emptyMeta);
      })
      .catch(() => {
        if (cancelled) return;
        setOrders([]);
        setLoadError('Không tải được danh sách đơn đặt hàng. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter, payFilter, reloadToken]);

  const handleOrderCreated = () => {
    setIsCreateOpen(false);
    setPage(1);
    setReloadToken((t) => t + 1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setStatusFilter('ALL');
    setPayFilter('ALL');
  };

  const handleCancelConfirm = async () => {
    if (!cancelingOrder) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await orderApiService.updateOrderStatus(cancelingOrder.orderId, {
        orderStatus: 'CANCELLED',
        cancelReason: cancelReason.trim() || undefined,
      });
      setCancelingOrder(null);
      setCancelReason('');
      setPage(1);
      const res = await orderApiService.getOrders({
        page: 1,
        limit,
        search: search.trim() || undefined,
        orderStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        paymentStatus: payFilter !== 'ALL' ? payFilter : undefined,
      });
      setOrders(res.data ?? []);
      setMeta(res.meta ?? emptyMeta);
    } catch {
      setCancelError('Hủy đơn thất bại. Vui lòng thử lại.');
    } finally {
      setIsCancelling(false);
    }
  };

  const paginationState: PaginationState = {
    currentPage: meta.page,
    totalPages: Math.max(1, meta.totalPages),
    totalItems: meta.totalItems,
    limit: meta.limit,
  };

  const kpiCards: { label: string; value: number; className: string }[] = [
    { label: 'Tổng đơn', value: meta.counts.all, className: 'bg-white text-slate-900' },
    { label: 'Mới', value: meta.counts.new, className: 'bg-slate-50 text-slate-600' },
    { label: 'Đã xác nhận', value: meta.counts.confirmed, className: 'bg-blue-50/50 text-blue-700' },
    { label: 'Đang thực hiện', value: meta.counts.inProgress, className: 'bg-indigo-50/50 text-indigo-700' },
    { label: 'Hoàn thành', value: meta.counts.completed, className: 'bg-green-50/50 text-green-700' },
    { label: 'Đã hủy', value: meta.counts.cancelled, className: 'bg-red-50/50 text-red-700' },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý đơn đặt hàng</h1>
          <p className="mt-1 text-sm text-slate-500">Giám sát trạng thái đơn hàng sự kiện, kiểm soát thanh toán và điều phối kho.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>Khởi tạo đơn đặt hàng</Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        {kpiCards.map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.2, delay: idx * 0.03 }}
            className={`rounded-xl border border-slate-200/80 p-3.5 shadow-2xs ${kpi.className}`}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">{kpi.label}</p>
            <p className="mt-1 text-base font-black">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 flex flex-col items-center justify-between gap-3 md:flex-row rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex w-full flex-wrap gap-2.5 md:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Mã đơn, sự kiện, khách hàng, SĐT..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'ALL')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={payFilter}
            onChange={(e) => setPayFilter(e.target.value as OrderPaymentStatus | 'ALL')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">Tất cả thanh toán</option>
            {(Object.keys(ORDER_PAYMENT_STATUS_LABEL) as OrderPaymentStatus[]).map((p) => (
              <option key={p} value={p}>
                {ORDER_PAYMENT_STATUS_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleResetFilters}
          className="shrink-0 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
        >
          Đặt lại
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Mã đơn</th>
                <th className="px-5 py-3">Sự kiện / Khách hàng</th>
                <th className="px-5 py-3">Ngày tổ chức</th>
                <th className="px-5 py-3">Địa điểm</th>
                <th className="px-5 py-3 text-center">Khách mời</th>
                <th className="px-5 py-3 text-right">Trị giá</th>
                <th className="px-5 py-3 text-center">Thanh toán</th>
                <th className="px-5 py-3 text-center">Đơn hàng</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    Đang tải danh sách đơn đặt hàng...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-red-500">
                    {loadError}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center italic text-slate-400">
                    Chưa có đơn đặt hàng nào khớp với tìm kiếm.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.orderId} className="text-xs transition-all hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono font-bold text-blue-600">
                      <Link href={`/admin/orders_audit/${o.orderId}`} className="hover:underline">
                        {o.orderCode}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="max-w-[200px] truncate font-semibold text-slate-950">{o.eventName || o.eventType}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-400">{o.customerName}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">{formatDate(o.eventDate)}</td>
                    <td className="max-w-[150px] truncate px-5 py-3 text-slate-600">{o.location}</td>
                    <td className="px-5 py-3 text-center font-bold text-slate-700">{o.guestCount ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-black text-slate-900">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant={PAYMENT_BADGE_VARIANT[o.paymentStatus]}>{ORDER_PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant={getStatusBadgeVariant(o.orderStatus)}>{ORDER_STATUS_LABEL[o.orderStatus]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/orders_audit/${o.orderId}`}
                          aria-label="Xem chi tiết"
                          title="Xem chi tiết"
                          className="inline-flex rounded-md p-1.5 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {CANCELLABLE_STATUSES.includes(o.orderStatus) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelingOrder(o);
                              setCancelReason('');
                              setCancelError(null);
                            }}
                            aria-label="Hủy đơn"
                            title="Hủy đơn"
                            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </motion.div>

      <Modal
        isOpen={Boolean(cancelingOrder)}
        onClose={() => setCancelingOrder(null)}
        title="Hủy đơn đặt"
        subtitle={cancelingOrder ? `Bạn có chắc muốn hủy đơn "${cancelingOrder.orderCode}"? Hành động này không thể hoàn tác.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelingOrder(null)} disabled={isCancelling}>
              Đóng
            </Button>
            <Button variant="danger" onClick={handleCancelConfirm} disabled={isCancelling}>
              {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy đơn'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="cancel-reason">
            Lý do hủy (không bắt buộc)
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {cancelError && <p className="mt-1 text-xs text-red-500">{cancelError}</p>}
        </div>
      </Modal>

      <CreateOrderModal
        isOpen={isCreateOpen}
        customers={customers}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleOrderCreated}
      />
    </div>
  );
}
