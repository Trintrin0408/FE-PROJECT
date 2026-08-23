'use client';

import { FormEvent, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type { ItemCategory } from '@/types/catalog';

export interface CategoryFormValues {
  categoryName: string;
  description: string;
}

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  category?: ItemCategory | null;
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (values: CategoryFormValues) => void;
}

const EMPTY_VALUES: CategoryFormValues = {
  categoryName: '',
  description: '',
};

export function CategoryFormModal({ isOpen, onClose, mode, category, isSubmitting, errorMessage, onSubmit }: Readonly<CategoryFormModalProps>) {
  const [values, setValues] = useState<CategoryFormValues>(EMPTY_VALUES);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        mode === 'edit' && category
          ? { categoryName: category.categoryName, description: category.description ?? '' }
          : EMPTY_VALUES,
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
      <Button type="submit" form="category-form" isLoading={isSubmitting}>
        {mode === 'create' ? 'Tạo danh mục' : 'Lưu thay đổi'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo danh mục thiết bị' : 'Chỉnh sửa danh mục'}
      subtitle={mode === 'create' ? 'Thêm một danh mục mới để phân nhóm thiết bị.' : `Cập nhật danh mục "${category?.categoryName ?? ''}".`}
      size="lg"
      footer={footer}
    >
      <form id="category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Tên danh mục"
          required
          placeholder="VD: Trang thiết bị âm thanh"
          value={values.categoryName}
          onChange={(e) => setValues((v) => ({ ...v, categoryName: e.target.value }))}
        />
        <Textarea
          id="category-description"
          label="Mô tả"
          rows={3}
          placeholder="Mô tả ngắn về danh mục này..."
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
        />

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{errorMessage}</p>
        )}
      </form>
    </Modal>
  );
}

export default CategoryFormModal;
