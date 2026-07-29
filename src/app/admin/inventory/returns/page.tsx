'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, Search } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import Reveal from '@/components/ui/Reveal';
import { formatDate } from '@/utils/formatDate';
import { inventoryApiService } from '@/services/inventory.service';
import type { CollectedEquipmentReport, CollectedEquipmentReportStatus } from '@/types/collectedEquipmentReport';

// Trang danh sách "Thu hồi & hoàn kho" — mirror /manager/inventory/returns (đọc, không tạo/xác nhận —
// Admin chỉ đọc theo CLAUDE.md). Nối API thật GET /api/v1/inventory/return-reports (backend đang chạy:
// D:\sep490-backend-api, xem cảnh báo đầu docs/more-require.md).

const STATUS_META: Record<CollectedEquipmentReportStatus, { label: string; badgeClass: string }> = {
  SUBMITTED: { label: 'CHƯA HOÀN', badgeClass: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'ĐÃ HOÀN', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

type StatusFilter = '' | CollectedEquipmentReportStatus;

export default function Page() {
  const [reports, setReports] = useState<CollectedEquipmentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const { pagination, setPage, updatePagination } = usePagination(10);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    inventoryApiService
      .getReturnReports({ status: statusFilter || undefined, page: pagination.currentPage, limit: pagination.limit })
      .then((res) => {
        if (cancelled) return;
        const data: CollectedEquipmentReport[] = res.data ?? [];
        setReports(data.filter((r) => r.reportType === 'INTERNAL'));
        if (res.meta) updatePagination({ totalItems: res.meta.totalItems, totalPages: Math.max(1, res.meta.totalPages) });
      })
      .catch(() => {
        if (cancelled) return;
        setReports([]);
        setLoadError('Không tải được danh sách phiếu hoàn kho. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pagination.currentPage]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter(
      (r) =>
        r.reportId.toLowerCase().includes(term) ||
        r.orderCode.toLowerCase().includes(term) ||
        r.reportedBy.fullName.toLowerCase().includes(term),
    );
  }, [reports, search]);

  const columns: TableColumn<CollectedEquipmentReport>[] = [
    {
      key: 'id',
      label: 'Mã phiếu',
      render: (r) => (
        <Link
          href={`/admin/inventory/returns/${r.reportId}`}
          title={r.reportId}
          className="font-semibold text-blue-600 hover:underline"
        >
          #{r.reportId.slice(0, 8).toUpperCase()}
        </Link>
      ),
    },
    {
      key: 'order',
      label: 'Đơn đặt cưới',
      render: (r) => (
        <Link href={`/admin/orders_audit/${r.orderId}`} className="font-semibold text-blue-600 hover:underline">
          {r.orderCode}
        </Link>
      ),
    },
    { key: 'itemCount', label: 'Số mặt hàng', render: (r) => `${r.items.length} loại thiết bị` },
    { key: 'createdAt', label: 'Ngày tạo', render: (r) => formatDate(r.createdAt) },
    { key: 'createdBy', label: 'Tạo bởi', render: (r) => r.reportedBy.fullName },
    {
      key: 'confirmedAt',
      label: 'Ngày hoàn kho thực tế',
      render: (r) => (r.confirmedAt ? formatDate(r.confirmedAt) : '—'),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_META[r.status].badgeClass}`}>
          {STATUS_META[r.status].label}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r) => (
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/inventory/returns/${r.reportId}`}
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Thu hồi &amp; hoàn kho</h1>
          <p className="mt-1 text-sm text-slate-500">Danh sách phiếu hoàn kho thiết bị sau khi thi công xong sự kiện.</p>
        </div>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder="Tìm theo mã phiếu, mã đơn, người tạo (trong trang hiện tại)..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'SUBMITTED', label: 'Chưa hoàn' },
                { value: 'CONFIRMED', label: 'Đã hoàn' },
              ]}
            />
          </div>
        </div>

        {loadError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{loadError}</p>}

        <div className="mt-4">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.reportId} isLoading={isLoading} />
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />

        <p className="mt-3 text-[11px] italic text-slate-400">
          Ghi chú: phiếu hoàn kho do Leader Staff ghi nhận tại hiện trường qua ứng dụng di động. Admin chỉ xem, không
          có quyền tạo hay xác nhận (chỉ Manager mới xác nhận được).
        </p>
      </Reveal>
    </div>
  );
}
