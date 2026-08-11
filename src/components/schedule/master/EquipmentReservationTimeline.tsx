'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, PackageSearch } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { inventoryApiService } from '@/services/inventory.service';
import { formatDate } from '@/utils/formatDate';
import { addDaysKey, diffDaysKey, dayOfMonth, weekdayLabel } from '@/utils/scheduleCalendar';
import type { TimelineItem } from '@/types/inventory';

interface Props {
  todayKey: string;
  orderHref: (orderId: string) => string;
}

const RANGE_DAYS = 28; // cửa sổ 4 tuần

const STATUS_BAR: Record<string, string> = {
  CONFIRMED: 'bg-emerald-500',
  HELD: 'bg-amber-400',
  CONSUMED: 'bg-violet-400',
  RELEASED: 'bg-slate-300',
};

export default function EquipmentReservationTimeline({ todayKey, orderHref }: Props) {
  const [rangeStart, setRangeStart] = useState<string>(() => addDaysKey(todayKey, -3));
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeEnd = useMemo(() => addDaysKey(rangeStart, RANGE_DAYS - 1), [rangeStart]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    inventoryApiService
      .getReservationsTimeline({ from: rangeStart, to: addDaysKey(rangeEnd, 1) })
      .then((res) => {
        if (!cancelled) setItems(res.data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được lịch giữ chỗ thiết bị.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd]);

  const shift = useCallback((delta: number) => setRangeStart((prev) => addDaysKey(prev, delta)), []);

  // Vạch ngày: hiện mốc mỗi 7 ngày cho gọn.
  const ticks = useMemo(() => {
    const out: { key: string; leftPct: number }[] = [];
    for (let i = 0; i < RANGE_DAYS; i += 7) out.push({ key: addDaysKey(rangeStart, i), leftPct: (i / RANGE_DAYS) * 100 });
    return out;
  }, [rangeStart]);

  const todayLeftPct = useMemo(() => {
    const off = diffDaysKey(rangeStart, todayKey);
    return off >= 0 && off < RANGE_DAYS ? (off / RANGE_DAYS) * 100 : null;
  }, [rangeStart, todayKey]);

  function barGeometry(startKey: string, endKey: string): { leftPct: number; widthPct: number } | null {
    const s = startKey < rangeStart ? rangeStart : startKey;
    const e = endKey > rangeEnd ? rangeEnd : endKey;
    if (e < rangeStart || s > rangeEnd) return null;
    const startOff = diffDaysKey(rangeStart, s);
    const days = diffDaysKey(s, e) + 1;
    return { leftPct: (startOff / RANGE_DAYS) * 100, widthPct: Math.max((days / RANGE_DAYS) * 100, 1.5) };
  }

  const overCount = items.filter((i) => i.overCommitted).length;

  return (
    <Reveal className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">Giữ chỗ thiết bị — {formatDate(rangeStart)} → {formatDate(rangeEnd)}</h3>
          <p className="mt-0.5 text-xs text-slate-400">Mỗi thanh = 1 khoảng giữ chỗ (đơn đã cọc) của item. Item tô đỏ = đặt trùng vượt số khả dụng (over-committed).</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => shift(-RANGE_DAYS)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Kỳ trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setRangeStart(addDaysKey(todayKey, -3))} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">
            Hôm nay
          </button>
          <button type="button" onClick={() => shift(RANGE_DAYS)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Kỳ sau">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {overCount > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5" />{overCount} thiết bị bị đặt trùng vượt khả dụng
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>
      ) : error ? (
        <div className="py-14 text-center text-sm text-rose-500">{error}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <PackageSearch className="h-6 w-6 text-slate-300" />
          <p className="text-xs font-medium text-slate-400">Không có thiết bị nào bị giữ chỗ trong khoảng này.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Trục ngày */}
            <div className="grid grid-cols-[220px_1fr]">
              <div className="border-b border-slate-100 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Thiết bị</div>
              <div className="relative border-b border-slate-100 py-2">
                {ticks.map((t) => (
                  <span key={t.key} className="absolute top-2 -translate-x-1/2 text-center text-[10px] font-semibold text-slate-400" style={{ left: `${t.leftPct}%` }}>
                    {dayOfMonth(t.key)}/{Number(t.key.slice(5, 7))}
                    <span className="block text-[9px] text-slate-300">{weekdayLabel(t.key)}</span>
                  </span>
                ))}
              </div>
            </div>

            {items.map((item) => (
              <div key={item.itemId} className={`grid grid-cols-[220px_1fr] border-b border-slate-100/80 ${item.overCommitted ? 'bg-rose-50/40' : ''}`}>
                <div className="flex items-center gap-2 py-2.5 pr-2">
                  {item.overCommitted && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{item.itemName}</p>
                    <p className="text-[10px] text-slate-400">
                      Khả dụng {item.capacity} · đỉnh giữ {item.maxConcurrent}
                      {item.overCommitted && <span className="ml-1 font-bold text-rose-600">· VƯỢT</span>}
                    </p>
                  </div>
                </div>
                <div className="relative py-2">
                  {/* đường "hôm nay" */}
                  {todayLeftPct !== null && <span className="absolute top-0 z-10 h-full w-px bg-blue-400/70" style={{ left: `${todayLeftPct}%` }} />}
                  <div className="flex flex-col gap-1">
                    {item.reservations.map((r) => {
                      const geo = barGeometry(r.startAt.slice(0, 10), r.endAt.slice(0, 10));
                      if (!geo) return null;
                      const bar = STATUS_BAR[r.status] ?? 'bg-slate-400';
                      const content = (
                        <span
                          className={`block h-4 truncate rounded px-1.5 text-[10px] font-bold leading-4 text-white ${bar}`}
                          title={`${r.orderCode ?? '—'} · ${r.customerName ?? ''} · giữ ${r.quantity} · ${formatDate(r.startAt)}→${formatDate(r.endAt)}`}
                        >
                          {r.orderCode ?? '—'} ({r.quantity})
                        </span>
                      );
                      return (
                        <div key={r.reservationId} className="relative h-4" style={{ marginLeft: `${geo.leftPct}%`, width: `${geo.widthPct}%` }}>
                          {r.orderId ? (
                            <Link href={orderHref(r.orderId)} className="block hover:opacity-80">{content}</Link>
                          ) : (
                            content
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Reveal>
  );
}
