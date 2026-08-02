'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, ExternalLink, MapPin, Phone } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { BackButton } from '@/components/ui/BackButton';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Table, type TableColumn } from '@/components/ui/Table';
import { formatDate, formatTime } from '@/utils/formatDate';
import { haversineDistanceKm } from '@/utils/geo';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import type { OrderDetail } from '@/types/order';
import type { SchedulePlan } from '@/types/schedulePlan';

// Trang chi tiết 1 dòng lịch trình (Schedule Plan) cụ thể của 1 Order — tách riêng khỏi tab "Lịch
// trình & Kỹ thuật" lồng trong trang chi tiết Order (src/app/manager/orders/[id]/page.tsx) để có
// breadcrumb + phần "Chấm công" (điểm danh + GPS check-in) riêng, theo yêu cầu người dùng 2026-08-02.
// Tổng quan + Chấm công hiển thị cùng 1 trang, không tách tab (yêu cầu chỉnh lại 2026-08-02).
//
// Dữ liệu chấm công/GPS lấy từ GET /schedule-plans/:planId — đã xác nhận qua đọc source thật
// `schedule.service.ts` (AssigneeDTO) tại D:\sep490-backend-api: mỗi assignee đã kèm sẵn checkInAt/
// checkOutAt/checkInEvidenceId/latitude/longitude, không cần gọi thêm endpoint nào khác. attendances.
// latitude/longitude và orders.latitude/longitude đều là cột thật (migration 20260728095707 và
// 20260731112151) — không phải mock.

const SCHEDULE_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Chờ xử lý', variant: 'neutral' },
  CONFIRMED: { label: 'Đã xác nhận', variant: 'info' },
  IN_PROGRESS: { label: 'Đang thi công', variant: 'warning' },
  COMPLETED: { label: 'Hoàn thành', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'error' },
};

const ASSIGNEE_ROLE_LABEL: Record<string, string> = {
  LEAD: 'Trưởng nhóm kỹ thuật',
  TECHNICAL: 'Nhân viên kỹ thuật',
};

type Assignee = NonNullable<SchedulePlan['assignees']>[number];

function ScheduleplanDetailContent() {
  const params = useParams<{ id: string; planId: string }>();
  const { id: orderId, planId } = params;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([orderApiService.getOrder(orderId), schedulePlanApiService.getSchedulePlanById(planId)])
      .then(([orderRes, planRes]) => {
        setOrder(orderRes.data as OrderDetail);
        setPlan(planRes.data as SchedulePlan);
      })
      .catch(() => setLoadError('Không tải được thông tin lịch trình.'))
      .finally(() => setIsLoading(false));
  }, [orderId, planId]);

  if (isLoading && !plan) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Đang tải thông tin lịch trình...</p>
      </div>
    );
  }

  if (!plan || !order) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">{loadError ?? 'Không tìm thấy lịch trình.'}</p>
        <Link href={`/manager/orders/${orderId}?tab=plans`} className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại đơn đặt
        </Link>
      </div>
    );
  }

  const assignees: Assignee[] = plan.assignees ?? [];

  const attendanceColumns: TableColumn<Assignee>[] = [
    {
      key: 'fullName',
      label: 'Nhân sự',
      render: (a) => (
        <div>
          <p className="font-semibold text-slate-900">{a.fullName}</p>
          <p className="text-xs text-slate-400">{ASSIGNEE_ROLE_LABEL[a.role] ?? a.role}</p>
        </div>
      ),
    },
    {
      key: 'checkInAt',
      label: 'Check-in',
      render: (a) => (a.checkInAt ? <span className="font-medium text-emerald-600">{formatDate(a.checkInAt)} · {formatTime(a.checkInAt)}</span> : <span className="text-slate-400">Chưa check-in</span>),
    },
    {
      key: 'checkOutAt',
      label: 'Check-out',
      render: (a) => (a.checkOutAt ? <span className="font-medium text-emerald-600">{formatDate(a.checkOutAt)} · {formatTime(a.checkOutAt)}</span> : <span className="text-slate-400">Chưa check-out</span>),
    },
    {
      key: 'gps',
      label: 'Vị trí GPS check-in',
      render: (a) => {
        if (a.latitude == null || a.longitude == null) {
          return <span className="text-slate-400">Chưa có dữ liệu</span>;
        }
        const distanceKm =
          order.latitude != null && order.longitude != null
            ? haversineDistanceKm({ lat: a.latitude, lng: a.longitude }, { lat: order.latitude, lng: order.longitude })
            : null;
        return (
          <div className="space-y-0.5">
            <p className="font-mono text-xs text-slate-600">
              {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
            </p>
            {distanceKm != null && <p className="text-xs text-slate-400">~{distanceKm.toFixed(2)} km từ địa điểm tổ chức</p>}
            <a
              href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              Xem trên bản đồ
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <Breadcrumb
        items={[
          { label: 'Đơn đặt' },
          { label: 'Danh sách đơn đặt', href: '/manager/orders' },
          { label: order.orderCode, href: `/manager/orders/${orderId}` },
          { label: 'Lịch trình' },
          { label: plan.taskName ?? plan.planCode },
        ]}
        className="mb-3"
      />

      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <BackButton href={`/manager/orders/${orderId}?tab=plans`} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{plan.taskName ?? plan.planCode}</h1>
              <Badge variant={SCHEDULE_STATUS_META[plan.status]?.variant ?? 'neutral'}>
                {SCHEDULE_STATUS_META[plan.status]?.label ?? plan.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono font-semibold text-slate-600">{plan.planCode}</span> · Thuộc đơn{' '}
              <span className="font-mono font-semibold text-slate-600">{order.orderCode}</span>
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6"
      >
        <h4 className="text-sm font-bold text-slate-950">Tổng quan</h4>

        <div>
          <p className="text-xs font-semibold text-slate-500">Người/đội phụ trách</p>
          {assignees.length > 0 ? (
            <div className="mt-1.5 space-y-1.5">
              {assignees.map((a) => (
                <p key={a.userId} className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">{a.fullName}</span>
                  <span className="text-slate-500">{ASSIGNEE_ROLE_LABEL[a.role] ?? a.role}</span>
                  {a.phone && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                      {a.phone}
                    </span>
                  )}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Chưa phân công.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">Ngày/giờ kế hoạch</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-900">
              <Calendar className="h-4 w-4 text-slate-400" />
              {formatDate(plan.startTime)} · {formatTime(plan.startTime)}
              {plan.endTime ? ` - ${formatTime(plan.endTime)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Địa điểm</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-900">
              <MapPin className="h-4 w-4 text-slate-400" />
              {plan.location ?? order.location}
            </p>
          </div>
        </div>

        {plan.notes && (
          <div>
            <p className="text-xs font-semibold text-slate-500">Ghi chú</p>
            <p className="mt-1 text-sm italic text-slate-600">{plan.notes}</p>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-5 space-y-3"
      >
        <div>
          <h4 className="text-sm font-bold text-slate-950">Chấm công</h4>
          <p className="text-xs text-slate-400">
            Check-in/check-out do nhân sự tự thực hiện qua app mobile — web chỉ hiển thị lại (đọc trực tiếp qua GET /schedule-plans/:planId).
          </p>
        </div>
        <Table
          columns={attendanceColumns}
          rows={assignees}
          rowKey={(a) => a.userId}
          emptyText="Chưa có nhân sự nào được phân công cho lịch trình này."
        />
      </motion.div>
    </div>
  );
}

export default function ScheduleplanDetailPage() {
  return <ScheduleplanDetailContent />;
}
