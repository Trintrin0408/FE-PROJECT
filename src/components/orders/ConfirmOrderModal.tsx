'use client';

// Popup khi Manager đổi trạng thái đơn sang "Đã xác nhận": khung 16:9. Bên trên là các "phần công việc"
// (Khảo sát / Lắp đặt / Thu hồi…) dạng thẻ kéo được; bên dưới là 1 cây TIMELINE dài co giãn (zoom) trải
// theo ngày. Kéo-thả (hoặc bấm) thẻ công việc xuống timeline để xếp lịch: block có thể kéo dời giờ + kéo
// cạnh phải để chỉnh thời lượng. Bấm xác nhận -> chốt đơn (khóa tồn kho) + tạo schedule plan theo đúng vị
// trí đã xếp. Lịch tạo ở đây chưa gán nhân sự (phân công sau ở Điều vận/Lịch trình).

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ShieldCheck, Check, ZoomIn, ZoomOut, Trash2, CalendarClock, MousePointerClick } from 'lucide-react';
import { workTaskApiService } from '@/services/workTask.service';
import { toDateInputValue, formatDate, formatTime } from '@/utils/formatDate';
import { addDaysKey, enumerateDayKeys, weekdayLabel } from '@/utils/scheduleCalendar';
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
  /** taskCode của các lịch đã tồn tại trên đơn — để đánh dấu tránh tạo trùng. */
  existingTaskCodes?: string[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (plans: PlanToCreate[]) => void;
}

interface Block {
  id: string;
  taskId: string;
  taskCode: string;
  taskName: string;
  startMs: number;
  durMs: number;
}

const HOUR = 3_600_000;
const SNAP_MS = 15 * 60_000; // hít 15 phút
const MIN_DUR_MS = 30 * 60_000;
const ROW_H = 40; // chiều cao 1 làn block
const MIN_PXH = 12;
const MAX_PXH = 56;
const DEFAULT_PXH = 30; // mặc định "phóng" đủ rộng để 1 việc 2h ~60px, dễ đọc

// Loại việc gợi ý tự xếp sẵn khi mở popup.
const SUGGESTED = new Set(['SURVEY', 'SETUP', 'COLLECT', 'RETURN']);

// Màu theo loại việc (class tĩnh để Tailwind giữ lại).
function colorFor(code: string): { dot: string; block: string; chip: string } {
  switch (code.toUpperCase()) {
    case 'SURVEY':
      return { dot: 'bg-blue-500', block: 'bg-blue-500 hover:bg-blue-600', chip: 'border-blue-200 bg-blue-50 text-blue-700' };
    case 'SETUP':
      return { dot: 'bg-emerald-500', block: 'bg-emerald-500 hover:bg-emerald-600', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    case 'COLLECT':
      return { dot: 'bg-amber-500', block: 'bg-amber-500 hover:bg-amber-600', chip: 'border-amber-200 bg-amber-50 text-amber-700' };
    case 'RETURN':
      return { dot: 'bg-violet-500', block: 'bg-violet-500 hover:bg-violet-600', chip: 'border-violet-200 bg-violet-50 text-violet-700' };
    case 'TRANSPORT':
      return { dot: 'bg-cyan-500', block: 'bg-cyan-500 hover:bg-cyan-600', chip: 'border-cyan-200 bg-cyan-50 text-cyan-700' };
    default:
      return { dot: 'bg-slate-500', block: 'bg-slate-500 hover:bg-slate-600', chip: 'border-slate-200 bg-slate-50 text-slate-600' };
  }
}

// Epoch ms của 00:00 giờ Việt Nam cho 1 ngày YYYY-MM-DD (VN cố định +07:00, không DST).
function vnMidnightMs(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00+07:00`).getTime();
}

// Giờ mặc định theo loại việc, suy từ ngày sự kiện: khảo sát trước 2 ngày, lắp đặt sáng ngày sự kiện,
// thu hồi sáng hôm sau khi kết thúc. Trả về mốc ms.
function defaultSlot(taskCode: string, evKey: string, endKey: string): { startMs: number; durMs: number } {
  switch (taskCode.toUpperCase()) {
    case 'SURVEY': {
      const k = addDaysKey(evKey, -2);
      return { startMs: vnMidnightMs(k) + 9 * HOUR, durMs: 2 * HOUR };
    }
    case 'SETUP':
      return { startMs: vnMidnightMs(evKey) + 8 * HOUR, durMs: 4 * HOUR };
    case 'COLLECT':
    case 'RETURN': {
      const k = addDaysKey(endKey, 1);
      return { startMs: vnMidnightMs(k) + 8 * HOUR, durMs: 3 * HOUR };
    }
    default:
      return { startMs: vnMidnightMs(evKey) + 8 * HOUR, durMs: 2 * HOUR };
  }
}

export default function ConfirmOrderModal({ isOpen, orderCode, eventDate, endDate, existingTaskCodes = [], isSubmitting, onCancel, onConfirm }: Props) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pxPerHour, setPxPerHour] = useState(DEFAULT_PXH);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; origStartMs: number; origDurMs: number } | null>(null);

  const existing = useMemo(() => new Set(existingTaskCodes.map((c) => c.toUpperCase())), [existingTaskCodes]);

  const evKey = useMemo(() => toDateInputValue(eventDate), [eventDate]);
  const endKey = useMemo(() => toDateInputValue(endDate ?? eventDate), [endDate, eventDate]);

  // Khoảng thời gian của timeline: đệm 1 ngày quanh khảo sát (−3) và thu hồi (+2).
  const rangeStartKey = useMemo(() => addDaysKey(evKey, -2), [evKey]);
  const rangeEndKey = useMemo(() => addDaysKey(endKey, 1), [endKey]);
  const days = useMemo(() => enumerateDayKeys(rangeStartKey, rangeEndKey), [rangeStartKey, rangeEndKey]);
  const rangeStartMs = useMemo(() => vnMidnightMs(rangeStartKey), [rangeStartKey]);
  const totalHours = days.length * 24;
  const rangeEndMs = rangeStartMs + totalHours * HOUR;
  const contentWidth = totalHours * pxPerHour;

  const eventDayKeys = useMemo(() => new Set(enumerateDayKeys(evKey, endKey)), [evKey, endKey]);

  const nextId = () => `b${(idRef.current += 1)}`;

  // Tải danh sách loại việc + tự xếp sẵn các loại gợi ý chưa có lịch.
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setPxPerHour(DEFAULT_PXH);
    workTaskApiService
      .getWorkTasks({ isActive: true })
      .then((res) => {
        const list = (res.data ?? []) as WorkTask[];
        setTasks(list);
        const init: Block[] = [];
        for (const t of list) {
          const code = t.taskCode.toUpperCase();
          if (SUGGESTED.has(code) && !existing.has(code)) {
            const { startMs, durMs } = defaultSlot(t.taskCode, evKey, endKey);
            init.push({ id: nextId(), taskId: t.taskId, taskCode: t.taskCode, taskName: t.taskName, startMs, durMs });
          }
        }
        setBlocks(init);
      })
      .catch(() => {
        setTasks([]);
        setBlocks([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, existing, evKey, endKey]);

  // Kéo dời / chỉnh thời lượng block bằng con trỏ (nghe trên window để mượt khi ra ngoài block).
  useEffect(() => {
    if (!isOpen) return;
    const msPerPx = HOUR / pxPerHour;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dMs = (e.clientX - d.startX) * msPerPx;
      setBlocks((bs) =>
        bs.map((b) => {
          if (b.id !== d.id) return b;
          if (d.mode === 'move') {
            let ns = Math.round((d.origStartMs + dMs) / SNAP_MS) * SNAP_MS;
            ns = Math.max(rangeStartMs, Math.min(ns, rangeEndMs - b.durMs));
            return { ...b, startMs: ns };
          }
          let nd = Math.round((d.origDurMs + dMs) / SNAP_MS) * SNAP_MS;
          nd = Math.max(MIN_DUR_MS, nd);
          if (b.startMs + nd > rangeEndMs) nd = rangeEndMs - b.startMs;
          return { ...b, durMs: nd };
        }),
      );
    };
    const up = () => {
      dragRef.current = null;
      setDraggingId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [isOpen, pxPerHour, rangeStartMs, rangeEndMs]);

  if (!isOpen) return null;

  const msToX = (ms: number) => ((ms - rangeStartMs) / HOUR) * pxPerHour;

  // Xếp block vào các làn (lane) tránh chồng nhau khi hiển thị.
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs);
  const laneOf: Record<string, number> = {};
  const laneEnds: number[] = [];
  for (const b of sorted) {
    let placed = false;
    for (let i = 0; i < laneEnds.length; i += 1) {
      if (b.startMs >= laneEnds[i]) {
        laneOf[b.id] = i;
        laneEnds[i] = b.startMs + b.durMs;
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneOf[b.id] = laneEnds.length;
      laneEnds.push(b.startMs + b.durMs);
    }
  }
  const laneCount = Math.max(3, laneEnds.length);
  const trackHeight = laneCount * ROW_H + 12;

  const countByTask: Record<string, number> = {};
  for (const b of blocks) countByTask[b.taskId] = (countByTask[b.taskId] ?? 0) + 1;

  const addBlock = (t: WorkTask, startMs?: number) => {
    const slot = defaultSlot(t.taskCode, evKey, endKey);
    let s = startMs ?? slot.startMs;
    s = Math.max(rangeStartMs, Math.min(Math.round(s / SNAP_MS) * SNAP_MS, rangeEndMs - slot.durMs));
    setBlocks((bs) => [...bs, { id: nextId(), taskId: t.taskId, taskCode: t.taskCode, taskName: t.taskName, startMs: s, durMs: slot.durMs }]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/task');
    const t = tasks.find((x) => x.taskId === taskId);
    if (!t || !contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    addBlock(t, rangeStartMs + (x / pxPerHour) * HOUR);
  };

  const startBlockDrag = (e: React.PointerEvent, b: Block, mode: 'move' | 'resize') => {
    e.stopPropagation();
    dragRef.current = { id: b.id, mode, startX: e.clientX, origStartMs: b.startMs, origDurMs: b.durMs };
    setDraggingId(b.id);
  };

  const removeBlock = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));

  const handleConfirm = () => {
    const plans: PlanToCreate[] = [...blocks]
      .sort((a, b) => a.startMs - b.startMs)
      .map((b) => ({
        taskId: b.taskId,
        taskName: b.taskName,
        startTime: new Date(b.startMs).toISOString(),
        endTime: new Date(b.startMs + b.durMs).toISOString(),
      }));
    onConfirm(plans);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ aspectRatio: '16 / 9', maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Xác nhận đơn {orderCode}</h3>
              <p className="text-xs text-slate-500">Đơn chuyển sang <b>Đã xác nhận</b> + khóa tồn kho. Kéo-thả phần công việc xuống timeline để xếp lịch.</p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button>
        </div>

        {/* Palette các phần công việc kéo được */}
        <div className="border-b border-slate-100 px-5 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <MousePointerClick className="h-3.5 w-3.5" /> Phần công việc - kéo xuống hoặc bấm để thêm
          </div>
          <div className="flex flex-wrap gap-2">
            {loading && <span className="py-1 text-sm text-slate-400">Đang tải danh sách công việc…</span>}
            {!loading && tasks.length === 0 && <span className="py-1 text-sm text-slate-400">Không có loại công việc nào.</span>}
            {!loading &&
              tasks.map((t) => {
                const c = colorFor(t.taskCode);
                const already = existing.has(t.taskCode.toUpperCase());
                const placed = countByTask[t.taskId] ?? 0;
                return (
                  <button
                    key={t.taskId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/task', t.taskId);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addBlock(t)}
                    title={already ? 'Đơn đã có lịch loại này' : 'Kéo xuống timeline hoặc bấm để thêm'}
                    className={`inline-flex cursor-grab items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm transition active:cursor-grabbing ${c.chip}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    {t.taskName}
                    {placed > 0 && <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-bold">×{placed}</span>}
                    {already && placed === 0 && <span className="rounded-full bg-white/70 px-1.5 text-[10px] font-medium text-emerald-600">đã có</span>}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Thanh zoom */}
        <div className="flex items-center justify-between px-5 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CalendarClock className="h-4 w-4 text-blue-600" /> Timeline lịch công việc
            {/* <span className="ml-1 font-normal text-slate-400">· hít 15 phút · kéo cạnh phải để chỉnh thời lượng</span> */}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Độ giãn</span>
            <button onClick={() => setPxPerHour((p) => Math.max(MIN_PXH, p - 3))} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" aria-label="Thu nhỏ"><ZoomOut className="h-4 w-4" /></button>
            <input type="range" min={MIN_PXH} max={MAX_PXH} value={pxPerHour} onChange={(e) => setPxPerHour(Number(e.target.value))} className="h-1 w-28 cursor-pointer accent-blue-600" />
            <button onClick={() => setPxPerHour((p) => Math.min(MAX_PXH, p + 3))} className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" aria-label="Phóng to"><ZoomIn className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Timeline cuộn ngang */}
        <div className="flex-1 overflow-auto px-5 pb-3">
          <div
            ref={contentRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={handleDrop}
            className="relative flex min-h-full flex-col rounded-xl border border-slate-200 bg-slate-50"
            style={{ width: contentWidth, minWidth: '100%' }}
          >
            {/* Header ngày */}
            <div className="sticky top-0 z-10 flex h-9 border-b border-slate-200 bg-white/95 backdrop-blur">
              {days.map((k) => {
                const isEvent = eventDayKeys.has(k);
                return (
                  <div
                    key={k}
                    className={`flex shrink-0 flex-col justify-center border-r border-slate-200 px-2 ${isEvent ? 'bg-blue-50/70' : ''}`}
                    style={{ width: 24 * pxPerHour }}
                  >
                    <span className="whitespace-nowrap text-[11px] font-semibold text-slate-700">
                      {weekdayLabel(k)} {formatDate(k).slice(0, 5)}
                      {isEvent && <span className="ml-1 rounded bg-blue-600 px-1 text-[9px] font-bold text-white">SỰ KIỆN</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Vùng track + lưới giờ */}
            <div className="relative flex-1" style={{ minHeight: trackHeight }}>
              {/* Lưới dọc mỗi 6 giờ */}
              {Array.from({ length: Math.floor(totalHours / 6) + 1 }, (_, idx) => idx * 6).map((h) => {
                const isMidnight = h % 24 === 0;
                return (
                  <div key={h} className={`absolute top-0 bottom-0 border-l ${isMidnight ? 'border-slate-200' : 'border-slate-100'}`} style={{ left: h * pxPerHour }}>
                    {!isMidnight && pxPerHour >= 11 && <span className="absolute top-0.5 left-0.5 text-[9px] text-slate-300">{h % 24}h</span>}
                  </div>
                );
              })}

              {/* Các block công việc */}
              {blocks.map((b) => {
                const c = colorFor(b.taskCode);
                const x = msToX(b.startMs);
                const w = (b.durMs / HOUR) * pxPerHour;
                const top = laneOf[b.id] * ROW_H + 6;
                const wide = w > 80;
                return (
                  <div
                    key={b.id}
                    onPointerDown={(e) => startBlockDrag(e, b, 'move')}
                    title={`${b.taskName} · ${formatDate(new Date(b.startMs).toISOString())} ${formatTime(b.startMs)}–${formatTime(b.startMs + b.durMs)}`}
                    className={`group absolute flex touch-none cursor-grab select-none flex-col justify-center overflow-hidden rounded-lg px-2 text-white shadow-sm ring-2 ring-white transition-colors active:cursor-grabbing ${c.block} ${draggingId === b.id ? 'z-20 opacity-90 shadow-lg' : ''}`}
                    style={{ left: x, width: Math.max(w, 44), top, height: ROW_H - 12 }}
                  >
                    <div className="flex items-center gap-1 leading-none">
                      <span className="truncate text-[11px] font-bold">{b.taskName}</span>
                    </div>
                    {wide && <span className="truncate text-[10px] leading-tight opacity-90">{formatTime(b.startMs)}–{formatTime(b.startMs + b.durMs)}</span>}

                    {/* Nút xóa */}
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeBlock(b.id)}
                      className="absolute right-0.5 top-0.5 hidden rounded bg-black/20 p-0.5 hover:bg-black/40 group-hover:block"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    {/* Tay nắm chỉnh thời lượng */}
                    <div
                      onPointerDown={(e) => startBlockDrag(e, b, 'resize')}
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {blocks.length === 0 && !loading && (
            <p className="mt-2 text-center text-xs text-slate-400">Chưa xếp phần việc nào — kéo thẻ ở trên xuống timeline, hoặc bấm để thêm nhanh.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span className="text-xs text-slate-500">Đã xếp <b className="text-slate-800">{blocks.length}</b> phần việc · chưa gán nhân sự (phân công sau).</span>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} disabled={isSubmitting} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSubmitting ? 'Đang xử lý…' : blocks.length > 0 ? `Xác nhận & tạo ${blocks.length} lịch` : 'Xác nhận đơn'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
