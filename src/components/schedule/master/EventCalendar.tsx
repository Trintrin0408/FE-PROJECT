'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import {
  DayLoad,
  ORDER_STATUS_ORDER,
  ORDER_STATUS_STYLE,
  WEEKDAY_LABELS,
  getMonthMatrix,
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
            Lịch sự kiện — Tháng {month0 + 1}/{year}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">Mỗi đơn trải theo khoảng [ngày sự kiện → ngày kết thúc], màu theo trạng thái đơn.</p>
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
              const isSelected = cell.key === selectedDay;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDay(cell.key)}
                  className={[
                    'flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 text-left transition',
                    cell.inMonth ? 'border-slate-100 bg-white' : 'border-transparent bg-slate-50/60 opacity-60',
                    isSelected ? 'ring-2 ring-slate-900' : cell.isToday ? 'ring-2 ring-blue-500' : 'hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className={`text-xs font-bold ${cell.isToday ? 'text-blue-600' : cell.weekend ? 'text-rose-400' : 'text-slate-500'}`}>
                    {cell.day}
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

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Trạng thái:</span>
        {ORDER_STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${ORDER_STATUS_STYLE[s].dot}`} />
            <span className="text-[11px] text-slate-500">{ORDER_STATUS_STYLE[s].label}</span>
          </span>
        ))}
      </div>
    </Reveal>
  );
}
