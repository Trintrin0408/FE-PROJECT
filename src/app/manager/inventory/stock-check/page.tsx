'use client';

import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
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
      <PageHeader
        title="Tồn kho doanh nghiệp"
        description="Quản lý số lượng tồn kho sản phẩm và thiết bị trong doanh nghiệp"
      />

      <FilterBar>
        <h2 className="text-base font-bold text-slate-900">Danh sách tồn kho doanh nghiệp</h2>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Tìm kiếm theo ID, tên sản phẩm..." />
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
      </FilterBar>

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
