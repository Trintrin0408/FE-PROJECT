'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';
import type { WorkTask } from '@/types/workTask';

interface WorkTaskDeleteDialogProps {
  isOpen: boolean;
  task: WorkTask | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const WorkTaskDeleteDialog: React.FC<WorkTaskDeleteDialogProps> = ({
  isOpen,
  task,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Xóa công việc</h3>
        <p className="mb-6 text-sm text-slate-500">
          Bạn có chắc chắn muốn xóa công việc <strong>{task?.taskName}</strong> không?
          <br />
          Hành động này sẽ thay đổi trạng thái của công việc thành ngưng hoạt động.
        </p>
        <div className="flex w-full justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting} className="w-full sm:w-auto">
            Hủy
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isDeleting}
            className="w-full bg-red-600 hover:bg-red-700 text-white sm:w-auto"
          >
            Xóa công việc
          </Button>
        </div>
      </div>
    </Modal>
  );
};
