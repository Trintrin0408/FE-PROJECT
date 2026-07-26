'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, RotateCcw, Search, User } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { orderApiService } from '@/services/order.service';
import { paymentApiService } from '@/services/payment.service';
import { DEPOSIT_STATUS_LABEL } from '@/constants/deposit-status';
import type { Order } from '@/types/order';
import type { Deposit, DepositStatus } from '@/types/payment';

// Nối API thật theo docs/datcoc_api.md — không có GET /api/v1/deposits gộp toàn hệ thống (404, xác
// nhận lại qua curl 2026-07-21, xem docs/more-require.md mục mới), nên bảng này phải ghép N+1 tạm thời
// (chấp nhận được ở quy mô demo hiện tại — vài chục đơn): GET /orders (tối đa limit=100) +
// GET /orders/:id/deposits cho từng đơn (lấy hồ sơ cọc MỚI NHẤT nếu có nhiều hơn 1 — mục 4.6 của doc,
// DB thật cho phép nhiều hồ sơ/đơn không ràng buộc UNIQUE).
// TODO(perf): thay bằng GET /api/v1/deposits (phân trang, lọc status/search) khi Backend bổ sung —
// tránh N+1 khi số đơn tăng lên hàng trăm.

type RowDepositStatus = DepositStatus | 'NONE';
type DepositFilterValue = '' | RowDepositStatus;

interface DepositListRow {
  key: string;
  code: string;
  eventTitle: string;
  customerName: string;
  customerPhone: string;
  totalValue: number;
  depositAmount: number | null;
  depositStatus: RowDepositStatus;
  detailHref: string;
}

interface DepositListViewProps {
  detailBasePath: string;
}

export default function DepositListView({ detailBasePath }: Readonly<DepositListViewProps>) {
  const [rows, setRows] = useState<DepositListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [depositFilter, setDepositFilter] = useState<DepositFilterValue>('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const loadOrderRows = async (): Promise<DepositListRow[]> => {
      const ordersRes = await orderApiService.getOrders({ limit: 100 });
      const orders: Order[] = ordersRes.data ?? [];
      const pairs = await Promise.all(
        orders.map((o) =>
          paymentApiService
            .getOrderDeposits(o.orderId)
            .then((res) => [o, (res.data ?? []) as Deposit[]] as const)
            .catch(() => [o, [] as Deposit[]] as const),
        ),
      );
      return pairs.map(([o, deposits]) => {
        const latest = [...deposits].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
        return {
          key: `order-${o.orderId}`,
          code: o.orderCode,
          eventTitle: o.eventName || o.eventType,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          totalValue: o.totalAmount,
          depositAmount: latest?.amount ?? null,
          depositStatus: latest?.status ?? 'NONE',
          detailHref: `${detailBasePath}/${o.orderId}`,
        };
      });
    };

    loadOrderRows()
      .then((orderRows) => {
        if (cancelled) return;
        setRows(orderRows);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailBasePath]);

  const hasActiveFilters = Boolean(search || depositFilter);

  const handleResetFilters = () => {
    setSearch('');
    setDepositFilter('');
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (depositFilter && r.depositStatus !== depositFilter) return false;
      if (!term) return true;
      return r.code.toLowerCase().includes(term) || r.customerName.toLowerCase().includes(term);
    });
  }, [rows, search, depositFilter]);

  const columns: TableColumn<DepositListRow>[] = [
    {
      key: 'code',
      label: 'Mã đơn đặt',
      render: (r) => (
        <div>
          <p className="font-bold text-blue-600">{r.code}</p>
          <p className="mt-0.5 max-w-[200px] truncate text-xs text-slate-400" title={r.eventTitle}>
            {r.eventTitle}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Tên khách hàng',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold text-slate-800">{r.customerName}</p>
            <p className="text-xs text-slate-400">{r.customerPhone}</p>
          </div>
        </div>
      ),
    },
    { key: 'totalValue', label: 'Tổng giá trị', render: (r) => <span className="font-bold text-slate-900">{formatCurrency(r.totalValue)}</span> },
    {
      key: 'depositAmount',
      label: 'Tiền đặt cọc',
      render: (r) =>
        r.depositAmount == null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="font-bold text-slate-900">{formatCurrency(r.depositAmount)}</span>
        ),
    },
    {
      key: 'depositStatus',
      label: 'Trạng thái cọc',
      render: (r) =>
        r.depositStatus === 'NONE' ? (
          <Badge variant="neutral">Chưa có yêu cầu</Badge>
        ) : (
          <Badge variant={getStatusBadgeVariant(r.depositStatus)}>{DEPOSIT_STATUS_LABEL[r.depositStatus]}</Badge>
        ),
    },
    {
      key: 'actions',
      label: 'Xử lý',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Link
            href={r.detailHref}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Đặt cọc</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi trạng thái đặt cọc của từng đơn đặt.</p>
      </div>

      <Reveal className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Bộ lọc &amp; tìm kiếm</p>
          {hasActiveFilters && (
            <button type="button" onClick={handleResetFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600">
              <RotateCcw className="h-3.5 w-3.5" />
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Tìm mã đơn hoặc tên khách hàng..."
            icon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={depositFilter}
            onChange={(e) => setDepositFilter(e.target.value as DepositFilterValue)}
            options={[
              { value: '', label: 'Trạng thái đặt cọc: Tất cả' },
              { value: 'NONE', label: 'Chưa có yêu cầu' },
              ...Object.entries(DEPOSIT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.key} isLoading={isLoading} />
        </div>
      </Reveal>
    </div>
  );
}
