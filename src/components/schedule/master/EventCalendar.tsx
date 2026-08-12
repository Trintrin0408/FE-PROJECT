'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import {
  DayLoad,
  ORDER_STATUS_ORDER,
  ORDER_STATUS_STYLE,
  WEEKDAY_LABELS,
  getMonthMatrix,
  loadLevel,
  orderStatusStyle,
} from '@/utils/scheduleCalendar';

interface Props {
  year: number;
  month0: number;
  todayKey: string;
  dayLoadMap: Map<string, DayLoad>;
  selectedDay: string | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDay: (key: string) => void;
}

const MAX_CHIPS = 3;

// Gộp "mức bận" vào lịch sự kiện: nền ô đậm dần theo số đơn cùng ngày (nhạt để không lấn chip đơn).
const CELL_TINT: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-white',
  1: 'bg-blue-50/60',
  2: 'bg-blue-50',
  3: 'bg-blue-100/70',
  4: 'bg-blue-100',
};
// Badge số đơn ở góc ô — đậm dần theo mức bận (dễ quét mắt hơn nền nhạt).
const COUNT_BADGE: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-blue-200 text-blue-800',
  3: 'bg-blue-400 text-white',
  4: 'bg-blue-600 text-white',
};
const LOAD_SWATCH = ['bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600'];

export default function EventCalendar({
  year,
  month0,
  todayKey,
  dayLoadMap,
  selectedDay,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDay,
}: Props) {
  const weeks = getMonthMatrix(year, month0, todayKey);

  return (
    <Reveal className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">
            Lịch sự kiện &amp; mức bận — Tháng {month0 + 1}/{year}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">Ô đậm dần = càng nhiều đơn diễn ra cùng ngày · chip = mã đơn (màu theo trạng thái). Nhấp 1 ngày để xem chi tiết.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onPrevMonth} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Tháng trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToday} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Hôm nay
          </button>
          <button type="button" onClick={onNextMonth} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Tháng sau">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {w}
              </div>
            ))}
            {weeks.flat().map((cell) => {
              const orders = dayLoadMap.get(cell.key)?.orders ?? [];
              const count = orders.length;
              const level = loadLevel(count);
              const isSelected = cell.key === selectedDay;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDay(cell.key)}
                  title={`${cell.key} · ${count} đơn`}
                  className={[
                    'flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 text-left transition',
                    cell.inMonth ? `border-slate-100 ${CELL_TINT[level]}` : 'border-transparent bg-slate-50/60 opacity-60',
                    isSelected ? 'ring-2 ring-slate-900' : cell.isToday ? 'ring-2 ring-blue-500' : 'hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-bold ${cell.isToday ? 'text-blue-600' : cell.weekend ? 'text-rose-400' : 'text-slate-500'}`}>{cell.day}</span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 text-[9px] font-bold leading-4 ${COUNT_BADGE[level as 1 | 2 | 3 | 4]}`}>{count}</span>
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {orders.slice(0, MAX_CHIPS).map((o) => {
                      const st = orderStatusStyle(o.orderStatus);
                      return (
                        <span key={o.orderId} className={`truncate rounded px-1.5 py-0.5 text-[10px] font-bold ${st.bar}`} title={`${o.orderCode} · ${o.eventName ?? ''}`}>
                          {o.orderCode}
                        </span>
                      );
                    })}
                    {orders.length > MAX_CHIPS && (
                      <span className="px-1 text-[10px] font-semibold text-slate-400">+{orders.length - MAX_CHIPS} đơn khác</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Trạng thái:</span>
          {ORDER_STATUS_ORDER.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${ORDER_STATUS_STYLE[s].dot}`} />
              <span className="text-[11px] text-slate-500">{ORDER_STATUS_STYLE[s].label}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mức bận:</span>
          <span className="text-[11px] text-slate-400">ít</span>
          {LOAD_SWATCH.map((c) => (
            <span key={c} className={`inline-block h-3.5 w-3.5 rounded ${c}`} />
          ))}
          <span className="text-[11px] text-slate-400">nhiều</span>
        </div>
      </div>
    </Reveal>
  );
}
