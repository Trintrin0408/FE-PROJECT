'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ItemType, ItemCategory } from '@/types/catalog';

export interface ItemTypeFormValues {
  categoryId: string;
  typeName: string;
  description: string;
}

interface ItemTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  type?: ItemType | null;
  defaultCategoryId?: string;
  categories: ItemCategory[];
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (values: ItemTypeFormValues) => void;
}

const textareaClassName =
  'block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

export function ItemTypeFormModal({
  isOpen,
  onClose,
  mode,
  type,
  defaultCategoryId,
  categories,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Readonly<ItemTypeFormModalProps>) {
  const [values, setValues] = useState<ItemTypeFormValues>({ categoryId: '', typeName: '', description: '' });
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        mode === 'edit' && type
          ? { categoryId: type.categoryId, typeName: type.typeName, description: type.description ?? '' }
          : { categoryId: defaultCategoryId ?? '', typeName: '', description: '' }
      );
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
  };

  const footer = (
    <>
      <Button type="button" variant="secondary" onClick={onClose}>
        Hủy
      </Button>
      <Button type="submit" form="item-type-form" isLoading={isSubmitting}>
        {mode === 'create' ? 'Tạo nhóm sản phẩm' : 'Lưu thay đổi'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo nhóm sản phẩm mới' : 'Chỉnh sửa nhóm sản phẩm'}
      footer={footer}
    >
      <form id="item-type-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Thuộc danh mục"
          required
          value={values.categoryId}
          onChange={(e) => setValues((v) => ({ ...v, categoryId: e.target.value }))}
          options={categories.map((c) => ({ value: c.categoryId, label: c.categoryName }))}
          placeholder="-- Chọn danh mục cha --"
        />
        <Input
          label="Tên nhóm sản phẩm"
          required
          value={values.typeName}
          onChange={(e) => setValues((v) => ({ ...v, typeName: e.target.value }))}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Mô tả</label>
          <textarea
            rows={3}
            className={textareaClassName}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}
      </form>
    </Modal>
  );
}
