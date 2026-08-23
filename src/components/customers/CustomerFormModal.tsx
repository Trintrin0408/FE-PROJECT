'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type { Customer, CustomerStatus } from '@/types/customer';

export interface CustomerFormValues {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: CustomerStatus;
}

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCustomer?: Customer | null;
  isSubmitting?: boolean;
  /** Lỗi từ backend khi lưu thất bại (vd trùng số điện thoại) — modal chỉ tự xử lý lỗi validate client-
   * side (bắt buộc nhập/định dạng), lỗi server phải do component cha truyền vào để hiển thị. */
  submitError?: string | null;
  onSubmit: (values: CustomerFormValues) => void;
}

function emptyValues(): CustomerFormValues {
  return { customerName: '', phone: '', email: '', address: '', notes: '', status: 'active' };
}

interface CustomerFormErrors {
  customerName?: string;
  phone?: string;
  address?: string;
}

function validate(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  if (!values.customerName.trim()) errors.customerName = 'Vui lòng nhập họ và tên khách hàng.';
  if (!values.phone.trim()) {
    errors.phone = 'Vui lòng nhập số điện thoại.';
  } else if (!/^\d{10}$/.test(values.phone.trim())) {
    errors.phone = 'Số điện thoại phải đủ 10 số.';
  }
  if (!values.address.trim()) errors.address = 'Vui lòng nhập địa chỉ khách hàng.';
  return errors;
}

export function CustomerFormModal({ isOpen, onClose, editingCustomer, isSubmitting, submitError, onSubmit }: Readonly<CustomerFormModalProps>) {
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        editingCustomer
          ? {
              customerName: editingCustomer.customerName,
              phone: editingCustomer.phone,
              email: editingCustomer.email,
              address: editingCustomer.address ?? '',
              notes: editingCustomer.notes ?? '',
              status: editingCustomer.status,
            }
          : emptyValues(),
      );
      setErrors({});
    }
  }

  const handleSubmit = () => {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Hủy bỏ
      </Button>
      <Button onClick={handleSubmit} isLoading={isSubmitting}>
        Lưu hồ sơ
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCustomer ? `Chỉnh sửa khách hàng · ${editingCustomer.customerId}` : 'Thêm khách hàng'}
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {submitError}
          </div>
        )}
        <Input
          label="Họ và tên *"
          value={values.customerName}
          onChange={(e) => {
            setValues((v) => ({ ...v, customerName: e.target.value }));
            setErrors((err) => ({ ...err, customerName: undefined }));
          }}
          error={errors.customerName}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Số điện thoại *"
            value={values.phone}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
              setValues((v) => ({ ...v, phone: digitsOnly }));
              setErrors((err) => ({ ...err, phone: undefined }));
            }}
            error={errors.phone}
            helpText={errors.phone ? undefined : 'Nhập đủ 10 số, ví dụ: 0987654321.'}
            inputMode="numeric"
            maxLength={10}
          />
          <Input
            label="Thư điện tử (Email)"
            type="email"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          />
        </div>
        <Select
          label="Trạng thái "
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as CustomerStatus }))}
          options={[
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'inactive', label: 'Tạm ngưng' },
          ]}
        />
        <Input
          label="Địa chỉ khách hàng *"
          value={values.address}
          onChange={(e) => {
            setValues((v) => ({ ...v, address: e.target.value }));
            setErrors((err) => ({ ...err, address: undefined }));
          }}
          error={errors.address}
        />
        <Textarea
          id="customer-notes"
          label="Ghi chú cụ thể"
          rows={3}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </div>
    </Modal>
  );
}

export default CustomerFormModal;
