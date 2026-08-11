'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import {
  DayLoad,
  LOAD_LEVEL_CLASS,
  LOAD_LEVEL_LABEL,
  WEEKDAY_LABELS,
  getMonthMatrix,
  loadLevel,
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

export default function CapacityOverview({
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
            Mức bận theo ngày — Tháng {month0 + 1}/{year}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">Ô càng đậm = càng nhiều đơn diễn ra cùng ngày. Nhấp 1 ngày để xem chi tiết.</p>
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
        <div className="min-w-[620px]">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {w}
              </div>
            ))}
            {weeks.flat().map((cell) => {
              const count = dayLoadMap.get(cell.key)?.orders.length ?? 0;
              const level = loadLevel(count);
              const isSelected = cell.key === selectedDay;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDay(cell.key)}
                  title={`${cell.key} · ${LOAD_LEVEL_LABEL[level]}`}
                  className={[
                    'relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-bold transition',
                    LOAD_LEVEL_CLASS[level],
                    cell.inMonth ? '' : 'opacity-40',
                    isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : cell.isToday ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-slate-300',
                  ].join(' ')}
                >
                  <span>{cell.day}</span>
                  {count > 0 && <span className="mt-0.5 text-[10px] font-semibold opacity-90">{count} đơn</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mức độ:</span>
        {([0, 1, 2, 3, 4] as const).map((lvl) => (
          <span key={lvl} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3.5 w-3.5 rounded ${LOAD_LEVEL_CLASS[lvl].split(' ')[0]}`} />
            <span className="text-[11px] text-slate-500">{LOAD_LEVEL_LABEL[lvl]}</span>
          </span>
        ))}
      </div>
    </Reveal>
  );
}
