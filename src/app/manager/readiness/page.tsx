'use client';

import { AlertTriangle, CalendarClock, ShieldCheck } from 'lucide-react';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import EventReadinessBoard from '@/components/dashboard/EventReadinessBoard';
import { useEventReadiness } from '@/hooks/useEventReadiness';

export default function ReadinessPage() {
  const { isLoading, loadError, rows, atRisk, upcoming, fullyReady } = useEventReadiness();

  const kpis: KpiCardItem[] = [
    { label: 'Sự kiện sắp diễn ra', value: upcoming, icon: CalendarClock, iconColor: 'blue' },
    { label: 'Sẵn sàng đầy đủ', value: fullyReady, icon: ShieldCheck, iconColor: 'green' },
    {
      label: 'Gấp & còn thiếu (≤7 ngày)',
      value: atRisk,
      icon: AlertTriangle,
      iconColor: 'pink',
      changeDirection: atRisk > 0 ? 'down' : 'up',
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Sẵn sàng vận hành</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kiểm soát nhanh toàn bộ sự kiện: cái nào đã đủ điều kiện chạy, cái nào còn thiếu khâu chuẩn bị nào.
        </p>
      </div>

      {loadError && <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{loadError}</div>}

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <div className="mt-6">
        <EventReadinessBoard rows={rows} isLoading={isLoading} />
      </div>
    </div>
  );
}
