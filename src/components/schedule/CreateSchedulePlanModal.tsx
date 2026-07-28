'use client';

import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { workTaskApiService } from '@/services/workTask.service';
import { userApiService } from '@/services/user.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { WorkTask } from '@/types/workTask';
import type { AdminUser } from '@/types/user';

// Nút "Tạo lịch trình" ở tab "Lịch trình & Kỹ thuật" (docs/lichtrinhkythuat_api.md) — tạo 1
// `schedule_plans` mới cho đơn hàng đang xem, gán sẵn nhân sự phụ trách ngay lúc tạo.
//
// Xác nhận qua curl thật 2026-07-21: `POST /schedule-plans` KHÔNG thật sự gán được người dù nhận
// field `assignedTo` (validate qua nhưng bị bỏ qua ở service, response luôn `assignees: []`) — phải
// gọi thêm `POST /schedule-plans/:id/assignees` (`schedulePlanApiService.addAssignee`) riêng cho từng
// người sau khi tạo plan thành công (xem đính chính ở đầu `types/schedulePlan.ts`).

const STAFF_ROLES = new Set(['MANAGER', 'STAFF']);
const ASSIGNEE_ROLE_LABEL: Record<string, string> = {
  LEADER: 'Trưởng nhóm kỹ thuật',
  TECHNICAL: 'Nhân viên kỹ thuật',
};

interface AssigneeDraft {
  key: string;
  userId: string;
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;
  return `sp-assignee-${draftKeySeq}`;
}

interface CreateSchedulePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  defaultLocation?: string;
  onCreated: () => void;
}

export default function CreateSchedulePlanModal({ isOpen, onClose, orderId, defaultLocation, onCreated }: Readonly<CreateSchedulePlanModalProps>) {
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [staff, setStaff] = useState<AdminUser[]>([]);

  const [taskId, setTaskId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [assignees, setAssignees] = useState<AssigneeDraft[]>([{ key: nextDraftKey(), userId: '' }]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTaskId('');
    setStartTime('');
    setEndTime('');
    setLocation(defaultLocation ?? '');
    setNotes('');
    setAssignees([{ key: nextDraftKey(), userId: '' }]);
    setError(null);
    workTaskApiService.getWorkTasks({ isActive: true }).then((res) => setWorkTasks(res.data ?? []));
    userApiService
      .getUsers({ limit: 100 })
      .then((res) => setStaff((res.data ?? []).filter((u: AdminUser) => STAFF_ROLES.has(u.role))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId]);

  const staffById = new Map(staff.map((u) => [u.userId, u]));
  const selectedUserIds = new Set(assignees.map((a) => a.userId).filter(Boolean));

  const optionsForRow = (rowUserId: string) =>
    staff
      .filter((u) => u.userId === rowUserId || !selectedUserIds.has(u.userId))
      .map((u) => ({ value: u.userId, label: `${u.fullName} (${ASSIGNEE_ROLE_LABEL[u.role] ?? u.role})` }));

  const addAssigneeRow = () => setAssignees((prev) => [...prev, { key: nextDraftKey(), userId: '' }]);
  const removeAssigneeRow = (key: string) => setAssignees((prev) => prev.filter((a) => a.key !== key));
  const updateAssigneeRow = (key: string, userId: string) =>
    setAssignees((prev) => prev.map((a) => (a.key === key ? { ...a, userId } : a)));

  const handleSubmit = async () => {
    const filledAssignees = assignees.filter((a) => a.userId);
    if (!taskId || !startTime) {
      setError('Vui lòng chọn loại việc và thời gian bắt đầu.');
      return;
    }
    if (filledAssignees.length === 0) {
      setError('Vui lòng chọn ít nhất 1 nhân sự phụ trách.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const planRes = await schedulePlanApiService.createSchedulePlan({
        orderId,
        taskId,
        startTime: new Date(startTime).toISOString(),
        ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      const planId = planRes.data.planId as string;

      try {
        await Promise.all(
          filledAssignees.map((a) => {
            const role = staffById.get(a.userId)?.role === 'MANAGER' ? 'LEAD' : 'TECHNICAL';
            return schedulePlanApiService.addAssignee(planId, { userId: a.userId, role });
          }),
        );
      } catch {
        setError('Đã tạo lịch trình nhưng gán nhân sự thất bại một phần — vui lòng mở lại kế hoạch vừa tạo và kiểm tra lại.');
        onCreated();
        setIsSubmitting(false);
        return;
      }

      onCreated();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message ?? 'Không thể tạo lịch trình. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo lịch trình mới"
      subtitle="Lập lịch thi công/kỹ thuật và phân công nhân sự phụ trách cho đơn hàng này."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Tạo lịch trình
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Loại việc"
          required
          placeholder="-- Chọn loại việc --"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          options={workTasks.map((t) => ({ value: t.taskId, label: t.taskName }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input type="datetime-local" label="Thời gian bắt đầu" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input type="datetime-local" label="Thời gian kết thúc (nếu có)" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <Input label="Địa điểm (mặc định theo địa điểm sự kiện)" value={location} onChange={(e) => setLocation(e.target.value)} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Nhân sự phụ trách <span className="text-red-500">*</span>
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={addAssigneeRow} disabled={selectedUserIds.size >= staff.length}>
              <Plus className="h-4 w-4" />
              Thêm nhân sự
            </Button>
          </div>
          <div className="space-y-2">
            {assignees.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    placeholder="-- Chọn nhân sự --"
                    value={row.userId}
                    onChange={(e) => updateAssigneeRow(row.key, e.target.value)}
                    options={optionsForRow(row.userId)}
                  />
                </div>
                {assignees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAssigneeRow(row.key)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Bỏ nhân sự này"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sp-notes" className="text-sm font-medium text-gray-700">
            Ghi chú
          </label>
          <textarea
            id="sp-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lưu ý về thiết bị, lối vào, giờ giấc..."
            className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
