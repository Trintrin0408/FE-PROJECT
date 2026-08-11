'use client';

// View "Thiết bị đi/về" — suy từ schedule-plan SETUP (đi) / COLLECT|RETURN (về), trục giờ co giãn theo ngày.
import { useMemo } from 'react';
import { ArrowLeftRight, ChevronLeft, ChevronRight, PackageCheck, PackageOpen } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { formatDate, formatTime } from '@/utils/formatDate';
import {
  EquipmentMovement,
  MovementKind,
  blockDayHours,
  blockHourGeometry,
  computeDayHourWindow,
  hourTicks,
} from '@/utils/scheduleCalendar';

interface Props {
  selectedDay: string;
  movements: EquipmentMovement[];
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onPickDay: (key: string) => void;
}

const KIND_META: Record<MovementKind, { label: string; tone: string; softText: string; icon: typeof PackageOpen }> = {
  OUT: { label: 'Đi (xuất kho lắp đặt)', tone: 'bg-amber-500 text-white', softText: 'text-amber-700', icon: PackageOpen },
  IN: { label: 'Về (thu hồi kho)', tone: 'bg-emerald-500 text-white', softText: 'text-emerald-700', icon: PackageCheck },
};

function Track({
  items,
  kind,
  selectedDay,
  ticks,
  winStart,
  winEnd,
}: {
  items: EquipmentMovement[];
  kind: MovementKind;
  selectedDay: string;
  ticks: number[];
  winStart: number;
  winEnd: number;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const span = Math.max(winEnd - winStart, 1);
  const tickLeft = (h: number) => ((h - winStart) / span) * 100;
  return (
    <div className="grid grid-cols-[150px_1fr] items-stretch border-b border-slate-100/80">
      <div className="flex items-center gap-1.5 py-2.5 pr-2">
        <Icon className={`h-4 w-4 ${meta.softText}`} />
        <div>
          <p className="text-xs font-bold text-slate-800">{kind === 'OUT' ? 'Thiết bị đi' : 'Thiết bị về'}</p>
          <p className="text-[10px] text-slate-400">{items.length} chuyến</p>
        </div>
      </div>
      <div className="relative my-1.5 h-9 rounded bg-slate-50">
        {ticks.map((h) => (
          <span key={h} className="absolute top-0 h-full w-px bg-slate-200/70" style={{ left: `${tickLeft(h)}%` }} />
        ))}
        {items.map((m) => {
          const hours = blockDayHours(m.startMs, m.endMs, selectedDay);
          const geo = blockHourGeometry(hours.start, hours.end, winStart, winEnd);
          if (!geo) return null;
          return (
            <div
              key={m.planId}
              className={`absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 overflow-hidden rounded px-1.5 text-[10px] font-bold shadow-sm ${meta.tone}`}
              style={{ left: `${geo.leftPct}%`, width: `${geo.widthPct}%` }}
              title={`${m.orderCode} · ${meta.label} · ${formatTime(new Date(m.startMs).toISOString())}–${formatTime(new Date(m.endMs).toISOString())}${m.estimatedEnd ? ' (giờ ước lượng)' : ''}${m.leadName ? ` · Trưởng nhóm: ${m.leadName}` : ''}`}
            >
              <span className="truncate">{m.orderCode}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EquipmentMovementBoard({ selectedDay, movements, onPrevDay, onNextDay, onToday, onPickDay }: Props) {
  const dayMovements = useMemo(() => movements.filter((m) => m.dayKey === selectedDay), [movements, selectedDay]);
  const outItems = dayMovements.filter((m) => m.kind === 'OUT');
  const inItems = dayMovements.filter((m) => m.kind === 'IN');

  const [winStart, winEnd] = useMemo(() => {
    const pairs = dayMovements.map((m) => blockDayHours(m.startMs, m.endMs, selectedDay));
    return computeDayHourWindow(pairs);
  }, [dayMovements, selectedDay]);
  const ticks = hourTicks(winStart, winEnd);
  const span = Math.max(winEnd - winStart, 1);

  return (
    <Reveal className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">Thiết bị đi / về — {formatDate(selectedDay)}</h3>
          <p className="mt-0.5 text-xs text-slate-400">Suy từ lịch lắp đặt (SETUP = đi) và thu hồi (COLLECT = về); khối đặt theo giờ thực tế.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => e.target.value && onPickDay(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none"
          />
          <button type="button" onClick={onPrevDay} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Ngày trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToday} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Hôm nay
          </button>
          <button type="button" onClick={onNextDay} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Ngày sau">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700"><PackageOpen className="h-3.5 w-3.5" />{outItems.length} chuyến đi</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><PackageCheck className="h-3.5 w-3.5" />{inItems.length} chuyến về</span>
      </div>

      {dayMovements.length === 0 ? (
        <div className="py-14 text-center text-xs font-medium text-slate-400">Ngày này không có thiết bị đi/về.</div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[150px_1fr]">
                <div />
                <div className="relative h-6 border-b border-slate-100">
                  {ticks.map((h) => (
                    <span key={h} className="absolute -translate-x-1/2 text-[10px] font-semibold text-slate-400" style={{ left: `${((h - winStart) / span) * 100}%` }}>
                      {String(h % 24).padStart(2, '0')}h
                    </span>
                  ))}
                </div>
              </div>
              <Track items={outItems} kind="OUT" selectedDay={selectedDay} ticks={ticks} winStart={winStart} winEnd={winEnd} />
              <Track items={inItems} kind="IN" selectedDay={selectedDay} ticks={ticks} winStart={winStart} winEnd={winEnd} />
            </div>
          </div>

          {/* Danh sách chi tiết */}
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {dayMovements.map((m) => {
              const meta = KIND_META[m.kind];
              const Icon = meta.icon;
              return (
                <div key={m.planId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${meta.softText}`} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        <span className="font-mono text-blue-600">{m.orderCode}</span> · {m.eventName || m.customerName}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{m.location ?? '—'}{m.leadName ? ` · TN: ${m.leadName}` : ''}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-bold ${meta.softText}`}>{m.kind === 'OUT' ? 'Đi' : 'Về'}</p>
                    <p className="font-mono text-[11px] text-slate-600">
                      {formatTime(new Date(m.startMs).toISOString())}–{formatTime(new Date(m.endMs).toISOString())}
                      {m.estimatedEnd && <span className="text-slate-300"> *</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400"><ArrowLeftRight className="h-3 w-3" />Dấu * = giờ kết thúc ước lượng (kế hoạch chưa nhập giờ về).</p>
        </>
      )}
    </Reveal>
  );
}
