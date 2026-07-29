'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { SCHEDULE_STATUS_LABEL } from '@/constants/work-task';
import { VN_TIME_ZONE } from '@/utils/formatDate';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { Order } from '@/types/order';
import type { Customer } from '@/types/customer';

const HOUR_START = 6;
const HOUR_END = 20;
const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

function getDaysOfWeek(anchor: Date): Date[] {
  const day = anchor.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayNumberClass(isSelected: boolean, isToday: boolean): string {
  if (isSelected) return 'bg-blue-600 text-white';
  if (isToday) return 'bg-blue-100 text-blue-600';
  return 'text-slate-800';
}

function cardClassFor(status: string): string {
  if (status === 'COMPLETED') return 'border-emerald-200 bg-emerald-50/90 text-emerald-900 hover:bg-emerald-50';
  if (status === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50/90 text-blue-900 hover:bg-blue-50';
  return 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
}

export interface WeekViewProps {
  anchorDate: Date;
  onAnchorDateChange: (date: Date) => void;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  schedules: SchedulePlan[];
  orderById: Map<string, Order>;
  customerById: Map<string, Customer>;
}

export default function WeekView({
  anchorDate,
  onAnchorDateChange,
  selectedDate,
  onSelectedDateChange,
  schedules,
  orderById,
  customerById,
}: Readonly<WeekViewProps>) {
  const days = getDaysOfWeek(anchorDate);
  const monthYearLabel = anchorDate.toLocaleDateString('vi-VN', {
    month: 'long',
    year: 'numeric',
    timeZone: VN_TIME_ZONE,
  });
  const today = new Date();

  // Lọc plan có startTime trong khung giờ hiển thị (06:00 – 20:00)
  const schedulesInWindow = schedules.filter((s) => {
    const d = new Date(s.startTime);
    const hour = d.getHours() + d.getMinutes() / 60;
    return hour >= HOUR_START && hour <= HOUR_END;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(anchorDate);
                d.setDate(d.getDate() - 7);
                onAnchorDateChange(d);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:shadow-xs"
              aria-label="Tuần trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(anchorDate);
                d.setDate(d.getDate() + 7);
                onAnchorDateChange(d);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:shadow-xs"
              aria-label="Tuần sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onAnchorDateChange(new Date());
              onSelectedDateChange(new Date());
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Hôm nay
          </button>
          <span className="ml-2 text-sm font-black capitalize text-slate-800">{monthYearLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />{' '}Đang thực hiện
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />{' '}Nháp / Đã giao việc
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{' '}Hoàn thành
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/60">
          <div className="border-r border-slate-100 p-3 text-center text-[10px] font-bold uppercase text-slate-400">
            Giờ
          </div>
          {days.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectedDateChange(day)}
                className={`flex flex-col items-center justify-center gap-1 border-r border-slate-100 p-3 text-center last:border-r-0 hover:bg-slate-50 ${
                  isSelected ? 'bg-blue-50/40' : ''
                }`}
              >
                <span
                  className={`text-[10px] font-black tracking-wider ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
                >
                  {idx === 6 ? 'CN' : `THỨ ${idx + 2}`}
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${dayNumberClass(isSelected, isToday)}`}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative overflow-y-auto" style={{ height: `${HOUR_HEIGHT * HOURS.length}px` }}>
          <div className="absolute inset-0 grid grid-cols-8">
            <div className="relative border-r border-slate-100">
              {HOURS.map((hour, idx) => (
                <div
                  key={hour}
                  className="absolute left-0 w-full px-1.5 text-right text-[11px] font-bold text-slate-400"
                  style={{ top: `${idx * HOUR_HEIGHT - 7}px` }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map((day) => (
              <div key={day.toISOString()} className="relative border-r border-slate-100 last:border-r-0">
                {HOURS.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute left-0 w-full border-t border-slate-100/70"
                    style={{ top: `${idx * HOUR_HEIGHT}px` }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="absolute inset-0 grid grid-cols-8">
            <div />
            {days.map((day) => {
              const daySchedules = schedulesInWindow.filter((s) =>
                isSameDay(new Date(s.startTime), day),
              );
              return (
                <div key={day.toISOString()} className="relative">
                  {daySchedules.map((schedule) => {
                    const start = new Date(schedule.startTime);
                    const end = schedule.endTime ? new Date(schedule.endTime) : new Date(start.getTime() + 3_600_000);
                    const hourDecimal = start.getHours() + start.getMinutes() / 60;
                    const top = (hourDecimal - HOUR_START) * HOUR_HEIGHT;
                    // Tính chiều cao theo khoảng thời gian (min 1h, max 4h)
                    const durationH = Math.max(
                      1,
                      Math.min(4, (end.getTime() - start.getTime()) / 3_600_000),
                    );
                    const height = durationH * HOUR_HEIGHT - 6;
                    const order = orderById.get(schedule.orderId);
                    const customer = order ? customerById.get(order.customerId) : undefined;
                    return (
                      <Link
                        key={schedule.planId}
                        href={`/manager/orders/${schedule.orderId}`}
                        className={`absolute left-1 right-1 flex flex-col justify-between overflow-hidden rounded-lg border p-2 text-left shadow-2xs transition-colors ${cardClassFor(schedule.status)}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div>
                          <span className="mb-1 block truncate text-[10px] font-black uppercase tracking-wide opacity-70">
                            {SCHEDULE_STATUS_LABEL[schedule.status] ?? schedule.status}
                          </span>
                          <p className="truncate text-xs font-extrabold leading-tight">
                            {schedule.taskName ?? `Task #${schedule.taskId}`}
                          </p>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[10px] font-bold opacity-80">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            {start.toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: VN_TIME_ZONE,
                            })}
                          </span>
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {schedule.location ?? customer?.customerName ?? `#${schedule.orderId}`}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
