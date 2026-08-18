'use client';

import { useMemo } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, HelpCircle, Users } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { formatDate, formatTime } from '@/utils/formatDate';
import {
  StaffBlock,
  StaffLane,
  blockDayHours,
  blockHourGeometry,
  computeDayHourWindow,
  hourTicks,
} from '@/utils/scheduleCalendar';

interface Props {
  selectedDay: string;
  lanes: StaffLane[];
  todayKey: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onPickDay: (key: string) => void;
}

const TASK_TONE: Record<string, string> = {
  SETUP: 'bg-amber-500',
  COLLECT: 'bg-emerald-500',
  RETURN: 'bg-emerald-500',
  SURVEY: 'bg-slate-400',
};

function blockTone(b: StaffBlock): string {
  if (b.conflict) return 'bg-rose-500 text-white ring-2 ring-rose-300';
  if (b.suspected) return 'bg-orange-400 text-white ring-2 ring-orange-200';
  return `${TASK_TONE[b.taskCode] ?? 'bg-blue-500'} text-white`;
}

function timeLabel(b: StaffBlock): string {
  return `${formatTime(new Date(b.startMs).toISOString())}–${formatTime(new Date(b.endMs).toISOString())}${b.estimatedEnd ? ' *' : ''}`;
}

export default function StaffScheduleGrid({ selectedDay, lanes, todayKey, onPrevDay, onNextDay, onToday, onPickDay }: Props) {
  const dayLanes = useMemo(() => {
    return lanes
      .map((lane) => ({ lane, blocks: lane.blocks.filter((b) => b.dayKey === selectedDay) }))
      .sort((a, b) => {
        const ca = a.blocks.filter((x) => x.conflict).length;
        const cb = b.blocks.filter((x) => x.conflict).length;
        if (cb !== ca) return cb - ca; // trùng cứng lên đầu
        if (b.blocks.length !== a.blocks.length) return b.blocks.length - a.blocks.length; // bận hơn lên trước
        return a.lane.fullName.localeCompare(b.lane.fullName, 'vi');
      });
  }, [lanes, selectedDay]);

  // Khung giờ co giãn theo dữ liệu thật của ngày → không ẩn mất việc sớm/khuya.
  const [winStart, winEnd] = useMemo(() => {
    const pairs = dayLanes.flatMap(({ blocks }) => blocks.map((b) => blockDayHours(b.startMs, b.endMs, selectedDay)));
    return computeDayHourWindow(pairs);
  }, [dayLanes, selectedDay]);
  const ticks = hourTicks(winStart, winEnd);
  const span = Math.max(winEnd - winStart, 1);
  const tickLeft = (h: number) => ((h - winStart) / span) * 100;

  const busyCount = dayLanes.filter((d) => d.blocks.length > 0).length;
  const freeCount = dayLanes.length - busyCount;
  const conflictStaff = dayLanes.filter((d) => d.blocks.some((b) => b.conflict)).length;
  const suspectStaff = dayLanes.filter((d) => d.blocks.some((b) => b.suspected) && !d.blocks.some((b) => b.conflict)).length;

  const allDayBlocks = useMemo(
    () =>
      dayLanes
        .flatMap(({ lane, blocks }) => blocks.map((b) => ({ ...b, staffName: lane.fullName })))
        .sort((a, b) => a.startMs - b.startMs),
    [dayLanes],
  );

  return (
    <Reveal className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">Lịch nhân sự — {formatDate(selectedDay)}</h3>
          {/* <p className="mt-0.5 text-xs text-slate-400">Mỗi hàng là 1 nhân sự; trống trên trục = rảnh. Đỏ = trùng giờ chắc chắn, cam = nghi ngờ. <span className="font-semibold">★</span> = trưởng nhóm (LEAD).</p> */}
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700"><Users className="h-3.5 w-3.5" />{busyCount} người có việc</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{freeCount} người rảnh</span>
        {conflictStaff > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />{conflictStaff} người trùng lịch</span>
        )}
        {suspectStaff > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700"><HelpCircle className="h-3.5 w-3.5" />{suspectStaff} nghi ngờ trùng</span>
        )}
      </div>

      {dayLanes.length === 0 ? (
        <div className="py-14 text-center text-xs font-medium text-slate-400">Chưa có nhân sự nào được phân công trong dữ liệu đang tải.</div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[820px]">
              {/* Trục giờ */}
              <div className="grid grid-cols-[150px_1fr]">
                <div />
                <div className="relative h-6 border-b border-slate-100">
                  {ticks.map((h) => (
                    <span key={h} className="absolute -translate-x-1/2 text-[10px] font-semibold text-slate-400" style={{ left: `${tickLeft(h)}%` }}>
                      {String(h % 24).padStart(2, '0')}h
                    </span>
                  ))}
                </div>
              </div>

              {dayLanes.map(({ lane, blocks }) => (
                <div key={lane.userId} className="grid grid-cols-[150px_1fr] items-stretch border-b border-slate-100/80">
                  <div className="flex flex-col justify-center py-2.5 pr-2">
                    <p className="truncate text-xs font-bold text-slate-800">{lane.fullName}</p>
                    <p className="text-[10px] text-slate-400">
                      {blocks.length === 0 ? 'Rảnh' : `${blocks.length} việc`}
                      {blocks.some((b) => b.conflict) && <span className="ml-1 font-bold text-rose-600">· trùng giờ</span>}
                      {!blocks.some((b) => b.conflict) && blocks.some((b) => b.suspected) && <span className="ml-1 font-bold text-orange-600">· nghi ngờ trùng</span>}
                    </p>
                  </div>
                  <div className="relative my-1.5 h-8 rounded bg-slate-50">
                    {ticks.map((h) => (
                      <span key={h} className="absolute top-0 h-full w-px bg-slate-200/70" style={{ left: `${tickLeft(h)}%` }} />
                    ))}
                    {blocks.map((b) => {
                      const hours = blockDayHours(b.startMs, b.endMs, selectedDay);
                      const geo = blockHourGeometry(hours.start, hours.end, winStart, winEnd);
                      if (!geo) return null;
                      return (
                        <div
                          key={b.planId}
                          className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded px-1.5 text-[10px] font-bold shadow-sm ${blockTone(b)}`}
                          style={{ left: `${geo.leftPct}%`, width: `${geo.widthPct}%` }}
                          title={`${b.orderCode} · ${b.taskName || b.taskCode} · ${b.role === 'LEAD' ? 'Trưởng nhóm' : 'Kỹ thuật viên'} · ${timeLabel(b)}${b.conflict ? ' · TRÙNG GIỜ' : b.suspected ? ' · NGHI NGỜ TRÙNG' : ''}`}
                        >
                          <span className="truncate">{b.role === 'LEAD' ? '★ ' : ''}{b.orderCode}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danh sách chi tiết — đảm bảo mọi việc đều đọc được kể cả khi thanh bị chồng/kẹp mép */}
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {allDayBlocks.map((b) => (
              <div key={`${b.planId}-${b.staffName}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {b.staffName} · <span className="font-mono text-blue-600">{b.orderCode}</span> · {b.taskName || b.taskCode}
                    <span className={`ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold ${b.role === 'LEAD' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {b.role === 'LEAD' ? '★ Trưởng nhóm' : 'KTV'}
                    </span>
                  </p>
                  {(b.conflict || b.suspected) && (
                    <p className={`text-[11px] font-bold ${b.conflict ? 'text-rose-600' : 'text-orange-600'}`}>{b.conflict ? 'Trùng giờ' : 'Nghi ngờ trùng (chưa có giờ về)'}</p>
                  )}
                </div>
                <p className="shrink-0 font-mono text-[11px] text-slate-600">{timeLabel(b)}</p>
              </div>
            ))}
          </div>
          {allDayBlocks.some((b) => b.estimatedEnd) && (
            <p className="mt-2 text-[11px] text-slate-400">Dấu * = giờ kết thúc ước lượng (kế hoạch chưa nhập giờ về) — chỉ tính "nghi ngờ trùng", không tính trùng cứng.</p>
          )}
        </>
      )}
    </Reveal>
  );
}
