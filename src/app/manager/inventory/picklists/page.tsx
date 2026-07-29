'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, PackageCheck, Search, Truck } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { Order, OrderItem } from '@/types/order';
import { groupPlansByOrder, getEarliestRowLead } from '@/utils/schedulePlanGroups';

// Kết nối backend thật (2026-07-21) — xem docs/picklistxuatkho_api.md. Tài liệu đề xuất 1 endpoint
// tổng hợp mới (`GET /orders/picklists`) + 1 endpoint hành động mới (`PUT /orders/:orderId/picklist/
// picked-up`) + 2 cột mới `orders.picked_up_at`/`picked_up_by` — test lại bằng curl ngày 2026-07-21
// xác nhận CẢ 3 đều CHƯA được Backend triển khai (`GET /orders/picklists` → 404, `GET /orders/:id`
// không có field `pickedUpAt`/`itemsConfirmedAt`). Khác các màn trước (kehoachvaphancong, lịch
// timeline...) nơi phần lớn đề xuất hóa ra đã có sẵn — màn này thật sự vẫn đang chờ Backend.
//
// Đã nối phần dữ liệu có thật (đơn CONFIRMED/IN_PROGRESS qua GET /orders, số lượng/đã chuẩn bị từng
// đơn qua GET /orders/:id, "Điều phối viên" qua GET /schedule-plans — LEAD của dòng sớm nhất theo
// order, đúng hướng đã chốt ở doc mục 3.4, dùng lại schedulePlanGroups.ts đã viết cho màn Kế hoạch).
// Cột "Trạng thái xuất kho" + nút "Đã xuất kho" hiển thị in nghiêng vì KHÔNG có API/cột lưu trạng thái
// này — xem ghi chú ngay dưới bảng.
export default function ManagerPicklistsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemTotals, setItemTotals] = useState<Map<string, { total: number; prepared: number }>>(new Map());
  const [coordinatorByOrderId, setCoordinatorByOrderId] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [readyFilter, setReadyFilter] = useState<'' | 'READY' | 'NOT_READY'>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [ordersRes, plansRes] = await Promise.all([
          orderApiService.getOrders({ limit: 100 }),
          schedulePlanApiService.getSchedulePlans(),
        ]);
        const scoped = (ordersRes.data ?? []).filter((o) => o.orderStatus === 'CONFIRMED' || o.orderStatus === 'IN_PROGRESS');

        const groups = groupPlansByOrder(plansRes.data ?? []);
        const coordMap = new Map<string, string>();
        for (const g of groups) {
          const lead = getEarliestRowLead(g.rows);
          if (lead) coordMap.set(g.orderId, lead);
        }

        const details = await Promise.all(
          scoped.map((o) =>
            orderApiService
              .getOrder(o.orderId)
              .then((res) => ({ orderId: o.orderId, items: (res.data.items ?? []) as OrderItem[] }))
              .catch(() => ({ orderId: o.orderId, items: [] as OrderItem[] })),
          ),
        );
        const totalsMap = new Map<string, { total: number; prepared: number }>();
        for (const d of details) {
          const total = d.items.reduce((sum: number, it: OrderItem) => sum + (it.quantity ?? 0), 0);
          const prepared = d.items.reduce((sum: number, it: OrderItem) => sum + (it.preparedQty ?? 0), 0);
          totalsMap.set(d.orderId, { total, prepared });
        }

        if (cancelled) return;
        setOrders(scoped);
        setItemTotals(totalsMap);
        setCoordinatorByOrderId(coordMap);
      } catch {
        if (!cancelled) setLoadError('Không tải được danh sách phiếu xuất kho từ máy chủ.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isReady = (orderId: string) => {
    const totals = itemTotals.get(orderId);
    return !!totals && totals.total > 0 && totals.prepared >= totals.total;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      const ready = isReady(o.orderId);
      if (readyFilter === 'READY' && !ready) return false;
      if (readyFilter === 'NOT_READY' && ready) return false;
      if (!term) return true;
      return o.orderCode.toLowerCase().includes(term) || (o.customerName ?? '').toLowerCase().includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, search, readyFilter, itemTotals]);

  const readyCount = orders.filter((o) => isReady(o.orderId)).length;

  const kpis: KpiCardItem[] = [
    { label: 'Tổng phiếu chuẩn bị', value: orders.length, icon: ClipboardList, iconColor: 'blue' },
    { label: 'Sẵn sàng xuất kho (ước tính)', value: readyCount, icon: PackageCheck, iconColor: 'amber' },
    { label: 'Đã xuất kho', value: '—', icon: CheckCircle2, iconColor: 'green' },
  ];

  const columns: TableColumn<Order>[] = [
    { key: 'code', label: 'Mã phiếu', render: (o) => <span className="font-mono text-xs font-bold text-slate-700">PKL-{o.orderCode}</span> },
    {
      key: 'order',
      label: 'Đơn đặt cưới',
      render: (o) => (
        <div>
          <Link href={`/manager/orders/${o.orderId}`} className="font-semibold text-blue-600 hover:underline">
            {o.orderCode}
          </Link>
          <p className="text-xs text-slate-400">{o.customerName}</p>
        </div>
      ),
    },
    { key: 'eventDate', label: 'Ngày thi công', render: (o) => formatDate(o.eventDate) },
    {
      key: 'coordinatorName',
      label: 'Điều phối viên',
      render: (o) => coordinatorByOrderId.get(o.orderId) ?? <span className="italic text-slate-400">Chưa phân công</span>,
    },
    {
      key: 'exportStatus',
      label: 'Trạng thái xuất kho',
      render: () => <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold italic text-slate-500">Chưa có API</span>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (o) => (
        <div className="flex items-center gap-2">
          <Link href={`/manager/orders/${o.orderId}`} className="text-xs font-semibold text-blue-600 hover:underline">
            Xem chi tiết
          </Link>
          <button
            type="button"
            disabled
            title="Chưa có API: backend cần bổ sung cột orders.picked_up_at và endpoint PUT /orders/:orderId/picklist/picked-up (xem docs/more-require.md)"
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold italic text-slate-400"
          >
            <Truck className="h-3.5 w-3.5" />
            Đã xuất kho
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center p-6 text-sm text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang tải phiếu chuẩn bị xuất kho...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          Pick-list xuất kho
        </h1>
        <p className="mt-1 text-sm text-slate-500">Phiếu chuẩn bị xuất kho theo từng đơn đặt đã xác nhận — theo dõi tiến độ chuẩn bị thiết bị.</p>
      </div>

      {loadError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder="Tìm theo mã đơn, khách hàng..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-64">
            <Select
              value={readyFilter}
              onChange={(e) => setReadyFilter(e.target.value as typeof readyFilter)}
              options={[
                { value: '', label: 'Tất cả tình trạng chuẩn bị' },
                { value: 'READY', label: 'Đã chuẩn bị đủ (ước tính)' },
                { value: 'NOT_READY', label: 'Chưa chuẩn bị đủ' },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.orderId} />
        </div>

        <p className="mt-3 text-[11px] italic text-slate-400">
          Ghi chú: &quot;Sẵn sàng xuất kho&quot; hiện tính ước tính từ tổng số lượng đã chuẩn bị/order_items — backend
          chưa có cột xác nhận riêng (<code>items_confirmed_at</code>) như tài liệu đề xuất. Cột &quot;Trạng thái xuất
          kho&quot; và nút &quot;Đã xuất kho&quot; chưa có API (thiếu cột <code>orders.picked_up_at</code> và endpoint tương
          ứng) — xem docs/more-require.md.
        </p>

        {orders.length === 0 && !loading && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
            <p className="text-sm text-slate-400">Không có đơn nào cần chuẩn bị xuất kho.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
