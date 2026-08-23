'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  BUSINESS_SERVICE_CATEGORY_OPTIONS,
  BUSINESS_SERVICE_STATUS_META,
  BusinessServicePackage,
  BusinessServiceStatus,
  nextBusinessServiceCode,
} from '@/mocks/db/catalog';

interface BusinessServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingService?: BusinessServicePackage | null;
  onSubmit: (values: Omit<BusinessServicePackage, 'id' | 'updatedAt'>) => void;
}

const fieldLabelClassName = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function emptyValues(): Omit<BusinessServicePackage, 'id' | 'updatedAt'> {
  return {
    code: nextBusinessServiceCode(),
    category: BUSINESS_SERVICE_CATEGORY_OPTIONS[0],
    name: '',
    priceFrom: 0,
    status: 'active',
    shortDescription: '',
    detailDescription: '',
    imageUrl: '',
  };
}

export function BusinessServiceFormModal({ isOpen, onClose, editingService, onSubmit }: Readonly<BusinessServiceFormModalProps>) {
  const [values, setValues] = useState(emptyValues);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        editingService
          ? {
              code: editingService.code,
              category: editingService.category,
              name: editingService.name,
              priceFrom: editingService.priceFrom,
              status: editingService.status,
              shortDescription: editingService.shortDescription,
              detailDescription: editingService.detailDescription,
              imageUrl: editingService.imageUrl,
            }
          : emptyValues(),
      );
    }
  }

  const handleSubmit = () => {
    if (!values.code.trim() || !values.name.trim()) return;
    onSubmit({
      ...values,
      shortDescription: values.shortDescription.trim() || values.detailDescription.slice(0, 120),
    });
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
      title={editingService ? 'Chỉnh sửa dịch vụ doanh nghiệp' : 'Thêm dịch vụ doanh nghiệp'}
      subtitle="Điền các thông tin chi tiết về gói dịch vụ của doanh nghiệp."
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="biz-code">
              Mã dịch vụ *
            </label>
            <Input id="biz-code" value={values.code} onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="biz-category">
              Phân loại danh mục
            </label>
            <Select
              id="biz-category"
              value={values.category}
              onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
              options={BUSINESS_SERVICE_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClassName} htmlFor="biz-name">
            Tên dịch vụ / Gói tiệc *
          </label>
          <Input
            id="biz-name"
            placeholder="Gói Tiệc Teabreak Cao Cấp,..."
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="biz-price">
              Đơn giá khởi điểm (VNĐ) *
            </label>
            <Input
              id="biz-price"
              type="number"
              value={values.priceFrom || ''}
              onChange={(e) => setValues((v) => ({ ...v, priceFrom: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabelClassName} htmlFor="biz-status">
              Trạng thái cung cấp
            </label>
            <Select
              id="biz-status"
              value={values.status}
              onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as BusinessServiceStatus }))}
              options={(Object.keys(BUSINESS_SERVICE_STATUS_META) as BusinessServiceStatus[]).map((s) => ({
                value: s,
                label: BUSINESS_SERVICE_STATUS_META[s].label,
              }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClassName} htmlFor="biz-description">
            Mô tả chi tiết / Nội dung gói dịch vụ
          </label>
          <Textarea
            id="biz-description"
            rows={4}
            placeholder="Nhập mô tả chi tiết, quy mô phục vụ, thiết bị đi kèm..."
            value={values.detailDescription}
            onChange={(e) => setValues((v) => ({ ...v, detailDescription: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={fieldLabelClassName} htmlFor="biz-image">
            Hình ảnh minh họa (URL)
          </label>
          <Input
            id="biz-image"
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
            <img src={values.imageUrl} alt="Xem trước hình ảnh dịch vụ" className="h-32 w-full rounded-lg object-cover" />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default BusinessServiceFormModal;
