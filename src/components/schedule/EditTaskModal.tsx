'use client';

import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { SchedulePlan } from '@/types/schedulePlan';

interface EditTaskModalProps {
  isOpen: boolean;
  plan: SchedulePlan | null;
  onClose: () => void;
  onUpdated: () => void;
}

// PUT /api/v1/schedule-plans/:id chỉ cho sửa khi status khác IN_PROGRESS/COMPLETED, và chỉ nhận
// startTime/endTime/location/notes (không đổi được taskId/assignedTo sau khi tạo).
export default function EditTaskModal({ isOpen, plan, onClose, onUpdated }: Readonly<EditTaskModalProps>) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !plan) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi mở modal, không phải vòng lặp render
    setStartTime(plan.startTime ? plan.startTime.slice(0, 16) : '');
    setEndTime(plan.endTime ? plan.endTime.slice(0, 16) : '');
    setLocation(plan.location ?? '');
    setError(null);
  }, [isOpen, plan]);

  const handleSubmit = async () => {
    if (!plan) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await schedulePlanApiService.updateSchedulePlan(plan.planId, {
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        location: location.trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message ?? 'Không thể cập nhật kế hoạch. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!plan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sửa kế hoạch"
      subtitle={plan.taskName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Chỉ chỉnh sửa được thời gian/địa điểm - không đổi được loại công việc hay nhân sự phụ trách sau khi tạo.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input type="datetime-local" label="Bắt đầu" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input type="datetime-local" label="Kết thúc" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <Input label="Địa điểm" value={location} onChange={(e) => setLocation(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
