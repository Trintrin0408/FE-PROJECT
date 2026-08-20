'use client';

// "Điều vận theo ngày" — bảng GỘP tài nguyên cho 1 ngày: sự kiện diễn ra + nhân sự (bận/rảnh + xung đột)
// + thiết bị đi/về, trên cùng 1 màn. Giải quyết khoảng trống lớn nhất của bài toán thời gian: free/busy
// đã có theo từng trục (Lịch tổng thể) nhưng chưa gộp để trả lời "ngày này ai rảnh VÀ thiết bị nào trống".

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays, Users, UserCheck, PackageOpen, PackageCheck, AlertTriangle, MapPin } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { useScheduleData } from '@/hooks/useScheduleData';
import { buildStaffLanes, extractEquipmentMovements, vnDateKey, todayKeyVN, addDaysKey, weekdayLabel, orderStatusStyle } from '@/utils/scheduleCalendar';
import { formatTime, formatDate } from '@/utils/formatDate';
import type { Order } from '@/types/order';

function ymdToDisplay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-');
  return `${d}/${m}/${y}`;
}

export default function DaySchedulePage() {
  const { isLoading, loadError, orders, plans, staff } = useScheduleData();
  const [dayKey, setDayKey] = useState<string>(() => todayKeyVN());

  const view = useMemo(() => {
    // Sự kiện diễn ra trong ngày: [eventDate, endDate] phủ dayKey, bỏ đơn đã hủy.
    const events = orders
      .filter((o) => o.orderStatus !== 'CANCELLED')
      .filter((o) => {
        const s = vnDateKey(o.eventDate);
        const e = vnDateKey(o.endDate ?? o.eventDate);
        return s <= dayKey && dayKey <= e;
      })
      .sort((a, b) => vnDateKey(a.eventDate).localeCompare(vnDateKey(b.eventDate)));

    // Nhân sự bận trong ngày (lọc block theo dayKey), kèm cờ xung đột.
    const lanes = buildStaffLanes(plans)
      .map((lane) => ({ ...lane, dayBlocks: lane.blocks.filter((b) => b.dayKey === dayKey) }))
      .filter((lane) => lane.dayBlocks.length > 0);
    const busyIds = new Set(lanes.map((l) => l.userId));
    const freeStaff = staff.filter((s) => !busyIds.has(s.userId));
    const conflictCount = lanes.reduce((n, l) => n + l.dayBlocks.filter((b) => b.conflict).length, 0);

    // Thiết bị đi/về trong ngày.
    const movements = extractEquipmentMovements(plans).filter((m) => m.dayKey === dayKey);
    const out = movements.filter((m) => m.kind === 'OUT');
    const inb = movements.filter((m) => m.kind === 'IN');

    return { events, lanes, freeStaff, conflictCount, out, inb };
  }, [orders, plans, staff, dayKey]);

  const kpis: KpiCardItem[] = [
    { label: 'Sự kiện diễn ra', value: view.events.length, icon: CalendarDays, iconColor: 'blue' },
    { label: 'Nhân sự bận', value: view.lanes.length, icon: Users, iconColor: 'amber' },
    { label: 'Nhân sự rảnh', value: view.freeStaff.length, icon: UserCheck, iconColor: 'green' },
    { label: 'Xung đột lịch', value: view.conflictCount, icon: AlertTriangle, iconColor: 'pink', changeDirection: view.conflictCount > 0 ? 'down' : 'up' },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Điều vận theo ngày</h1>
          {/* <p className="mt-1 text-sm text-slate-500">Toàn cảnh 1 ngày: sự kiện, nhân sự (rảnh/bận), thiết bị đi/về — trên cùng một màn.</p> */}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDayKey(addDaysKey(dayKey, -1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex flex-col items-center">
            <input type="date" value={dayKey} onChange={(e) => e.target.value && setDayKey(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" />
            <span className="mt-0.5 text-[11px] font-semibold text-slate-400">{weekdayLabel(dayKey) === 'CN' ? 'Chủ nhật' : `Thứ ${Number(weekdayLabel(dayKey).replace('T', ''))}`}</span>
          </div>
          <button onClick={() => setDayKey(addDaysKey(dayKey, 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setDayKey(todayKeyVN())} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Hôm nay</button>
        </div>
      </div>

      {loadError && <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{loadError}</div>}

      <div className="mt-6"><DashboardStats items={kpis} /></div>

      {/* Sự kiện diễn ra */}
      <Reveal className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><CalendarDays className="h-4 w-4 text-blue-600" /> Sự kiện diễn ra ngày {ymdToDisplay(dayKey)}</h3>
        {view.events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Không có sự kiện nào diễn ra trong ngày.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.events.map((o: Order) => {
              const st = orderStatusStyle(o.orderStatus);
              return (
                <Link key={o.orderId} href={`/manager/orders/${o.orderId}`} className="rounded-xl border border-slate-200 p-3 transition hover:border-blue-300 hover:bg-blue-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-blue-700">{o.orderCode}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.bar}`}>{st.label}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-slate-700">{o.eventName || o.eventType}</div>
                  <div className="text-xs text-slate-500">{o.customerName}{o.guestCount ? ` · ${o.guestCount} khách` : ''}</div>
                  {o.location && <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{o.location}</span></div>}
                </Link>
              );
            })}
          </div>
        )}
      </Reveal>

      {/* Nhân sự */}
      <Reveal delay={0.05} className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><Users className="h-4 w-4 text-amber-500" /> Nhân sự trong ngày</h3>
        {view.lanes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Không có ai được phân công trong ngày.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {view.lanes.map((lane) => (
              <div key={lane.userId} className={`rounded-xl border p-3 ${lane.dayBlocks.some((b) => b.conflict) ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{lane.fullName}</span>
                  {lane.dayBlocks.some((b) => b.conflict) && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"><AlertTriangle className="h-3 w-3" /> Trùng lịch</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {lane.dayBlocks.sort((a, b) => a.startMs - b.startMs).map((b) => (
                    <span key={b.planId} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${b.conflict ? 'bg-rose-100 text-rose-700' : b.role === 'LEAD' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`} title={`${b.taskName} · ${b.orderCode}`}>
                      <span className="font-bold">{formatTime(b.startMs)}{b.estimatedEnd ? '' : `–${formatTime(b.endMs)}`}</span>
                      <span className="max-w-[140px] truncate">{b.taskName} · {b.orderCode}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {view.freeStaff.length > 0 && (
          <div className="mt-3 rounded-xl bg-emerald-50/60 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><UserCheck className="h-3.5 w-3.5" /> Đang rảnh ({view.freeStaff.length})</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {view.freeStaff.map((s) => (
                <span key={s.userId} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">{s.fullName}</span>
              ))}
            </div>
          </div>
        )}
      </Reveal>

      {/* Thiết bị đi / về */}
      <Reveal delay={0.1} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><PackageOpen className="h-4 w-4 text-orange-500" /> Thiết bị ĐI (xuất kho / lắp đặt) · {view.out.length}</h3>
          <MovementList items={view.out} empty="Không có chuyến đi thiết bị." tone="out" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><PackageCheck className="h-4 w-4 text-emerald-500" /> Thiết bị VỀ (thu hồi / hoàn kho) · {view.inb.length}</h3>
          <MovementList items={view.inb} empty="Không có chuyến về thiết bị." tone="in" />
        </div>
      </Reveal>

      {isLoading && <p className="mt-6 text-center text-sm text-slate-400">Đang tải dữ liệu điều vận…</p>}
    </div>
  );
}

function MovementList({ items, empty, tone }: { items: ReturnType<typeof extractEquipmentMovements>; empty: string; tone: 'out' | 'in' }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-slate-400">{empty}</p>;
  return (
    <div className="mt-3 space-y-2">
      {items.map((m) => (
        <Link key={m.planId} href={`/manager/orders/${m.orderId}`} className="block rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-blue-700">{m.orderCode}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone === 'out' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {formatTime(m.startMs)}{m.estimatedEnd ? '' : `–${formatTime(m.endMs)}`}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-slate-600">{m.eventName || m.customerName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
            {m.leadName && <span>Phụ trách: {m.leadName}</span>}
            {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> <span className="max-w-[180px] truncate">{m.location}</span></span>}
          </div>
        </Link>
      ))}
    </div>
  );
}
