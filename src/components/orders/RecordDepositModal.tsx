'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { paymentApiService } from '@/services/payment.service';

interface RecordDepositModalProps {
  isOpen: boolean;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Backend mới chỉ có 1 bảng Deposit phẳng, không có cổng thanh toán online (VNPay/paymentUrl) —
// Manager ghi nhận trực tiếp số tiền đã/sẽ thu. Tick "Đã nhận đủ tiền" để đánh dấu SUCCESS ngay
// (cập nhật Order.paymentStatus = DEPOSITED); để trống thì chỉ ghi nhận ở trạng thái PENDING.
export default function RecordDepositModal({ isOpen, orderId, onClose, onSuccess }: Readonly<RecordDepositModalProps>) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [markReceived, setMarkReceived] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setMarkReceived(true);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const createRes = await paymentApiService.createOrderDeposit(orderId, {
        amount: numericAmount,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      const depositId: string = createRes.data?.depositId;
      if (markReceived && depositId) {
        await paymentApiService.updateDepositStatus(depositId, { status: 'PAID' });
      }
      onSuccess();
      resetAndClose();
    } catch {
      setError('Không thể ghi nhận tiền cọc. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Ghi nhận tiền cọc"
      footer={
        <>
          <Button variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Ghi nhận
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          type="number"
          label="Số tiền"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="VD: 25000000"
          required
        />
        <Select
          label="Phương thức"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          options={[
            { value: 'cash', label: 'Tiền mặt' },
            { value: 'bank_transfer', label: 'Chuyển khoản' },
          ]}
        />
        <Input
          label="Ghi chú (không bắt buộc)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="VD: Khách chuyển khoản tại văn phòng"
        />
        <label className="flex select-none items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={markReceived}
            onChange={(e) => setMarkReceived(e.target.checked)}
            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
          />
          Đã nhận đủ tiền (đánh dấu thành công ngay)
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
