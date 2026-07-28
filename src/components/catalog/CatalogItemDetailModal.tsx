'use client';

import { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { formatDate } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Item } from '@/types/catalog';

interface CatalogItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  MAINTENANCE: 'Bảo trì',
};

function DetailRow({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function CatalogItemDetailModal({ isOpen, onClose, item }: Readonly<CatalogItemDetailModalProps>) {
  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết thiết bị">
      <div className="flex flex-col">
        <DetailRow label="Mã thiết bị" value={item.itemCode} />
        <DetailRow label="Tên thiết bị" value={item.itemName} />
        <DetailRow label="Loại" value={item.typeName ?? '—'} />
        <DetailRow label="Đơn vị tính" value={item.unit} />
        <DetailRow label="Mô tả" value={item.description || '—'} />
        <DetailRow label="Đơn giá thuê" value={formatCurrency(item.rentalPrice)} />
        <DetailRow label="Tồn kho" value={item.inventory ? `${item.inventory.quantityAvailable}/${item.inventory.quantityTotal}` : '—'} />
        <DetailRow label="Trạng thái" value={<Badge variant={getStatusBadgeVariant(item.status)}>{STATUS_LABEL[item.status] ?? item.status}</Badge>} />
        <DetailRow label="Ngày tạo" value={formatDate(item.createdAt)} />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Đối tác cung cấp (Minh họa)</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-500">Tên nhà cung cấp</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">Giá nhập/thuê</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {/* Đây là dữ liệu giả (Mock) hiển thị tạm cho đến khi Backend làm xong bảng supplier_items */}
              <tr>
                <td className="px-3 py-2 text-slate-900">Công ty TNHH Kỹ thuật Điện Toàn Phát</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">250.000 ₫</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-slate-900">Studio Ánh Sáng Sự Kiện Nam Việt</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">270.000 ₫</td>
              </tr>
            </tbody>
          </table>
          <div className="bg-slate-50 px-3 py-2 text-center text-xs italic text-slate-400">
            Dữ liệu thực tế sẽ được tải từ bảng supplier_items sau khi hoàn thiện API.
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default CatalogItemDetailModal;
