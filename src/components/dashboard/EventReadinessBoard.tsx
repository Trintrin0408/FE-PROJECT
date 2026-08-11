'use client';

// Bảng sẵn sàng vận hành (go/no-go matrix): mỗi hàng là 1 sự kiện sắp diễn ra, mỗi cột là 1 cổng
// chuẩn bị (Cọc / Khảo sát / Phân công / Xuất kho). Xanh = xong, vàng = còn thiếu. Sắp theo "còn mấy
// ngày" để việc gấp nhất nằm trên cùng. Dữ liệu do useEventReadiness gom từ API thật.

import Link from 'next/link';
import { Check, Clock, CalendarClock, ShieldCheck, ClipboardCheck, Users, PackageCheck, DollarSign } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import type { GateKey, GateState, ReadinessRow } from '@/hooks/useEventReadiness';

const GATE_META: { key: GateKey; label: string; icon: typeof Check }[] = [
  { key: 'deposit', label: 'Cọc', icon: DollarSign },
  { key: 'survey', label: 'Khảo sát', icon: ClipboardCheck },
  { key: 'staff', label: 'Phân công', icon: Users },
  { key: 'picked', label: 'Xuất kho', icon: PackageCheck },
];

function GateCell({ state }: { state: GateState }) {
  if (state === 'done') {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-inset ring-emerald-200">
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'na') {
    return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-300">—</span>;
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-1 ring-inset ring-amber-200">
      <Clock className="h-4 w-4" />
    </span>
  );
}

function daysBadge(daysLeft: number) {
  if (daysLeft < 0) return { text: `Đã qua ${-daysLeft} ngày`, cls: 'bg-slate-100 text-slate-500' };
  if (daysLeft === 0) return { text: 'Hôm nay', cls: 'bg-rose-100 text-rose-700' };
  if (daysLeft <= 3) return { text: `Còn ${daysLeft} ngày`, cls: 'bg-rose-100 text-rose-700' };
  if (daysLeft <= 7) return { text: `Còn ${daysLeft} ngày`, cls: 'bg-amber-100 text-amber-700' };
  return { text: `Còn ${daysLeft} ngày`, cls: 'bg-slate-100 text-slate-600' };
}

function ReadyBar({ ready, total, atRisk }: { ready: number; total: number; atRisk: boolean }) {
  const pct = Math.round((ready / total) * 100);
  const color = ready === total ? 'bg-emerald-500' : atRisk ? 'bg-rose-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold ${ready === total ? 'text-emerald-600' : 'text-slate-600'}`}>{ready}/{total}</span>
    </div>
  );
}

export default function EventReadinessBoard({ rows, isLoading }: { rows: ReadinessRow[]; isLoading?: boolean }) {
  return (
    <Reveal className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-blue-600" /> Bảng sẵn sàng vận hành
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">Sự kiện sắp diễn ra và tình trạng từng khâu chuẩn bị — việc gấp nhất ở trên cùng.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} /> Đã xong</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> Còn thiếu</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Sự kiện</th>
              <th className="px-2 py-2">
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Ngày diễn ra</span>
              </th>
              {GATE_META.map((g) => (
                <th key={g.key} className="px-2 py-2 text-center">
                  <span className="inline-flex items-center gap-1"><g.icon className="h-3.5 w-3.5" /> {g.label}</span>
                </th>
              ))}
              <th className="px-2 py-2">Sẵn sàng</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-2 py-10 text-center text-sm text-slate-400">Đang tải…</td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-10 text-center text-sm text-slate-400">Không có sự kiện nào đang trong quá trình vận hành.</td>
              </tr>
            )}
            {rows.map((r) => {
              const atRisk = r.daysLeft >= 0 && r.daysLeft <= 7 && r.readyCount < r.totalGates;
              const b = daysBadge(r.daysLeft);
              return (
                <tr
                  key={r.orderId}
                  className={`border-b border-slate-50 transition hover:bg-slate-50/70 ${atRisk ? 'bg-rose-50/40' : ''}`}
                >
                  <td className={`px-2 py-3 ${atRisk ? 'border-l-2 border-rose-400' : ''}`}>
                    <Link href={`/manager/orders/${r.orderId}`} className="font-semibold text-blue-700 hover:underline">
                      {r.orderCode}
                    </Link>
                    <div className="text-xs text-slate-500">{r.eventName || r.eventType || '—'}</div>
                    <div className="text-[11px] text-slate-400">{r.customerName}</div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="text-slate-700">{formatDate(r.eventDate)}</div>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${b.cls}`}>{b.text}</span>
                  </td>
                  {GATE_META.map((g) => (
                    <td key={g.key} className="px-2 py-3 text-center">
                      <div className="flex justify-center">
                        <GateCell state={r.gates[g.key]} />
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-3">
                    <ReadyBar ready={r.readyCount} total={r.totalGates} atRisk={atRisk} />
                    <div className="mt-0.5 text-[11px] text-slate-400">{formatCurrency(r.totalAmount)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}
