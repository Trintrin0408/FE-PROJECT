'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { AdminEmployee, EMPLOYEE_ROLES, EmployeeRole, EmployeeStatus, nextAdminEmployeeId } from '@/mocks/db/employees';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee?: AdminEmployee | null;
  onSubmit: (values: Omit<AdminEmployee, 'id' | 'avatarColor' | 'assignedBookings'>) => void;
}

const AVATAR_COLOR_POOL = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-slate-600'];

function emptyValues(): Omit<AdminEmployee, 'id' | 'avatarColor' | 'assignedBookings'> {
  return { name: '', phone: '', email: '', role: EMPLOYEE_ROLES[0], status: 'active' };
}

export function EmployeeFormModal({ isOpen, onClose, editingEmployee, onSubmit }: Readonly<EmployeeFormModalProps>) {
  const [values, setValues] = useState(emptyValues);
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setValues(
        editingEmployee
          ? { name: editingEmployee.name, phone: editingEmployee.phone, email: editingEmployee.email, role: editingEmployee.role, status: editingEmployee.status }
          : emptyValues(),
      );
    }
  }

  const handleSubmit = () => {
    if (!values.name.trim() || !values.email.trim()) return;
    onSubmit(values);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Hủy bỏ
      </Button>
      <Button onClick={handleSubmit}>Lưu hồ sơ</Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingEmployee ? `Chỉnh sửa nhân sự · ${editingEmployee.id}` : 'Thêm nhân sự'}
      subtitle={editingEmployee ? undefined : `Mã nhân sự dự kiến: ${nextAdminEmployeeId()}`}
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <Input label="Họ và tên *" required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        <Input 
          label="Số điện thoại di động" 
          value={values.phone} 
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} 
          pattern="^0[0-9]{9}$" 
          title="Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số"
        />
        <Input
          label="Thư điện tử doanh nghiệp (Email) *"
          required
          type="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Vai trò chuyên môn"
            value={values.role}
            onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as EmployeeRole }))}
            options={EMPLOYEE_ROLES.map((r) => ({ value: r, label: r }))}
          />
          <Select
            label="Trạng thái vận hành"
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as EmployeeStatus }))}
            options={[
              { value: 'active', label: 'Đang trực' },
              { value: 'inactive', label: 'Ngoại tuyến' },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}

export default EmployeeFormModal;

export function randomAvatarColor(): string {
  return AVATAR_COLOR_POOL[Math.floor(Math.random() * AVATAR_COLOR_POOL.length)];
}
