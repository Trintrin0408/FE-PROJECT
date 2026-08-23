'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Search } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { settingsApiService } from '@/services/settings.service';
import type { SepayTransaction } from '@/types/settings';

// Trang "Lịch sử giao dịch" (Admin + Manager) — đọc giao dịch ngân hàng qua BE proxy SePay
// (GET /settings/transactions), lọc theo tài khoản Admin đã cấu hình. Token SePay nằm ở BE (env),
// không lộ ra FE. Chỉ đọc — không tạo/sửa giao dịch.
type TransferFilter = '' | 'in' | 'out';

export default function TransactionHistoryView() {
  const [rows, setRows] = useState<SepayTransaction[]>([]);
  const [configured, setConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [transferType, setTransferType] = useState<TransferFilter>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { pagination, setPage, updatePagination } = usePagination(20);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    settingsApiService
      .getTransactions({
        page: pagination.currentPage,
        perPage: pagination.limit,
        transferType: transferType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        q: debouncedSearch.trim() || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setConfigured(res.configured);
        setRows(res.data ?? []);
        if (res.meta) updatePagination({ totalItems: res.meta.total, totalPages: Math.max(1, res.meta.totalPages) });
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setLoadError('Không tải được lịch sử giao dịch. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, transferType, dateFrom, dateTo, debouncedSearch]);

  const handleDateFrom = (v: string) => {
    setDateFrom(v);
    if (v && dateTo && v > dateTo) setDateTo(v);
    setPage(1);
  };
  const handleDateTo = (v: string) => {
    setDateTo(v);
    if (v && dateFrom && v < dateFrom) setDateFrom(v);
    setPage(1);
  };
  const handleReset = () => {
    setSearch('');
    setTransferType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const columns: TableColumn<SepayTransaction>[] = useMemo(
    () => [
      { key: 'date', label: 'Thời gian', render: (t) => <span className="whitespace-nowrap text-slate-600">{t.transactionDate ?? '—'}</span> },
      {
        key: 'type',
        label: 'Loại',
        render: (t) =>
          t.transferType === 'in' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
              <ArrowDownLeft className="h-3 w-3" /> Tiền vào
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              <ArrowUpRight className="h-3 w-3" /> Tiền ra
            </span>
          ),
      },
      { key: 'content', label: 'Nội dung', render: (t) => <span className="text-slate-700">{t.content ?? '—'}</span> },
      { key: 'ref', label: 'Mã tham chiếu', render: (t) => <span className="font-mono text-xs text-slate-500">{t.referenceNumber ?? '—'}</span> },
      {
        key: 'in',
        label: 'Tiền vào',
        render: (t) => <span className="font-semibold text-emerald-600">{t.amountIn > 0 ? `+${formatCurrency(t.amountIn)}` : '—'}</span>,
      },
      {
        key: 'out',
        label: 'Tiền ra',
        render: (t) => <span className="font-semibold text-red-600">{t.amountOut > 0 ? `-${formatCurrency(t.amountOut)}` : '—'}</span>,
      },
      { key: 'acc', label: 'Số dư luỹ kế', render: (t) => <span className="text-slate-600">{formatCurrency(t.accumulated)}</span> },
    ],
    [],
  );

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Lịch sử giao dịch</h1>
        <p className="mt-1 text-sm text-slate-500">
          Giao dịch ngân hàng của tài khoản công ty đã cấu hình (đồng bộ qua SePay). Chỉ để tra cứu &amp; đối soát thanh toán.
        </p>
      </div>

      {!configured && !isLoading ? (
        <Reveal className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Chưa cấu hình tích hợp SePay hoặc chưa cấu hình tài khoản ngân hàng. Vui lòng liên hệ Admin cấu hình tài khoản
          (Cấu hình &gt; Tài khoản ngân hàng) và thiết lập token SePay ở máy chủ để xem lịch sử giao dịch.
        </Reveal>
      ) : (
        <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <Input
                placeholder="Tìm nội dung, mã tham chiếu..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-40">
              <Select
                value={transferType}
                onChange={(e) => {
                  setTransferType(e.target.value as TransferFilter);
                  setPage(1);
                }}
                options={[
                  { value: '', label: 'Tất cả loại' },
                  { value: 'in', label: 'Tiền vào' },
                  { value: 'out', label: 'Tiền ra' },
                ]}
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => handleDateFrom(e.target.value)} className="bg-transparent text-xs text-slate-700 outline-none" />
              <span className="text-xs text-slate-400">→</span>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => handleDateTo(e.target.value)} className="bg-transparent text-xs text-slate-700 outline-none" />
            </div>
            <Button type="button" variant="secondary" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Làm mới
            </Button>
          </div>

          {loadError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{loadError}</p>}

          <div className="mt-4 overflow-x-auto">
            <Table columns={columns} rows={rows} rowKey={(row) => row.id} isLoading={isLoading} />
          </div>

          <Pagination pagination={pagination} onPageChange={setPage} />

          <p className="mt-3 text-[11px] italic text-slate-400">
            Dữ liệu lấy trực tiếp từ SePay (chỉ đọc). Đối soát cọc/quyết toán bằng mã tham chiếu &amp; nội dung chuyển khoản.
          </p>
        </Reveal>
      )}
    </div>
  );
}
