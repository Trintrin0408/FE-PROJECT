'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ChangeRequest, ChangeRequestType } from '@/types/changeRequest';

const TYPE_LABEL: Record<ChangeRequestType, string> = {
  add: 'Thêm thiết bị',
  remove: 'Bớt thiết bị',
  replace: 'Thay thiết bị',
};

function describe(cr: ChangeRequest): string {
  const added = cr.items.filter((i) => i.action === 'add').reduce((s, i) => s + i.quantity, 0);
  const removed = cr.items.filter((i) => i.action === 'remove').reduce((s, i) => s + i.quantity, 0);
  const parts: string[] = [];
  if (added > 0) parts.push(`thêm ${added} thiết bị`);
  if (removed > 0) parts.push(`bớt ${removed} thiết bị`);
  return parts.length > 0 ? `Khách hàng yêu cầu ${parts.join(', ')}.` : 'Yêu cầu thay đổi thiết bị từ hiện trường.';
}

interface FieldChangeRequestCardProps {
  changeRequests: ChangeRequest[];
  canManage: boolean;
  submittingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function FieldChangeRequestCard({
  changeRequests,
  canManage,
  submittingId,
  onApprove,
  onReject,
}: Readonly<FieldChangeRequestCardProps>) {
  const pending = changeRequests.filter((cr) => cr.status === 'pending');

  if (pending.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400 shadow-xs"
      >
        Không có yêu cầu thay đổi từ hiện trường.
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-xs"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <h3 className="text-base font-semibold text-orange-800">Yêu cầu thay đổi từ hiện trường</h3>
      </div>

      <div className="space-y-4">
        {pending.map((cr) => (
          <div key={cr.changeRequestId} className="rounded-xl bg-white/70 p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                {TYPE_LABEL[cr.type]}
              </span>
            </div>
            <p className="text-sm text-slate-700">{describe(cr)}</p>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  isLoading={submittingId === cr.changeRequestId}
                  disabled={submittingId !== null}
                  onClick={() => onApprove(cr.changeRequestId)}
                >
                  Chấp thuận
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  disabled={submittingId !== null}
                  onClick={() => onReject(cr.changeRequestId)}
                >
                  Từ chối
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
