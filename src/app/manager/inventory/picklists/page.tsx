'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Camera, CheckCircle2, ClipboardList, Loader2, PackageCheck, Search } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EvidenceBlock } from '@/components/payments/EvidenceBlock';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { evidenceApiService } from '@/services/evidence.service';
import { parseApiError } from '@/utils/apiError';
import toast from 'react-hot-toast';
import type { Order, OrderItem } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { Evidence } from '@/types/evidence';
import { groupPlansByOrder, getEarliestRowLead, SCHEDULE_STATUS_BADGE, SCHEDULE_STATUS_LABEL } from '@/utils/schedulePlanGroups';

// Kết nối backend thật — xem docs/picklistxuatkho_api.md. Backend NAY ĐÃ có `PUT /orders/:orderId/
// picklist/picked-up` + 2 cột `orders.picked_up_at`/`picked_up_by`, nên nút "Đã xuất kho" đã nối API
// thật (không còn stub). Dữ liệu: đơn CONFIRMED/IN_PROGRESS qua GET /orders, số lượng/đã chuẩn bị từng
// đơn + `pickedUpAt` qua GET /orders/:id, "Điều phối viên" qua GET /schedule-plans (LEAD của dòng sớm
// nhất theo order, dùng lại schedulePlanGroups.ts). Backend guard: chặn nếu đã xuất kho rồi hoặc chưa
// chuẩn bị đủ thiết bị (preparedQty < quantity) — FE hiện lỗi qua toast (parseApiError).
//
// Đổi tên hiển thị 2026-08-03: "Pick-list xuất kho" → "Xuất kho và bàn giao" + thêm nút "Xem bằng
// chứng" (modal) hiển thị ảnh minh chứng Leader Staff gắn khi cập nhật trạng thái từng SchedulePlan
// của đơn (field `evidenceId` — PATCH /schedule-plans/:id/status — đã có thật ở backend, không phải
// mock). Giữ nguyên toàn bộ phần xuất kho ở trên vì vẫn đang chờ Backend như ghi chú cũ.
export default function ManagerPicklistsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemTotals, setItemTotals] = useState<Map<string, { total: number; prepared: number }>>(new Map());
  const [itemsByOrderId, setItemsByOrderId] = useState<Map<string, OrderItem[]>>(new Map());
  const [pickedUpMap, setPickedUpMap] = useState<Map<string, string | null>>(new Map());
  const [reloadToken, setReloadToken] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [coordinatorByOrderId, setCoordinatorByOrderId] = useState<Map<string, string>>(new Map());
  const [plansByOrderId, setPlansByOrderId] = useState<Map<string, SchedulePlan[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [readyFilter, setReadyFilter] = useState<'' | 'READY' | 'NOT_READY'>('');

  const [viewingEvidenceOrder, setViewingEvidenceOrder] = useState<Order | null>(null);

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
        const scoped = (ordersRes.data ?? []).filter((o) => o.orderStatus === 'CONFIRMED' || o.orderStatus === 'IN_PROGRESS' || o.orderStatus === 'COMPLETED');

        const groups = groupPlansByOrder(plansRes.data ?? []);
        const coordMap = new Map<string, string>();
        const plansMap = new Map<string, SchedulePlan[]>();
        for (const g of groups) {
          const lead = getEarliestRowLead(g.rows);
          if (lead) coordMap.set(g.orderId, lead);
          plansMap.set(g.orderId, g.rows);
        }

        const details = await Promise.all(
          scoped.map((o) =>
            orderApiService
              .getOrder(o.orderId)
              .then((res) => ({ orderId: o.orderId, items: (res.data.items ?? []) as OrderItem[], pickedUpAt: (res.data.pickedUpAt ?? null) as string | null }))
              .catch(() => ({ orderId: o.orderId, items: [] as OrderItem[], pickedUpAt: null as string | null })),
          ),
        );
        const totalsMap = new Map<string, { total: number; prepared: number }>();
        const pickedMap = new Map<string, string | null>();
        const itemsMap = new Map<string, OrderItem[]>();
        for (const d of details) {
          const total = d.items.reduce((sum: number, it: OrderItem) => sum + (it.quantity ?? 0), 0);
          const prepared = d.items.reduce((sum: number, it: OrderItem) => sum + (it.preparedQty ?? 0), 0);
          totalsMap.set(d.orderId, { total, prepared });
          pickedMap.set(d.orderId, d.pickedUpAt);
          itemsMap.set(d.orderId, d.items);
        }

        if (cancelled) return;
        setOrders(scoped);
        setItemTotals(totalsMap);
        setPickedUpMap(pickedMap);
        setItemsByOrderId(itemsMap);
        setCoordinatorByOrderId(coordMap);
        setPlansByOrderId(plansMap);
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
  }, [reloadToken]);

  // Đơn chưa chuẩn bị đủ (preparedQty < quantity ở ít nhất 1 dòng) → nút sẽ gộp thêm bước chuẩn bị.
  const needsPrepare = (orderId: string) => {
    const t = itemTotals.get(orderId);
    return !!t && t.prepared < t.total;
  };

  const handleMarkPickedUp = async (orderId: string) => {
    setMarkingId(orderId);
    try {
      // Gộp 1 nút: nếu chưa chuẩn bị đủ thì TỰ xác nhận chuẩn bị đủ (preparedQty = quantity mọi dòng)
      // trước, rồi mới đánh dấu xuất kho — khỏi phải sang trang chi tiết đơn bấm "Xác nhận đã chuẩn bị xong".
      if (needsPrepare(orderId)) {
        const lines = (itemsByOrderId.get(orderId) ?? [])
          .filter((it) => it.orderItemId)
          .map((it) => ({ orderItemId: it.orderItemId as string, preparedQty: it.quantity }));
        if (lines.length > 0) {
          await orderApiService.confirmPreparedItems(orderId, { items: lines });
        }
      }
      await orderApiService.markPicklistPickedUp(orderId);
      toast.success('Đã chuẩn bị đủ & xuất kho cho đơn.');
      setReloadToken((t) => t + 1);
    } catch (err) {
      // Backend vẫn chặn nếu đơn đã xuất kho rồi.
      toast.error(parseApiError(err, 'Không thể xuất kho.'));
    } finally {
      setMarkingId(null);
    }
  };

  // Lấy đúng dòng SchedulePlan "lắp đặt/bàn giao" (taskCode === 'SETUP') — KHÔNG tính "Khảo sát hiện
  // trường" (SURVEY, chưa đụng thiết bị, luôn diễn ra sớm nhất nên trước đây bị getEarliestRowLead-style
  // lấy nhầm) lẫn "Thu hồi thiết bị" (COLLECT, diễn ra sau, thuộc luồng thu hồi & hoàn kho riêng — trang
  // "Xuất kho và bàn giao" chỉ nói về bàn giao). Dữ liệu cũ có thể chưa có taskCode — fallback loại trừ
  // theo tên "khảo sát"/"thu hồi" để tránh lấy nhầm.
  const handoverRow = useMemo(() => {
    if (!viewingEvidenceOrder) return null;
    const rows = (plansByOrderId.get(viewingEvidenceOrder.orderId) ?? []).filter((r) => r.status !== 'CANCELLED');
    const setupRow = rows.find((r) => r.taskCode === 'SETUP');
    if (setupRow) return setupRow;
    return rows.find((r) => !/khảo sát|thu hồi/i.test(r.taskName ?? '')) ?? null;
  }, [viewingEvidenceOrder, plansByOrderId]);

  const handleViewEvidence = (order: Order) => {
    setViewingEvidenceOrder(order);
  };

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
  const exportedCount = orders.filter((o) => pickedUpMap.get(o.orderId)).length;

  const kpis: KpiCardItem[] = [
    { label: 'Tổng phiếu chuẩn bị', value: orders.length, icon: ClipboardList, iconColor: 'blue' },
    { label: 'Sẵn sàng xuất kho (ước tính)', value: readyCount, icon: PackageCheck, iconColor: 'amber' },
    { label: 'Đã xuất kho', value: exportedCount, icon: CheckCircle2, iconColor: 'green' },
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
    {
      key: 'eventDate',
      label: 'Ngày thi công',
      render: (o) => (
        <>
          {formatDate(o.eventDate)}
          {o.endDate ? ` - ${formatDate(o.endDate)}` : ''}
        </>
      ),
    },
    {
      key: 'coordinatorName',
      label: 'Điều phối viên',
      render: (o) => coordinatorByOrderId.get(o.orderId) ?? <span className="italic text-slate-400">Chưa phân công</span>,
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
            onClick={() => handleViewEvidence(o)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-600"
          >
            <Camera className="h-3.5 w-3.5" />
            Xem bằng chứng
          </button>
          {pickedUpMap.get(o.orderId) ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã xuất kho
            </span>
          ) : (
            // Nút "Đánh dấu xuất kho" đã ẩn theo yêu cầu — chỉ hiển thị trạng thái, không cho thao tác ở đây.
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-400">
              Chưa xuất kho
            </span>
          )}
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
          Xuất kho và bàn giao
        </h1>
        {/* <p className="mt-1 text-sm text-slate-500">
          Phiếu chuẩn bị xuất kho theo từng đơn đặt đã xác nhận — theo dõi tiến độ chuẩn bị thiết bị và xem bằng chứng bàn giao do Leader Staff gửi lên tại hiện trường.
        </p> */}
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

        {/* <p className="mt-3 text-[11px] italic text-slate-400">
          Ghi chú: &quot;Sẵn sàng xuất kho&quot; là ước tính từ tổng số lượng đã chuẩn bị/order_items. Nút &quot;Đánh
          dấu xuất kho&quot; ghi <code>orders.picked_up_at</code> qua API thật; backend chặn nếu chưa chuẩn bị
          đủ thiết bị hoặc đơn đã xuất kho rồi.
        </p> */}

        {orders.length === 0 && !loading && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
            <p className="text-sm text-slate-400">Không có đơn nào cần chuẩn bị xuất kho.</p>
          </div>
        )}
      </motion.div>

      <Modal
        isOpen={Boolean(viewingEvidenceOrder)}
        onClose={() => setViewingEvidenceOrder(null)}
        title="Bằng chứng bàn giao"
        subtitle={viewingEvidenceOrder ? `${viewingEvidenceOrder.orderCode} · ${viewingEvidenceOrder.customerName ?? ''}` : undefined}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setViewingEvidenceOrder(null)}>
            Đóng
          </Button>
        }
      >
        {viewingEvidenceOrder && (() => {
          if (!handoverRow) {
            return <p className="text-sm text-slate-400">Đơn chưa có kế hoạch/công việc lắp đặt — bàn giao nào được lập.</p>;
          }
          const r = handoverRow;
          const lead = r.assignees?.find((a) => a.role === 'LEAD');
          return (
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.taskName ?? 'Công việc chưa đặt tên'}</p>
                  <p className="text-xs text-slate-400">Phụ trách: {lead?.fullName ?? 'Chưa phân công'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${SCHEDULE_STATUS_BADGE[r.status]}`}>
                  {SCHEDULE_STATUS_LABEL[r.status]}
                </span>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <EvidenceBlock
                  evidenceIds={r.evidenceIds ?? []}
                  title="Bằng chứng bàn giao (lắp đặt)"
                  emptyLabel="Chưa có bằng chứng cho công việc này."
                />
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
