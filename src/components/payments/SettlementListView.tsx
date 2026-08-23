'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, RotateCcw, User } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { orderApiService } from '@/services/order.service';
import { settlementApiService } from '@/services/settlement.service';
import { SETTLEMENT_STATUS_LABEL, SETTLEMENT_STATUS_VARIANT } from '@/constants/settlement-status';
import type { Order } from '@/types/order';
import type { Settlement, SettlementStatus } from '@/types/settlement';

// Nối API thật (2026-07-21) — thay thế hẳn màn mock cũ (`mocks/db/payments.ts`, `OrderPaymentView`)
// từng bị báo lỗi ở màn "tạo quyết toán trong thanh toán" (mục "Còn lại" DEMO_CHECKLIST.md). Không có
// `GET /api/v1/settlements` gộp toàn hệ thống — dùng cùng kỹ thuật N+1 đã áp dụng cho màn "Đặt cọc"
// (docs/datcoc_api.md, xem DepositListView.tsx): GET /orders (limit 100) + GET /orders/:id/settlement
// cho từng đơn (trả bản ghi MỚI NHẤT hoặc null — không phải mảng như Deposit, xem types/settlement.ts).
// TODO(perf): thay bằng endpoint gộp khi Backend bổ sung.

type SettlementFilterValue = '' | SettlementStatus | 'NONE';

interface SettlementListRow {
  orderId: string;
  orderCode: string;
  eventTitle: string;
  customerName: string;
  customerPhone: string;
  totalValue: number;
  settlement: Settlement | null;
}

interface SettlementListViewProps {
  detailBasePath: string;
}

export default function SettlementListView({ detailBasePath }: Readonly<SettlementListViewProps>) {
  const [rows, setRows] = useState<SettlementListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SettlementFilterValue>('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    orderApiService
      .getOrders({ limit: 100 })
      .then(async (ordersRes) => {
        const orders: Order[] = ordersRes.data ?? [];
        const pairs = await Promise.all(
          orders.map((o) =>
            settlementApiService
              .getOrderSettlement(o.orderId)
              .then((res) => [o, (res.data ?? null) as Settlement | null] as const)
              .catch(() => [o, null] as const),
          ),
        );
        if (cancelled) return;
        setRows(
          pairs.map(([o, settlement]) => ({
            orderId: o.orderId,
            orderCode: o.orderCode,
            eventTitle: o.eventName || o.eventType,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            totalValue: o.totalAmount,
            settlement,
          })),
        );
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
  }, []);

  const hasActiveFilters = Boolean(search || statusFilter);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === 'NONE' && r.settlement) return false;
      if (statusFilter && statusFilter !== 'NONE' && r.settlement?.status !== statusFilter) return false;
      if (!term) return true;
      return r.orderCode.toLowerCase().includes(term) || r.customerName.toLowerCase().includes(term);
    });
  }, [rows, search, statusFilter]);

  const columns: TableColumn<SettlementListRow>[] = [
    {
      key: 'orderCode',
      label: 'Mã đơn đặt',
      render: (r) => (
        <div>
          <p className="font-bold text-blue-600">{r.orderCode}</p>
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
    { key: 'totalValue', label: 'Tổng giá trị đơn', render: (r) => <span className="font-bold text-slate-900">{formatCurrency(r.totalValue)}</span> },
    {
      key: 'finalAmount',
      label: 'Số tiền quyết toán cuối',
      render: (r) =>
        r.settlement ? (
          <span className="font-bold text-slate-900">{formatCurrency(r.settlement.finalAmount)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: 'settlementStatus',
      label: 'Trạng thái quyết toán',
      render: (r) =>
        r.settlement ? (
          <Badge variant={SETTLEMENT_STATUS_VARIANT[r.settlement.status]}>{SETTLEMENT_STATUS_LABEL[r.settlement.status]}</Badge>
        ) : (
          <Badge variant="neutral">Chưa lập biên bản</Badge>
        ),
    },
    {
      key: 'actions',
      label: 'Xử lý',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Link
            href={`${detailBasePath}/${r.orderId}`}
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
      <PageHeader title="Thanh toán" description="Theo dõi trạng thái quyết toán cuối kỳ của từng đơn đặt." />

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

        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <SearchInput width="full" value={search} onChange={setSearch} placeholder="Tìm mã đơn hoặc tên khách hàng..." />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SettlementFilterValue)}
            options={[
              { value: '', label: 'Trạng thái quyết toán: Tất cả' },
              { value: 'NONE', label: 'Chưa lập biên bản' },
              ...Object.entries(SETTLEMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.orderId} isLoading={isLoading} />
        </div>
      </Reveal>
    </div>
  );
}
