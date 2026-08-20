'use client';

import { motion } from 'framer-motion';
import type { ChangeRequest, ChangeRequestType } from '@/types/changeRequest';
import type { Order } from '@/types/order';

export interface ApprovalCardProps {
  changeRequest: ChangeRequest;
  order?: Order;
  onApprove: () => void;
  onReject: () => void;
}

const TYPE_LABEL: Record<ChangeRequestType, string> = {
  add: 'Thêm thiết bị',
  remove: 'Bớt thiết bị',
  replace: 'Thay thiết bị',
};

export default function ApprovalCard({ changeRequest, order, onApprove, onReject }: Readonly<ApprovalCardProps>) {
  const addedCount = changeRequest.items
    .filter((i) => i.action === 'add')
    .reduce((sum, i) => sum + i.quantity, 0);
  const removedCount = changeRequest.items
    .filter((i) => i.action === 'remove')
    .reduce((sum, i) => sum + i.quantity, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-slate-100 bg-slate-50 p-4 shadow-xs"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
          Đơn #{order?.orderId ?? changeRequest.orderId}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {TYPE_LABEL[changeRequest.type]}
        </span>
      </div>
      {/* <p className="mt-1 italic text-[10px] text-slate-400" title="Backend không còn API cho ChangeRequest — dữ liệu minh họa">
        (Dữ liệu minh họa — chưa có API)
      </p> */}
      <p className="mt-2.5 text-sm text-slate-600">
        {addedCount > 0 && <>Thêm {addedCount} thiết bị. </>}
        {removedCount > 0 && <>Bớt {removedCount} thiết bị.</>}
        {addedCount === 0 && removedCount === 0 && 'Yêu cầu thay đổi thiết bị.'}
      </p>
      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
        >
          Phê duyệt
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50"
        >
          Từ chối
        </button>
      </div>
    </motion.div>
  );
}
