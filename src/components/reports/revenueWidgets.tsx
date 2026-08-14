'use client';

// Bộ widget cho Báo cáo doanh thu: KPI tile + nhiều mẫu chart (recharts) — dùng lại cho dashboard.
// Theo hệ thống thiết kế: card rounded-2xl, viền nhạt, accent xanh #2563eb, màu trạng thái nhất quán.

import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
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
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-rose-50 text-rose-600',
  violet: 'bg-indigo-50 text-indigo-600',
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
    <div className="group rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-[0_2px_12px_rgb(0,0,0,0.03)] backdrop-blur-md transition-all hover:shadow-[0_8px_24px_rgb(0,0,0,0.08)] hover:-translate-y-0.5">
      <div className="flex items-center gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${ICON_BG[tone]}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export function AlertBanner({ title, message, actionText, onAction }: Readonly<{ title: string; message: string; actionText?: string; onAction?: () => void }>) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="font-bold text-rose-900">{title}</h4>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
        </div>
      </div>
      {actionText && onAction && (
        <button onClick={onAction} className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 transition-colors">
          {actionText}
        </button>
      )}
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
    <div className={`rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] backdrop-blur-xl ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

const AXIS = { fontSize: 12, fill: '#64748b' } as const;
const GRID = '#f1f5f9';

function EmptyChart({ text = 'Chưa có dữ liệu trong khoảng đã chọn.' }: Readonly<{ text?: string }>) {
  return <div className="flex h-72 items-center justify-center text-sm font-medium text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">{text}</div>;
}

// ── Chart 1: Doanh thu & thu tiền theo tháng (cột chồng: đã thu + còn phải thu) ──────────────────────
export interface MonthlyMoneyPoint {
  month: string;
  committed: number;
  collected: number;
  outstanding: number;
}
export function MonthlyMoneyChart({ data }: Readonly<{ data: MonthlyMoneyPoint[] }>) {
  const hasData = data.some((d) => d.collected > 0 || d.outstanding > 0);
  return (
    <ChartCard title="Hiệu quả doanh thu theo tháng" subtitle="Giá trị hợp đồng chốt (cột = tổng) chia thành Đã thu và Còn phải thu">
      {hasData ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} width={48} dx={-8} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v, n) => [formatCurrency(Number(v)), n === 'collected' ? 'Đã thu' : 'Còn phải thu']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: '16px' }} />
              <Bar dataKey="collected" stackId="money" name="Đã thu" fill="#10b981" maxBarSize={48} />
              <Bar dataKey="outstanding" stackId="money" name="Còn phải thu" fill="#fbbf24" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// ── Chart 1.5: Dòng tiền mặt theo tháng (Cash-flow Area Chart) ──────────────────────
export interface CashFlowPoint {
  month: string;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
}
export function MonthlyCashFlowChart({ data }: Readonly<{ data: CashFlowPoint[] }>) {
  const hasData = data.some((d) => d.cashIn > 0 || d.cashOut > 0);
  return (
    <ChartCard title="Lưu lượng dòng tiền mặt (Cash-flow)" subtitle="Thống kê tiền thực thu và thực chi theo ngày giao dịch">
      {hasData ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} width={48} dx={-8} />
              <Tooltip formatter={(v, n) => [formatCurrency(Number(v)), n]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: '16px' }} />
              <Area type="monotone" dataKey="cashIn" name="Dòng tiền vào" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
              <Area type="monotone" dataKey="cashOut" name="Dòng tiền ra" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
            </AreaChart>
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
export function StatusDonut({
  title,
  subtitle,
  centerLabel,
  data,
  valueFormat = (n) => `${n}`,
  centerFormat,
  unit = 'Số đơn',
}: Readonly<{
  title: string;
  subtitle?: string;
  centerLabel: string;
  data: DonutSlice[];
  valueFormat?: (n: number) => string;
  centerFormat?: (n: number) => string;
  unit?: string;
}>) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const centerFmt = centerFormat ?? valueFormat;
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {total > 0 ? (
        <>
          <div className="relative h-60">
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[17px] font-bold tracking-tight text-slate-900">{centerFmt(total)}</span>
              <span className="mt-1 text-xs font-medium text-slate-400">{centerLabel}</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" innerRadius={64} outerRadius={96} paddingAngle={3} isAnimationActive={true} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.label} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [valueFormat(Number(v)), unit]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-2.5">
            {data.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-600">
                  <span className="h-3 w-3 rounded-full shadow-inner" style={{ background: d.color }} /> {d.label}
                </span>
                <span className="font-bold text-slate-800">
                  {valueFormat(d.value)} <span className="ml-1 text-xs font-medium text-slate-400">({total === 0 ? 0 : Math.round((d.value / total) * 100)}%)</span>
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
    <ChartCard title="Doanh thu theo loại sự kiện" subtitle="Giá trị hợp đồng đã chốt theo từng loại">
      {data.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="eventType" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} width={48} dx={-8} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [formatCurrency(Number(v)), 'Doanh thu']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// ── Chart 4: Bar ngang Top khách hàng ───────────────────────────────────────────────────────────────
export function TopCustomersBar({ data }: Readonly<{ data: { name: string; revenue: number }[] }>) {
  return (
    <ChartCard title="Top khách hàng theo doanh thu" subtitle="10 khách hàng đóng góp nhiều nhất">
      {data.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={formatMillions} dy={8} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [formatCurrency(Number(v)), 'Doanh thu']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="revenue" name="Doanh thu" fill="#8b5cf6" radius={[0, 6, 6, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
