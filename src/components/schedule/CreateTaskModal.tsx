'use client';

import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { orderApiService } from '@/services/order.service';
import { customerApiService } from '@/services/customer.service';
import { workTaskApiService } from '@/services/workTask.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { userApiService } from '@/services/user.service';
import type { Order } from '@/types/order';
import type { Customer } from '@/types/customer';
import type { WorkTask } from '@/types/workTask';
import type { AdminUser } from '@/types/user';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STAFF_ROLES = new Set(['MANAGER', 'STAFF']);

// Tạo 1 SchedulePlan mới — thay thế "Tạo công việc" (WorkTask instance) cũ. Chọn đơn hàng + loại
// việc (danh mục WorkTask tĩnh) + nhân sự phụ trách + thời gian trong 1 bước duy nhất (không còn
// bước "Phân công" riêng vì assignedTo là field bắt buộc lúc tạo).
export default function CreateTaskModal({ isOpen, onClose, onCreated }: Readonly<CreateTaskModalProps>) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [orderId, setOrderId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi mở modal, không phải vòng lặp render
    setOrderId('');
    setTaskId('');
    setAssignedTo('');
    setStartTime('');
    setLocation('');
    setError(null);
    // limit tối đa backend thật chấp nhận cho /orders và /customers là 100 (400 VALIDATION_ERROR nếu
    // vượt quá).
    orderApiService.getOrders({ limit: 100 }).then((res) => setOrders(res.data ?? []));
    customerApiService.getCustomers({ limit: 100 }).then((res) => setCustomers(res.data ?? []));
    workTaskApiService.getWorkTasks({ isActive: true }).then((res) => setWorkTasks(res.data ?? []));
    userApiService
      .getUsers({ limit: 100 })
      .then((res) => setStaff((res.data ?? []).filter((u: AdminUser) => STAFF_ROLES.has(u.role))));
  }, [isOpen]);

  const customerById = new Map(customers.map((c) => [c.customerId, c]));
  const orderOptions = orders.map((o) => ({
    value: o.orderId,
    label: `${o.orderCode} — ${customerById.get(o.customerId)?.customerName ?? `KH #${o.customerId}`}`,
  }));

  const handleSubmit = async () => {
    if (!orderId || !taskId || !assignedTo || !startTime) {
      setError('Vui lòng nhập đầy đủ đơn hàng, loại việc, nhân sự và thời gian bắt đầu.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await schedulePlanApiService.createSchedulePlan({
        orderId,
        taskId,
        assignedTo,
        startTime: new Date(startTime).toISOString(),
        location: location.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message ?? 'Không thể tạo kế hoạch. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo kế hoạch mới"
      subtitle="Giao việc khảo sát hoặc vận hành thi công cho một đơn hàng."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Tạo kế hoạch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Đơn hàng liên kết"
          required
          placeholder="-- Chọn đơn hàng --"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          options={orderOptions}
        />

        <Select
          label="Loại công việc"
          required
          placeholder="-- Chọn loại công việc --"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          options={workTasks.map((t) => ({ value: t.taskId, label: t.taskName }))}
        />

        <Select
          label="Nhân sự phụ trách"
          required
          placeholder="-- Chọn nhân sự --"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={staff.map((u) => ({ value: u.userId, label: `${u.fullName} (${u.username})` }))}
        />

        <Input type="datetime-local" label="Thời gian bắt đầu" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />

        <Input label="Địa điểm (nếu khác địa điểm sự kiện)" value={location} onChange={(e) => setLocation(e.target.value)} />

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
