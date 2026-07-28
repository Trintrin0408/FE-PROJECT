import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { supplierApiService } from '@/services/supplier.service';
import type { SupplierItem } from '@/types/supplier';
import toast from 'react-hot-toast';

interface UpdateSupplierItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  item: SupplierItem | null;
  onSuccess: () => void;
}

export default function UpdateSupplierItemModal({
  isOpen,
  onClose,
  supplierId,
  item,
  onSuccess,
}: UpdateSupplierItemModalProps) {
  const [suppliedPrice, setSuppliedPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setSuppliedPrice(item.suppliedPrice.toString());
      setIsActive(item.isActive);
    }
  }, [isOpen, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    if (!suppliedPrice || Number(suppliedPrice) < 0) {
      toast.error('Vui lòng nhập giá cung cấp hợp lệ');
      return;
    }

    try {
      setIsSubmitting(true);
      await supplierApiService.updateSupplierItem(supplierId, item.itemId, {
        suppliedPrice: Number(suppliedPrice),
        isActive,
      });
      toast.success('Cập nhật mặt hàng thành công');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update item:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật mặt hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cập nhật giá / trạng thái">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Hạng mục
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-500"
            value={item.itemName}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Giá nhập/thuê mới (VNĐ) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={suppliedPrice}
            onChange={(e) => setSuppliedPrice(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
            Đang cung cấp (Active)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
