'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { BusinessPolicy, PolicyType } from '@/types/policy';

export interface PolicyFormValues {
  policyCode: string;
  policyName: string;
  policyType: PolicyType;
  policyValue: number;
  unit: string;
  description: string;
  isActive: boolean;
}

interface PolicyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  policy?: BusinessPolicy | null;
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (values: PolicyFormValues) => void;
}

const POLICY_TYPE_OPTIONS: { value: PolicyType; label: string }[] = [
  { value: 'DEPOSIT', label: 'Đặt cọc' },
  { value: 'CANCELLATION', label: 'Hủy đơn & hoàn cọc' },
  { value: 'COMPENSATION', label: 'Đền bù thiết bị' },
  { value: 'FEE', label: 'Phụ phí' },
  { value: 'WAGE', label: 'Tiền công nhân sự' },
];

const EMPTY_VALUES: PolicyFormValues = {
  policyCode: '',
  policyName: '',
  policyType: 'DEPOSIT',
  policyValue: 0,
  unit: '',
  description: '',
  isActive: true,
};

const textareaClassName =
  'block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

export function PolicyFormModal({ isOpen, onClose, mode, policy, isSubmitting, errorMessage, onSubmit }: Readonly<PolicyFormModalProps>) {
  const [values, setValues] = useState<PolicyFormValues>(EMPTY_VALUES);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        (mode === 'edit' || mode === 'view') && policy
          ? {
              policyCode: policy.policyCode,
              policyName: policy.policyName,
              policyType: policy.policyType,
              policyValue: policy.policyValue,
              unit: policy.unit,
              description: policy.description ?? '',
              isActive: policy.isActive,
            }
          : EMPTY_VALUES,
      );
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
  };

  const footer = mode === 'view' ? (
    <Button type="button" variant="secondary" onClick={onClose}>
      Đóng
    </Button>
  ) : (
    <>
      <Button type="button" variant="secondary" onClick={onClose}>
        Hủy
      </Button>
      <Button type="submit" form="policy-form" isLoading={isSubmitting}>
        {mode === 'create' ? 'Tạo chính sách' : 'Lưu thay đổi'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo chính sách mới' : mode === 'edit' ? 'Chỉnh sửa chính sách' : 'Chi tiết chính sách'}
      subtitle={
        mode === 'create'
          ? 'Thêm một chính sách nghiệp vụ mới (cọc, hoàn cọc, đền bù, phụ phí, tiền công...).'
          : mode === 'edit' 
            ? `Cập nhật giá trị/trạng thái của chính sách "${policy?.policyName ?? ''}".`
            : `Thông tin chi tiết của chính sách "${policy?.policyName ?? ''}".`
      }
      size="lg"
      footer={footer}
    >
      {mode === 'view' ? (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{values.policyName}</h3>
              <p className="mt-1 font-mono text-sm text-slate-500">Mã: {values.policyCode}</p>
            </div>
            <Badge variant={values.isActive ? 'success' : 'neutral'}>
              {values.isActive ? 'Đang áp dụng' : 'Ngừng áp dụng'}
            </Badge>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 text-center shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wider text-blue-600">Mức giá trị áp dụng</p>
            <p className="mt-2 text-4xl font-bold text-blue-900">
              {values.policyValue.toLocaleString('vi-VN')} <span className="text-2xl font-medium text-blue-700">{values.unit}</span>
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Phân loại: {POLICY_TYPE_OPTIONS.find((o) => o.value === values.policyType)?.label}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700">Mô tả chi tiết</h4>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              {values.description || <span className="italic text-slate-400">Không có mô tả cho chính sách này.</span>}
            </div>
          </div>
        </div>
      ) : (
        <form id="policy-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Mã chính sách"
              required
              disabled={mode === 'edit'}
              placeholder="VD: HOAN-COC-30"
              value={values.policyCode}
              onChange={(e) => setValues((v) => ({ ...v, policyCode: e.target.value }))}
            />
            <Select
              label="Loại chính sách"
              disabled={mode === 'edit'}
              value={values.policyType}
              onChange={(e) => setValues((v) => ({ ...v, policyType: e.target.value as PolicyType }))}
              options={POLICY_TYPE_OPTIONS}
            />
          </div>
          <Input
            label="Tên chính sách"
            required
            disabled={mode === 'edit'}
            placeholder="VD: Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện"
            value={values.policyName}
            onChange={(e) => setValues((v) => ({ ...v, policyName: e.target.value }))}
          />
          {mode === 'edit' && (
            <p className="-mt-2 text-xs italic text-slate-400">Mã, loại và tên chính sách không thể sửa sau khi tạo — chỉ có thể đổi giá trị, đơn vị, mô tả và trạng thái.</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Giá trị"
              required
              type="number"
              value={values.policyValue}
              onChange={(e) => setValues((v) => ({ ...v, policyValue: Number(e.target.value) || 0 }))}
            />
            <Input
              label="Đơn vị"
              required
              placeholder="VD: %, km, VNĐ/buổi"
              value={values.unit}
              onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="policy-description" className="text-sm font-medium text-gray-700">
              Mô tả
            </label>
            <textarea
              id="policy-description"
              rows={3}
              className={textareaClassName}
              placeholder="Mô tả ngắn gọn nội dung/điều kiện áp dụng của chính sách này..."
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          </div>
          {mode === 'edit' && (
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Đang áp dụng</span>
            </label>
          )}

          {errorMessage && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{errorMessage}</p>
          )}
        </form>
      )}
    </Modal>
  );
}

export default PolicyFormModal;
