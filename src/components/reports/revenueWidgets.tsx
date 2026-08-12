'use client';

// Bộ widget cho Báo cáo doanh thu: KPI tile + nhiều mẫu chart (recharts) — dùng lại cho dashboard.
// Theo hệ thống thiết kế: card rounded-2xl, viền nhạt, accent xanh #2563eb, màu trạng thái nhất quán.

import type { LucideIcon } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/utils/formatCurrency';

export function formatMillions(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}T`;
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${value}`;
}

const ICON_BG: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
};

export function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'blue',
}: Readonly<{ label: string; value: React.ReactNode; sub?: string; icon: LucideIcon; tone?: keyof typeof ICON_BG }>) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ICON_BG[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 truncate text-lg font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-[11px] font-medium text-slate-400">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = '',
}: Readonly<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }>) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-xs ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

const AXIS = { fontSize: 12, fill: '#64748b' } as const;
const GRID = '#f1f5f9';

function EmptyChart({ text = 'Chưa có dữ liệu trong khoảng đã chọn.' }: Readonly<{ text?: string }>) {
  return <div className="flex h-64 items-center justify-center text-xs text-slate-400">{text}</div>;
}

// ── Chart 1: Doanh thu đặt (area) vs Đã thu (line) theo tháng ──────────────────────────────────────
export interface TrendPoint {
  month: string;
  booked: number;
  collected: number;
}
export function RevenueTrendChart({ data }: Readonly<{ data: TrendPoint[] }>) {
  const hasData = data.some((d) => d.booked > 0 || d.collected > 0);
  return (
    <ChartCard title="Doanh thu theo tháng" subtitle="Doanh thu đặt (đơn hiệu lực) vs tiền đã thu (cọc) · 12 tháng gần nhất">
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bookedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} width={40} />
              <Tooltip formatter={(v, n) => [formatCurrency(Number(v)), n === 'booked' ? 'Doanh thu đặt' : 'Đã thu (cọc)']} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="booked" name="Doanh thu đặt" stroke="#2563eb" strokeWidth={2} fill="url(#bookedFill)" isAnimationActive={false} />
              <Line type="monotone" dataKey="collected" name="Đã thu (cọc)" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// ── Chart 2: Donut cơ cấu thanh toán ──────────────────────────────────────────────────────────────
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}
export function StatusDonut({ title, subtitle, centerLabel, data }: Readonly<{ title: string; subtitle?: string; centerLabel: string; data: DonutSlice[] }>) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {total > 0 ? (
        <>
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" innerRadius={54} outerRadius={82} paddingAngle={2} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.label} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v}`, 'Số đơn']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[11px] text-slate-400">{centerLabel}</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {data.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.label}
                </span>
                <span className="font-semibold text-slate-800">
                  {d.value} · {total === 0 ? 0 : Math.round((d.value / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// ── Chart 3: Bar doanh thu theo loại sự kiện ────────────────────────────────────────────────────────
export function EventTypeBar({ data }: Readonly<{ data: { eventType: string; revenue: number }[] }>) {
  return (
    <ChartCard title="Doanh thu theo loại sự kiện" subtitle="Tổng doanh thu đặt theo từng loại">
      {data.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="eventType" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} width={40} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Doanh thu']} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// ── Chart 4: Doanh thu (bar) vs Chi phí NCC (line) theo tháng ────────────────────────────────────────
export function RevenueVsCostChart({ data }: Readonly<{ data: { month: string; revenue: number; cost: number }[] }>) {
  const hasData = data.some((d) => d.revenue > 0 || d.cost > 0);
  return (
    <ChartCard title="Doanh thu vs Chi phí Nhà cung cấp" subtitle="Cột: doanh thu đặt · Đường: chi phí thuê/mua NCC · theo tháng">
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} width={40} />
              <Tooltip formatter={(v, n) => [formatCurrency(Number(v)), n === 'revenue' ? 'Doanh thu' : 'Chi phí NCC']} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[5, 5, 0, 0]} barSize={18} isAnimationActive={false} />
              <Line type="monotone" dataKey="cost" name="Chi phí NCC" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// ── Chart 5: Bar ngang Top khách hàng ───────────────────────────────────────────────────────────────
export function TopCustomersBar({ data }: Readonly<{ data: { name: string; revenue: number }[] }>) {
  return (
    <ChartCard title="Top khách hàng theo doanh thu" subtitle="10 khách hàng doanh thu cao nhất">
      {data.length > 0 ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Doanh thu']} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#7c3aed" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
