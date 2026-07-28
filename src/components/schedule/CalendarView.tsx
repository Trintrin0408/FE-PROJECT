'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VN_TIME_ZONE } from '@/utils/formatDate';
import type { SchedulePlan } from '@/types/schedulePlan';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayCellClass(isSelected: boolean, inMonth: boolean): string {
  if (isSelected) return 'border-2 border-blue-500 bg-blue-50/70';
  if (inMonth) return 'border border-slate-100 hover:border-slate-300 hover:bg-slate-50';
  return 'border border-slate-50 text-slate-300';
}

function dayNumberClass(isSelected: boolean, inMonth: boolean): string {
  if (isSelected) return 'text-blue-600';
  if (inMonth) return 'text-slate-600';
  return 'text-slate-300';
}

function getMonthGrid(viewDate: Date): Date[] {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const lastOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7);
  const gridStart = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1 - startOffset,
  );
  const totalDays = startOffset + lastOfMonth.getDate() + endOffset;
  return Array.from({ length: totalDays }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
}

export interface CalendarViewProps {
  viewDate: Date;
  selectedDate: Date;
  onViewDateChange: (date: Date) => void;
  onSelectedDateChange: (date: Date) => void;
  /** Nhóm plan theo startTime. */
  schedules: SchedulePlan[];
}

export default function CalendarView({
  viewDate,
  selectedDate,
  onViewDateChange,
  onSelectedDateChange,
  schedules,
}: Readonly<CalendarViewProps>) {
  const monthGrid = getMonthGrid(viewDate);
  const monthLabel = viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric', timeZone: VN_TIME_ZONE });

  const schedulesByDay = new Map<string, SchedulePlan[]>();
  for (const s of schedules) {
    const key = new Date(s.startTime).toDateString();
    const list = schedulesByDay.get(key) ?? [];
    list.push(s);
    schedulesByDay.set(key, list);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-base font-bold capitalize text-slate-900">{monthLabel}</span>
        <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onViewDateChange(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:shadow-xs"
            aria-label="Tháng trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewDateChange(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:shadow-xs"
            aria-label="Tháng sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 border-b border-slate-100 pb-2 text-center text-[11px] font-bold uppercase text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {monthGrid.map((date) => {
          const inMonth = date.getMonth() === viewDate.getMonth();
          const isSelected = isSameDay(date, selectedDate);
          const daySchedules = schedulesByDay.get(date.toDateString()) ?? [];
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelectedDateChange(date)}
              className={`flex min-h-[64px] flex-col items-start rounded-lg p-1.5 text-left transition-colors ${dayCellClass(isSelected, inMonth)}`}
            >
              <span className={`text-xs font-bold ${dayNumberClass(isSelected, inMonth)}`}>
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {daySchedules.slice(0, 2).map((s) => (
                  <span
                    key={s.planId}
                    className={`block w-full truncate rounded px-1 py-0.5 text-[9px] font-bold ${
                      s.taskName?.toLowerCase().includes('khảo sát')
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    #{s.orderId}
                  </span>
                ))}
                {daySchedules.length > 2 && (
                  <span className="block text-[9px] font-semibold text-slate-400">
                    +{daySchedules.length - 2}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
