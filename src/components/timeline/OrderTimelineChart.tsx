'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { OrderPlanGroup, getGroupStatusInfo } from '@/utils/schedulePlanGroups';
import Reveal from '@/components/ui/Reveal';
import { formatDate } from '@/utils/formatDate';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const TIMELINE_DAY_COUNT = 10;

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function weekdayLabelOf(dateStr: string): string {
  const day = new Date(dateStr).getDay();
  return WEEKDAY_LABELS[(day + 6) % 7];
}

export function dateDiffInDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

interface OrderTimelineChartProps {
  timelineAnchor: string;
  setTimelineAnchor: (anchor: string | ((prev: string) => string)) => void;
  timelineDays: string[];
  todayStr: string;
  timelineRows: { group: OrderPlanGroup; range: [string, string]; customerColorClass: string }[];
  onSelectGroupDetail: (group: OrderPlanGroup) => void;
}

export default function OrderTimelineChart({
  timelineAnchor,
  setTimelineAnchor,
  timelineDays,
  todayStr,
  timelineRows,
  onSelectGroupDetail,
}: OrderTimelineChartProps) {
  return (
    <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">
            Lịch timeline tháng {new Date(timelineAnchor).getMonth() + 1}/{new Date(timelineAnchor).getFullYear()}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">Bản đồ tiến độ thi công và khớp thời gian thực tế của tất cả các đơn hàng trùng khớp nhau</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTimelineAnchor((prev) => addDaysStr(prev, -7))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            title="Kỳ trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTimelineAnchor(todayStr)}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => setTimelineAnchor((prev) => addDaysStr(prev, 7))}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
            title="Kỳ sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[220px_1fr]">
            <div className="border-b border-slate-100 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Đơn hàng</div>
            <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: `repeat(${TIMELINE_DAY_COUNT}, minmax(0, 1fr))` }}>
              {timelineDays.map((d) => (
                <div key={d} className={`py-2 text-center ${d === todayStr ? 'text-blue-600' : 'text-slate-400'}`}>
                  <p className="text-sm font-bold">{new Date(d).getDate()}</p>
                  <p className="text-[10px] font-semibold">{weekdayLabelOf(d)}</p>
                </div>
              ))}
            </div>
          </div>

          {timelineRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Clock className="h-6 w-6 text-slate-300" />
              <p className="text-xs font-medium text-slate-400">Không có kế hoạch nào trong khoảng thời gian này.</p>
            </div>
          ) : (
            timelineRows.map(({ group, range, customerColorClass }) => {
              const info = getGroupStatusInfo(group.rows);
              const rangeStartStr = toDateStr(new Date(range[0]));
              const rangeEndStr = toDateStr(new Date(range[1]));
              const startCol = Math.max(1, dateDiffInDays(timelineDays[0], rangeStartStr) + 1);
              const endCol = Math.min(TIMELINE_DAY_COUNT, dateDiffInDays(timelineDays[0], rangeEndStr) + 1);
              return (
                <div key={group.orderId} className="grid grid-cols-[220px_1fr] border-b border-slate-100/80">
                  <div className="flex items-center gap-2 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${info.dotColorClass}`} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{group.orderCode}</p>
                      <p className="truncate text-[10px] text-slate-500">{group.customerName || '—'}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatDate(rangeStartStr)} - {formatDate(rangeEndStr)}
                      </p>
                    </div>
                  </div>
                  <div className="relative grid py-3" style={{ gridTemplateColumns: `repeat(${TIMELINE_DAY_COUNT}, minmax(0, 1fr))` }}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectGroupDetail(group);
                      }}
                      title={`${group.customerName} — ${group.eventName} — nhấp để xem chi tiết`}
                      className={`truncate rounded-full px-2.5 py-1.5 text-center text-[11px] font-bold transition-opacity hover:opacity-80 ${customerColorClass}`}
                      style={{ gridColumn: `${startCol} / ${endCol + 1}` }}
                    >
                      {group.orderCode}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        {/* <p className="text-[11px] italic leading-relaxed text-slate-500">
          Mẹo: Nhấp vào thanh ngang màu sắc của đơn hàng (ví dụ <strong className="font-bold not-italic text-slate-700">{timelineRows[0]?.group.orderCode ?? 'ORD-001'}</strong>) trên bảng
          timeline để hiển thị Drawer chi tiết các công việc, nhân sự phân công và trang thiết bị thực tế (bao gồm ±6 tiếng đệm).
        </p> */}
      </div>
    </Reveal>
  );
}
