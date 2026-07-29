import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supplierApiService } from '@/services/supplier.service';
import { orderApiService } from '@/services/order.service';
import type { SupplierItem, TransactionItemInput, SupplierTransaction } from '@/types/supplier';
import type { Order } from '@/types/order';
import { Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface UpdateSupplierTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  transaction: SupplierTransaction | null;
  onSuccess: () => void;
  mode?: 'edit' | 'view';
}

export default function UpdateSupplierTransactionModal({
  isOpen,
  onClose,
  supplierId,
  transaction,
  onSuccess,
  mode = 'edit'
}: Readonly<UpdateSupplierTransactionModalProps>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  
  const [orderId, setOrderId] = useState('');
  const [transactionType, setTransactionType] = useState<'RENTAL' | 'PURCHASE'>('RENTAL');
  const [serviceTitle, setServiceTitle] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [status, setStatus] = useState<string>('PENDING');
  const [paymentStatus, setPaymentStatus] = useState<string>('UNPAID');
  
  const [items, setItems] = useState<TransactionItemInput[]>([
    { itemId: '', quantity: 1, unitCost: 0, notes: '' }
  ]);

  // Load data when opened
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        // Fallback or partial load from prop
        setOrderId(transaction.orderId || '');
        setTransactionType((transaction.transactionType as 'RENTAL' | 'PURCHASE') || 'RENTAL');
        setServiceTitle(transaction.serviceTitle || '');
        setDepositAmount(transaction.depositAmount || 0);
        setStatus(transaction.status || 'PENDING');
        setPaymentStatus(transaction.paymentStatus || 'UNPAID');
        
        // Fetch full details to get items
        supplierApiService.getTransactionById(transaction.transactionId)
          .then(res => {
            const detailTx = (res as any).data || res;
            if (detailTx.items && detailTx.items.length > 0) {
              setItems(detailTx.items.map((i: any) => ({
                itemId: i.itemId || '',
                itemName: i.itemName || '',
                quantity: i.quantity,
                unitCost: i.unitCost || 0,
                notes: i.notes || ''
              })));
            }
          })
          .catch(err => {
            console.error('Failed to load transaction details:', err);
            toast.error('Lỗi khi tải chi tiết giao dịch');
          });
      } else {
        setOrderId('');
        setTransactionType('RENTAL');
        setServiceTitle('');
        setDepositAmount(0);
        setStatus('PENDING');
        setPaymentStatus('UNPAID');
        setItems([{ itemId: '', quantity: 1, unitCost: 0, notes: '' }]);
      }
      
      supplierApiService.getSupplierItems(supplierId)
        .then(res => setSupplierItems((res as any).data || res || []))
        .catch(err => console.error('Failed to load items:', err));

      orderApiService.getOrders({ limit: 100 })
        .then(res => setOrders(res.data || []))
        .catch(err => console.error('Failed to load orders:', err));
    }
  }, [isOpen, supplierId, transaction]);

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
    
    if (!serviceTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề dịch vụ');
      return;
    }
    
    const validItems = items.filter(i => i.itemId);
    if (validItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 hạng mục thiết bị');
      return;
    }

    try {
      setIsSubmitting(true);
      const isOriginalPending = !transaction || transaction.status === 'PENDING';

      if (isOriginalPending) {
        const payload = {
          serviceTitle: serviceTitle.trim(),
          depositAmount,
          items: validItems
        };
        await supplierApiService.updateSupplierTransaction(transaction!.transactionId, payload);
      }

      if (transaction) {
        await supplierApiService.updateTransactionStatus(transaction.transactionId, status);
        await supplierApiService.updateTransactionPaymentStatus(transaction.transactionId, paymentStatus);
      }

      toast.success('Đã cập nhật giao dịch thành công');
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật giao dịch';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'view' ? "Chi tiết giao dịch" : "Cập nhật giao dịch"}
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-slate-500">
            {transaction?.updater?.fullName ? (
              <span>Người cập nhật cuối: <span className="font-medium text-slate-700">{transaction.updater.fullName}</span></span>
            ) : null}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Đóng
            </Button>
            {mode === 'edit' && (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Đơn hàng (Không thể đổi)</label>
            <select
              value={orderId}
              disabled
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
            >
              <option value={orderId}>
                {orderId ? (orders.find(o => o.orderId === orderId)?.orderCode || 'Đang tải...') : '-- Nhập kho trực tiếp (Không gắn đơn) --'}
              </option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Loại giao dịch (Không thể đổi)</label>
            <select
              value={transactionType}
              disabled
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
            >
              <option value="RENTAL">Thuê ngoài</option>
              <option value="PURCHASE">Mua hàng</option>
            </select>
          </div>

          {mode === 'edit' && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Trạng thái giao dịch</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="RECEIVED">Đã nhận</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Trạng thái thanh toán</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="UNPAID">Chưa thanh toán</option>
                  <option value="DEPOSITED">Đã đặt cọc</option>
                  <option value="PAID">Đã thanh toán</option>
                </select>
              </div>
              {status === 'APPROVED' && (!transaction || transaction.status === 'PENDING') && (
                <div className="md:col-span-2 text-sm text-orange-600 font-medium">
                  Lưu ý: Sau khi chuyển sang Đã duyệt và lưu lại, bạn sẽ không thể sửa chi tiết hạng mục hoặc xóa giao dịch này nữa.
                </div>
              )}
            </>
          )}

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Tiêu đề dịch vụ {mode === 'edit' && <span className="text-red-500">*</span>}</label>
            <Input
              value={serviceTitle}
              onChange={(e) => setServiceTitle(e.target.value)}
              placeholder="Vd: Thuê âm thanh ánh sáng cho sự kiện..."
              required
              disabled={mode === 'view' || Boolean(transaction?.status && transaction.status !== 'PENDING')}
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
              disabled={mode === 'view' || Boolean(transaction?.status && transaction.status !== 'PENDING')}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Chi tiết hạng mục</h4>
            {mode === 'edit' && (
              <Button type="button" variant="secondary" size="sm" onClick={handleAddItem} className="h-8">
                <Plus className="h-4 w-4 mr-1" /> Thêm hạng mục
              </Button>
            )}
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 items-end">
                <div className="w-full md:w-2/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Hạng mục cung cấp</label>
                  <select
                    value={item.itemId || ''}
                    onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    required
                    disabled={mode === 'view' || Boolean(transaction?.status && transaction.status !== 'PENDING')}
                  >
                    <option value="">
                      {(!item.itemId && item.itemName) ? `${item.itemName} (Hạng mục đã bị xoá)` : '-- Chọn hạng mục --'}
                    </option>
                    {supplierItems
                      .filter(si => si.isActive || si.itemId === item.itemId)
                      .map(si => (
                      <option key={si.itemId} value={si.itemId}>{si.itemName}</option>
                    ))}
                    {item.itemId && !supplierItems.find(si => si.itemId === item.itemId) && (
                      <option key={item.itemId} value={item.itemId}>{item.itemName || 'Hạng mục bị xoá / Tạm ẩn'}</option>
                    )}
                  </select>
                </div>
                
                <div className="w-full md:w-1/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Số lượng</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity?.toString() ?? '1'}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={mode === 'view' || Boolean(transaction?.status && transaction.status !== 'PENDING')}
                  />
                </div>
                
                <div className="w-full md:w-1/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Đơn giá</label>
                  <Input
                    type="number"
                    min="0"
                    value={item.unitCost?.toString() ?? '0'}
                    onChange={(e) => handleItemChange(index, 'unitCost', e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={mode === 'view' || Boolean(transaction?.status && transaction.status !== 'PENDING')}
                  />
                </div>

                {mode === 'edit' && (
                  <div className="w-full md:w-auto pb-1.5">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length === 1 || Boolean(transaction?.status && transaction.status !== 'PENDING')}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
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
      </form>
    </Modal>
  );
}
