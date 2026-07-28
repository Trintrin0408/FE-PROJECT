import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { catalogApiService } from '@/services/catalog.service';
import { supplierApiService } from '@/services/supplier.service';
import type { Item } from '@/types/catalog';
import toast from 'react-hot-toast';

interface AssignSupplierItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  onSuccess: () => void;
}

export default function AssignSupplierItemModal({
  isOpen,
  onClose,
  supplierId,
  onSuccess,
}: AssignSupplierItemModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  
  const [selectedItemId, setSelectedItemId] = useState('');
  const [suppliedPrice, setSuppliedPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      setSelectedItemId('');
      setSuppliedPrice('');
    }
  }, [isOpen]);

  const fetchItems = async () => {
    try {
      setIsLoadingItems(true);
      const res = await catalogApiService.getItems({ limit: 200, status: 'ACTIVE' });
      // The API returns data array, but could be nested in 'data'
      setItems(res.data || []);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast.error('Không thể tải danh sách mặt hàng');
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast.error('Vui lòng chọn một mặt hàng');
      return;
    }
    if (!suppliedPrice || Number(suppliedPrice) < 0) {
      toast.error('Vui lòng nhập giá cung cấp hợp lệ');
      return;
    }

    try {
      setIsSubmitting(true);
      await supplierApiService.assignSupplierItem(supplierId, {
        itemId: selectedItemId,
        suppliedPrice: Number(suppliedPrice),
        isActive: true,
      });
      toast.success('Đã gán mặt hàng thành công');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to assign item:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi gán mặt hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm hạng mục cung cấp">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Chọn mặt hàng/thiết bị <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={isLoadingItems || isSubmitting}
            required
          >
            <option value="">-- Chọn mặt hàng --</option>
            {items.map((item) => (
              <option key={item.itemId} value={item.itemId}>
                {item.itemCode} - {item.itemName} (Đơn vị: {item.unit})
              </option>
            ))}
          </select>
          {isLoadingItems && <p className="text-xs text-slate-500 mt-1">Đang tải...</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Giá nhập/thuê (VNĐ) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={suppliedPrice}
            onChange={(e) => setSuppliedPrice(e.target.value)}
            placeholder="VD: 250000"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Lưu hạng mục
          </Button>
        </div>
      </form>
    </Modal>
  );
}
