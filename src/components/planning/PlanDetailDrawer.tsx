'use client';

import { motion } from 'framer-motion';
import { Activity as ActivityIcon, Calendar, Edit, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { OrderPlanGroup } from '@/utils/schedulePlanGroups';
import { ROLE_LABEL, SCHEDULE_STATUS_BADGE, SCHEDULE_STATUS_LABEL, getGroupStatusInfo, unionAssignees } from '@/utils/schedulePlanGroups';

interface PlanDetailDrawerProps {
  group: OrderPlanGroup;
  onClose: () => void;
  onEdit: (group: OrderPlanGroup) => void;
  /** planId của thẻ công việc cụ thể vừa nhấn (từ lịch tháng/lịch ngày) — khi có, ưu tiên hiển thị công
   * việc đó ở tiêu đề & tô nổi bật đúng dòng trong danh sách, thay vì chỉ hiện chung theo mã đơn. */
  focusPlanId?: string | null;
}

// Kết nối backend thật (2026-07-21, GET /schedule-plans?orderId=) — xem docs/chitietkehoach_api.md.
// Theo quyết định đã chốt ở mục 6 tài liệu đó: gộp "Các hoạt động chính" + "Danh sách công việc &
// phân công" (mock cũ tách 2 mảng activities[]/tasks[]) thành 1 danh sách duy nhất, vì DB thật không
// phân biệt 2 khái niệm này — mỗi phần tử là 1 dòng schedule_plans thật.
export default function PlanDetailDrawer({ group, onClose, onEdit, focusPlanId }: Readonly<PlanDetailDrawerProps>) {
  const statusInfo = getGroupStatusInfo(group.rows);
  const staff = unionAssignees(group.rows);
  // "Ghi chú" cấp nhóm — quyết định đã chốt ở docs/chitietkehoach_api.md mục 6.2: lấy notes của dòng
  // có start_time sớm nhất trong nhóm (schedule_plans.notes là cột per-row, không có "notes cấp nhóm").
  const earliestNotes = [...group.rows].sort((a, b) => a.startTime.localeCompare(b.startTime))[0]?.notes;
  const focusRow = focusPlanId ? group.rows.find((r) => r.planId === focusPlanId) : undefined;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col justify-between border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {focusRow ? 'Chi tiết công việc' : 'Chi tiết kế hoạch vận hành'}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${focusRow ? SCHEDULE_STATUS_BADGE[focusRow.status] : statusInfo.badgeClass}`}>
                {focusRow ? SCHEDULE_STATUS_LABEL[focusRow.status] : statusInfo.label}
              </span>
            </div>
            {focusRow ? (
              <>
                <h3 className="mt-1 text-base font-bold text-slate-900">{focusRow.taskName ?? focusRow.planCode}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  <span className="font-mono font-semibold text-slate-500">{focusRow.planCode}</span> — Thuộc đơn{' '}
                  <span className="font-mono font-semibold text-slate-500">{group.orderCode}</span>
                </p>
              </>
            ) : (
              <h3 className="mt-1 text-base font-bold text-slate-900">{group.orderCode}</h3>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-200/50 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-3 rounded-xl border border-slate-150 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">{group.orderCode}</span>
              <span className="text-[11px] italic text-slate-400" title="Chưa có API: GET /schedule-plans chưa join sẵn orders.created_by cho màn đa đơn — xem docs/more-require.md">
                Người lập: chưa có API
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">{group.eventName}</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <p className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-slate-400" />
                {formatDate(group.eventDate)}
              </p>
              <p className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-400" />
                {group.location}
              </p>
            </div>
            {earliestNotes && <p className="rounded-lg bg-white p-2.5 text-xs italic text-slate-500">{earliestNotes}</p>}
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
              Các hoạt động & công việc ({group.rows.length})
            </h4>
            <div className="space-y-2">
              {group.rows.map((row) => (
                <div
                  key={row.planId}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    row.planId === focusPlanId ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-150 bg-white'
                  }`}
                >
                  <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                    <ActivityIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">{row.planCode}</span>
                        <span className="font-bold text-slate-800">{row.taskName ?? row.taskId}</span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${SCHEDULE_STATUS_BADGE[row.status]}`}>
                        {SCHEDULE_STATUS_LABEL[row.status]}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatTime(row.startTime)}
                      {row.endTime ? ` - ${formatTime(row.endTime)}` : ''}
                      {` · ${formatDate(row.startTime)}`}
                    </span>
                    {row.notes && <p className="leading-relaxed text-slate-500">{row.notes}</p>}
                    {row.location && (
                      <p className="flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {row.location}
                      </p>
                    )}
                    {(row.assignees?.length ?? 0) > 0 && (
                      <p className="text-[10px] text-slate-500">
                        Phụ trách:{' '}
                        <strong className="text-slate-700">
                          {row.assignees!.map((a) => `${a.fullName} (${ROLE_LABEL[a.role]})`).join(', ')}
                        </strong>
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {group.rows.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center italic text-slate-400">
                  Chưa có hoạt động/công việc nào được lập cho đơn này.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
              Nhân sự tham gia ({staff.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <span key={s.userId} className="rounded-lg border border-slate-150 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                  {s.fullName} <span className="font-normal text-slate-400">— {ROLE_LABEL[s.role]}</span>
                </span>
              ))}
              {staff.length === 0 && <span className="text-xs italic text-slate-400">Chưa có nhân sự nào được gán.</span>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-150 bg-slate-50 p-5">
          <Button variant="secondary" onClick={onClose}>
            Đóng lại
          </Button>
          <Button
            onClick={() => {
              onEdit(group);
              onClose();
            }}
          >
            <Edit className="h-3.5 w-3.5" />
            Chỉnh sửa kế hoạch
          </Button>
        </div>
      </motion.div>
    </>
  );
}
