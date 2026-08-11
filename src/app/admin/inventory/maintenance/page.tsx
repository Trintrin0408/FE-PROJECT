'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Wrench, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApiService } from '@/services/inventory.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import Reveal from '@/components/ui/Reveal';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatDate';
import { parseApiError } from '@/utils/apiError';
import type { InventoryRow } from '@/types/inventory';

interface MaintenanceRow {
  itemId: string;
  itemName: string;
  damagedQuantity: number;
  totalQuantity: number;
  updatedAt: string;
}

type ActionKind = 'repair' | 'scrap';

export default function Page() {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  // Modal bảo trì (sửa xong / thanh lý)
  const [action, setAction] = useState<ActionKind | null>(null);
  const [target, setTarget] = useState<MaintenanceRow | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    inventoryApiService
      .getInventory({ limit: 200 })
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

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((row) => row.itemName.toLowerCase().includes(debouncedSearch.trim().toLowerCase())),
    [rows, debouncedSearch]
  );

  const openAction = (kind: ActionKind, row: MaintenanceRow) => {
    setAction(kind);
    setTarget(row);
    setQuantity('1');
    setNotes('');
    setFormError(null);
  };
  const closeModal = () => {
    setAction(null);
    setTarget(null);
  };

  const handleSubmit = async () => {
    if (!action || !target) return;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > target.damagedQuantity) {
      setFormError(`Số lượng phải từ 1 đến ${target.damagedQuantity} (số hỏng hiện có).`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = { itemId: target.itemId, quantity: qty, notes: notes.trim() || undefined };
      if (action === 'repair') await inventoryApiService.repairInventory(payload);
      else await inventoryApiService.scrapInventory(payload);
      toast.success(action === 'repair' ? 'Đã ghi nhận sửa xong.' : 'Đã thanh lý hàng hỏng.');
      closeModal();
      load();
    } catch (err) {
      setFormError(parseApiError(err, 'Không thể thực hiện thao tác bảo trì.'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumn<MaintenanceRow>[] = [
    { key: 'itemId', label: 'Mã thiết bị' },
    { key: 'itemName', label: 'Tên thiết bị' },
    {
      key: 'damagedQuantity',
      label: 'Số lượng hỏng',
      render: (row) => <span className="font-bold text-rose-600">{row.damagedQuantity}</span>,
    },
    { key: 'totalQuantity', label: 'Tổng số lượng' },
    { key: 'updatedAt', label: 'Cập nhật gần nhất', render: (row) => formatDate(row.updatedAt) },
    {
      key: 'status',
      label: 'Trạng thái',
      render: () => <Badge variant={getStatusBadgeVariant('MAINTENANCE')}>Đang sửa chữa</Badge>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAction('repair', row)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
          >
            <Wrench className="h-3.5 w-3.5" />
            Sửa xong
          </button>
          <button
            type="button"
            onClick={() => openAction('scrap', row)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 hover:border-rose-200 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Thanh lý
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Thiết bị đang bảo trì</h1>
        <p className="mt-1 text-sm text-slate-500">
          Thiết bị có số lượng hỏng cần sửa chữa, không được dùng cho đơn hàng mới (UC 2.13). Sửa xong đưa hàng về khả
          dụng; thanh lý loại hàng khỏi sở hữu.
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

      <Modal
        isOpen={action !== null}
        onClose={closeModal}
        title={action === 'repair' ? 'Sửa xong hàng hỏng' : 'Thanh lý hàng hỏng'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              {action === 'repair' ? 'Xác nhận sửa xong' : 'Xác nhận thanh lý'}
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{target.itemName}</span> — đang hỏng {target.damagedQuantity}, tổng{' '}
              {target.totalQuantity}.
              {action === 'repair'
                ? ' Sửa xong sẽ giảm số hỏng, tổng giữ nguyên (hàng dùng lại được).'
                : ' Thanh lý sẽ giảm cả số hỏng lẫn tổng (loại khỏi sở hữu).'}
            </p>
            <Input
              type="number"
              label="Số lượng"
              min={1}
              max={target.damagedQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Input label="Ghi chú (không bắt buộc)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
