'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { addDaysKey, dayOfMonth, StaffLane, weekStartKey } from '@/utils/scheduleCalendar';

interface Props {
  lanes: StaffLane[];
  todayKey: string;
}

const WEEKS = 8;
const HEAVY = 4; // ≥4 việc/tuần = tải nặng

function cellClass(count: number, conflict: boolean): string {
  if (conflict) return 'bg-rose-500 text-white';
  if (count <= 0) return 'bg-slate-50 text-slate-300';
  if (count === 1) return 'bg-blue-50 text-blue-700';
  if (count === 2) return 'bg-blue-100 text-blue-800';
  if (count < HEAVY) return 'bg-blue-300 text-blue-950';
  return 'bg-amber-400 text-amber-950'; // tải nặng
}

export default function StaffUtilization({ lanes, todayKey }: Props) {
  const [windowStart, setWindowStart] = useState<string>(() => weekStartKey(addDaysKey(todayKey, -14)));

  const weeks = useMemo(() => Array.from({ length: WEEKS }, (_, i) => addDaysKey(windowStart, i * 7)), [windowStart]);
  const currentWeek = weekStartKey(todayKey);

  // Tổng hợp: mỗi nhân sự × tuần → {count, hours, conflict}
  const rows = useMemo(() => {
    return lanes
      .map((lane) => {
        const byWeek = new Map<string, { count: number; hours: number; conflict: boolean }>();
        for (const b of lane.blocks) {
          const wk = weekStartKey(b.dayKey);
          const cur = byWeek.get(wk) ?? { count: 0, hours: 0, conflict: false };
          cur.count += 1;
          cur.hours += Math.max((b.endMs - b.startMs) / 3_600_000, 0);
          if (b.conflict) cur.conflict = true;
          byWeek.set(wk, cur);
        }
        const total = lane.blocks.length;
        const totalHours = lane.blocks.reduce((s, b) => s + Math.max((b.endMs - b.startMs) / 3_600_000, 0), 0);
        return { lane, byWeek, total, totalHours };
      })
      .sort((a, b) => b.total - a.total);
  }, [lanes]);

  const overloadedThisWindow = rows.filter((r) => weeks.some((w) => (r.byWeek.get(w)?.count ?? 0) >= HEAVY || r.byWeek.get(w)?.conflict)).length;

  return (
    <Reveal className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">Tải nhân sự theo tuần</h3>
          {/* <p className="mt-0.5 text-xs text-slate-400">Số việc mỗi nhân sự/tuần — ô đậm = bận, cam = tải nặng (≥{HEAVY}), đỏ = có trùng lịch. Thấy ai rảnh để nhận thêm.</p> */}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setWindowStart((w) => addDaysKey(w, -WEEKS * 7))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Kỳ trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setWindowStart(weekStartKey(addDaysKey(todayKey, -14)))} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Hiện tại
          </button>
          <button type="button" onClick={() => setWindowStart((w) => addDaysKey(w, WEEKS * 7))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Kỳ sau">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {overloadedThisWindow > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />{overloadedThisWindow} nhân sự tải nặng/trùng lịch trong kỳ này
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-14 text-center text-xs font-medium text-slate-400">Chưa có nhân sự nào được phân công trong dữ liệu đang tải.</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate" style={{ borderSpacing: '4px 0' }}>
            <thead>
              <tr>
                <th className="w-44 pb-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Nhân sự</th>
                {weeks.map((w) => (
                  <th key={w} className={`pb-2 text-center text-[10px] font-semibold ${w === currentWeek ? 'text-blue-600' : 'text-slate-400'}`}>
                    Tuần<br />{dayOfMonth(w)}/{Number(w.slice(5, 7))}
                  </th>
                ))}
                <th className="pb-2 text-center text-[10px] font-bold uppercase text-slate-400">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lane, byWeek, total, totalHours }) => (
                <tr key={lane.userId}>
                  <td className="py-1">
                    <p className="truncate text-xs font-bold text-slate-800">{lane.fullName}</p>
                    <p className="text-[10px] text-slate-400">{total} việc · {Math.round(totalHours)}h</p>
                  </td>
                  {weeks.map((w) => {
                    const c = byWeek.get(w);
                    const count = c?.count ?? 0;
                    return (
                      <td key={w} className="py-1">
                        <div
                          className={`flex h-9 items-center justify-center rounded text-xs font-bold ${cellClass(count, c?.conflict ?? false)}`}
                          title={`Tuần ${dayOfMonth(w)}/${Number(w.slice(5, 7))}: ${count} việc${c?.hours ? ` · ${Math.round(c.hours)}h` : ''}${c?.conflict ? ' · TRÙNG LỊCH' : ''}`}
                        >
                          {count > 0 ? count : ''}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-1 text-center text-xs font-extrabold text-slate-700">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <Users className="h-3.5 w-3.5 text-slate-400" />
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-50" /> nhẹ</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-300" /> bận</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-400" /> tải nặng (≥{HEAVY})</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-rose-500" /> trùng lịch</span>
      </div>
    </Reveal>
  );
}
