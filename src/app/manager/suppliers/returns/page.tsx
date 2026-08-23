'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Box, CheckCircle2, Eye, FileText, Loader2, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { usePagination } from '@/hooks/usePagination';
import { usePermission } from '@/hooks/usePermission';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate, formatTime } from '@/utils/formatDate';
import { inventoryApiService } from '@/services/inventory.service';
import { supplierApiService } from '@/services/supplier.service';
import type {
  CollectedEquipmentReport,
  CollectedEquipmentReportItem,
  CollectedEquipmentReportStatus,
} from '@/types/collectedEquipmentReport';

// Trang "Trả thiết bị cho nhà cung cấp" — NỐI API THẬT: GET /api/v1/inventory/return-reports?reportType=SUPPLIER
// (backend đang chạy: D:\sep490-backend-api). Đây là các phiếu thu hồi thiết bị THUÊ của NCC do Leader Staff
// ghi nhận tại hiện trường qua mobile (reportType=SUPPLIER) — web chỉ XEM và XÁC NHẬN, không có nút "Tạo
// phiếu" (POST cùng endpoint chỉ LEADER gọi được). PUT .../confirm chỉ role MANAGER (gate usePermission).
//
// Báo cáo SUPPLIER chỉ mang `transactionId` trơ (không kèm tên NCC/mã giao dịch) — phải resolve thêm qua
// GET /supplier-transactions?orderId=... để hiện tên NCC + mã PO. Tiền "đền bù NCC" = (hỏng+mất) × đơn giá
// thuê của giao dịch (lấy từ GET /supplier-transactions/:id, chỉ tính hiển thị — BE không lưu con số này).

const STATUS_META: Record<CollectedEquipmentReportStatus, { label: string; badgeClass: string }> = {
  SUBMITTED: { label: 'Chờ xác nhận', badgeClass: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Đã xác nhận', badgeClass: 'bg-emerald-100 text-emerald-700' },
};

type StatusFilter = '' | CollectedEquipmentReportStatus;
type SupplierRef = { supplierName: string; transactionCode: string };

export default function Page() {
  const { can } = usePermission();
  const canConfirm = can('inventory:confirm-return');

  const [reports, setReports] = useState<CollectedEquipmentReport[]>([]);
  // transactionId -> { tên NCC, mã giao dịch NCC }
  const [supplierMap, setSupplierMap] = useState<Record<string, SupplierRef>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [detailReport, setDetailReport] = useState<CollectedEquipmentReport | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { pagination, setPage, updatePagination } = usePagination(10);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    (async () => {
      try {
        const res = await inventoryApiService.getReturnReports({
          reportType: 'SUPPLIER',
          status: statusFilter || undefined,
          page: pagination.currentPage,
          limit: pagination.limit,
        });
        if (cancelled) return;
        // Lọc client-side thêm 1 lớp: phòng khi BE đang chạy chưa deploy bản hỗ trợ reportType.
        const data: CollectedEquipmentReport[] = (res.data ?? []).filter(
          (r: CollectedEquipmentReport) => r.reportType === 'SUPPLIER',
        );
        setReports(data);
        if (res.meta) updatePagination({ totalItems: res.meta.totalItems, totalPages: Math.max(1, res.meta.totalPages) });

        // Resolve tên NCC + mã giao dịch theo từng đơn (report chỉ có transactionId trơ).
        const orderIds = Array.from(new Set(data.map((r) => r.orderId)));
        const lists = await Promise.all(
          orderIds.map((oid) => supplierApiService.getSupplierTransactions({ orderId: oid, limit: 100 }).catch(() => null)),
        );
        if (cancelled) return;
        const map: Record<string, SupplierRef> = {};
        for (const list of lists) {
          for (const tx of list?.data ?? []) {
            map[tx.transactionId] = { supplierName: tx.supplierName, transactionCode: tx.transactionCode };
          }
        }
        setSupplierMap(map);
      } catch {
        if (cancelled) return;
        setReports([]);
        setSupplierMap({});
        setLoadError('Không tải được danh sách phiếu trả thiết bị NCC. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, pagination.currentPage, reloadKey]);

  const supplierRefOf = (r: CollectedEquipmentReport): SupplierRef | undefined =>
    r.transactionId ? supplierMap[r.transactionId] : undefined;

  const supplierNames = useMemo(
    () => Array.from(new Set(Object.values(supplierMap).map((s) => s.supplierName))).sort((a, b) => a.localeCompare(b, 'vi')),
    [supplierMap],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((r) => {
      const ref = r.transactionId ? supplierMap[r.transactionId] : undefined;
      if (supplierFilter && ref?.supplierName !== supplierFilter) return false;
      if (!term) return true;
      return (
        r.reportId.toLowerCase().includes(term) ||
        r.orderCode.toLowerCase().includes(term) ||
        (ref?.supplierName ?? '').toLowerCase().includes(term) ||
        (ref?.transactionCode ?? '').toLowerCase().includes(term)
      );
    });
  }, [reports, supplierMap, search, supplierFilter]);

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSupplierFilter('');
    setPage(1);
  };

  const columns: TableColumn<CollectedEquipmentReport>[] = [
    {
      key: 'id',
      label: 'Mã phiếu',
      render: (r) => (
        <button
          type="button"
          onClick={() => setDetailReport(r)}
          title={r.reportId}
          className="font-semibold text-blue-600 hover:underline"
        >
          #{r.reportId.slice(0, 8).toUpperCase()}
        </button>
      ),
    },
    {
      key: 'supplier',
      label: 'Nhà cung cấp',
      render: (r) => <span className="font-medium text-slate-800">{supplierRefOf(r)?.supplierName ?? '—'}</span>,
    },
    {
      key: 'transactionCode',
      label: 'Mã giao dịch NCC',
      render: (r) => <span className="text-slate-600">{supplierRefOf(r)?.transactionCode ?? '—'}</span>,
    },
    {
      key: 'order',
      label: 'Đơn đặt cưới',
      render: (r) => (
        <Link href={`/manager/orders/${r.orderId}`} className="font-semibold text-blue-600 hover:underline">
          {r.orderCode}
        </Link>
      ),
    },
    { key: 'itemCount', label: 'Số mặt hàng', render: (r) => `${r.items.length} loại thiết bị` },
    {
      key: 'createdAt',
      label: 'Ngày tạo',
      render: (r) => `${formatDate(r.createdAt)} ${formatTime(r.createdAt)}`,
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_META[r.status].badgeClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_META[r.status].label}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDetailReport(r)}
            aria-label="Xem chi tiết phiếu trả"
            title="Xem chi tiết phiếu trả"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Reveal className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div>
          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-500">
            Đối tác &amp; thiết bị
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Trả thiết bị cho nhà cung cấp</h1>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách phiếu thu hồi thiết bị thuê ngoài (do Leader Staff ghi nhận tại hiện trường), kèm kiểm đếm hỏng/mất
            để đối soát đền bù với nhà cung cấp.
          </p>
        </div>
      </Reveal>

      <FilterBar delay={0.05} spacing="none" className="mt-4">
        <FilterRow layout="start">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm mã phiếu, mã đơn, tên NCC, mã giao dịch..." />
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'SUBMITTED', label: 'Chờ xác nhận' },
                { value: 'CONFIRMED', label: 'Đã xác nhận' },
              ]}
            />
          </div>
          <Button type="button" variant="secondary" onClick={handleResetFilters}>
            <RotateCcw className="h-4 w-4" />
            Làm mới
          </Button>
          <Button type="button" variant={showAdvancedFilters ? 'primary' : 'secondary'} onClick={() => setShowAdvancedFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </Button>
        </FilterRow>

        {showAdvancedFilters && (
          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-400">Nhà cung cấp:</span>
            <div className="w-56">
              <Select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                options={[{ value: '', label: 'Tất cả nhà cung cấp' }, ...supplierNames.map((n) => ({ value: n, label: n }))]}
              />
            </div>
          </div>
        )}

        {loadError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{loadError}</p>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.reportId} isLoading={isLoading} />
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />

        {/* <p className="mt-3 text-[11px] italic text-slate-400">
          Ghi chú: phiếu trả thiết bị NCC do Leader Staff ghi nhận tại hiện trường qua ứng dụng di động — web chỉ xem và
          xác nhận, không có chức năng tạo phiếu trên web.
        </p> */}
      </FilterBar>

      <SupplierReturnDetailModal
        report={detailReport}
        supplierRef={detailReport ? supplierRefOf(detailReport) : undefined}
        canConfirm={canConfirm}
        onClose={() => setDetailReport(null)}
        onConfirmed={() => {
          setDetailReport(null);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

function SupplierReturnDetailModal({
  report,
  supplierRef,
  canConfirm,
  onClose,
  onConfirmed,
}: Readonly<{
  report: CollectedEquipmentReport | null;
  supplierRef: SupplierRef | undefined;
  canConfirm: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}>) {
  // itemId -> đơn giá thuê NCC (để tính đền bù = (hỏng+mất) × đơn giá). Lấy từ chi tiết giao dịch.
  const [unitCostMap, setUnitCostMap] = useState<Record<string, number>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  const transactionId = report?.transactionId ?? null;

  useEffect(() => {
    setError('');
    if (!transactionId) {
      setUnitCostMap({});
      return;
    }
    let cancelled = false;
    supplierApiService
      .getTransactionById(transactionId)
      .then((res) => {
        if (cancelled) return;
        const detail =
          (res as unknown as { data?: { items?: { itemId: string; unitCost?: number }[] } })?.data ??
          (res as unknown as { items?: { itemId: string; unitCost?: number }[] });
        const items = detail?.items ?? [];
        const map: Record<string, number> = {};
        for (const it of items) map[it.itemId] = it.unitCost ?? 0;
        setUnitCostMap(map);
      })
      .catch(() => {
        if (!cancelled) setUnitCostMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  if (!report) return null;

  const compensationOf = (item: CollectedEquipmentReportItem) =>
    (item.damagedQuantity + item.lostQuantity) * (unitCostMap[item.itemId] ?? 0);
  const totalCompensation = report.items.reduce((sum, it) => sum + compensationOf(it), 0);

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError('');
    try {
      await inventoryApiService.confirmReturnReport(report.reportId);
      onConfirmed();
    } catch {
      setError('Xác nhận phiếu trả thất bại. Vui lòng thử lại.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-slate-400" />
            Chi tiết phiếu trả NCC: <span className="text-blue-600">#{report.reportId.slice(0, 8).toUpperCase()}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nhà cung cấp</p>
              <p className="mt-0.5 font-bold text-slate-900">{supplierRef?.supplierName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mã giao dịch NCC</p>
              <p className="mt-0.5 font-semibold text-slate-700">{supplierRef?.transactionCode ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Đơn đặt cưới</p>
              <Link href={`/manager/orders/${report.orderId}`} className="mt-0.5 inline-block font-bold text-blue-600 hover:underline">
                {report.orderCode}
              </Link>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái phiếu</p>
              <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_META[report.status].badgeClass}`}>
                {STATUS_META[report.status].label}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Người ghi nhận</p>
              <p className="mt-0.5 font-semibold text-slate-700">{report.reportedBy.fullName}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày tạo phiếu</p>
              <p className="mt-0.5 font-semibold text-slate-700">
                {formatDate(report.createdAt)} {formatTime(report.createdAt)}
              </p>
            </div>
            {report.confirmedBy && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Người xác nhận</p>
                  <p className="mt-0.5 font-semibold text-slate-700">{report.confirmedBy.fullName}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày xác nhận</p>
                  <p className="mt-0.5 font-semibold text-slate-700">{report.confirmedAt ? formatDate(report.confirmedAt) : '—'}</p>
                </div>
              </>
            )}
          </div>

          {report.notes && (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ghi chú</p>
              <p className="mt-1 text-sm text-slate-700">{report.notes}</p>
            </div>
          )}

          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Box className="h-4 w-4 text-slate-500" />
              Danh sách thiết bị hoàn trả
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Tên thiết bị</th>
                      <th className="px-3 py-2 text-center">ĐVT</th>
                      <th className="px-3 py-2 text-center text-emerald-600">Nguyên vẹn</th>
                      <th className="px-3 py-2 text-center text-red-600">Hỏng</th>
                      <th className="px-3 py-2 text-center text-amber-600">Mất</th>
                      <th className="px-3 py-2 text-right">Đền bù NCC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.items.map((item) => (
                      <tr key={item.cerItemId}>
                        <td className="px-3 py-3 font-medium text-slate-800">{item.itemName}</td>
                        <td className="px-3 py-3 text-center text-slate-500">{item.unit}</td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-600">{item.goodQuantity}</td>
                        <td className="px-3 py-3 text-center font-bold text-red-600">{item.damagedQuantity}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-600">{item.lostQuantity}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-700">{formatCurrency(compensationOf(item))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Tổng đền bù NCC (tạm tính)
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{formatCurrency(totalCompensation)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] italic text-slate-400">
              Đền bù NCC tạm tính = (hỏng + mất) × đơn giá thuê của giao dịch - chỉ để tham khảo đối soát, hệ thống không
              lưu con số này.
            </p>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
            Đóng
          </Button>
          {report.status === 'SUBMITTED' && canConfirm && (
            <Button onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Xác nhận phiếu trả
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
