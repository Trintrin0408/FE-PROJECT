'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { WorkTask, CreateWorkTaskBody } from '@/types/workTask';

export interface WorkTaskFormValues extends CreateWorkTaskBody {}

interface WorkTaskFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  task: WorkTask | null;
  isSubmitting: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (values: WorkTaskFormValues) => void;
}

export const WorkTaskFormModal: React.FC<WorkTaskFormModalProps> = ({
  isOpen,
  mode,
  task,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [taskCode, setTaskCode] = useState('');
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && task) {
        setTaskCode(task.taskCode || '');
        setTaskName(task.taskName || '');
        setDescription(task.description || '');
        setIsActive(task.isActive ?? true);
      } else {
        setTaskCode('');
        setTaskName('');
        setDescription('');
        setIsActive(true);
      }
    }
  }, [isOpen, mode, task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ taskCode, taskName, description, isActive });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Thêm công việc' : 'Cập nhật công việc'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          <Input
            label="Mã công việc *"
            value={taskCode}
            onChange={(e) => setTaskCode(e.target.value)}
            placeholder="Ví dụ: TSK-SURVEY"
            required
            disabled={isSubmitting || mode === 'edit'}
          />

          <Input
            label="Tên công việc *"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="Nhập tên công việc"
            required
            disabled={isSubmitting}
          />

          <Textarea
            label="Mô tả"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ghi chú thêm về loại công việc này..."
            disabled={isSubmitting}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
              Đang hoạt động
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" isLoading={isSubmitting}>
            {mode === 'create' ? 'Tạo mới' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
