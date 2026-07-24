import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';
import { TASK_STATUS_META, type FlatWorkTask } from '@/mocks/db/schedulePlans';
import { formatDate } from '@/utils/formatDate';
import StatusPill from './StatusPill';

interface TaskCardProps {
  task: FlatWorkTask;
}

/** "YYYY-MM-DD HH:mm" -> "HH:mm, dd/MM/yyyy" — tách thủ công thay vì new Date(startTime) vì chuỗi có
 * khoảng trắng không đảm bảo parse nhất quán giữa các trình duyệt. */
function formatTaskTime(startTime: string): string {
  const [datePart, timePart] = startTime.split(' ');
  return `${timePart ?? ''}, ${formatDate(datePart)}`;
}

export default function TaskCard({ task }: Readonly<TaskCardProps>) {
  const statusMeta = TASK_STATUS_META[task.status];
  return (
    <Link
      href={`/staff-mobile/tasks/${task.planId}__${task.id}`}
      className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition-colors active:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{task.title}</p>
        <StatusPill label={statusMeta.label} badgeClass={statusMeta.badgeClass} />
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-400">
        {task.eventName} · {task.orderId}
      </p>
      <div className="mt-2.5 flex flex-col gap-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          {formatTaskTime(task.startTime)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{task.location}</span>
        </span>
      </div>
    </Link>
  );
}
