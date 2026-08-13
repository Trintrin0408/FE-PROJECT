'use client';

import { useEffect, useState } from 'react';
import { reportApiService } from '@/services/report.service';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  KpiTile,
  MonthlyMoneyChart,
  MonthlyCashFlowChart,
  StatusDonut,
  EventTypeBar,
  TopCustomersBar,
  AlertBanner,
} from '@/components/reports/revenueWidgets';
import {
  Banknote,
  BarChart3,
  BadgeCheck,
  ClipboardCheck,
  DollarSign,
  Receipt,
  TrendingUp,
  ArrowRightLeft,
  Scale,
  FileBarChart2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

function isoOf(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CEORevenueReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pnl' | 'cashflow'>('pnl');

  useEffect(() => {
    const n = new Date();
    setFrom(isoOf(new Date(n.getFullYear(), n.getMonth() - 11, 1)));
    setTo(isoOf(n));
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    reportApiService.getRevenueReport({ startDate: from, endDate: to })
      .then((res) => {
        if (res.success) {
          setData(res.data);
        } else {
          toast.error(res.message || 'Lỗi lấy báo cáo doanh thu');
        }
      })
      .catch((err) => {
        toast.error('Lỗi lấy báo cáo doanh thu');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const pnl = data?.profitability;
  const cf = data?.cashFlow;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header & Date Picker */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between bg-white/70 p-6 rounded-2xl shadow-sm border border-slate-200/60 backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <FileBarChart2 className="w-8 h-8 text-blue-600" />
            Báo cáo Tài chính Tổng hợp
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Dữ liệu được tổng hợp theo thời gian thực từ hóa đơn, hợp đồng và dòng tiền thực tế.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Từ ngày</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block w-40 rounded-xl border-slate-200 bg-white/50 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Đến ngày</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block w-40 rounded-xl border-slate-200 bg-white/50 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        </div>
      ) : !data ? (
        <div className="text-center text-slate-500">Không có dữ liệu.</div>
      ) : (
        <>
          {/* Cảnh báo nợ đọng nếu trên 50 triệu */}
          {cf.totalOutstandingDebt > 50000000 && (
            <AlertBanner
              title="Cảnh báo Nợ đọng quá hạn cao!"
              message={`Hiện có ${formatCurrency(cf.totalOutstandingDebt)} tiền nợ từ các sự kiện đã HOÀN THÀNH nhưng chưa được thanh toán (chưa chốt sổ). Cần đôn đốc bộ phận kế toán thu hồi ngay.`}
              actionText="Xem chi tiết đơn nợ"
              onAction={() => window.location.href = '/admin/orders?status=COMPLETED&payment=UNPAID'}
            />
          )}

          {/* Tab Navigation */}
          <div className="mb-8 flex gap-2 p-1 bg-slate-200/50 rounded-xl max-w-fit mx-auto backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('pnl')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'pnl'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              Hiệu quả Kinh doanh
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'cashflow'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:bg-white/40 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-5 h-5" />
              Lưu lượng Dòng tiền
            </button>
          </div>

          {activeTab === 'pnl' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* P&L Top KPIs */}
              <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <KpiTile
                  label="Tổng Giá trị Hợp đồng"
                  value={formatCurrency(pnl.committed)}
                  sub={`Từ ${pnl.orderCount} sự kiện chốt`}
                  icon={Banknote}
                  tone="blue"
                />
                <KpiTile
                  label="Chi phí NCC Ước tính"
                  value={formatCurrency(pnl.supplierCost)}
                  sub="Theo các giao dịch thuê NCC"
                  icon={Receipt}
                  tone="red"
                />
                <KpiTile
                  label="Lãi gộp"
                  value={formatCurrency(pnl.revenueAfterSupplier)}
                  sub={`Tỷ suất Lãi gộp: ${pnl.committed > 0 ? Math.round((pnl.revenueAfterSupplier / pnl.committed) * 100) : 0}%`}
                  icon={Scale}
                  tone="amber"
                />
                <KpiTile
                  label="Tỷ lệ Thu tiền Hợp đồng"
                  value={`${Math.round(pnl.collectionRate * 100)}%`}
                  sub={`Đã thu ${formatCurrency(pnl.collected)}`}
                  icon={BadgeCheck}
                  tone="green"
                />
              </div>

              {/* P&L Charts */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MonthlyMoneyChart data={pnl.monthly} />
                </div>
                <div>
                  <StatusDonut
                    title="Tiến độ thu tiền dự án"
                    subtitle="So với Tổng Hợp đồng đã chốt"
                    centerLabel="Tổng Hợp đồng"
                    data={pnl.collectionDonut}
                    valueFormat={(v) => formatCurrency(v)}
                  />
                </div>
              </div>

              {/* Additional Breakdowns */}
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <EventTypeBar data={pnl.byType} />
                <TopCustomersBar data={pnl.topCustomers} />
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Cash-flow Top KPIs */}
              <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                <KpiTile
                  label="Dòng tiền VÀO"
                  value={formatCurrency(cf.totalCashIn)}
                  sub="Tổng Cọc & Quyết toán đã nhận"
                  icon={TrendingUp}
                  tone="green"
                />
                <KpiTile
                  label="Dòng tiền RA"
                  value={formatCurrency(cf.totalCashOut)}
                  sub="Tiền thanh toán cho NCC"
                  icon={Receipt}
                  tone="red"
                />
                <KpiTile
                  label="Dòng tiền THUẦN"
                  value={formatCurrency(cf.netCashFlow)}
                  sub="Tiền vào - Tiền ra trong kỳ"
                  icon={DollarSign}
                  tone={cf.netCashFlow >= 0 ? 'blue' : 'amber'}
                />
              </div>

              {/* Cash-flow Charts */}
              <div className="grid grid-cols-1 gap-6">
                <div className="lg:col-span-2">
                  <MonthlyCashFlowChart data={cf.monthly} />
                </div>
              </div>
              
              <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100/50 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-xl font-bold text-emerald-900">Quản trị Dòng tiền</h3>
                  <p className="mt-1 max-w-2xl text-sm text-emerald-700">Dòng tiền thuần dương là tín hiệu tốt. Bạn có thể theo dõi chi tiết ở các báo cáo khác. Số dư nợ đọng cần thu hồi hiện tại là <strong>{formatCurrency(cf.totalOutstandingDebt)}</strong>.</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
