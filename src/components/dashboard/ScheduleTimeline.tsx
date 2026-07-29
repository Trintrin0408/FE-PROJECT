'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, ClipboardList, MapPin } from 'lucide-react';
import { SCHEDULE_STATUS_LABEL } from '@/constants/work-task';
import { VN_TIME_ZONE } from '@/utils/formatDate';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { Order } from '@/types/order';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: VN_TIME_ZONE });
}

function getMonthGrid(viewDate: Date): Date[] {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const lastOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const endOffset = 6 - ((lastOfMonth.getDay() + 6) % 7);
  const gridStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - startOffset);
  const totalDays = startOffset + lastOfMonth.getDate() + endOffset;

  return Array.from(
    { length: totalDays },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
}

function timelineDotColor(status: string, isDelayed: boolean): string {
  if (isDelayed) return 'bg-red-500';
  if (status === 'IN_PROGRESS') return 'bg-blue-600';
  if (status === 'COMPLETED') return 'bg-blue-300';
  return 'bg-slate-300';
}

export interface ScheduleTimelineProps {
  viewDate: Date;
  selectedDate: Date;
  onViewDateChange: (date: Date) => void;
  onSelectedDateChange: (date: Date) => void;
  schedules: SchedulePlan[];
  alertedTaskIds: Set<string>;
  orderById: Map<string, Order>;
  scheduleHref: string;
}

export default function ScheduleTimeline({
  viewDate,
  selectedDate,
  onViewDateChange,
  onSelectedDateChange,
  schedules,
  alertedTaskIds,
  orderById,
  scheduleHref,
}: Readonly<ScheduleTimelineProps>) {
  const monthGrid = getMonthGrid(viewDate);
  const monthLabel = viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric', timeZone: VN_TIME_ZONE });
  const selectedDateLabel = selectedDate.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: VN_TIME_ZONE,
  });

  // Nhóm theo startTime — ngày/giờ dự kiến thật.
  const schedulesOnSelectedDate = schedules.filter((s) =>
    isSameDay(new Date(s.startTime), selectedDate),
  );
  const datesWithSchedules = new Set(
    schedules.map((s) => new Date(s.startTime).toDateString()),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Lịch trình &amp; Lịch sự kiện</h3>
        </div>
        <Link href={scheduleHref} className="text-xs font-bold text-blue-600 hover:underline">
          Xem lịch trình
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mini calendar */}
        <div className="w-full">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                onViewDateChange(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
              }
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-slate-100"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</span>
            <button
              type="button"
              onClick={() =>
                onViewDateChange(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
              }
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-slate-100"
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d} className="text-xs text-slate-400">
                {d}
              </span>
            ))}
            {monthGrid.map((date) => {
              const inMonth = date.getMonth() === viewDate.getMonth();
              const isSelected = isSameDay(date, selectedDate);
              const hasSchedules = datesWithSchedules.has(date.toDateString());
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => onSelectedDateChange(date)}
                  className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors duration-150 ${
                    isSelected
                      ? 'bg-blue-600 font-semibold text-white shadow-sm'
                      : inMonth
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {date.getDate()}
                  {hasSchedules && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h4 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold capitalize text-slate-700">
            {selectedDateLabel}
          </h4>
          {schedulesOnSelectedDate.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Không có công việc nào trong ngày này.
            </p>
          ) : (
            <div className="relative flex flex-col gap-5 before:absolute before:bottom-1 before:left-[13px] before:top-1 before:w-px before:bg-slate-200">
              {schedulesOnSelectedDate.map((schedule, index) => {
                const order = orderById.get(schedule.orderId);
                const isDelayed = alertedTaskIds.has(schedule.planId);
                const isActive = schedule.status === 'IN_PROGRESS';
                const dotColor = timelineDotColor(schedule.status, isDelayed);
                return (
                  <motion.div
                    key={schedule.planId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="relative flex gap-4"
                  >
                    <span
                      className={`z-10 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-white ${dotColor}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                    <div
                      className={`flex-1 rounded-xl border p-4 transition-colors duration-150 ${
                        isActive ? 'border-blue-100 bg-blue-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-base font-semibold text-slate-800">
                          {schedule.taskName ?? `Task #${schedule.taskId}`}
                        </span>
                        <span className="flex-shrink-0 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-100">
                          {formatTime(schedule.startTime)}
                        </span>
                      </div>
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                        <ClipboardList className="h-3 w-3 flex-shrink-0" />
                        Đơn #{order?.orderId ?? schedule.orderId}
                      </p>
                      {schedule.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {schedule.location}
                        </p>
                      )}
                      <div className="mt-2.5">
                        {isDelayed ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200">
                            Bị trễ
                          </span>
                        ) : (
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                            {SCHEDULE_STATUS_LABEL[schedule.status] ?? schedule.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
