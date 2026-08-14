'use client';

import MasterSchedule from '@/components/schedule/MasterSchedule';

export default function Page() {
  return (
    <div className="p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Lịch tổng thể</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bức tranh toàn cảnh: mức bận theo ngày, lịch sự kiện, timeline đơn, lịch nhân sự (cảnh báo trùng) và thời gian thiết bị đi/về —
          để nắm nhanh đang trống hay kín mà sắp xếp nhân sự, thiết bị.
        </p>
      </div>
      <div className="mt-6">
        <MasterSchedule orderHref={(orderId) => `/manager/orders/${orderId}`} hiddenViews={['dispatch']} />
      </div>
    </div>
  );
}
