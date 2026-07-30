'use client';

import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Wrench } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { inventoryApiService } from '@/services/inventory.service';
import { catalogApiService } from '@/services/catalog.service';
import { orderApiService } from '@/services/order.service';
import type { InventoryMovement, InventoryRow } from '@/types/inventory';
import type { Item } from '@/types/catalog';

// Nối API thật theo docs/tonkhodoanhnghiep_api.md (2026-07-20) — component RIÊNG cho màn "Tồn kho
// doanh nghiệp" (`/manager/inventory/stock-check`, `/admin/inventory/stock-status`), KHÔNG dùng chung
// với `EquipmentDetailModal.tsx` (component cũ vẫn giữ nguyên cho `/admin/catalog/packages`, trang
// CRUD danh mục thuần mock — đổi chung 1 component sẽ phá vỡ trang đó vì prop shape khác hẳn). Nhận
// `itemId` thay vì object mock, tự tải inventory + catalog item + nhật ký biến động qua
// `inventoryApiService`/`catalogApiService`. 2 gap còn lại (Kích thước/Chất liệu, Vị trí kho) hiển thị
// in nghiêng — chưa có cột thật, xem docs/more-require.md mục (u).

type AdjustKind = 'INBOUND' | 'RECOUNT';

const MOCK_DIMENSIONS = '1.2m x 0.8m x 1.5m';
const MOCK_MATERIAL = 'Nhựa ABS + kim loại';
const MOCK_LOCATION = 'Kho A - Kệ 03';

interface InventoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string | null;
  onAdjusted?: () => void;
}

export function InventoryDetailModal({ isOpen, onClose, itemId, onAdjusted }: Readonly<InventoryDetailModalProps>) {
  const [row, setRow] = useState<InventoryRow | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orderCodes, setOrderCodes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [adjustKind, setAdjustKind] = useState<AdjustKind>('INBOUND');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustDamaged, setAdjustDamaged] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = (id: string) => {
    setIsLoading(true);
    // GET /catalog/items/:id (chi tiết theo id) trả 404 thật — xác nhận qua curl (2026-07-20, xem
    // docs/more-require.md mục (u)) — chỉ GET /catalog/items (danh sách) hoạt động, nên tự lọc theo
    // itemId phía client thay vì gọi endpoint chi tiết không tồn tại.
    Promise.all([
      inventoryApiService.getInventory({ itemId: id, limit: 1 }),
      catalogApiService.getItems({ limit: 100 }).catch(() => ({ data: [] })),
      inventoryApiService.getMovements({ itemId: id, limit: 20 }),
    ])
      .then(([invRes, itemsRes, movRes]) => {
        setRow((invRes.data ?? [])[0] ?? null);
        setItem((itemsRes.data ?? []).find((i: Item) => i.itemId === id) ?? null);
        const list: InventoryMovement[] = movRes.data ?? [];
        setMovements(list);
        const uniqueOrderIds = Array.from(new Set(list.map((m) => m.orderId).filter((v): v is string => Boolean(v))));
        Promise.all(uniqueOrderIds.map((oid) => orderApiService.getOrder(oid).then((r) => [oid, r.data?.orderCode ?? oid] as const).catch(() => [oid, oid] as const))).then(
          (pairs) => setOrderCodes(Object.fromEntries(pairs)),
        );
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isOpen || !itemId) return;
    setAdjustQty('');
    setAdjustDamaged('');
    setAdjustReason('');
    setSaveError(null);
    load(itemId);
  }, [isOpen, itemId]);

  if (!isOpen || !itemId) return null;

  const handleAdjustSubmit = async () => {
    const deltaTotal = Number(adjustQty) || 0;
    const deltaDamaged = Number(adjustDamaged) || 0;
    if (adjustKind === 'INBOUND' && deltaTotal <= 0) return;
    if (adjustKind === 'RECOUNT' && deltaTotal === 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await inventoryApiService.adjustInventory({
        itemId,
        deltaTotal: adjustKind === 'INBOUND' ? Math.abs(deltaTotal) : deltaTotal,
        deltaDamaged: deltaDamaged || undefined,
        notes: adjustReason || undefined,
      });
      setAdjustQty('');
      setAdjustDamaged('');
      setAdjustReason('');
      load(itemId);
      onAdjusted?.();
    } catch {
      setSaveError('Ghi nhận điều chỉnh thất bại. Vui lòng kiểm tra lại số lượng và thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = adjustKind === 'INBOUND' ? Number(adjustQty) > 0 : Number(adjustQty) !== 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={row?.itemName ?? item?.itemName ?? 'Chi tiết thiết bị'}
      subtitle={`Mã: ${row?.itemCode ?? item?.itemCode ?? itemId} · Danh mục: ${row?.categoryName ?? '—'}`}
      size="xl"
    >
      {isLoading && !row ? (
        <p className="py-10 text-center text-sm text-slate-400">Đang tải chi tiết thiết bị...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Đơn giá</p>
              <p className="mt-0.5 font-semibold text-slate-800">
                {item ? formatCurrency(item.rentalPrice) : '—'} <span className="text-xs font-normal text-slate-400">/{(row?.unit ?? '').toLowerCase()}</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Giá trị đền bù</p>
              <p className="mt-0.5 font-semibold text-slate-800">{item?.purchasePrice != null ? formatCurrency(item.purchasePrice) : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Kích thước</p>
              <p className="mt-0.5 font-semibold italic text-slate-500">{MOCK_DIMENSIONS}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Chất liệu</p>
              <p className="mt-0.5 font-semibold italic text-slate-500">{MOCK_MATERIAL}</p>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mô tả kỹ thuật</p>
              <p className="mt-0.5 text-slate-600">{item?.description || 'Không có mô tả.'}</p>
            </div>
          </div>
          <p className="text-[10px] italic text-slate-400">
            "Kích thước"/"Chất liệu" là dữ liệu fix cứng — `items` chưa có 2 cột này, xem docs/more-require.md mục (u).
          </p>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Tồn kho hiện tại</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tổng số</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{row?.quantityTotal ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Khả dụng</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">{row?.quantityAvailable ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Đã khóa (đơn hàng)</p>
                <p className="mt-1 text-lg font-bold text-blue-700">{row?.quantityReserved ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Hỏng</p>
                <p className="mt-1 text-lg font-bold text-amber-700">{row?.quantityDamaged ?? '—'}</p>
              </div>
            </div>
            <p className="mt-2 text-xs italic text-slate-400">Vị trí kho: {MOCK_LOCATION} (dữ liệu fix cứng — `inventory` chưa có cột `location`)</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Điều chỉnh tồn kho</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Select
                label="Loại điều chỉnh"
                value={adjustKind}
                onChange={(e) => setAdjustKind(e.target.value as AdjustKind)}
                options={[
                  { value: 'INBOUND', label: 'Nhập kho thêm' },
                  { value: 'RECOUNT', label: 'Điều chỉnh kiểm kê (±)' },
                ]}
              />
              <Input
                label={adjustKind === 'INBOUND' ? 'Số lượng nhập thêm' : 'Chênh lệch tổng số (±)'}
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
              <Input label="Trong đó có hỏng" type="number" min={0} value={adjustDamaged} onChange={(e) => setAdjustDamaged(e.target.value)} />
              <Input label="Lý do / Ghi chú" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
            <p className="mt-2 text-[10px] italic text-slate-400">
              Backend hiện yêu cầu "Chênh lệch tổng số" phải khác 0 để ghi nhận được điều chỉnh — chưa hỗ trợ ghi nhận riêng hàng hỏng mà không đổi tổng số lượng, xem docs/more-require.md mục (u).
            </p>
            {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handleAdjustSubmit} disabled={!canSubmit} isLoading={isSaving}>
                Ghi nhận điều chỉnh
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Nhật ký biến động kho ({movements.length})</h3>
            {movements.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Chưa có biến động nào được ghi nhận.</p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                {movements.map((log) => {
                  const isOutbound = log.movementType === 'OUTBOUND';
                  const variant: BadgeVariant = isOutbound ? 'info' : log.quantity < 0 ? 'error' : 'success';
                  const reference = log.orderId ? `Đơn ${orderCodes[log.orderId] ?? log.orderId.slice(0, 8)}` : 'Điều chỉnh thủ công';
                  return (
                    <li key={log.movementId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        {log.movementType === 'INBOUND' && <ArrowDownCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />}
                        {log.movementType === 'OUTBOUND' && <ArrowUpCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                        {log.movementType === 'ADJUSTMENT' && <Wrench className="h-4 w-4 flex-shrink-0 text-slate-400" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-700">{log.notes || '—'}</p>
                          <p className="text-xs text-slate-400">
                            {formatDate(log.createdAt)} · {reference} · {log.performedBy?.fullName ?? '—'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={variant}>
                        {log.quantity > 0 ? '+' : ''}
                        {log.quantity} {row?.unit ?? ''}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default InventoryDetailModal;
