'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { userApiService } from '@/services/user.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { AdminUser } from '@/types/user';
import type { SchedulePlan } from '@/types/schedulePlan';

type AssignMode = 'survey' | 'execution';

interface AssignStaffModalProps {
  isOpen: boolean;
  mode: AssignMode;
  orderId: string;
  taskId: string | null;
  onClose: () => void;
  onAssigned: (plan: SchedulePlan) => void;
}

// GET /users trả role raw enum (không hậu tố _STAFF) — xem docs/more-require.md. Backend refactor
// 2026-07-26 gộp LEADER/TECHNICAL thành 1 role STAFF chung (Leader/Technical giờ chỉ là vai trò gán
// theo từng schedule_plan, không còn phân biệt được ở tài khoản).

// Tạo 1 SchedulePlan mới (orderId+taskId+assignedTo+startTime) — không có endpoint sửa assignedTo
// của plan đã tồn tại, nên "đổi người khảo sát" cũng tạo plan mới thay vì sửa tại chỗ.
export default function AssignStaffModal({ isOpen, mode, orderId, taskId, onClose, onAssigned }: Readonly<AssignStaffModalProps>) {
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset form state khi mở modal, không phải vòng lặp render */
    setError(null);
    setUserId('');
    setStartTime('');
    setLocation('');
    /* eslint-enable react-hooks/set-state-in-effect */
    userApiService
      .getUsers({ limit: 100 })
      .then((res) => {
        const list: AdminUser[] = (res.data ?? []).filter((u: AdminUser) => u.role === 'STAFF');
        setStaff(list);
      })
      .catch(() => setStaff([]));
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!taskId || !userId || !startTime) {
      setError('Vui lòng chọn nhân sự và thời gian thực hiện.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await schedulePlanApiService.createSchedulePlan({
        orderId,
        taskId,
        assignedTo: userId,
        startTime: new Date(startTime).toISOString(),
        location: location.trim() || undefined,
      });
      const user = staff.find((u) => u.userId === userId);
      onAssigned({
        planId: res.data?.planId ?? '',
        planCode: '',
        orderId,
        taskId,
        assignedTo: userId,
        startTime: new Date(startTime).toISOString(),
        location: location.trim() || undefined,
        status: 'PENDING',
        createdBy: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assigneeName: user?.fullName,
      });
      onClose();
    } catch {
      setError('Không thể phân công. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'survey' ? 'Đổi người khảo sát' : 'Phân công nhân sự thi công'}
      subtitle={mode === 'survey' ? 'Chọn khảo sát viên phụ trách đơn hàng.' : 'Thêm nhân sự vào ca thi công.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Phân công
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Nhân sự"
          required
          placeholder="Chọn nhân sự"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          options={staff.map((u) => ({ value: u.userId, label: `${u.fullName} (${u.username})` }))}
        />
        <Input type="datetime-local" label="Thời gian thực hiện" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label="Địa điểm (không bắt buộc)" value={location} onChange={(e) => setLocation(e.target.value)} />
        {staff.length === 0 && <p className="text-xs text-amber-600">Không tải được danh sách nhân sự.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
