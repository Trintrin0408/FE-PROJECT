'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Ban, Calendar, Eye, FileSignature, RotateCcw, Search, ShoppingBag } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { ORDER_PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/constants/order-status';
import type { Order, OrderPaymentStatus, OrderStatus } from '@/types/order';

// Nối API thật theo docs/danhsachhopdong_api.md — đã áp dụng Hướng A đã chốt trước đó (comment cũ ở
// đầu file này, giữ nguyên tinh thần): "Hợp đồng" không có bảng thật, màn này chỉ là 1 VIEW LỌC của
// Order (chỉ hiển thị đơn có quotationId — được sinh từ báo giá đã duyệt), dùng lại nguyên
// orderApiService/GetOrdersQuery đã có sẵn, không có entity/endpoint riêng nào cho "Hợp đồng" cả.
//
// PHÁT HIỆN MỚI khi nối API thật (ngoài phạm vi doc gốc, xem docs/more-require.md mục (r)):
// `GET /api/v1/orders` (danh sách) KHÔNG trả field `quotationId` (chỉ `GET /orders/:id` — chi tiết —
// mới có field này) — không thể lọc "đơn có quotationId" chỉ bằng 1 lần gọi danh sách. Vì tổng số đơn
// hiện còn rất nhỏ (nghiệp vụ tổ chức sự kiện, không phải khối lượng thương mại điện tử), FE tạm chấp
// nhận N+1: gọi danh sách rồi gọi CHI TIẾT từng đơn để biết `quotationId` — đã ghi rõ yêu cầu Backend
// thêm field này vào response danh sách để bỏ N+1 khi cần scale.
//
// Nút "Tạo đơn từ báo giá" tạm khóa — cùng lý do đã ghi ở docs/more-require.md mục (q):
// `CreateOrderFromQuotationModal`/`CreateOrderPickQuotationModal` nhận dữ liệu theo shape mock cũ
// (`AdminQuotationRow`), chưa tương thích với API thật đã nối ở các màn báo giá — cần nối lại riêng.

const STATUS_TABS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NEW', label: ORDER_STATUS_LABEL.NEW },
  { value: 'CONFIRMED', label: ORDER_STATUS_LABEL.CONFIRMED },
  { value: 'IN_PROGRESS', label: ORDER_STATUS_LABEL.IN_PROGRESS },
  { value: 'COMPLETED', label: ORDER_STATUS_LABEL.COMPLETED },
  { value: 'CANCELLED', label: ORDER_STATUS_LABEL.CANCELLED },
];

const PAYMENT_STATUS_FILTER_OPTIONS: { value: OrderPaymentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả thanh toán' },
  { value: 'UNPAID', label: ORDER_PAYMENT_STATUS_LABEL.UNPAID },
  { value: 'DEPOSITED', label: ORDER_PAYMENT_STATUS_LABEL.DEPOSITED },
  { value: 'PAID', label: ORDER_PAYMENT_STATUS_LABEL.PAID },
];

const PAYMENT_BADGE_VARIANT: Record<OrderPaymentStatus, BadgeVariant> = {
  UNPAID: 'neutral',
  DEPOSITED: 'warning',
  PAID: 'success',
};

interface OrderFromQuotation extends Order {
  quotationId: string;
}

export default function AdminContractsPage() {
  const [ordersFromQuotation, setOrdersFromQuotation] = useState<OrderFromQuotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderFromQuotation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusTab, setStatusTab] = useState<OrderStatus | 'ALL'>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<OrderPaymentStatus | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    orderApiService
      .getOrders({ limit: 100 })
      .then(async (res) => {
        const list: Order[] = res.data ?? [];
        // N+1 tạm thời — xem giải thích đầu file. Danh sách hiện chỉ có vài chục đơn nên chấp nhận được.
        const details = await Promise.all(list.map((o) => orderApiService.getOrder(o.orderId).catch(() => null)));
        const withQuotation = details
          .map((d) => d?.data as (Order & { quotationId?: string | null }) | undefined)
          .filter((d): d is Order & { quotationId: string } => Boolean(d?.quotationId));
        setOrdersFromQuotation(withQuotation);
      })
      .catch(() => setLoadError('Không tải được danh sách đơn từ báo giá. Vui lòng thử lại.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const tabCounts: Record<OrderStatus | 'ALL', number> = {
    ALL: ordersFromQuotation.length,
    NEW: ordersFromQuotation.filter((o) => o.orderStatus === 'NEW').length,
    CONFIRMED: ordersFromQuotation.filter((o) => o.orderStatus === 'CONFIRMED').length,
    IN_PROGRESS: ordersFromQuotation.filter((o) => o.orderStatus === 'IN_PROGRESS').length,
    COMPLETED: ordersFromQuotation.filter((o) => o.orderStatus === 'COMPLETED').length,
    CANCELLED: ordersFromQuotation.filter((o) => o.orderStatus === 'CANCELLED').length,
  };

  const kpis = useMemo(() => {
    const active = ordersFromQuotation.filter((o) => o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'COMPLETED').length;
    const completed = ordersFromQuotation.filter((o) => o.orderStatus === 'COMPLETED').length;
    const totalValue = ordersFromQuotation.reduce((sum, o) => sum + o.totalAmount, 0);
    return { active, completed, totalValue };
  }, [ordersFromQuotation]);

  const kpiItems: KpiCardItem[] = [
    { label: 'Tổng số đơn từ báo giá', value: ordersFromQuotation.length, icon: FileSignature, iconColor: 'blue' },
    { label: 'Đang triển khai', value: kpis.active, icon: ShoppingBag, iconColor: 'amber' },
    { label: 'Đã hoàn thành', value: kpis.completed, icon: FileSignature, iconColor: 'green' },
    { label: 'Tổng giá trị', value: formatCurrency(kpis.totalValue), icon: FileSignature, iconColor: 'pink' },
  ];

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ordersFromQuotation.filter((o) => {
      if (statusTab !== 'ALL' && o.orderStatus !== statusTab) return false;
      if (paymentStatusFilter !== 'ALL' && o.paymentStatus !== paymentStatusFilter) return false;
      if (startDate && o.eventDate < startDate) return false;
      if (endDate && o.eventDate > endDate) return false;
      if (!term) return true;
      return (
        o.orderCode.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        (o.eventName ?? '').toLowerCase().includes(term)
      );
    });
  }, [ordersFromQuotation, search, statusTab, paymentStatusFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredOrders.slice((safePage - 1) * limit, safePage * limit);
  const paginationState: PaginationState = { currentPage: safePage, totalPages, totalItems: filteredOrders.length, limit };

  const handleResetFilters = () => {
    setSearchInput('');
    setStatusTab('ALL');
    setPaymentStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleCancelConfirm = async () => {
    if (!cancellingOrder) return;
    setIsCancelling(true);
    try {
      await orderApiService.updateOrderStatus(cancellingOrder.orderId, { orderStatus: 'CANCELLED' });
      setCancellingOrder(null);
      load();
    } finally {
      setIsCancelling(false);
    }
  };

  const columns: TableColumn<OrderFromQuotation>[] = [
    {
      key: 'orderCode',
      label: 'Mã đơn',
      render: (row) => (
        <Link href={`/admin/orders_audit/${row.orderId}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
          {row.orderCode}
        </Link>
      ),
    },
    {
      key: 'customerName',
      label: 'Khách hàng',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.customerName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{row.customerName}</p>
            <p className="text-xs text-slate-400">{row.customerPhone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'eventName',
      label: 'Sự kiện & Ngày tổ chức',
      className: 'max-w-[180px]',
      render: (row) => (
        <div>
          <p className="line-clamp-1 font-medium text-slate-700">{row.eventName || row.eventType}</p>
          <p className="text-xs text-slate-400">{formatDate(row.eventDate)}</p>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      label: 'Giá trị',
      className: 'text-right font-bold text-slate-900',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'orderStatus',
      label: 'Trạng thái đơn',
      className: 'text-center',
      render: (row) => <Badge variant={getStatusBadgeVariant(row.orderStatus)}>{ORDER_STATUS_LABEL[row.orderStatus]}</Badge>,
    },
    {
      key: 'paymentStatus',
      label: 'Thanh toán',
      className: 'text-center',
      render: (row) => <Badge variant={PAYMENT_BADGE_VARIANT[row.paymentStatus]}>{ORDER_PAYMENT_STATUS_LABEL[row.paymentStatus]}</Badge>,
    },
    {
      key: 'actions',
      label: 'Hành động',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/orders_audit/${row.orderId}`}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {row.orderStatus !== 'CANCELLED' && row.orderStatus !== 'COMPLETED' && (
            <button
              type="button"
              onClick={() => setCancellingOrder(row)}
              aria-label="Hủy đơn"
              title="Hủy đơn"
              className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <Ban className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hợp đồng</h1>
          <p className="mt-1 text-sm text-slate-500">Danh sách đơn đặt hàng được tạo từ báo giá đã duyệt và dùng để vận hành sự kiện.</p>
        </div>
        <Button disabled title="Cần nối lại luồng chọn báo giá + tạo đơn theo API thật - xem docs/more-require.md mục (q)/(r)">
          Tạo đơn từ báo giá
        </Button>
      </div>

      <div className="mt-6">
        <DashboardStats items={kpiItems} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
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
                {tab.label} ({tabCounts[tab.value]})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3.5 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo mã đơn, khách hàng, sự kiện..."
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-3 text-sm hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">Thanh toán:</span>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value as OrderPaymentStatus | 'ALL')}
                className="rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-2.5 pr-8 text-xs hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PAYMENT_STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Ngày tổ chức từ"
                className="w-28 border-none bg-transparent py-0.5 text-xs text-slate-700 focus:outline-none"
              />
              <span className="text-xs text-slate-300">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Ngày tổ chức đến"
                className="w-28 border-none bg-transparent py-0.5 text-xs text-slate-700 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition duration-150 hover:bg-slate-200"
              title="Đặt lại các bộ lọc"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Đang tải danh sách...</p>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-red-500">{loadError}</p>
          ) : (
            <Table columns={columns} rows={pageRows} rowKey={(row) => row.orderId} />
          )}
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </motion.div>

      <Modal
        isOpen={Boolean(cancellingOrder)}
        onClose={() => setCancellingOrder(null)}
        title="Hủy đơn đặt"
        subtitle={cancellingOrder ? `Bạn có chắc muốn hủy đơn "${cancellingOrder.orderCode}"? Đơn sẽ chuyển sang trạng thái Đã hủy, dữ liệu vẫn được giữ lại để đối chiếu.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancellingOrder(null)} disabled={isCancelling}>
              Đóng
            </Button>
            <Button variant="danger" onClick={handleCancelConfirm} isLoading={isCancelling}>
              Hủy đơn
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}
