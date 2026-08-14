'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectOptionGroup } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { AddressAutocompleteInput } from '@/components/ui/AddressAutocompleteInput';
import { userApiService } from '@/services/user.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { useStaffConflictPlans, type StaffConflictDateWindow } from '@/hooks/useStaffConflictPlans';
import { buildStaffConflictMap, type StaffConflict } from '@/utils/staffAvailability';
import { addDaysKey } from '@/utils/scheduleCalendar';
import { formatTime } from '@/utils/formatDate';
import { ROLE_LABEL, SCHEDULE_STATUS_BADGE, SCHEDULE_STATUS_LABEL } from '@/utils/schedulePlanGroups';
import { getEndTimeError, getStartTimeError, isDateRestrictedTaskName, toLocalInputValue } from '@/utils/schedulePlanValidation';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { AdminUser } from '@/types/user';

// Popup sửa 1 lịch trình cụ thể ngay tại tab "Lịch trình & Kỹ thuật" của đơn (yêu cầu người dùng
// 2026-08-04) — thay cho việc mở PlanFormDrawer (drawer lớn, trước đó bị lỗi luôn hiển thị TẤT CẢ
// lịch trình của đơn bất kể bấm "Sửa" ở thẻ nào). Validate ngày/giờ dùng chung
// `utils/schedulePlanValidation.ts` — cùng logic với CreateSchedulePlanModal.tsx.
//
// PUT /schedule-plans/:id (UpdateSchedulePlanPayload) KHÔNG nhận taskId — không đổi được loại việc
// sau khi tạo, chỉ hiển thị đọc. Backend cũng CHƯA có endpoint gỡ 1 người khỏi kế hoạch đã gán (chỉ có
// POST /schedule-plans/:id/assignees để thêm) — nhân sự đã gán hiển thị dạng chip chỉ đọc, phần "Thêm
// nhân sự" bên dưới chỉ cho thêm mới.

type AssigneeRole = 'LEAD' | 'TECHNICAL';

interface AssigneeDraft {
  key: string;
  userId: string;
  role: AssigneeRole;
}

let draftKeySeq = 0;
function nextDraftKey(): string {
  draftKeySeq += 1;
  return `esp-assignee-${draftKeySeq}`;
}

interface EditSchedulePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: SchedulePlan;
  /** Ngày tổ chức sự kiện (ISO) — dùng để chặn khảo sát/lắp đặt lên lịch sau ngày diễn ra. */
  eventDate?: string;
  /** Địa chỉ đơn hàng — dùng làm giá trị mặc định khi kế hoạch chưa có địa điểm riêng. */
  defaultLocation?: string;
  onUpdated: () => void;
}

export default function EditSchedulePlanModal({ isOpen, onClose, plan, eventDate, defaultLocation, onUpdated }: Readonly<EditSchedulePlanModalProps>) {
  const [staff, setStaff] = useState<AdminUser[]>([]);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [newAssignees, setNewAssignees] = useState<AssigneeDraft[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingAssignees = useMemo(() => plan.assignees ?? [], [plan.assignees]);
  const existingHasLead = existingAssignees.some((a) => a.role === 'LEAD');

  useEffect(() => {
    if (!isOpen) return;
    setStartTime(toLocalInputValue(new Date(plan.startTime)));
    setEndTime(plan.endTime ? toLocalInputValue(new Date(plan.endTime)) : '');
    setLocation(plan.location || defaultLocation || '');
    setLatitude(plan.latitude ?? undefined);
    setLongitude(plan.longitude ?? undefined);
    setNotes(plan.notes ?? '');
    setNewAssignees([]);
    setError(null);
    setAttemptedSubmit(false);
    userApiService.getUsers({ role: 'STAFF', limit: 100 }).then((res) => setStaff(res.data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, plan.planId]);

  const isDateRestricted = isDateRestrictedTaskName(plan.taskName);

  const existingAssigneeIds = new Set(existingAssignees.map((a) => a.userId));
  const selectedNewUserIds = new Set(newAssignees.map((a) => a.userId).filter(Boolean));

  // Check trùng lịch nhân sự — chỉ cảnh báo mềm, không chặn (giống CreateSchedulePlanModal.tsx). Loại
  // trừ chính lịch trình đang sửa khỏi tập trùng lịch để không tự báo trùng với chính nó.
  // Nới cửa sổ fetch ±1 ngày (xem giải thích ở CreateSchedulePlanModal): so trùng theo GIỜ thực tế nên
  // lịch vắt qua nửa đêm / đè lịch hôm trước cần dữ liệu ngày kề để đổi giờ vẫn cảnh báo đúng.
  const conflictDateWindow: StaffConflictDateWindow | null = startTime
    ? { from: addDaysKey(startTime.slice(0, 10), -1), to: addDaysKey((endTime || startTime).slice(0, 10), 1) }
    : null;
  const { plans: conflictPlans, isLoading: checkingConflicts } = useStaffConflictPlans(conflictDateWindow);
  const conflictMap: Map<string, StaffConflict[]> = useMemo(
    () => (startTime ? buildStaffConflictMap(conflictPlans, startTime, endTime || undefined, plan.planId) : new Map()),
    [conflictPlans, startTime, endTime, plan.planId],
  );

  // Cảnh báo trùng/kẹt lịch cho CẢ nhân sự đã gán (đổi giờ có thể làm họ trùng) lẫn nhân sự thêm mới.
  const [acceptConflict, setAcceptConflict] = useState(false);
  useEffect(() => setAcceptConflict(false), [startTime, endTime]);
  const conflictedNames = useMemo(() => {
    const ids = new Set<string>([...existingAssignees.map((a) => a.userId), ...newAssignees.map((a) => a.userId)].filter(Boolean));
    return [...ids]
      .filter((uid) => (conflictMap.get(uid)?.length ?? 0) > 0)
      .map((uid) => staff.find((u) => u.userId === uid)?.fullName ?? existingAssignees.find((a) => a.userId === uid)?.fullName ?? '')
      .filter(Boolean);
  }, [existingAssignees, newAssignees, conflictMap, staff]);
  const hasConflict = conflictedNames.length > 0;

  const nowInputValue = toLocalInputValue(new Date());
  const eventDateInputValue = eventDate ? toLocalInputValue(new Date(eventDate)) : undefined;

  const startTimeRequiredError = attemptedSubmit && !startTime ? 'Vui lòng nhập thời gian bắt đầu.' : undefined;
  const startTimeError = startTimeRequiredError ?? getStartTimeError(startTime, eventDate, isDateRestricted);
  const endTimeError = getEndTimeError(startTime, endTime, eventDate, isDateRestricted);
  const totalAssigneeCount = existingAssignees.length + newAssignees.filter((a) => a.userId).length;
  const assigneesError = attemptedSubmit && totalAssigneeCount === 0 ? 'Vui lòng chọn ít nhất 1 nhân sự phụ trách.' : undefined;

  const optionsForRow = (rowUserId: string): SelectOptionGroup[] => {
    const selectable = staff.filter(
      (u) => (u.userId === rowUserId || !selectedNewUserIds.has(u.userId)) && !existingAssigneeIds.has(u.userId),
    );
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

  const addAssigneeRow = () =>
    setNewAssignees((prev) => [...prev, { key: nextDraftKey(), userId: '', role: existingHasLead ? 'TECHNICAL' : 'LEAD' }]);
  const removeAssigneeRow = (key: string) => setNewAssignees((prev) => prev.filter((a) => a.key !== key));
  const updateAssigneeRow = (key: string, userId: string) =>
    setNewAssignees((prev) => prev.map((a) => (a.key === key ? { ...a, userId } : a)));
  const setAssigneeRowRole = (key: string, role: AssigneeRole) => {
    if (role === 'LEAD' && existingHasLead) return; // kế hoạch đã có 1 Trưởng nhóm, backend chỉ cho tối đa 1
    setNewAssignees((prev) =>
      prev.map((a) => {
        if (a.key === key) return { ...a, role };
        return role === 'LEAD' ? { ...a, role: 'TECHNICAL' as const } : a;
      }),
    );
  };

  const handleSubmit = async () => {
    setAttemptedSubmit(true);
    const filledNewAssignees = newAssignees.filter((a) => a.userId);
    const hasBlockingError =
      !startTime ||
      !!getStartTimeError(startTime, eventDate, isDateRestricted) ||
      !!getEndTimeError(startTime, endTime, eventDate, isDateRestricted) ||
      totalAssigneeCount === 0 ||
      (hasConflict && !acceptConflict);
    if (hasBlockingError) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await schedulePlanApiService.updateSchedulePlan(plan.planId, {
        startTime: new Date(startTime).toISOString(),
        ...(endTime ? { endTime: new Date(endTime).toISOString() } : {}),
        location: location.trim() || undefined,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        notes: notes.trim() || undefined,
      });

      if (filledNewAssignees.length > 0) {
        try {
          await Promise.all(
            filledNewAssignees.map((a) => schedulePlanApiService.addAssignee(plan.planId, { userId: a.userId, role: a.role })),
          );
        } catch {
          setError('Đã lưu thay đổi lịch trình nhưng gán thêm nhân sự thất bại một phần — vui lòng mở lại kế hoạch và kiểm tra.');
          onUpdated();
          setIsSubmitting(false);
          return;
        }
      }

      onUpdated();
      onClose();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message ?? 'Không thể lưu thay đổi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sửa lịch trình"
      subtitle={plan.taskName ? `${plan.planCode} · ${plan.taskName}` : plan.planCode}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={hasConflict && !acceptConflict}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Loại việc:</span>
          <span className="text-sm font-semibold text-slate-900">{plan.taskName ?? '—'}</span>
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${SCHEDULE_STATUS_BADGE[plan.status]}`}>
            {SCHEDULE_STATUS_LABEL[plan.status]}
          </span>
        </div>

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
            helpText={isDateRestricted ? 'Loại việc này phải hoàn tất chậm nhất trong ngày tổ chức sự kiện.' : undefined}
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

        <AddressAutocompleteInput
          label="Địa điểm"
          placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
          value={location}
          onChange={(value) => {
            setLocation(value);
            setLatitude(undefined);
            setLongitude(undefined);
          }}
          onSelectPlace={({ formattedAddress, lat, lng }) => {
            setLocation(formattedAddress);
            setLatitude(lat);
            setLongitude(lng);
          }}
        />

        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">Nhân sự đã gán</span>
          {existingAssignees.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {existingAssignees.map((a) => (
                <span
                  key={a.userId}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                >
                  {a.fullName} · {ROLE_LABEL[a.role]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-slate-400">Chưa có nhân sự nào được gán.</p>
          )}
          {/* <p className="mt-1 text-[11px] italic text-slate-400">
            Chưa hỗ trợ gỡ nhân sự đã gán — backend chưa có endpoint xóa (chỉ có thể thêm mới bên dưới).
          </p> */}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              Thêm nhân sự
              {checkingConflicts && (
                <span className="flex items-center gap-1 text-xs font-normal text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang kiểm tra lịch trùng...
                </span>
              )}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addAssigneeRow}
              disabled={existingAssigneeIds.size + selectedNewUserIds.size >= staff.length}
            >
              <Plus className="h-4 w-4" />
              Thêm nhân sự
            </Button>
          </div>
          {newAssignees.length > 0 && (
            <div className="space-y-2">
              {newAssignees.map((row) => {
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
                          disabled={existingHasLead}
                          title={existingHasLead ? 'Kế hoạch này đã có Trưởng nhóm.' : undefined}
                          className={`px-2.5 py-2 ${row.role === 'LEAD' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white`}
                        >
                          Trưởng nhóm
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigneeRowRole(row.key, 'TECHNICAL')}
                          className={`border-l border-slate-200 px-2.5 py-2 ${row.role === 'TECHNICAL' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                          Kỹ thuật viên
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAssigneeRow(row.key)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Bỏ nhân sự này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {rowConflicts && rowConflicts.length > 0 && (
                      <p className="flex items-start gap-1 pl-1 text-xs text-amber-600">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Trùng lịch:{' '}
                        {rowConflicts
                          .map((c) => {
                            const timeRange = c.endTime ? `${formatTime(c.startTime)}–${formatTime(c.endTime)}` : formatTime(c.startTime);
                            return `${c.orderCode ?? c.planCode} (${c.taskName ?? 'việc khác'}, ${timeRange})`;
                          })
                          .join('; ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {assigneesError && <p className="mt-1 text-xs text-red-600">{assigneesError}</p>}
          {hasConflict && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {conflictedNames.length} nhân sự bị trùng/kẹt lịch trong khung giờ này: {conflictedNames.join(', ')} — không thể ở 2 nơi cùng lúc.
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-amber-800">
                <input
                  type="checkbox"
                  checked={acceptConflict}
                  onChange={(e) => setAcceptConflict(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                Tôi vẫn phân công dù trùng lịch (tự chịu trách nhiệm điều phối)
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="esp-notes" className="text-sm font-medium text-gray-700">
            Ghi chú
          </label>
          <textarea
            id="esp-notes"
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
