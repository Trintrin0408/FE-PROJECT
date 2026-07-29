'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Supplier } from '@/types/supplier';

export interface SupplierFormValues {
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  contactPerson: string;
  phone: string;
  address: string;
  rating: string;
  notes: string;
}

const EMPTY_FORM: SupplierFormValues = {
  supplierCode: '',
  supplierName: '',
  serviceType: '',
  contactPerson: '',
  phone: '',
  address: '',
  rating: '',
  notes: '',
};

interface SupplierFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  supplier: Supplier | null;
  isSubmitting?: boolean;
  /** Lỗi từ backend khi lưu thất bại — modal chỉ tự xử lý lỗi validate client-side (bắt buộc nhập). */
  submitError?: string | null;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => void;
}

interface SupplierFormErrors {
  supplierCode?: string;
  supplierName?: string;
  serviceType?: string;
}

function validate(mode: 'create' | 'edit', values: SupplierFormValues): SupplierFormErrors {
  const errors: SupplierFormErrors = {};
  if (mode === 'create' && !values.supplierCode.trim()) errors.supplierCode = 'Vui lòng nhập mã đối tác';
  if (!values.supplierName.trim()) errors.supplierName = 'Vui lòng nhập tên nhà cung cấp';
  if (!values.serviceType.trim()) errors.serviceType = 'Vui lòng nhập phân loại dịch vụ';
  return errors;
}

/** Modal Thêm/Sửa đối tác — dùng chung cho /admin/suppliers và /manager/suppliers. Bộ trường khớp
 * đúng CreateSupplierPayload/UpdateSupplierPayload thật (types/supplier.ts) — có `contactPerson`,
 * `rating`, `notes`; không có `email` (backend nhận thì bỏ qua âm thầm, không lưu — xem comment đầu
 * types/supplier.ts). Việc gọi supplierApiService.createSupplier/updateSupplier do component cha
 * (trang danh sách) thực hiện, modal chỉ thu thập + validate client-side rồi trả values ra ngoài. */
export function SupplierFormModal({ isOpen, mode, supplier, isSubmitting, submitError, onClose, onSubmit }: Readonly<SupplierFormModalProps>) {
  const [values, setValues] = useState<SupplierFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<SupplierFormErrors>({});
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setErrors({});
      setValues(
        mode === 'edit' && supplier
          ? {
              supplierCode: supplier.supplierCode,
              supplierName: supplier.supplierName,
              serviceType: supplier.serviceType,
              contactPerson: supplier.contactPerson ?? '',
              phone: supplier.phone ?? '',
              address: supplier.address ?? '',
              rating: supplier.rating != null ? String(supplier.rating) : '',
              notes: supplier.notes ?? '',
            }
          : EMPTY_FORM,
      );
    }
  }

  const handleSubmit = () => {
    const nextErrors = validate(mode, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Thêm đối tác mới' : 'Chỉnh sửa đối tác'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            {mode === 'create' ? 'Thêm đối tác' : 'Lưu thay đổi'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {submitError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Mã đối tác"
            required
            disabled={mode === 'edit'}
            value={values.supplierCode}
            onChange={(e) => setValues((v) => ({ ...v, supplierCode: e.target.value }))}
            placeholder="VD: SUP_ABC"
            error={errors.supplierCode}
          />
          <Input
            label="Tên nhà cung cấp"
            required
            value={values.supplierName}
            onChange={(e) => setValues((v) => ({ ...v, supplierName: e.target.value }))}
            placeholder="VD: Ánh Sáng Pro"
            error={errors.supplierName}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Người liên hệ"
            value={values.contactPerson}
            onChange={(e) => setValues((v) => ({ ...v, contactPerson: e.target.value }))}
            placeholder="Họ và tên"
          />
          <Input label="Số điện thoại" value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} placeholder="09xx xxx xxx" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Địa chỉ"
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            placeholder="Quận/huyện, tỉnh/thành"
          />
          <Input
            label="Phân loại"
            required
            value={values.serviceType}
            onChange={(e) => setValues((v) => ({ ...v, serviceType: e.target.value }))}
            placeholder="VD: Âm thanh biểu diễn"
            error={errors.serviceType}
          />
        </div>
        <Input
          label="Đánh giá (0 - 5)"
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={values.rating}
          onChange={(e) => setValues((v) => ({ ...v, rating: e.target.value }))}
          placeholder="VD: 4.5"
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="supplier-notes">
            Ghi chú
          </label>
          <textarea
            id="supplier-notes"
            rows={3}
            className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}

export default SupplierFormModal;
