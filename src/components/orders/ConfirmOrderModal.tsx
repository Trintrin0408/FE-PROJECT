'use client';

// Popup khi Manager đổi trạng thái đơn sang "Đã xác nhận": xác nhận chốt đơn (khóa tồn kho) + checklist
// các loại công việc lịch trình (Khảo sát / Lắp đặt / Thu hồi…) để tích chọn và TẠO LUÔN schedule plan
// tương ứng — giờ dự kiến tự suy từ ngày sự kiện. Lịch tạo ở đây chưa gán nhân sự (phân công sau).

import { useEffect, useMemo, useState } from 'react';
import { X, ShieldCheck, CalendarPlus, Check } from 'lucide-react';
import { workTaskApiService } from '@/services/workTask.service';
import { toDateInputValue, formatDate, formatTime } from '@/utils/formatDate';
import { addDaysKey } from '@/utils/scheduleCalendar';
import type { WorkTask } from '@/types/workTask';

export interface PlanToCreate {
  taskId: string;
  taskName: string;
  startTime: string;
  endTime: string;
}

interface Props {
  isOpen: boolean;
  orderCode: string;
  eventDate: string;
  endDate?: string | null;
  /** taskCode của các lịch đã tồn tại trên đơn — để bỏ tích/khoá tránh tạo trùng. */
  existingTaskCodes?: string[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (plans: PlanToCreate[]) => void;
}

// ISO theo giờ tường Việt Nam cho 1 ngày (YYYY-MM-DD) + giờ HH:mm.
function vnISO(dayKey: string, hhmm: string): string {
  return new Date(`${dayKey}T${hhmm}:00+07:00`).toISOString();
}

// Giờ dự kiến mặc định theo loại việc, suy từ ngày sự kiện: khảo sát trước 2 ngày, lắp đặt sáng ngày sự
// kiện, thu hồi sáng hôm sau khi kết thúc.
function defaultTimes(taskCode: string, eventDate: string, endDate?: string | null): { start: string; end: string } {
  const evKey = toDateInputValue(eventDate);
  const endKey = toDateInputValue(endDate ?? eventDate);
  switch (taskCode.toUpperCase()) {
    case 'SURVEY': {
      const k = addDaysKey(evKey, -2);
      return { start: vnISO(k, '09:00'), end: vnISO(k, '11:00') };
    }
    case 'SETUP':
      return { start: vnISO(evKey, '08:00'), end: vnISO(evKey, '12:00') };
    case 'COLLECT':
    case 'RETURN': {
      const k = addDaysKey(endKey, 1);
      return { start: vnISO(k, '08:00'), end: vnISO(k, '11:00') };
    }
    default:
      return { start: vnISO(evKey, '08:00'), end: vnISO(evKey, '10:00') };
  }
}

// Loại việc gợi ý tạo lịch sẵn khi chốt đơn.
const SUGGESTED = new Set(['SURVEY', 'SETUP', 'COLLECT', 'RETURN']);

export default function ConfirmOrderModal({ isOpen, orderCode, eventDate, endDate, existingTaskCodes = [], isSubmitting, onCancel, onConfirm }: Props) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const existing = useMemo(() => new Set(existingTaskCodes.map((c) => c.toUpperCase())), [existingTaskCodes]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    workTaskApiService
      .getWorkTasks({ isActive: true })
      .then((res) => {
        const list = (res.data ?? []) as WorkTask[];
        setTasks(list);
        // Mặc định tích các loại việc gợi ý CHƯA có lịch trên đơn.
        const init: Record<string, boolean> = {};
        for (const t of list) {
          init[t.taskId] = SUGGESTED.has(t.taskCode.toUpperCase()) && !existing.has(t.taskCode.toUpperCase());
        }
        setChecked(init);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [isOpen, existing]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const plans: PlanToCreate[] = tasks
      .filter((t) => checked[t.taskId])
      .map((t) => {
        const { start, end } = defaultTimes(t.taskCode, eventDate, endDate);
        return { taskId: t.taskId, taskName: t.taskName, startTime: start, endTime: end };
      });
    onConfirm(plans);
  };

  const selectedCount = tasks.filter((t) => checked[t.taskId]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Xác nhận đơn {orderCode}</h3>
              <p className="text-xs text-slate-500">Đơn sẽ chuyển sang <b>Đã xác nhận</b> và khóa tồn kho theo ngày.</p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <CalendarPlus className="h-4 w-4 text-blue-600" /> Tạo lịch công việc luôn khi chốt đơn
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">Tích các loại việc cần tạo — giờ dự kiến suy từ ngày sự kiện, chưa gán nhân sự (phân công sau ở Điều vận/Lịch trình).</p>

          <div className="mt-3 space-y-1.5">
            {loading && <p className="py-4 text-center text-sm text-slate-400">Đang tải danh sách công việc…</p>}
            {!loading && tasks.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Không có loại công việc nào.</p>}
            {!loading &&
              tasks.map((t) => {
                const already = existing.has(t.taskCode.toUpperCase());
                const { start, end } = defaultTimes(t.taskCode, eventDate, endDate);
                return (
                  <label
                    key={t.taskId}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition ${
                      checked[t.taskId] ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    } ${already ? 'opacity-70' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[t.taskId]}
                      onChange={(e) => setChecked((c) => ({ ...c, [t.taskId]: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{t.taskName}</span>
                        {already && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">Đã có lịch</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">Dự kiến: {formatDate(start)} · {formatTime(start)}–{formatTime(end)}</div>
                    </div>
                  </label>
                );
              })}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={isSubmitting} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {isSubmitting ? 'Đang xử lý…' : selectedCount > 0 ? `Xác nhận & tạo ${selectedCount} lịch` : 'Xác nhận đơn'}
          </button>
        </div>
      </div>
    </div>
  );
}
