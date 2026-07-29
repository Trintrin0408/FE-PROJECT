import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supplierApiService } from '@/services/supplier.service';
import { orderApiService } from '@/services/order.service';
import type { SupplierItem, TransactionItemInput, CreateSupplierTransactionPayload } from '@/types/supplier';
import type { Order } from '@/types/order';
import { Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateSupplierTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  onSuccess: () => void;
}

export default function CreateSupplierTransactionModal({
  isOpen,
  onClose,
  supplierId,
  onSuccess
}: CreateSupplierTransactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  
  const [orderId, setOrderId] = useState('');
  const [transactionType, setTransactionType] = useState<'RENTAL' | 'PURCHASE'>('RENTAL');
  const [serviceTitle, setServiceTitle] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  
  const [items, setItems] = useState<TransactionItemInput[]>([
    { itemId: '', quantity: 1, unitCost: 0, notes: '' }
  ]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      fetchInitialData();
    }
  }, [isOpen, supplierId]);

  // If transaction type changes, update prices for already selected items
  useEffect(() => {
    setItems(currentItems => 
      currentItems.map(item => {
        if (!item.itemId) return item;
        const selectedSupplierItem = supplierItems.find(si => si.itemId === item.itemId);
        if (!selectedSupplierItem) return item;
        
        return {
          ...item,
          unitCost: (transactionType === 'RENTAL' ? selectedSupplierItem.rentalPrice : selectedSupplierItem.purchasePrice) ?? undefined
        };
      })
    );
  }, [transactionType, supplierItems]);

  const resetForm = () => {
    setOrderId('');
    setTransactionType('RENTAL');
    setServiceTitle('');
    setDepositAmount(0);
    setItems([{ itemId: '', quantity: 1, unitCost: 0, notes: '' }]);
  };

  const fetchInitialData = async () => {
    try {
      const [ordersRes, itemsRes] = await Promise.all([
        orderApiService.getOrders({ limit: 100 }), // Get recent orders
        supplierApiService.getSupplierItems(supplierId)
      ]);
      
      setOrders(ordersRes.data || []);
      // Only keep active items
      setSupplierItems(((itemsRes as any).data || itemsRes || []).filter((i: SupplierItem) => i.isActive));
    } catch (error) {
      toast.error('Lỗi khi tải dữ liệu ban đầu');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { itemId: '', quantity: 1, unitCost: 0, notes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof TransactionItemInput, value: any) => {
    const newItems = [...items];
    
    if (field === 'itemId') {
      const selectedSupplierItem = supplierItems.find(si => si.itemId === value);
      newItems[index] = {
        ...newItems[index],
        itemId: value,
        unitCost: selectedSupplierItem ? (transactionType === 'RENTAL' ? selectedSupplierItem.rentalPrice : selectedSupplierItem.purchasePrice) ?? undefined : 0
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + (item.quantity * (item.unitCost || 0)), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (transactionType === 'RENTAL' && !orderId) {
      toast.error('Giao dịch thuê bắt buộc phải chọn đơn hàng');
      return;
    }
    if (!serviceTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề dịch vụ');
      return;
    }
    
    // Validate items
    const validItems = items.filter(i => i.itemId);
    if (validItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 hạng mục thiết bị');
      return;
    }
    
    for (const item of validItems) {
      if (item.quantity <= 0) {
        toast.error('Số lượng phải lớn hơn 0');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload: CreateSupplierTransactionPayload = {
        supplierId,
        orderId: orderId || undefined,
        transactionType,
        serviceTitle,
        depositAmount,
        items: validItems
      };
      
      await supplierApiService.createSupplierTransaction(payload);
      toast.success('Tạo giao dịch thành công');
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || 'Có lỗi xảy ra khi tạo giao dịch';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo giao dịch mới" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Đơn hàng gốc {transactionType === 'RENTAL' && <span className="text-red-500">*</span>}</label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required={transactionType === 'RENTAL'}
            >
              <option value="">{transactionType === 'RENTAL' ? '-- Chọn đơn hàng --' : '-- Nhập kho trực tiếp (Không gắn đơn) --'}</option>
              {orders.map(order => (
                <option key={order.orderId} value={order.orderId}>
                  {order.orderCode} - {order.customerName} ({order.eventName || order.eventType})
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Loại giao dịch <span className="text-red-500">*</span></label>
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as 'RENTAL' | 'PURCHASE')}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              <option value="RENTAL">Thuê ngoài</option>
              <option value="PURCHASE">Mua hàng</option>
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Tiêu đề dịch vụ <span className="text-red-500">*</span></label>
            <Input
              value={serviceTitle}
              onChange={(e) => setServiceTitle(e.target.value)}
              placeholder="Vd: Thuê âm thanh ánh sáng cho sự kiện..."
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Tiền cọc (₫)</label>
            <Input
              type="number"
              min="0"
              value={depositAmount || ''}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Chi tiết hạng mục ({transactionType === 'RENTAL' ? 'Thuê' : 'Mua'})</h4>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddItem} className="h-8">
              <Plus className="h-4 w-4 mr-1" /> Thêm hạng mục
            </Button>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 items-end">
                <div className="w-full md:w-2/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Hạng mục cung cấp</label>
                  <select
                    value={item.itemId}
                    onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">-- Chọn hạng mục --</option>
                    {supplierItems
                      .filter(si => si.isActive)
                      .map(si => (
                      <option key={si.itemId} value={si.itemId}>
                        {si.itemName || 'Unknown Item'}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="w-full md:w-1/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Số lượng</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity?.toString() ?? '1'}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>
                
                <div className="w-full md:w-1/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Đơn giá ({transactionType === 'RENTAL' ? 'Thuê' : 'Mua'})</label>
                  <Input
                    type="number"
                    min="0"
                    value={item.unitCost?.toString() ?? '0'}
                    onChange={(e) => handleItemChange(index, 'unitCost', e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>

                <div className="w-full md:w-auto pb-1.5">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:hover:bg-transparent"
                    title="Xóa hạng mục này"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <span className="text-sm text-slate-500 mr-3">Tổng cộng:</span>
              <span className="text-lg font-bold text-blue-600">{calculateTotal().toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Tạo giao dịch'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
