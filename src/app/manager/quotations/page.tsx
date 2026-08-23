'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, RotateCcw } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import CreateQuotationWizardModal from '@/components/quotations/CreateQuotationWizardModal';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { quotationApiService } from '@/services/quotation.service';
import { QUOTATION_STATUS_META } from '@/mocks/db/quotations';
import type { QuotationListItem, QuotationListMeta, QuotationListStatus } from '@/types/quotation';

// Nối API thật theo docs/danhsachbaogia_api.md — GET /quotations đã trả sẵn customerName/customerPhone
// (JOIN) + meta.counts (dùng thẳng cho 5 thẻ KPI). Theo Hướng A đã chốt ở doc mục 3.1: bỏ hẳn trạng
// thái "Đang khảo sát" khỏi bộ lọc/KPI màn này — đó là Order đang khảo sát, chưa có bản ghi Quotation
// nào cả (khác domain, xem /manager/survey). Bộ lọc "Tất cả khách hàng" (doc mục 4.2) cũng bỏ khỏi UI —
// dropdown cũ chỉ liệt kê tên khách từ đúng 10 dòng đang tải ở client, sai khi có phân trang server thật
// (không thấy hết khách của các trang khác); ô tìm kiếm hiện có đã tìm được theo tên khách nên không mất
// tính năng. Version đổi từ number sang string thật (không tự thêm tiền tố "v" nữa — DB đã lưu sẵn).

const emptyMeta: QuotationListMeta = {
  page: 1,
  limit: 10,
  totalItems: 0,
  totalPages: 1,
  counts: { all: 0, draft: 0, approved: 0, rejected: 0, approvedValue: 0 },
};

export default function ManagerQuotationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<QuotationListItem[]>([]);
  const [meta, setMeta] = useState<QuotationListMeta>(emptyMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<QuotationListStatus | ''>('');
  const [onlyUnviewed, setOnlyUnviewed] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, onlyUnviewed]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    quotationApiService
      .getQuotations({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        isManagerViewed: onlyUnviewed ? false : undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
        setMeta(res.meta ?? emptyMeta);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setLoadError('Không tải được danh sách báo giá. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter, onlyUnviewed]);

  const refetch = () => {
    quotationApiService
      .getQuotations({
        page: 1,
        limit,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        isManagerViewed: onlyUnviewed ? false : undefined,
      })
      .then((res) => {
        setPage(1);
        setRows(res.data ?? []);
        setMeta(res.meta ?? emptyMeta);
      })
      .catch(() => undefined);
  };

  const paginationState: PaginationState = {
    currentPage: meta.page,
    totalPages: Math.max(1, meta.totalPages),
    totalItems: meta.totalItems,
    limit: meta.limit,
  };

  const kpiItems: { label: string; value: string; valueClassName: string }[] = [
    { label: 'Tổng báo giá', value: String(meta.counts.all), valueClassName: 'text-slate-900' },
    { label: 'Dự thảo nháp', value: String(meta.counts.draft), valueClassName: 'text-slate-900' },
    { label: 'Đã phê duyệt', value: String(meta.counts.approved), valueClassName: 'text-green-600' },
    { label: 'Bị từ chối', value: String(meta.counts.rejected), valueClassName: 'text-red-600' },
    { label: 'Giá trị đã phê duyệt', value: formatCurrency(meta.counts.approvedValue), valueClassName: 'text-slate-900' },
  ];

  const handleResetFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setOnlyUnviewed(false);
  };

  const columns: TableColumn<QuotationListItem>[] = [
    {
      key: 'code',
      label: 'Mã báo giá',
      render: (row) => <span className="font-semibold text-slate-800">{row.code}</span>,
    },
    {
      key: 'customerName',
      label: 'Khách hàng',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.customerName}</p>
          <p className="text-xs text-slate-400">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: 'version',
      label: 'Phiên bản',
      render: (row) => <span className="text-slate-600">{row.version}</span>,
    },
    {
      key: 'subtotal',
      label: 'Tổng trước giảm',
      className: 'text-right',
      render: (row) => <span className="text-slate-600">{formatCurrency(row.subtotal)}</span>,
    },
    {
      key: 'discount',
      label: 'Giảm giá',
      className: 'text-right',
      render: (row) => <span className="text-red-500">-{formatCurrency(row.discount)}</span>,
    },
    {
      key: 'totalAmount',
      label: 'Tổng tiền',
      className: 'text-right font-bold text-slate-900',
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => <Badge variant={QUOTATION_STATUS_META[row.status].variant}>{QUOTATION_STATUS_META[row.status].label}</Badge>,
    },
    {
      key: 'createdAt',
      label: 'Ngày tạo',
      render: (row) => <span className="whitespace-nowrap text-sm text-slate-500">{formatDate(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Quản lý báo giá"
        description="Tạo mới, phê duyệt, lưu nháp hoặc từ chối các báo giá sự kiện."
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo báo giá mới
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
            <p className={`mt-2 text-2xl font-bold ${item.valueClassName}`}>{item.value}</p>
          </motion.div>
        ))}
      </div>

      <FilterBar>
        <FilterRow layout="end">
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Tìm theo mã báo giá, tên khách..." />
          <div className="w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QuotationListStatus | '')}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'draft', label: QUOTATION_STATUS_META.draft.label },
                { value: 'approved', label: QUOTATION_STATUS_META.approved.label },
                { value: 'rejected', label: QUOTATION_STATUS_META.rejected.label },
              ]}
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={onlyUnviewed}
              onChange={(e) => setOnlyUnviewed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Chỉ hiện báo giá chưa xem</span>
          </label>
          <Button variant="secondary" className="ml-auto" onClick={handleResetFilters}>
            <RotateCcw className="h-4 w-4" />
            Làm mới bộ lọc
          </Button>
        </FilterRow>

        <div className="mt-4 overflow-x-auto">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Đang tải danh sách báo giá...</p>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-red-500">{loadError}</p>
          ) : (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(row) => row.quotationId}
              rowClassName={(row) => (!row.isManagerViewed ? 'bg-blue-50 hover:bg-blue-100/70' : '')}
              onRowClick={(row) => router.push(`/manager/quotations/${row.quotationId}`)}
            />
          )}
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </FilterBar>

      <CreateQuotationWizardModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          refetch();
          setIsCreateOpen(false);
        }}
      />
    </div>
  );
}
