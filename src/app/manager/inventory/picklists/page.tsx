'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Camera, CheckCircle2, ClipboardList, Loader2, PackageCheck, Search, Truck } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { evidenceApiService } from '@/services/evidence.service';
import type { Order, OrderItem } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { Evidence } from '@/types/evidence';
import { groupPlansByOrder, getEarliestRowLead, SCHEDULE_STATUS_BADGE, SCHEDULE_STATUS_LABEL } from '@/utils/schedulePlanGroups';

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
//
// Đổi tên hiển thị 2026-08-03: "Pick-list xuất kho" → "Xuất kho và bàn giao" + thêm nút "Xem bằng
// chứng" (modal) hiển thị ảnh minh chứng Leader Staff gắn khi cập nhật trạng thái từng SchedulePlan
// của đơn (field `evidenceId` — PATCH /schedule-plans/:id/status — đã có thật ở backend, không phải
// mock). Giữ nguyên toàn bộ phần xuất kho ở trên vì vẫn đang chờ Backend như ghi chú cũ.
export default function ManagerPicklistsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemTotals, setItemTotals] = useState<Map<string, { total: number; prepared: number }>>(new Map());
  const [coordinatorByOrderId, setCoordinatorByOrderId] = useState<Map<string, string>>(new Map());
  const [plansByOrderId, setPlansByOrderId] = useState<Map<string, SchedulePlan[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [readyFilter, setReadyFilter] = useState<'' | 'READY' | 'NOT_READY'>('');

  const [viewingEvidenceOrder, setViewingEvidenceOrder] = useState<Order | null>(null);
  const [evidenceByPlanId, setEvidenceByPlanId] = useState<Map<string, Evidence | null>>(new Map());
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
  }, []);

  // Chỉ lấy dòng SchedulePlan sớm nhất còn hoạt động (đúng dòng dùng cho cột "Điều phối viên",
  // getEarliestRowLead) — đây là công việc "lắp đặt/bàn giao", KHÔNG tính dòng "Thu hồi thiết bị"
  // (diễn ra sau, thuộc luồng thu hồi & hoàn kho riêng — trang "Xuất kho và bàn giao" chỉ nói về
  // bàn giao, không phải thu hồi).
  const handoverRow = useMemo(() => {
    if (!viewingEvidenceOrder) return null;
    const rows = plansByOrderId.get(viewingEvidenceOrder.orderId) ?? [];
    return rows.find((r) => r.status !== 'CANCELLED') ?? null;
  }, [viewingEvidenceOrder, plansByOrderId]);

  useEffect(() => {
    const evidenceId = handoverRow?.evidenceId;
    if (!evidenceId) return;

    let cancelled = false;
    async function loadEvidence() {
      setEvidenceLoading(true);
      const res = await evidenceApiService.getEvidenceById(evidenceId as string).catch(() => null);
      if (cancelled) return;
      setEvidenceByPlanId(new Map([[evidenceId as string, (res?.data ?? null) as Evidence | null]]));
      setEvidenceLoading(false);
    }
    loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [handoverRow]);

  const handleViewEvidence = (order: Order) => {
    setEvidenceByPlanId(new Map());
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
          Xuất kho và bàn giao
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Phiếu chuẩn bị xuất kho theo từng đơn đặt đã xác nhận — theo dõi tiến độ chuẩn bị thiết bị và xem bằng chứng bàn giao do Leader Staff gửi lên tại hiện trường.
        </p>
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
          chưa có cột xác nhận riêng (<code>items_confirmed_at</code>) như tài liệu đề xuất. Nút &quot;Đã xuất
          kho&quot; chưa có API (thiếu cột <code>orders.picked_up_at</code> và endpoint tương ứng) — xem
          docs/more-require.md.
        </p>

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
          const evidence = r.evidenceId ? evidenceByPlanId.get(r.evidenceId) : undefined;
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

              <div className="mt-3">
                {!r.evidenceId && <p className="text-xs italic text-slate-400">Chưa có bằng chứng cho công việc này.</p>}
                {r.evidenceId && evidenceLoading && evidence === undefined && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải ảnh minh chứng...
                  </p>
                )}
                {r.evidenceId && !evidenceLoading && !evidence?.fileUrl && (
                  <p className="text-xs italic text-slate-400">Không tải được ảnh minh chứng.</p>
                )}
                {evidence?.fileUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ Firebase Storage
                  <img
                    src={evidence.fileUrl}
                    alt={`Bằng chứng bàn giao — ${r.taskName ?? r.planId}`}
                    onClick={() => setLightboxImage(evidence.fileUrl)}
                    className="h-28 w-28 cursor-zoom-in rounded-lg border border-slate-100 object-cover transition-opacity hover:opacity-80"
                  />
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-8"
          onClick={() => setLightboxImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ Firebase Storage */}
          <img src={lightboxImage} alt="Bằng chứng bàn giao (phóng to)" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
