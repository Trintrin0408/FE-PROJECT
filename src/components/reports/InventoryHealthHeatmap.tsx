'use client';

// Heatmap sức khỏe tồn kho: hàng = thiết bị, cột = ngày (4 tuần tới), ô = mức giữ chỗ / sức chứa trong
// ngày đó. Màu theo dataviz: 1 hue (xanh) đậm dần theo utilization; vượt sức chứa = ĐỎ (status). Dữ liệu
// lấy từ getReservationsTimeline (đã có ở reports/inventory) — mỗi item kèm danh sách reservation window.

import { useMemo, useState } from 'react';
import { Boxes, AlertTriangle } from 'lucide-react';
import { vnDateKey, addDaysKey, todayKeyVN, weekdayLabel, dayOfMonth } from '@/utils/scheduleCalendar';
import type { TimelineItem } from '@/types/inventory';

const WINDOW_DAYS = 28; // 4 tuần
const ACTIVE_RES = new Set(['HELD', 'CONFIRMED']);

// Sequential 1-hue (xanh) light→dark theo utilization; >100% = đỏ status.
function cellStyle(reserved: number, capacity: number): { cls: string; over: boolean } {
  if (reserved <= 0) return { cls: 'bg-slate-50 text-slate-300', over: false };
  if (capacity > 0 && reserved > capacity) return { cls: 'bg-rose-500 text-white', over: true };
  const u = capacity > 0 ? reserved / capacity : 1;
  if (u <= 0.25) return { cls: 'bg-blue-100 text-blue-700', over: false };
  if (u <= 0.5) return { cls: 'bg-blue-200 text-blue-800', over: false };
  if (u <= 0.75) return { cls: 'bg-blue-400 text-white', over: false };
  return { cls: 'bg-blue-600 text-white', over: false };
}

interface Row {
  item: TimelineItem;
  daily: number[]; // reserved qty per day trong cửa sổ
  peak: number;
}

export default function InventoryHealthHeatmap({ items }: { items: TimelineItem[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const { dayKeys, rows } = useMemo(() => {
    const start = todayKeyVN();
    const dayKeys = Array.from({ length: WINDOW_DAYS }, (_, i) => addDaysKey(start, i));
    const rows: Row[] = [];
    for (const item of items) {
      const daily = dayKeys.map((dk) => {
        let sum = 0;
        for (const r of item.reservations ?? []) {
          if (!ACTIVE_RES.has(r.status)) continue;
          const sk = vnDateKey(r.startAt);
          const ek = vnDateKey(r.endAt);
          if (sk <= dk && dk <= ek) sum += r.quantity;
        }
        return sum;
      });
      const peak = Math.max(0, ...daily);
      if (peak > 0) rows.push({ item, daily, peak });
    }
    rows.sort((a, b) => {
      const ua = a.item.capacity > 0 ? a.peak / a.item.capacity : a.peak;
      const ub = b.item.capacity > 0 ? b.peak / b.item.capacity : b.peak;
      return ub - ua;
    });
    return { dayKeys, rows };
  }, [items]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
          <Boxes className="h-4 w-4 text-blue-600" /> Bản thống kê số lượng tồn kho theo ngày (4 tuần tới)
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-100" /> Sử dụng ít</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-600" /> Sử dụng nhiều</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-500" /> Quá tải (Vượt sức chứa)</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Không có thiết bị nào được giữ chỗ trong 4 tuần tới.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Thiết bị</th>
                {dayKeys.map((dk) => {
                  const isMon = weekdayLabel(dk) === 'T2';
                  return (
                    <th key={dk} className={`px-0.5 py-1 text-center text-[10px] font-semibold ${isMon ? 'text-slate-600' : 'text-slate-300'}`}>
                      {dayOfMonth(dk)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, daily }) => (
                <tr key={item.itemId}>
                  <td className="sticky left-0 z-10 max-w-[180px] truncate bg-white px-2 py-1 pr-3">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate text-xs font-semibold text-slate-700" title={item.itemName}>{item.itemName}</span>
                      {item.quantityDamaged > 0 && (
                        <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-600" title={`${item.quantityDamaged} hỏng`}>{item.quantityDamaged}⚠</span>
                      )}
                      {item.overCommitted && <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />}
                    </div>
                    <div className="text-[10px] text-slate-400">Sức chứa {item.capacity}</div>
                  </td>
                  {daily.map((reserved, i) => {
                    const { cls, over } = cellStyle(reserved, item.capacity);
                    const key = `${item.itemId}-${dayKeys[i]}`;
                    return (
                      <td key={key} className="p-[1px]">
                        <div
                          className={`relative flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold ${cls} ${over ? 'ring-1 ring-rose-600' : ''}`}
                          onMouseEnter={() => setHover(key)}
                          onMouseLeave={() => setHover(null)}
                        >
                          {reserved > 0 ? reserved : ''}
                          {hover === key && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-normal text-white shadow-lg">
                              {item.itemName} · {dayKeys[i]}<br />
                              Giữ chỗ {reserved}/{item.capacity}{over ? ' — VƯỢT' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
