'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { procurementApiService } from '@/services/procurement.service';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Supplier } from '@/types/supplier';
import type { Order } from '@/types/order';
import type { SupplierTransactionType } from '@/types/procurement';

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'PURCHASE', label: 'Mua hàng' },
  { value: 'RENTAL', label: 'Thuê ngoài' },
];

interface CreateProcurementModalProps {
  isOpen: boolean;
  suppliers: Supplier[];
  orders: Order[];
  onClose: () => void;
  onSuccess: () => void;
}

// estimatedCost giờ tự tính server-side từ items[].unitCost * quantity (không nhận trực tiếp qua
// body) — form thu thập 1 hạng mục (itemName/quantity/unitCost) thay vì tổng chi phí nhập tay.
export default function CreateProcurementModal({ isOpen, suppliers, orders, onClose, onSuccess }: Readonly<CreateProcurementModalProps>) {
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [transactionType, setTransactionType] = useState<SupplierTransactionType>('PURCHASE');
  const [serviceTitle, setServiceTitle] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSupplierId('');
    setOrderId('');
    setTransactionType('PURCHASE');
    setServiceTitle('');
    setItemName('');
    setQuantity('1');
    setUnitCost('');
    setDepositAmount('');
    setErrors({});
    setSubmitError(null);
  }, [isOpen]);

  const supplierOptions = [
    { value: '', label: '— Chọn nhà cung cấp —' },
    ...suppliers.filter((s) => s.status === 'ACTIVE').map((s) => ({ value: s.supplierId, label: s.supplierName })),
  ];

  const orderOptions = [
    { value: '', label: '— Chọn đơn hàng liên kết —' },
    ...orders.map((o) => ({ value: o.orderId, label: o.orderCode })),
  ];

  const estimatedCost = (Number(quantity) || 0) * (Number(unitCost) || 0);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!supplierId) errs.supplierId = 'Vui lòng chọn nhà cung cấp';
    if (!orderId) errs.orderId = 'Vui lòng chọn đơn hàng';
    if (!serviceTitle.trim()) errs.serviceTitle = 'Vui lòng nhập tên giao dịch';
    if (!itemName.trim()) errs.itemName = 'Vui lòng nhập hạng mục mua sắm';
    if (!unitCost || Number(unitCost) <= 0) errs.unitCost = 'Vui lòng nhập đơn giá hợp lệ';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await procurementApiService.createTransaction({
        supplierId,
        orderId,
        transactionType,
        serviceTitle: serviceTitle.trim(),
        depositAmount: Number(depositAmount || '0'),
        items: [{ itemName: itemName.trim(), quantity: Number(quantity) || 1, unitCost: Number(unitCost) }],
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg ?? 'Tạo đơn mua sắm thất bại, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Khởi tạo đơn mua sắm / Thuê NCC">
      <div className="space-y-4 p-1">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Nhà cung cấp <span className="text-red-500">*</span>
          </label>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={supplierOptions} />
          {errors.supplierId && <p className="mt-1 text-xs text-red-600">{errors.supplierId}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Đơn hàng liên kết <span className="text-red-500">*</span>
          </label>
          <Select value={orderId} onChange={(e) => setOrderId(e.target.value)} options={orderOptions} />
          {errors.orderId && <p className="mt-1 text-xs text-red-600">{errors.orderId}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Loại giao dịch</label>
          <Select value={transactionType} onChange={(e) => setTransactionType(e.target.value as SupplierTransactionType)} options={TRANSACTION_TYPE_OPTIONS} />
        </div>

        <Input
          label="Tên giao dịch"
          required
          value={serviceTitle}
          onChange={(e) => setServiceTitle(e.target.value)}
          placeholder="VD: Thuê hoa tươi trang trí tiệc cưới"
          error={errors.serviceTitle}
        />

        <Input
          label="Hạng mục mua sắm / Thuê ngoài"
          required
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="VD: Hoa hồng Ecuador Pink Floyd (cành)"
          error={errors.itemName}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Số lượng" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input
            label="Đơn giá (đ)"
            required
            type="number"
            min={0}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder="150000"
            error={errors.unitCost}
          />
        </div>

        {estimatedCost > 0 && <p className="text-xs text-slate-500">Chi phí ước tính: {formatCurrency(estimatedCost)}</p>}

        <Input
          label="Chi đặt cọc NCC (đ)"
          type="number"
          min={0}
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          placeholder="4500000"
        />

        {submitError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-200">{submitError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Khởi tạo đơn mua sắm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
