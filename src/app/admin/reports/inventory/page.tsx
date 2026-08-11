'use client';

import { useEffect, useMemo, useState } from 'react';
import { Boxes, Wrench, AlertTriangle, PackageSearch } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import InventoryHealthHeatmap from '@/components/reports/InventoryHealthHeatmap';
import { Table, TableColumn } from '@/components/ui/Table';
import Reveal from '@/components/ui/Reveal';
import { inventoryApiService } from '@/services/inventory.service';
import type { InventoryRow, ReconcileItem, TimelineItem } from '@/types/inventory';

export default function Page() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [anomalies, setAnomalies] = useState<ReconcileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      inventoryApiService.getInventory({ limit: 200 }).catch(() => ({ data: [] })),
      inventoryApiService.getReservationsTimeline({ from: '2026-01-01', to: '2027-12-31' }).catch(() => ({ data: { items: [] } as { items: TimelineItem[] } })),
      inventoryApiService.getReconcile().catch(() => ({ data: { anomalies: [] } as { anomalies: ReconcileItem[] } })),
    ])
      .then(([invRes, tlRes, rcRes]) => {
        setInventory((invRes.data ?? []) as InventoryRow[]);
        setTimeline(((tlRes.data as { items?: TimelineItem[] })?.items ?? []));
        setAnomalies(((rcRes.data as { anomalies?: ReconcileItem[] })?.anomalies ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const totalOwned = inventory.reduce((s, r) => s + (r.quantityTotal ?? 0), 0);
    const totalDamaged = inventory.reduce((s, r) => s + (r.quantityDamaged ?? 0), 0);
    const overCommitted = timeline.filter((t) => t.overCommitted).length;
    return { items: inventory.length, totalOwned, totalDamaged, overCommitted };
  }, [inventory, timeline]);

  // Top item theo mức giữ chỗ đỉnh (maxConcurrent)
  const topReserved = useMemo(() => [...timeline].sort((a, b) => b.maxConcurrent - a.maxConcurrent).slice(0, 10), [timeline]);

  const items: KpiCardItem[] = [
    { label: 'Loại thiết bị', value: kpis.items, icon: Boxes, iconColor: 'blue' },
    { label: 'Tổng SL sở hữu', value: kpis.totalOwned, icon: PackageSearch, iconColor: 'green' },
    { label: 'Đang hỏng', value: kpis.totalDamaged, icon: Wrench, iconColor: 'amber' },
    { label: 'Thiết bị đặt vượt (over-committed)', value: kpis.overCommitted, icon: AlertTriangle, iconColor: 'pink', changeDirection: kpis.overCommitted > 0 ? 'down' : 'up' },
  ];

  const reservedCols: TableColumn<TimelineItem>[] = [
    { key: 'itemName', label: 'Thiết bị', render: (r) => <span className="font-semibold text-slate-800">{r.itemName}</span> },
    { key: 'capacity', label: 'Khả dụng', className: 'text-center', render: (r) => r.capacity },
    { key: 'maxConcurrent', label: 'Đỉnh giữ chỗ', className: 'text-center', render: (r) => <span className="font-bold">{r.maxConcurrent}</span> },
    {
      key: 'over',
      label: 'Trạng thái',
      className: 'text-center',
      render: (r) => (r.overCommitted ? <span className="font-bold text-rose-600">Vượt khả dụng</span> : <span className="text-emerald-600">Đủ</span>),
    },
  ];

  const anomalyCols: TableColumn<ReconcileItem>[] = [
    { key: 'itemName', label: 'Thiết bị', render: (r) => <span className="font-semibold text-slate-800">{r.itemName}</span> },
    { key: 'outbound', label: 'Xuất', className: 'text-center', render: (r) => r.outbound },
    { key: 'inbound', label: 'Nhập', className: 'text-center', render: (r) => r.inbound },
    { key: 'onHand', label: 'Tồn thực', className: 'text-center', render: (r) => r.onHand },
    { key: 'flags', label: 'Bất thường', render: (r) => <span className="text-xs text-rose-600">{r.flags.join('; ')}</span> },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Báo cáo tồn kho</h1>
        <p className="mt-1 text-sm text-slate-500">Sức chứa, mức giữ chỗ đỉnh của từng thiết bị và đối soát tồn (phát hiện lệch xuất/nhập).</p>
      </div>

      <div className="mt-6">
        <DashboardStats items={items} />
      </div>

      <Reveal className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <InventoryHealthHeatmap items={timeline} />
      </Reveal>

      <Reveal className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h3 className="text-sm font-extrabold text-slate-800">Top thiết bị theo mức giữ chỗ</h3>
        <div className="mt-3">
          <Table columns={reservedCols} rows={topReserved} rowKey={(r) => r.itemId} isLoading={loading} emptyText="Chưa có thiết bị nào bị giữ chỗ." />
        </div>
      </Reveal>

      <Reveal delay={0.05} className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
          <AlertTriangle className="h-4 w-4 text-rose-500" /> Đối soát tồn kho — bất thường ({anomalies.length})
        </h3>
        <div className="mt-3">
          <Table columns={anomalyCols} rows={anomalies} rowKey={(r) => r.itemId} isLoading={loading} emptyText="Không có bất thường — tồn kho khớp lịch sử xuất/nhập." />
        </div>
      </Reveal>
    </div>
  );
}
