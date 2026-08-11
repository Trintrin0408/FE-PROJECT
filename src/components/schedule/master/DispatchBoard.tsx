'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, MapPin, PackageCheck, PackageOpen, User } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { EquipmentMovement, MovementKind } from '@/utils/scheduleCalendar';

interface Props {
  selectedDay: string;
  movements: EquipmentMovement[];
  orderHref: (orderId: string) => string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onPickDay: (key: string) => void;
}

function Column({
  title,
  kind,
  items,
  orderHref,
}: {
  title: string;
  kind: MovementKind;
  items: EquipmentMovement[];
  orderHref: (orderId: string) => string;
}) {
  const isOut = kind === 'OUT';
  const Icon = isOut ? PackageOpen : PackageCheck;
  const accent = isOut ? 'text-amber-600' : 'text-emerald-600';
  const headBg = isOut ? 'bg-amber-50' : 'bg-emerald-50';
  return (
    <div className="flex-1 rounded-xl border border-slate-200">
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2.5 ${headBg}`}>
        <Icon className={`h-4 w-4 ${accent}`} />
        <h4 className="text-sm font-extrabold text-slate-800">{title}</h4>
        <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-slate-500">{items.length}</span>
      </div>
      <div className="space-y-2 p-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Không có {isOut ? 'chuyến xuất' : 'chuyến về'} nào.</p>
        ) : (
          items.map((m) => (
            <div key={m.planId} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <Link href={orderHref(m.orderId)} className="truncate font-mono text-sm font-bold text-blue-600 hover:underline">
                  {m.orderCode}
                </Link>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <Clock className="h-3 w-3" />
                  {formatTime(new Date(m.startMs).toISOString())}
                  {m.estimatedEnd ? '' : `–${formatTime(new Date(m.endMs).toISOString())}`}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">{m.eventName || m.customerName}</p>
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                <p className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{m.location ?? '—'}</p>
                <p className="flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" />Phụ trách: {m.leadName ?? 'Chưa phân công trưởng nhóm'}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DispatchBoard({ selectedDay, movements, orderHref, onPrevDay, onNextDay, onToday, onPickDay }: Props) {
  const dayMovements = useMemo(() => movements.filter((m) => m.dayKey === selectedDay), [movements, selectedDay]);
  const outItems = dayMovements.filter((m) => m.kind === 'OUT');
  const inItems = dayMovements.filter((m) => m.kind === 'IN');

  return (
    <Reveal className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-800">Điều vận ngày — {formatDate(selectedDay)}</h3>
          <p className="mt-0.5 text-xs text-slate-400">To-do cho thủ kho/điều phối: đơn cần XUẤT (lắp đặt) và đơn cần thu VỀ (kiểm–nhập) trong ngày.</p>
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

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <Column title="Xuất hôm nay (lắp đặt)" kind="OUT" items={outItems} orderHref={orderHref} />
        <Column title="Về hôm nay (thu hồi)" kind="IN" items={inItems} orderHref={orderHref} />
      </div>
    </Reveal>
  );
}
