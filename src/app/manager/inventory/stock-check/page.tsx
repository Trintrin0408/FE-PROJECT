'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Wrench } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import InventoryDetailModal from '@/components/catalog/InventoryDetailModal';
import { useDebounce } from '@/hooks/useDebounce';
import { inventoryApiService } from '@/services/inventory.service';
import type { InventoryRow } from '@/types/inventory';

// Nối API thật theo docs/tonkhodoanhnghiep_api.md (2026-07-20) — GET /api/v1/inventory (bảng
// `inventory` thật ra ĐÃ được tạo, tin mới hơn ghi nhận cũ ở docs/more-require.md mục (b)) trả sẵn
// itemCode/itemName/categoryName/typeName + 4 số liệu tồn kho (quantityTotal/quantityDamaged/
// quantityReserved/quantityAvailable).
// `categoryId`/`onlyDamaged` bị backend bỏ qua — FE tự lọc theo `categoryName`/`quantityDamaged > 0` phía client (dữ liệu hiện
// còn rất nhỏ, chấp nhận được). Xem chi tiết các gap này ở docs/more-require.md mục (u).
// Mirror của src/app/admin/inventory/stock-status/page.tsx cho vai trò Manager.

export default function ManagerStockCheckPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [viewingItemId, setViewingItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    inventoryApiService
      .getInventory({ search: search.trim() || undefined, limit: 100, date: selectedDate || undefined })
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
  }, [search, reloadToken, selectedDate]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, selectedDate]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.categoryName).filter((v): v is string => Boolean(v)))),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (categoryFilter && r.categoryName !== categoryFilter) return false;
        return true;
      }),
    [rows, categoryFilter],
  );

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
      key: 'quantityOnHand',
      label: 'Tồn thực (on-hand)',
      className: 'text-center',
      render: (row) => <span className="font-bold text-slate-700">{row.quantityOnHand ?? row.quantityTotal - row.quantityDamaged}</span>,
    },
    {
      key: 'quantityAvailable',
      label: 'Khả dụng (theo ngày)',
      className: 'text-center',
      render: (row) => <span className="font-bold text-emerald-600">{row.quantityAvailable}</span>,
    },
    {
      key: 'quantityReserved',
      label: 'Đã giữ (theo ngày)',
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
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tồn kho doanh nghiệp</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý số lượng tồn kho sản phẩm và thiết bị trong doanh nghiệp</p>
        </div>
        <Link href="/admin/inventory/maintenance">
          <Button variant="secondary">
            <Wrench className="h-4 w-4" />
            Thiết bị đang bảo trì
          </Button>
        </Link>
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
          <div className="w-full md:w-48">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              placeholder="Chọn ngày xem kho"
            />
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
        selectedDate={selectedDate}
        onAdjusted={() => setReloadToken((t) => t + 1)}
      />
    </div>
  );
}
