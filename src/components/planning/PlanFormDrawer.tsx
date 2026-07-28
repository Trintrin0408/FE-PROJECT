'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Loader2, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { OrderPlanGroup } from '@/utils/schedulePlanGroups';
import { ROLE_LABEL, SCHEDULE_STATUS_BADGE, SCHEDULE_STATUS_LABEL } from '@/utils/schedulePlanGroups';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { workTaskApiService } from '@/services/workTask.service';
import { userApiService } from '@/services/user.service';
import type { WorkTask } from '@/types/workTask';
import type { AdminUser } from '@/types/user';

export interface UnplannedOrderOption {
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName: string;
  eventDate: string;
  location: string;
}

interface DraftItem {
  localId: string;
  taskId: string;
  start: string; // datetime-local
  end: string; // datetime-local
  location: string;
  notes: string;
  leadUserId: string;
  technicalUserIds: string[];
}

interface PlanFormDrawerProps {
  isOpen: boolean;
  editingGroup: OrderPlanGroup | null;
  unplannedOrders: UnplannedOrderOption[];
  defaultOrderId?: string;
  onClose: () => void;
  onSaved: () => void;
}

function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newDraftItem(defaultLocation: string): DraftItem {
  return {
    localId: `NEW-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    taskId: '',
    start: '',
    end: '',
    location: defaultLocation,
    notes: '',
    leadUserId: '',
    technicalUserIds: [],
  };
}

// Kết nối backend thật (2026-07-21) — xem docs/kehoachvaphancong_api.md mục 8. Mỗi hoạt động/công việc
// nhập ở đây = 1 lần gọi tuần tự POST /schedule-plans + POST /schedule-plans/:id/assignees (backend
// CHƯA có endpoint batch, xem mục 8.5 điểm 2 — lưu tuần tự, báo rõ nếu lỗi giữa chừng thay vì giả vờ
// thành công toàn bộ). Đã bỏ hẳn: dropdown "Trạng thái kế hoạch" (POST không nhận status, luôn tạo
// PENDING — mục 8.5 điểm 3), PLANNING_STAFF_POOL 5 vai trò bespoke (đổi sang chọn user thật role
// LEADER/TECHNICAL — mục 8.3), tên việc tự do (đổi sang chọn task_id từ danh mục work_tasks thật + ô
// mô tả ghi vào notes — mục 2/8.4), và luồng "đơn đặt ảo từ báo giá" (chưa làm được, chờ Backend đổi
// schema thêm schedule_plans.quotation_id — xem docs/kehoachvaphancong_api.md mục 8.1/12).
export default function PlanFormDrawer({ isOpen, editingGroup, unplannedOrders, defaultOrderId, onClose, onSaved }: Readonly<PlanFormDrawerProps>) {
  const [orderId, setOrderId] = useState(() => editingGroup?.orderId ?? defaultOrderId ?? unplannedOrders[0]?.orderId ?? '');
  const [items, setItems] = useState<DraftItem[]>(() => {
    const order = unplannedOrders.find((o) => o.orderId === (defaultOrderId ?? unplannedOrders[0]?.orderId));
    return editingGroup ? [] : [newDraftItem(order?.location ?? '')];
  });

  const [workTasks, setWorkTasks] = useState<WorkTask[]>([]);
  const [leaders, setLeaders] = useState<AdminUser[]>([]);
  const [technicians, setTechnicians] = useState<AdminUser[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowEditDraft, setRowEditDraft] = useState<{ start: string; end: string; location: string; notes: string } | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [assigneePickerRowId, setAssigneePickerRowId] = useState<string | null>(null);
  const [assigneePickUserId, setAssigneePickUserId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingCatalog(true);
    Promise.all([
      workTaskApiService.getWorkTasks(),
      userApiService.getUsers({ role: 'MANAGER', limit: 100 }),
      userApiService.getUsers({ role: 'STAFF', limit: 100 }),
    ])
      .then(([tasksRes, leadersRes, techRes]) => {
        if (cancelled) return;
        setWorkTasks(tasksRes.data ?? []);
        setLeaders(leadersRes.data ?? []);
        setTechnicians(techRes.data ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkTasks([]);
          setLeaders([]);
          setTechnicians([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const allStaff = useMemo(() => [...leaders, ...technicians], [leaders, technicians]);
  const orderInfo = editingGroup ?? unplannedOrders.find((o) => o.orderId === orderId);

  if (!isOpen) return null;

  const addItem = () => setItems((prev) => [...prev, newDraftItem(orderInfo?.location ?? '')]);
  const removeItem = (localId: string) => setItems((prev) => prev.filter((i) => i.localId !== localId));
  const updateItem = (localId: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.localId === localId ? { ...i, ...patch } : i)));

  const canSubmit = !!orderId && items.length > 0 && items.every((i) => i.taskId && i.start);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    let done = 0;
    try {
      for (const item of items) {
        const created = await schedulePlanApiService.createSchedulePlan({
          orderId,
          taskId: item.taskId,
          startTime: new Date(item.start).toISOString(),
          endTime: item.end ? new Date(item.end).toISOString() : undefined,
          location: item.location || undefined,
          notes: item.notes || undefined,
        });
        const planId = created.data.planId as string;
        if (item.leadUserId) {
          await schedulePlanApiService.addAssignee(planId, { userId: item.leadUserId, role: 'LEAD' });
        }
        for (const techId of item.technicalUserIds) {
          await schedulePlanApiService.addAssignee(planId, { userId: techId, role: 'TECHNICAL' });
        }
        done += 1;
      }
      onSaved();
      onClose();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Có lỗi xảy ra.';
      setSubmitError(
        `Lưu thất bại ở hoạt động thứ ${done + 1}/${items.length}: ${message}. ${done > 0 ? `${done} hoạt động trước đó đã lưu thành công (không tự động hoàn tác — backend chưa có endpoint batch/transaction).` : ''}`,
      );
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  const startRowEdit = (row: OrderPlanGroup['rows'][number]) => {
    setEditingRowId(row.planId);
    setRowEditDraft({
      start: toDatetimeLocal(row.startTime),
      end: toDatetimeLocal(row.endTime),
      location: row.location ?? '',
      notes: row.notes ?? '',
    });
  };

  const saveRowEdit = async (row: OrderPlanGroup['rows'][number]) => {
    if (!rowEditDraft) return;
    setRowBusyId(row.planId);
    try {
      await schedulePlanApiService.updateSchedulePlan(row.planId, {
        // Backend có bug: PUT báo lỗi validate nếu thiếu startTime dù chỉ sửa field khác — luôn gửi
        // kèm startTime hiện tại để tránh lỗi 400 (xem docs/more-require.md).
        startTime: new Date(rowEditDraft.start).toISOString(),
        endTime: rowEditDraft.end ? new Date(rowEditDraft.end).toISOString() : undefined,
        location: rowEditDraft.location || undefined,
        notes: rowEditDraft.notes || undefined,
      });
      setEditingRowId(null);
      onSaved();
    } catch {
      // giữ nguyên form sửa để người dùng thử lại
    } finally {
      setRowBusyId(null);
    }
  };

  const changeRowStatus = async (row: OrderPlanGroup['rows'][number], status: 'CONFIRMED' | 'CANCELLED') => {
    setRowBusyId(row.planId);
    try {
      await schedulePlanApiService.updateSchedulePlanStatus(row.planId, { status });
      onSaved();
    } finally {
      setRowBusyId(null);
    }
  };

  const assignToRow = async (row: OrderPlanGroup['rows'][number]) => {
    if (!assigneePickUserId) return;
    const isLeader = leaders.some((l) => l.userId === assigneePickUserId);
    setRowBusyId(row.planId);
    try {
      await schedulePlanApiService.addAssignee(row.planId, { userId: assigneePickUserId, role: isLeader ? 'LEAD' : 'TECHNICAL' });
      setAssigneePickerRowId(null);
      setAssigneePickUserId('');
      onSaved();
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative flex h-full w-full max-w-4xl flex-col justify-between border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {editingGroup ? `Chỉnh sửa kế hoạch ${editingGroup.orderCode}` : 'Lập kế hoạch điều phối mới'}
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">Mỗi hoạt động/công việc lưu thành 1 dòng kế hoạch riêng, gắn nhân sự phụ trách thật.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-4 rounded-2xl border border-slate-150 bg-slate-50 p-5">
            <h4 className="border-l-2 border-blue-600 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">Section 1: Đơn đặt</h4>
            {editingGroup ? (
              <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs">
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Đơn đặt (không đổi được khi sửa)</span>
                <span className="mt-0.5 block font-bold text-slate-800">
                  {editingGroup.orderCode} — {editingGroup.customerName}
                </span>
              </div>
            ) : (
              <SearchableSelect
                label="Lựa chọn đơn đặt"
                value={orderId}
                onChange={setOrderId}
                searchPlaceholder="Tìm theo mã đơn hoặc tên khách hàng..."
                emptyText="Không còn đơn đặt nào chưa có kế hoạch."
                options={unplannedOrders.map((o) => ({ value: o.orderId, label: `${o.orderCode} - ${o.customerName}` }))}
              />
            )}
            {!editingGroup && unplannedOrders.length === 0 && (
              <p className="text-xs italic text-amber-600">Không còn đơn đặt nào chưa có kế hoạch điều phối.</p>
            )}
            <p className="text-[11px] italic text-slate-400">
              Chưa hỗ trợ lập lịch khảo sát khi báo giá chưa có đơn đặt thật — backend cần bổ sung cột
              <code className="mx-1 rounded bg-slate-100 px-1">schedule_plans.quotation_id</code>
              trước (xem docs/more-require.md).
            </p>
            {orderInfo && (
              <div className="grid grid-cols-2 gap-3.5 rounded-xl border border-slate-100 bg-white p-3 text-xs">
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">Khách hàng</span>
                  <span className="mt-0.5 block font-bold text-slate-800">{orderInfo.customerName}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">Ngày sự kiện</span>
                  <span className="mt-0.5 block font-bold text-slate-800">{formatDate(orderInfo.eventDate)}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">Địa điểm tổ chức</span>
                  <span className="mt-0.5 block font-semibold text-slate-700">{orderInfo.location}</span>
                </div>
              </div>
            )}
          </div>

          {editingGroup && editingGroup.rows.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-slate-200 p-5">
              <h4 className="border-l-2 border-blue-600 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                Các hoạt động/công việc đã có ({editingGroup.rows.length})
              </h4>
              <div className="space-y-3">
                {editingGroup.rows.map((row) => {
                  const editable = row.status !== 'IN_PROGRESS' && row.status !== 'COMPLETED';
                  const isEditingRow = editingRowId === row.planId;
                  const busy = rowBusyId === row.planId;
                  return (
                    <div key={row.planId} className="space-y-2.5 rounded-xl border border-slate-150 bg-slate-50/50 p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{row.taskName ?? row.taskId}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SCHEDULE_STATUS_BADGE[row.status]}`}>
                          {SCHEDULE_STATUS_LABEL[row.status]}
                        </span>
                      </div>

                      {isEditingRow && rowEditDraft ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Bắt đầu</label>
                            <input
                              type="datetime-local"
                              value={rowEditDraft.start}
                              onChange={(e) => setRowEditDraft((d) => (d ? { ...d, start: e.target.value } : d))}
                              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Kết thúc</label>
                            <input
                              type="datetime-local"
                              value={rowEditDraft.end}
                              onChange={(e) => setRowEditDraft((d) => (d ? { ...d, end: e.target.value } : d))}
                              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Địa điểm</label>
                            <input
                              type="text"
                              value={rowEditDraft.location}
                              onChange={(e) => setRowEditDraft((d) => (d ? { ...d, location: e.target.value } : d))}
                              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Ghi chú</label>
                            <input
                              type="text"
                              value={rowEditDraft.notes}
                              onChange={(e) => setRowEditDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                              className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs"
                            />
                          </div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingRowId(null)} className="rounded-lg border border-slate-200 px-3 py-1 font-bold text-slate-600">
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => saveRowEdit(row)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 font-bold text-white disabled:opacity-60"
                            >
                              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                              Lưu
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-mono text-[10px] text-slate-500">
                            {formatTime(row.startTime)}
                            {row.endTime ? ` - ${formatTime(row.endTime)}` : ''} · {row.location || 'Chưa có địa điểm'}
                          </p>
                          {(row.assignees?.length ?? 0) > 0 && (
                            <p className="text-[10px] text-slate-500">
                              {row.assignees!.map((a) => `${a.fullName} (${ROLE_LABEL[a.role]})`).join(', ')}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {editable && (
                              <button type="button" onClick={() => startRowEdit(row)} className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-600 hover:bg-white">
                                Sửa giờ/địa điểm
                              </button>
                            )}
                            {row.status === 'PENDING' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => changeRowStatus(row, 'CONFIRMED')}
                                className="rounded-lg border border-emerald-200 px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                              >
                                Xác nhận
                              </button>
                            )}
                            {editable && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => changeRowStatus(row, 'CANCELLED')}
                                className="rounded-lg border border-rose-200 px-2 py-1 font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                              >
                                Hủy
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setAssigneePickerRowId(assigneePickerRowId === row.planId ? null : row.planId)}
                              className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-600 hover:bg-white"
                            >
                              + Gán người
                            </button>
                          </div>
                          {assigneePickerRowId === row.planId && (
                            <div className="flex items-center gap-2 rounded-lg bg-white p-2">
                              <select
                                value={assigneePickUserId}
                                onChange={(e) => setAssigneePickUserId(e.target.value)}
                                className="flex-1 rounded-lg border border-slate-200 p-1.5 text-xs"
                              >
                                <option value="">Chọn người...</option>
                                {allStaff
                                  .filter((u) => !row.assignees?.some((a) => a.userId === u.userId))
                                  .map((u) => (
                                    <option key={u.userId} value={u.userId}>
                                      {u.fullName} ({u.role === 'MANAGER' ? 'Trưởng nhóm' : 'Kỹ thuật viên'})
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                disabled={!assigneePickUserId || busy}
                                onClick={() => assignToRow(row)}
                                className="rounded-lg bg-blue-600 px-2.5 py-1.5 font-bold text-white disabled:opacity-60"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="border-l-2 border-blue-600 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
                {editingGroup ? 'Thêm hoạt động/công việc mới' : 'Section 2: Hoạt động & công việc'}
              </h4>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
                <PlusCircle className="h-3.5 w-3.5" />
                Thêm dòng
              </button>
            </div>

            {loadingCatalog ? (
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải danh mục loại việc & nhân sự...
              </p>
            ) : (
              <div className="space-y-3.5">
                {items.map((item) => (
                  <div key={item.localId} className="relative space-y-3 rounded-xl border border-slate-150 bg-slate-50/50 p-4">
                    <button
                      type="button"
                      onClick={() => removeItem(item.localId)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-red-500"
                      title="Xóa dòng này"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Loại việc</label>
                        <select
                          value={item.taskId}
                          onChange={(e) => updateItem(item.localId, { taskId: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Chọn loại việc...</option>
                          {workTasks.map((t) => (
                            <option key={t.taskId} value={t.taskId}>
                              {t.taskName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Bắt đầu</label>
                        <input
                          type="datetime-local"
                          value={item.start}
                          onChange={(e) => updateItem(item.localId, { start: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Kết thúc</label>
                        <input
                          type="datetime-local"
                          value={item.end}
                          onChange={(e) => updateItem(item.localId, { end: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Địa điểm cụ thể</label>
                        <input
                          type="text"
                          value={item.location}
                          onChange={(e) => updateItem(item.localId, { location: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Ghi chú</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateItem(item.localId, { notes: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Phụ trách chính (LEAD)</label>
                        <select
                          value={item.leadUserId}
                          onChange={(e) => updateItem(item.localId, { leadUserId: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Chưa chọn</option>
                          {leaders.map((u) => (
                            <option key={u.userId} value={u.userId}>
                              {u.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Kỹ thuật viên đồng hành</label>
                        <div className="flex flex-wrap gap-1.5">
                          {technicians.map((u) => {
                            const checked = item.technicalUserIds.includes(u.userId);
                            return (
                              <button
                                type="button"
                                key={u.userId}
                                onClick={() =>
                                  updateItem(item.localId, {
                                    technicalUserIds: checked
                                      ? item.technicalUserIds.filter((id) => id !== u.userId)
                                      : [...item.technicalUserIds, u.userId],
                                  })
                                }
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  checked ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
                                }`}
                              >
                                {u.fullName}
                              </button>
                            );
                          })}
                          {technicians.length === 0 && <span className="text-[10px] italic text-slate-400">Không có kỹ thuật viên nào.</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="rounded-lg bg-slate-50 py-2 text-center text-[11px] italic text-slate-400">Chưa có hoạt động nào.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-150 bg-slate-50 p-5">
          {submitError && (
            <p className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {submitError}
            </p>
          )}
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingGroup ? 'Lưu hoạt động mới' : 'Lưu kế hoạch'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
