'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { AdminEquipment, CreateEquipmentInput, EQUIPMENT_CATEGORY_OPTIONS, EquipmentStatus } from '@/mocks/db/catalog';

interface EquipmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: AdminEquipment | null;
  onSubmit: (values: CreateEquipmentInput) => void;
}

const EMPTY_VALUES: CreateEquipmentInput = {
  name: '',
  category: EQUIPMENT_CATEGORY_OPTIONS[0],
  unit: 'Cái',
  price: 0,
  specs: '',
  dimensions: '',
  material: '',
  replacementValue: 0,
  installRequired: false,
  status: 'active',
  initialStock: 0,
  location: '',
};

export function EquipmentFormModal({ isOpen, onClose, equipment, onSubmit }: Readonly<EquipmentFormModalProps>) {
  const [values, setValues] = useState<CreateEquipmentInput>(EMPTY_VALUES);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        equipment
          ? {
              name: equipment.name,
              category: equipment.category,
              unit: equipment.unit,
              price: equipment.price,
              specs: equipment.specs,
              dimensions: equipment.dimensions,
              material: equipment.material,
              replacementValue: equipment.replacementValue,
              installRequired: equipment.installRequired,
              status: equipment.status,
              initialStock: equipment.totalStock,
              location: equipment.location,
            }
          : EMPTY_VALUES,
      );
    }
  }

  const isEditing = Boolean(equipment);

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Hủy bỏ
      </Button>
      <Button onClick={() => onSubmit(values)} disabled={!values.name.trim()}>
        {isEditing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Chỉnh sửa · ${equipment?.id}` : 'Thêm sản phẩm & thiết bị'}
      subtitle={isEditing ? undefined : 'Tạo mới một sản phẩm/thiết bị trong danh mục kho doanh nghiệp.'}
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <Input label="Tên sản phẩm & thiết bị" required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Danh mục"
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            options={EQUIPMENT_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
          />
          <Input label="Đơn vị tính" value={values.unit} onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Đơn giá thuê (VNĐ)"
            type="number"
            value={values.price}
            onChange={(e) => setValues((v) => ({ ...v, price: Number(e.target.value) || 0 }))}
          />
          <Input
            label="Giá trị đền bù khi mất/hỏng (VNĐ)"
            type="number"
            value={values.replacementValue}
            onChange={(e) => setValues((v) => ({ ...v, replacementValue: Number(e.target.value) || 0 }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Kích thước" value={values.dimensions} onChange={(e) => setValues((v) => ({ ...v, dimensions: e.target.value }))} />
          <Input label="Chất liệu" value={values.material} onChange={(e) => setValues((v) => ({ ...v, material: e.target.value }))} />
        </div>
        <Textarea
          id="equipment-specs"
          label="Mô tả kỹ thuật / thông số"
          rows={2}
          value={values.specs}
          onChange={(e) => setValues((v) => ({ ...v, specs: e.target.value }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Vị trí kho" value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} />
          {!isEditing && (
            <Input
              label="Tồn kho ban đầu"
              type="number"
              value={values.initialStock}
              onChange={(e) => setValues((v) => ({ ...v, initialStock: Number(e.target.value) || 0 }))}
            />
          )}
          <Select
            label="Trạng thái"
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as EquipmentStatus }))}
            options={[
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Ngừng kinh doanh' },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.installRequired}
            onChange={(e) => setValues((v) => ({ ...v, installRequired: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Cần nhân sự lắp đặt/thi công riêng
        </label>
      </div>
    </Modal>
  );
}

export default EquipmentFormModal;
