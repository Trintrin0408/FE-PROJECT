'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectOptionGroup } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { workTaskApiService } from '@/services/workTask.service';
import { userApiService } from '@/services/user.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { useStaffConflictPlans, type StaffConflictDateWindow } from '@/hooks/useStaffConflictPlans';
import { buildStaffConflictMap, type StaffConflict } from '@/utils/staffAvailability';
import { formatTime } from '@/utils/formatDate';
import type { WorkTask } from '@/types/workTask';
import type { AdminUser } from '@/types/user';

// Nút "Tạo lịch trình" ở tab "Lịch trình & Kỹ thuật" (docs/lichtrinhkythuat_api.md) — tạo 1
// `schedule_plans` mới cho đơn hàng đang xem, gán sẵn nhân sự phụ trách ngay lúc tạo.
//
// Xác nhận qua curl thật 2026-07-21: `POST /schedule-plans` KHÔNG thật sự gán được người dù nhận
// field `assignedTo` (validate qua nhưng bị bỏ qua ở service, response luôn `assignees: []`) — phải
// gọi thêm `POST /schedule-plans/:id/assignees` (`schedulePlanApiService.addAssignee`) riêng cho từng
// người sau khi tạo plan thành công (xem đính chính ở đầu `types/schedulePlan.ts`).
//
// Backend refactor 2026-07-26 (commit 4157a7f): gộp LEADER/TECHNICAL thành 1 role STAFF chung — vai
// trò LEAD/TECHNICAL không còn suy ra được từ tài khoản, giờ Manager phải tự chọn khi gán từng người
// vào kế hoạch (PlanMemberRole). Backend chỉ cho tối đa 1 người vai trò LEAD/kế hoạch
// (schedule.service.ts: assertAtMostOneLead / 409 LEAD_ALREADY_ASSIGNED) — form dưới tự đảm bảo
// ràng buộc này trước khi submit.

type AssigneeRole = 'LEAD' | 'TECHNICAL';

interface AssigneeDraft {
  key: string;
  userId: string;
  role: AssigneeRole;
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
  /** Ngày tổ chức sự kiện (ISO) — dùng để chặn khảo sát/lắp đặt lên lịch sau ngày diễn ra. */
  eventDate?: string;
  /** `taskName` của loại việc vừa tạo — cho phép trang cha tự quyết định có cần chuyển mốc tiến trình đơn hay không. */
  onCreated: (taskName: string) => void;
}

// datetime-local input cần định dạng "yyyy-MM-ddTHH:mm" theo giờ local (không phải ISO UTC).
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Yêu cầu nghiệp vụ: khảo sát hiện trường & lắp đặt thiết bị phải diễn ra trước ngày tổ chức sự kiện.
function isDateRestrictedTaskName(taskName: string | undefined): boolean {
  if (!taskName) return false;
  return /khảo sát|lắp đặt/i.test(taskName);
}

function getStartTimeError(startTime: string, eventDate: string | undefined, isRestricted: boolean): string | undefined {
  if (!startTime) return undefined;
  const start = new Date(startTime);
  if (start.getTime() < Date.now()) return 'Không thể chọn thời gian trong quá khứ.';
  if (isRestricted && eventDate && start.getTime() >= new Date(eventDate).getTime()) {
    return 'Thời gian bắt đầu phải trước ngày diễn ra sự kiện.';
  }
  return undefined;
}

function getEndTimeError(startTime: string, endTime: string, eventDate: string | undefined, isRestricted: boolean): string | undefined {
  if (!endTime) return undefined;
  const end = new Date(endTime);
  if (startTime && end.getTime() <= new Date(startTime).getTime()) {
    return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  }
  if (end.getTime() < Date.now()) return 'Không thể chọn thời gian trong quá khứ.';
  if (isRestricted && eventDate && end.getTime() >= new Date(eventDate).getTime()) {
    return 'Thời gian kết thúc phải trước ngày diễn ra sự kiện.';
  }
  return undefined;
}

export default function CreateSchedulePlanModal({ isOpen, onClose, orderId, defaultLocation, eventDate, onCreated }: Readonly<CreateSchedulePlanModalProps>) {
  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [staff, setStaff] = useState<AdminUser[]>([]);

  const [taskId, setTaskId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [assignees, setAssignees] = useState<AssigneeDraft[]>([{ key: nextDraftKey(), userId: '', role: 'LEAD' }]);

  const [error, setError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTaskId('');
    setStartTime('');
    setEndTime('');
    setLocation(defaultLocation ?? '');
    setNotes('');
    setAssignees([{ key: nextDraftKey(), userId: '', role: 'LEAD' }]);
    setError(null);
    setAttemptedSubmit(false);
    workTaskApiService.getWorkTasks({ isActive: true }).then((res) => setWorkTasks(res.data ?? []));
    userApiService
      .getUsers({ role: 'STAFF', limit: 100 })
      .then((res) => setStaff(res.data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId]);

  const selectedUserIds = new Set(assignees.map((a) => a.userId).filter(Boolean));

  const selectedTaskName = workTasks.find((t) => t.taskId === taskId)?.taskName;
  const isDateRestricted = isDateRestrictedTaskName(selectedTaskName);

  // Check trùng lịch nhân sự: lấy toàn bộ lịch trình (mọi đơn) giao với ngày của khung giờ đang chọn,
  // rồi lọc chính xác theo giờ ở client (useStaffConflictPlans/buildStaffConflictMap) — chỉ để CẢNH
  // BÁO MỀM, không chặn chọn người đang bận (xác nhận với người dùng: không có ràng buộc backend nào
  // cấm 1 người nhận nhiều việc trùng giờ, Manager tự quyết định).
  const conflictDateWindow: StaffConflictDateWindow | null = startTime
    ? { from: startTime.slice(0, 10), to: (endTime || startTime).slice(0, 10) }
    : null;
  const { plans: conflictPlans, isLoading: checkingConflicts } = useStaffConflictPlans(conflictDateWindow);
  const conflictMap: Map<string, StaffConflict[]> = useMemo(
    () => (startTime ? buildStaffConflictMap(conflictPlans, startTime, endTime || undefined) : new Map()),
    [conflictPlans, startTime, endTime],
  );

  const nowInputValue = toLocalInputValue(new Date());
  const eventDateInputValue = eventDate ? toLocalInputValue(new Date(eventDate)) : undefined;

  const taskIdError = attemptedSubmit && !taskId ? 'Vui lòng chọn loại việc.' : undefined;
  const startTimeRequiredError = attemptedSubmit && !startTime ? 'Vui lòng nhập thời gian bắt đầu.' : undefined;
  const startTimeError = startTimeRequiredError ?? getStartTimeError(startTime, eventDate, isDateRestricted);
  const endTimeError = getEndTimeError(startTime, endTime, eventDate, isDateRestricted);
  const assigneesError =
    attemptedSubmit && assignees.filter((a) => a.userId).length === 0 ? 'Vui lòng chọn ít nhất 1 nhân sự phụ trách.' : undefined;

  const optionsForRow = (rowUserId: string): SelectOptionGroup[] => {
    const selectable = staff.filter((u) => u.userId === rowUserId || !selectedUserIds.has(u.userId));
    const free = selectable.filter((u) => !conflictMap.get(u.userId)?.length);
    const busy = selectable.filter((u) => (conflictMap.get(u.userId)?.length ?? 0) > 0);
    const groups: SelectOptionGroup[] = [
      { label: 'Nhân sự rảnh', options: free.map((u) => ({ value: u.userId, label: `${u.fullName} (${u.username})` })) },
    ];
    if (busy.length > 0) {
      groups.push({
        label: 'Nhân sự đang bận (trùng lịch)',
        options: busy.map((u) => {
          const conflict = conflictMap.get(u.userId)![0];
          const timeRange = conflict.endTime ? `${formatTime(conflict.startTime)}–${formatTime(conflict.endTime)}` : formatTime(conflict.startTime);
          const extra = (conflictMap.get(u.userId)?.length ?? 0) > 1 ? ` +${conflictMap.get(u.userId)!.length - 1} việc khác` : '';
          return {
            value: u.userId,
            label: `${u.fullName} (${u.username}) — Bận ${timeRange} (${conflict.orderCode ?? conflict.planCode})${extra}`,
          };
        }),
      });
    }
    return groups;
  };

  const addAssigneeRow = () => setAssignees((prev) => [...prev, { key: nextDraftKey(), userId: '', role: 'TECHNICAL' }]);
  const removeAssigneeRow = (key: string) =>
    setAssignees((prev) => {
      const next = prev.filter((a) => a.key !== key);
      // Nếu dòng bị xóa đang là Trưởng nhóm, tự đôn dòng đầu tiên còn lại lên Trưởng nhóm — luôn phải có 1 Trưởng nhóm.
      if (next.length > 0 && !next.some((a) => a.role === 'LEAD')) {
        next[0] = { ...next[0], role: 'LEAD' };
      }
      return next;
    });
  const updateAssigneeRow = (key: string, userId: string) =>
    setAssignees((prev) => prev.map((a) => (a.key === key ? { ...a, userId } : a)));
  // Backend chỉ cho tối đa 1 LEAD/kế hoạch, và luôn phải có đúng 1 Trưởng nhóm — chọn LEAD ở 1 dòng
  // tự đổi các dòng khác về TECHNICAL; nút chuyển dòng đang là LEAD về TECHNICAL bị vô hiệu hóa (JSX
  // bên dưới) để tránh mất Trưởng nhóm — muốn đổi Trưởng nhóm thì bấm "Trưởng nhóm" ở dòng khác.
  const setAssigneeRowRole = (key: string, role: AssigneeRole) =>
    setAssignees((prev) =>
      prev.map((a) => {
        if (a.key === key) return { ...a, role };
        return role === 'LEAD' ? { ...a, role: 'TECHNICAL' } : a;
      }),
    );

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    const filledAssignees = assignees.filter((a) => a.userId);
    const hasBlockingError =
      !taskId ||
      !startTime ||
      !!getStartTimeError(startTime, eventDate, isDateRestricted) ||
      !!getEndTimeError(startTime, endTime, eventDate, isDateRestricted) ||
      filledAssignees.length === 0;
    if (hasBlockingError) return;

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
      const createdTaskName = workTasks.find((t) => t.taskId === taskId)?.taskName ?? '';

      try {
        await Promise.all(
          filledAssignees.map((a) => schedulePlanApiService.addAssignee(planId, { userId: a.userId, role: a.role })),
        );
      } catch {
        setError('Đã tạo lịch trình nhưng gán nhân sự thất bại một phần — vui lòng mở lại kế hoạch vừa tạo và kiểm tra lại.');
        onCreated(createdTaskName);
        setIsSubmitting(false);
        return;
      }

      onCreated(createdTaskName);
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
          error={taskIdError}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="datetime-local"
            label="Thời gian bắt đầu"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            min={nowInputValue}
            max={isDateRestricted ? eventDateInputValue : undefined}
            error={startTimeError}
            helpText={isDateRestricted ? 'Loại việc này phải diễn ra trước ngày tổ chức sự kiện.' : undefined}
          />
          <Input
            type="datetime-local"
            label="Thời gian kết thúc (nếu có)"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            min={startTime || nowInputValue}
            max={isDateRestricted ? eventDateInputValue : undefined}
            error={endTimeError}
          />
        </div>

        <Input label="Địa điểm (mặc định theo địa điểm sự kiện)" value={location} onChange={(e) => setLocation(e.target.value)} />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              Nhân sự phụ trách <span className="text-red-500">*</span>
              {checkingConflicts && (
                <span className="flex items-center gap-1 text-xs font-normal text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang kiểm tra lịch trùng...
                </span>
              )}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={addAssigneeRow} disabled={selectedUserIds.size >= staff.length}>
              <Plus className="h-4 w-4" />
              Thêm nhân sự
            </Button>
          </div>
          <div className="space-y-2">
            {assignees.map((row) => {
              const rowConflicts = row.userId ? conflictMap.get(row.userId) : undefined;
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        placeholder="-- Chọn nhân sự --"
                        value={row.userId}
                        onChange={(e) => updateAssigneeRow(row.key, e.target.value)}
                        options={optionsForRow(row.userId)}
                      />
                    </div>
                    <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setAssigneeRowRole(row.key, 'LEAD')}
                        className={`px-2.5 py-2 ${row.role === 'LEAD' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                      >
                        Trưởng nhóm
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssigneeRowRole(row.key, 'TECHNICAL')}
                        disabled={row.role === 'LEAD'}
                        title={row.role === 'LEAD' ? 'Chọn nhân sự khác làm Trưởng nhóm để đổi vai trò này.' : undefined}
                        className={`border-l border-slate-200 px-2.5 py-2 ${row.role === 'TECHNICAL' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white`}
                      >
                        Kỹ thuật viên
                      </button>
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
                  {rowConflicts && rowConflicts.length > 0 && (
                    <p className="flex items-start gap-1 pl-1 text-xs text-amber-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Trùng lịch:{' '}
                      {rowConflicts
                        .map((c) => `${c.orderCode ?? c.planCode} (${c.taskName ?? 'việc khác'}, ${formatTime(c.startTime)}${c.endTime ? `–${formatTime(c.endTime)}` : ''})`)
                        .join('; ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {assigneesError && <p className="mt-1 text-xs text-red-600">{assigneesError}</p>}
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
