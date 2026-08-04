import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { ORDER_STATUS_LABEL } from '@/constants/order-status';
import type { UpcomingEvent } from '@/types/dashboard';

interface UpcomingEventsCardProps {
  events: UpcomingEvent[];
  viewAllHref?: string;
}

export default function UpcomingEventsCard({ events, viewAllHref = '/admin/orders_audit' }: Readonly<UpcomingEventsCardProps>) {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Lịch sự kiện sắp tới</h3>
        <Calendar className="h-4 w-4 text-slate-400" />
      </div>

      <div className="mt-3 flex-1 space-y-3">
        {events.map((event) => {
          return (
            <div key={`${event.day}-${event.title}`} className="flex items-start gap-3">
              <div className="flex w-11 flex-shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1.5">
                <span className="text-base font-bold leading-none text-slate-900">{event.day}</span>
                <span className="mt-1 text-[9px] font-semibold uppercase text-slate-400">{event.month}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{event.title}</p>
                <p className="text-xs text-slate-400">
                  {event.time} • {event.venue}
                </p>
              </div>
              <Badge variant={getStatusBadgeVariant(event.status)}>{ORDER_STATUS_LABEL[event.status] ?? event.status}</Badge>
            </div>
          );
        })}
      </div>

      <Link href={viewAllHref} className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
        Xem tất cả
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
