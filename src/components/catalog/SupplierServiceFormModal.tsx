'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  SUPPLIER_SERVICE_CATEGORY_OPTIONS,
  SUPPLIER_SERVICE_STATUS_META,
  SUPPLIER_SERVICE_UNIT_OPTIONS,
  SupplierServicePackage,
  SupplierServiceStatus,
  nextSupplierServiceCode,
} from '@/mocks/supplierServicesMock';
import { getAdminSuppliers } from '@/mocks/db/suppliers';

interface SupplierServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingService?: SupplierServicePackage | null;
  onSubmit: (values: Omit<SupplierServicePackage, 'id' | 'updatedAt'>) => void;
}

const fieldLabelClassName = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function emptyValues(firstSupplierId: string, firstSupplierName: string, firstSupplierPhone: string): Omit<SupplierServicePackage, 'id' | 'updatedAt'> {
  return {
    code: nextSupplierServiceCode(),
    name: '',
    supplierId: firstSupplierId,
    supplierName: firstSupplierName,
    supplierPhone: firstSupplierPhone,
    category: SUPPLIER_SERVICE_CATEGORY_OPTIONS[0],
    unit: SUPPLIER_SERVICE_UNIT_OPTIONS[0],
    referencePrice: 0,
    status: 'active',
    imageUrl: '',
    description: '',
  };
}

export function SupplierServiceFormModal({ isOpen, onClose, editingService, onSubmit }: Readonly<SupplierServiceFormModalProps>) {
  const suppliers = getAdminSuppliers();
  const [values, setValues] = useState(() => emptyValues(suppliers[0]?.supplierId ?? '', suppliers[0]?.supplierName ?? '', suppliers[0]?.phone ?? ''));
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        editingService
          ? {
              code: editingService.code,
              name: editingService.name,
              supplierId: editingService.supplierId,
              supplierName: editingService.supplierName,
              supplierPhone: editingService.supplierPhone,
              category: editingService.category,
              unit: editingService.unit,
              referencePrice: editingService.referencePrice,
              status: editingService.status,
              imageUrl: editingService.imageUrl,
              description: editingService.description,
            }
          : emptyValues(suppliers[0]?.supplierId ?? '', suppliers[0]?.supplierName ?? '', suppliers[0]?.phone ?? ''),
      );
    }
  }

  const handleSelectSupplier = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.supplierId === supplierId);
    setValues((v) => ({ ...v, supplierId, supplierName: supplier?.supplierName ?? '', supplierPhone: supplier?.phone ?? '' }));
  };

  const handleSubmit = () => {
    if (!values.code.trim() || !values.name.trim() || !values.supplierId) return;
    onSubmit(values);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Hủy bỏ
      </Button>
      <Button onClick={handleSubmit}>Lưu dịch vụ</Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingService ? 'Chỉnh sửa dịch vụ NCC' : 'Thêm dịch vụ NCC'}
      subtitle="Điền các thông tin chi tiết về dịch vụ do nhà cung cấp cung ứng."
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-code">
              Mã dịch vụ NCC *
            </label>
            <Input id="ncc-code" value={values.code} onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-category">
              Danh mục
            </label>
            <Select
              id="ncc-category"
              value={values.category}
              onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
              options={SUPPLIER_SERVICE_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClassName} htmlFor="ncc-name">
            Tên dịch vụ NCC *
          </label>
          <Input
            id="ncc-name"
            placeholder="Vd: Cho thuê âm thanh ánh sáng..."
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-supplier">
              Nhà cung cấp *
            </label>
            <Select
              id="ncc-supplier"
              value={values.supplierId}
              onChange={(e) => handleSelectSupplier(e.target.value)}
              options={suppliers.map((s) => ({ value: s.supplierId, label: s.supplierName }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-supplier-phone">
              Số điện thoại NCC
            </label>
            <Input id="ncc-supplier-phone" value={values.supplierPhone} disabled readOnly />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-unit">
              Đơn vị tính
            </label>
            <Select
              id="ncc-unit"
              value={values.unit}
              onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
              options={SUPPLIER_SERVICE_UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-price">
              Giá tham khảo (VNĐ) *
            </label>
            <Input
              id="ncc-price"
              type="number"
              value={values.referencePrice || ''}
              onChange={(e) => setValues((v) => ({ ...v, referencePrice: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="ncc-status">
              Trạng thái
            </label>
            <Select
              id="ncc-status"
              value={values.status}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as SupplierServiceStatus }))}
              options={(Object.keys(SUPPLIER_SERVICE_STATUS_META) as SupplierServiceStatus[]).map((s) => ({
                value: s,
                label: SUPPLIER_SERVICE_STATUS_META[s].label,
              }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClassName} htmlFor="ncc-description">
            Mô tả chi tiết
          </label>
          <Textarea
            id="ncc-description"
            rows={3}
            placeholder="Nhập mô tả chi tiết dịch vụ, quy cách/số lượng đi kèm..."
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClassName} htmlFor="ncc-image">
            Hình ảnh minh họa (URL)
          </label>
          <Input
            id="ncc-image"
            placeholder="https://images.unsplash.com/photo-..."
            value={values.imageUrl}
            onChange={(e) => setValues((v) => ({ ...v, imageUrl: e.target.value }))}
          />
          <p className="text-xs text-slate-400">Sử dụng liên kết hình ảnh Unsplash có sẵn để hiển thị đẹp mắt.</p>
        </div>

        {values.imageUrl && (
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabelClassName}>Xem trước ảnh</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL ảnh minh họa nhập tay, không thuộc domain đã cấu hình next/image */}
            <img src={values.imageUrl} alt="Xem trước hình ảnh dịch vụ NCC" className="h-32 w-full rounded-lg object-cover" />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SupplierServiceFormModal;
