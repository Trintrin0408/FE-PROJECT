'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { inventoryApiService } from '@/services/inventory.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import Reveal from '@/components/ui/Reveal';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatDate';
import type { InventoryRow } from '@/types/inventory';

interface MaintenanceRow {
  itemId: string;
  itemName: string;
  damagedQuantity: number;
  totalQuantity: number;
  updatedAt: string;
}

export default function Page() {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    inventoryApiService
      .getInventory({ limit: 500 })
      .then((inventoryRes) => {
        const maintenanceRows: MaintenanceRow[] = (inventoryRes.data as InventoryRow[])
          .filter((row) => row.quantityDamaged > 0)
          .map((row) => ({
            itemId: row.itemId,
            itemName: row.itemName ?? row.itemId,
            damagedQuantity: row.quantityDamaged,
            totalQuantity: row.quantityTotal,
            updatedAt: row.updatedAt,
          }));

        setRows(maintenanceRows);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredRows = useMemo(
    () => rows.filter((row) => row.itemName.toLowerCase().includes(debouncedSearch.trim().toLowerCase())),
    [rows, debouncedSearch]
  );

  const columns: TableColumn<MaintenanceRow>[] = [
    { key: 'itemId', label: 'Mã thiết bị' },
    { key: 'itemName', label: 'Tên thiết bị' },
    { key: 'damagedQuantity', label: 'Số lượng hỏng' },
    { key: 'totalQuantity', label: 'Tổng số lượng' },
    {
      key: 'updatedAt',
      label: 'Cập nhật gần nhất',
      render: (row) => formatDate(row.updatedAt),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: () => <Badge variant={getStatusBadgeVariant('MAINTENANCE')}>Đang sửa chữa</Badge>,
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Thiết bị đang bảo trì</h1>
        <p className="mt-1 text-sm text-slate-500">
          Thiết bị có số lượng hỏng cần sửa chữa, không được dùng cho đơn hàng mới (UC 2.13).
        </p>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Tìm theo tên thiết bị..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Table
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.itemId}
            isLoading={isLoading}
            emptyText="Không có thiết bị nào đang bảo trì."
          />
        </div>
      </Reveal>
    </div>
  );
}
