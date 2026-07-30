'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ClipboardList, Clock, Eye, FileText, Search, Truck, Users } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { inventoryApiService } from '@/services/inventory.service';
import type { Order, OrderDetail, OrderItem } from '@/types/order';
import type { PicklistItem } from '@/types/inventory';

const OUTBOUND_STATUS_META = {
  exported: { label: 'Đã xuất', variant: 'success' as const },
  not_exported: { label: 'Chưa xuất', variant: 'warning' as const },
};

export default function AdminWarehouseOutboundPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [bookingFilter, setBookingFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exported' | 'not_exported'>('all');

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [picklistMap, setPicklistMap] = useState<Map<string, PicklistItem>>(new Map());
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const refresh = () => setReloadToken((t) => t + 1);

  // Load danh sách đơn cần xuất kho
  useEffect(() => {
    setIsLoading(true);
    orderApiService
      .getOrders({ orderStatus: 'CONFIRMED,IN_PROGRESS', limit: 200 })
      .then((res) => setOrders(res.data ?? []))
      .catch(() => setLoadError('Không tải được danh sách phiếu xuất kho.'))
      .finally(() => setIsLoading(false));
  }, [reloadToken]);

  // Load chi tiết khi chọn 1 đơn
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderDetail(null);
      setPicklistMap(new Map());
      return;
    }
    setIsLoadingDetail(true);
    Promise.all([
      orderApiService.getOrder(selectedOrderId),
      inventoryApiService.getPicklist(selectedOrderId).catch(() => ({ data: [] })),
    ])
      .then(([orderRes, picklistRes]) => {
        setSelectedOrderDetail(orderRes.data as OrderDetail);
        const items = (picklistRes.data ?? []) as PicklistItem[];
        setPicklistMap(new Map(items.map((p) => [p.itemId, p])));
      })
      .finally(() => setIsLoadingDetail(false));
  }, [selectedOrderId, reloadToken]); // reloadToken để fetch lại tồn kho sau khi xuất

  const uniqueBookings = useMemo(() => Array.from(new Set(orders.map((o) => o.customerName))).sort(), [orders]);

  const kpis = useMemo(() => {
    const exported = orders.filter((o) => o.pickedUpAt).length;
    const notExported = orders.length - exported;
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = orders.filter((o) => o.eventDate?.slice(0, 10) === today && !o.pickedUpAt).length;
    return { exported, notExported, dueToday };
  }, [orders]);

  const kpiItems: KpiCardItem[] = [
    { label: 'Tổng phiếu cần xuất', value: orders.length, icon: ClipboardList, iconColor: 'blue' },
    { label: 'Đã xuất kho', value: kpis.exported, icon: CheckCircle2, iconColor: 'green' },
    { label: 'Chưa xuất kho', value: kpis.notExported, icon: Clock, iconColor: 'amber' },
    { label: 'Cần xuất hôm nay', value: kpis.dueToday, icon: Truck, iconColor: 'red' },
  ];

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (bookingFilter && o.customerName !== bookingFilter) return false;
      if (dateFilter && (!o.eventDate || !o.eventDate.startsWith(dateFilter))) return false;
      if (statusFilter !== 'all') {
        const isExported = !!o.pickedUpAt;
        if (statusFilter === 'exported' && !isExported) return false;
        if (statusFilter === 'not_exported' && isExported) return false;
      }
      if (!term) return true;
      return (
        o.orderCode.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        (o.customerPhone && o.customerPhone.includes(term))
      );
    });
  }, [orders, search, bookingFilter, dateFilter, statusFilter]);

  const handleConfirmExport = async (id: string) => {
    setIsExporting(true);
    try {
      await orderApiService.exportEquipment(id);
      refresh();
      setConfirmingOrderId(null);
    } catch (err: any) {
      alert('Xuất kho thất bại: ' + (err.response?.data?.message ?? 'Lỗi không xác định'));
    } finally {
      setIsExporting(false);
    }
  };

  if (selectedOrderId && (isLoadingDetail || selectedOrderDetail)) {
    const order = selectedOrderDetail;
    const totalUnits = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const isExported = !!order?.pickedUpAt;

    const itemColumns: TableColumn<OrderItem>[] = [
      { key: 'itemId', label: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-400">{row.itemId}</span> },
      { key: 'name', label: 'Tên sản phẩm & thiết bị', render: (row) => <span className="font-semibold text-slate-800">{row.itemName}</span> },
      { key: 'unit', label: 'Đơn vị' },
      { key: 'source', label: 'Nguồn', render: (row) => (
          <Badge variant={row.source === 'INTERNAL' ? 'neutral' : 'info'}>{row.source === 'INTERNAL' ? 'Kho nhà' : 'Thuê ngoài'}</Badge>
        ) 
      },
      { key: 'requestedQty', label: 'Số lượng đặt', className: 'text-center font-bold text-slate-800', render: (row) => row.quantity },
      { key: 'availableQty', label: 'Tồn kho khả dụng', className: 'text-center', render: (row) => {
          if (row.source !== 'INTERNAL') return <span className="text-slate-300">—</span>;
          const pi = picklistMap.get(row.itemId);
          if (!pi) return <span className="text-slate-300">...</span>;
          const shortage = Math.max(0, row.quantity - (pi.quantityAvailable ?? 0));
          if (shortage > 0) return <span className="font-bold text-red-600">⚠ Thiếu {shortage}</span>;
          return <span className="font-bold text-emerald-600">✓ {pi.quantityAvailable}</span>;
        }
      },
      { key: 'note', label: 'Ghi chú', render: (row) => row.notes || <span className="italic text-slate-300">Không có ghi chú</span> },
    ];

    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => setSelectedOrderId(null)}
          className="mb-3.5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-xs transition hover:bg-slate-50 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Chi tiết phiếu xuất kho</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi thông tin phiếu xuất kho và danh sách thiết bị cần xuất cho đơn đặt cưới.</p>

        {isLoadingDetail ? (
           <div className="mt-8 flex justify-center"><p className="text-sm text-slate-400">Đang tải chi tiết...</p></div>
        ) : order ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-center rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:col-span-9">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Số phiếu xuất</p>
                    <p className="font-mono text-base font-bold text-blue-600">PKL-{order.orderCode}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <Users className="h-5 w-5 text-slate-400" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tên đơn đặt</p>
                    <p className="text-sm font-bold text-slate-800">{order.customerName}</p>
                    <Link href={`/admin/orders_audit/${order.orderId}`} className="text-xs font-semibold text-blue-600 hover:underline">
                      {order.orderCode}
                    </Link>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <Calendar className="h-5 w-5 text-slate-400" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày diễn ra sự kiện</p>
                    <p className="font-mono text-sm font-bold text-slate-700">{formatDate(order.eventDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <Clock className="h-5 w-5 text-slate-400" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày thực tế xuất kho</p>
                    {isExported ? (
                      <p className="text-xs font-bold text-emerald-600">Đã xuất kho · {formatDate(order.pickedUpAt as string)}</p>
                    ) : (
                      <p className="text-xs font-semibold text-slate-500">Chưa xuất kho</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-2.5 border-t border-slate-100 pt-5 text-center xl:col-span-3 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
                {!isExported ? (
                  <>
                    <Button className="w-full" onClick={() => setConfirmingOrderId(order.orderId)}>
                      Xác nhận xuất kho
                    </Button>
                    <p className="max-w-[220px] text-[11px] leading-normal text-slate-400">
                      Khi xác nhận, trạng thái phiếu sẽ chuyển sang Đã xuất và hệ thống sẽ trừ tồn kho khả dụng tương ứng.
                    </p>
                  </>
                ) : (
                  <div className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="text-xs font-black uppercase tracking-wider">Đã xuất kho thành công</span>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <h2 className="text-sm font-semibold text-slate-900">Danh sách thiết bị cần xuất</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Tổng cộng <span className="font-bold text-blue-600">{order.items.length}</span> thiết bị /{' '}
                <span className="font-bold text-blue-600">{totalUnits}</span> đơn vị cần xuất
              </p>
              <div className="mt-4">
                <Table columns={itemColumns} rows={order.items} rowKey={(row) => row.itemId + row.source} />
              </div>
            </motion.div>
          </>
        ) : (
          <div className="mt-8 text-center text-sm text-slate-400">Không tải được chi tiết phiếu xuất</div>
        )}

        <Modal
          isOpen={Boolean(confirmingOrderId)}
          onClose={() => setConfirmingOrderId(null)}
          title="Xác nhận bàn giao xuất kho?"
          subtitle={`Bạn đang chuẩn bị xuất kho cho đơn ${order?.orderCode}. Hệ thống sẽ trừ tồn kho khả dụng tương ứng và chuyển trạng thái sang "Đã xuất" ngay lập tức.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingOrderId(null)}>
                Hủy bỏ
              </Button>
              <Button onClick={() => confirmingOrderId && handleConfirmExport(confirmingOrderId)} isLoading={isExporting}>
                Xác nhận & Xuất kho
              </Button>
            </>
          }
        >
          <div className="flex items-start gap-3 text-sm text-slate-500">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <p>Hành động này không thể hoàn tác. Các mặt hàng thiếu sẽ không thể xuất kho.</p>
          </div>
        </Modal>
      </div>
    );
  }

  const columns: TableColumn<Order>[] = [
    {
      key: 'id',
      label: 'Số phiếu xuất',
      render: (row) => (
        <button type="button" onClick={() => setSelectedOrderId(row.orderId)} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
          PKL-{row.orderCode}
        </button>
      ),
    },
    { key: 'bookingName', label: 'Đơn đặt cưới (Khách hàng)', render: (row) => <span className="font-medium text-slate-700">{row.customerName}</span> },
    { key: 'expectedDate', label: 'Ngày sự kiện', render: (row) => <span className="font-mono text-slate-500">{formatDate(row.eventDate)}</span> },
    {
      key: 'actualDate',
      label: 'Ngày xuất kho thực tế',
      render: (row) => (row.pickedUpAt ? <span className="font-mono text-slate-600">{formatDate(row.pickedUpAt)}</span> : <span className="italic text-slate-300">—</span>),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) =>
        row.pickedUpAt ? (
          <Badge variant={OUTBOUND_STATUS_META.exported.variant}>{OUTBOUND_STATUS_META.exported.label}</Badge>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingOrderId(row.orderId)}
            title="Bấm để xác nhận xuất kho"
            className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100"
          >
            {OUTBOUND_STATUS_META.not_exported.label}
          </button>
        ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedOrderId(row.orderId)}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Xuất kho</h1>
        <p className="mt-1 text-sm text-slate-500">Quản lý danh sách phiếu xuất kho cho các đơn đặt cưới.</p>
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo số phiếu, tên khách hàng, SĐT..."
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-3 text-sm hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-56">
              <Select
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                options={[{ value: '', label: 'Tất cả khách hàng' }, ...uniqueBookings.map((b) => ({ value: b, label: b }))]}
              />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
            <div className="w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'exported', label: 'Đã xuất' },
                  { value: 'not_exported', label: 'Chưa xuất' },
                ]}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 flex justify-center"><p className="text-sm text-slate-400">Đang tải danh sách...</p></div>
        ) : loadError ? (
          <div className="mt-8 text-center text-sm text-red-500">{loadError}</div>
        ) : (
          <div className="mt-4">
            <Table columns={columns} rows={filteredOrders} rowKey={(row) => row.orderId} />
          </div>
        )}
      </motion.div>

      <Modal
        isOpen={Boolean(confirmingOrderId)}
        onClose={() => setConfirmingOrderId(null)}
        title="Xác nhận bàn giao xuất kho?"
        subtitle={`Bạn đang chuẩn bị xuất kho cho đơn này. Hệ thống sẽ trừ tồn kho khả dụng tương ứng và chuyển trạng thái sang "Đã xuất" ngay lập tức.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingOrderId(null)}>
              Hủy bỏ
            </Button>
            <Button onClick={() => confirmingOrderId && handleConfirmExport(confirmingOrderId)} isLoading={isExporting}>Xác nhận & Xuất kho</Button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-sm text-slate-500">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <p>Hành động này không thể hoàn tác.</p>
        </div>
      </Modal>
    </div>
  );
}
