'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, MoreHorizontal, Search, SlidersHorizontal, Box, Lock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import InventoryDetailModal from '@/components/catalog/InventoryDetailModal';
import { useDebounce } from '@/hooks/useDebounce';
import { inventoryApiService } from '@/services/inventory.service';
import type { InventoryRow } from '@/types/inventory';

// Nối API thật theo docs/tonkhodoanhnghiep_api.md (2026-07-20) — GET /api/v1/inventory (bảng
// `inventory` thật ra ĐÃ được tạo, tin mới hơn ghi nhận cũ ở docs/more-require.md mục (b)) trả sẵn
// itemCode/itemName/categoryName/typeName + 4 số liệu tồn kho (quantityTotal/quantityDamaged/
// quantityReserved/quantityAvailable). Đã bỏ ô chọn ngày (Date-based Inventory Lock) khỏi UI — xác
// nhận qua curl backend KHÔNG áp dụng `date` vào việc tính `quantityReserved` (số này không đổi theo
// ngày), giữ ô chọn ngày sẽ gây hiểu nhầm là số liệu date-based thật. `categoryId`/`onlyDamaged` cũng
// bị backend bỏ qua — FE tự lọc theo `categoryName`/`quantityDamaged > 0` phía client (dữ liệu hiện
// còn rất nhỏ, chấp nhận được). Xem chi tiết 3 gap này ở docs/more-require.md mục (u).
// Mirror của src/app/manager/inventory/stock-check/page.tsx cho vai trò Admin.

export default function AdminStockStatusPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyReserved, setOnlyReserved] = useState(false);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [viewingItemId, setViewingItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag toggled before/after the fetch below, not a render loop
    setIsLoading(true);
    setLoadError(null);
    inventoryApiService
      .getInventory({ search: search.trim() || undefined, limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setLoadError('Không tải được danh sách tồn kho. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, reloadToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset trang khi đổi bộ lọc/tìm kiếm
    setPage(1);
  }, [search, categoryFilter, onlyReserved, onlyLowStock]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.categoryName).filter((v): v is string => Boolean(v)))),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (categoryFilter && r.categoryName !== categoryFilter) return false;
        if (onlyReserved && r.quantityReserved <= 0) return false;
        if (onlyLowStock && r.quantityAvailable >= 5) return false; // Giả định threshold = 5
        return true;
      }),
    [rows, categoryFilter, onlyReserved, onlyLowStock],
  );

  const summary = useMemo(() => {
    return {
      totalItems: rows.length,
      totalAvailable: rows.reduce((sum, r) => sum + r.quantityAvailable, 0),
      totalReserved: rows.reduce((sum, r) => sum + r.quantityReserved, 0),
      totalDamaged: rows.reduce((sum, r) => sum + r.quantityDamaged, 0),
    };
  }, [rows]);

  const kpiItems: KpiCardItem[] = useMemo(() => [
    { label: 'Tổng loại thiết bị', value: summary.totalItems, icon: Box, iconColor: 'slate' },
    { label: 'Đang khả dụng', value: summary.totalAvailable, icon: CheckCircle2, iconColor: 'green' },
    { label: 'Đang giữ (Reserved)', value: summary.totalReserved, icon: Lock, iconColor: 'blue' },
    { label: 'Đang hỏng', value: summary.totalDamaged, icon: XCircle, iconColor: 'red' },
  ], [summary]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * limit, safePage * limit);
  const paginationState: PaginationState = { currentPage: safePage, totalPages, totalItems: filteredRows.length, limit };

  const columns: TableColumn<InventoryRow>[] = [
    { key: 'itemCode', label: 'ID', render: (row) => <span className="font-semibold text-slate-400">{row.itemCode}</span> },
    {
      key: 'itemName',
      label: 'Tên sản phẩm & thiết bị',
      render: (row) => (
        <button type="button" onClick={() => setViewingItemId(row.itemId)} className="text-left font-semibold text-blue-600 hover:underline">
          {row.itemName}
        </button>
      ),
    },
    { key: 'categoryName', label: 'Nhóm sản phẩm', render: (row) => <span className="text-slate-600">{row.categoryName}</span> },
    {
      key: 'quantityAvailable',
      label: 'Tổng khả dụng',
      className: 'text-center',
      render: (row) => <span className="font-bold text-emerald-600">{row.quantityAvailable}</span>,
    },
    {
      key: 'quantityReserved',
      label: 'Số lượng đã khóa',
      className: 'text-center',
      render: (row) => <span className="font-bold text-blue-600">{row.quantityReserved}</span>,
    },
    {
      key: 'quantityDamaged',
      label: 'Số lượng hỏng',
      className: 'text-center',
      render: (row) => <span className="font-bold text-rose-600">{row.quantityDamaged}</span>,
    },
    {
      key: 'quantityTotal',
      label: 'Tổng số lượng',
      className: 'text-center bg-slate-50/60',
      render: (row) => <span className="font-bold text-slate-900">{row.quantityTotal}</span>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'text-center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
            onClick={() => setViewingItemId(row.itemId)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Tùy chọn"
            title="Tùy chọn"
            onClick={() => setViewingItemId(row.itemId)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tồn kho doanh nghiệp</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý số lượng tồn kho sản phẩm và thiết bị trong doanh nghiệp</p>
        </div>
      </div>

      <div className="mt-6">
        <DashboardStats items={kpiItems} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 sm:p-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <h2 className="text-base font-bold text-slate-900">Danh sách tồn kho doanh nghiệp</h2>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder="Tìm kiếm theo ID, tên sản phẩm..."
              icon={<Search className="h-4 w-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="w-full md:w-52">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[{ value: '', label: 'Nhóm sản phẩm' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyReserved(!onlyReserved)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                onlyReserved
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Lock className="h-4 w-4" />
              Đang Reserved
            </button>
            <button
              type="button"
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                onlyLowStock
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Tồn thấp
            </button>
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-400">Đang tải danh sách tồn kho...</p>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-red-500">{loadError}</p>
          ) : (
            <Table columns={columns} rows={pageRows} rowKey={(row) => row.itemId} />
          )}
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </motion.div>

      <InventoryDetailModal
        isOpen={Boolean(viewingItemId)}
        onClose={() => setViewingItemId(null)}
        itemId={viewingItemId}
        onAdjusted={() => setReloadToken((t) => t + 1)}
      />
    </div>
  );
}
