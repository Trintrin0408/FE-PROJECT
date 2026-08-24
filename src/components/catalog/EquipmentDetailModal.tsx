'use client';

import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Wrench } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/utils/formatCurrency';
import { AdminEquipment, STOCK_LOG_TYPE_META, StockLogType } from '@/mocks/db/catalog';

interface EquipmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: AdminEquipment | null;
  onAdjustStock: (type: StockLogType, quantity: number, reason: string) => void;
}

const ADJUST_TYPE_OPTIONS: { value: StockLogType; label: string }[] = [
  { value: 'nhap_kho', label: 'Nhập kho' },
  { value: 'xuat_kho', label: 'Xuất kho (đi tiệc)' },
  { value: 'bao_tri', label: 'Đưa đi bảo trì' },
  { value: 'dieu_chinh', label: 'Điều chỉnh kiểm kê' },
];

export function EquipmentDetailModal({ isOpen, onClose, equipment, onAdjustStock }: Readonly<EquipmentDetailModalProps>) {
  const [adjustType, setAdjustType] = useState<StockLogType>('nhap_kho');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  if (!equipment) return null;

  const handleAdjustSubmit = () => {
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) return;
    onAdjustStock(adjustType, qty, adjustReason || ADJUST_TYPE_OPTIONS.find((o) => o.value === adjustType)?.label || '');
    setAdjustQty('');
    setAdjustReason('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={equipment.name} subtitle={`Mã: ${equipment.id} · Danh mục: ${equipment.category}`} size="xl">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Đơn giá</p>
            <p className="mt-0.5 font-semibold text-slate-800">
              {formatCurrency(equipment.price)} <span className="text-xs font-normal text-slate-400">/{equipment.unit.toLowerCase()}</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Giá trị đền bù</p>
            <p className="mt-0.5 font-semibold text-slate-800">{formatCurrency(equipment.replacementValue)}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Tồn kho hiện tại</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tổng số</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{equipment.totalStock}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Khả dụng</p>
              <p className="mt-1 text-lg font-bold text-emerald-700">{equipment.availableStock}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Đang đi tiệc</p>
              <p className="mt-1 text-lg font-bold text-blue-700">{equipment.rentedStock}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Bảo trì</p>
              <p className="mt-1 text-lg font-bold text-amber-700">{equipment.maintenanceStock}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Vị trí kho: {equipment.location || 'Chưa cập nhật'}</p>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Điều chỉnh tồn kho</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select
              label="Loại điều chỉnh"
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as StockLogType)}
              options={ADJUST_TYPE_OPTIONS}
            />
            <Input label="Số lượng" type="number" min={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            <div className="sm:col-span-2">
              <Input label="Lý do / Ghi chú" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleAdjustSubmit} disabled={!adjustQty || Number(adjustQty) <= 0}>
              Ghi nhận điều chỉnh
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Nhật ký biến động kho ({equipment.logs.length})</h3>
          {equipment.logs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Chưa có biến động nào được ghi nhận.</p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
              {equipment.logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.type === 'nhap_kho' && <ArrowDownCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />}
                    {log.type === 'xuat_kho' && <ArrowUpCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                    {log.type === 'bao_tri' && <Wrench className="h-4 w-4 flex-shrink-0 text-amber-500" />}
                    {log.type === 'dieu_chinh' && <ArrowDownCircle className="h-4 w-4 flex-shrink-0 text-slate-400" />}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{log.reason}</p>
                      <p className="text-xs text-slate-400">
                        {log.time} · {log.reference}
                      </p>
                    </div>
                  </div>
                  <Badge variant={STOCK_LOG_TYPE_META[log.type].variant}>
                    {log.type === 'xuat_kho' || log.type === 'bao_tri' ? '-' : '+'}
                    {log.quantity} {equipment.unit}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default EquipmentDetailModal;
