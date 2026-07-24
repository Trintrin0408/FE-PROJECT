interface StatusPillProps {
  label: string;
  badgeClass: string;
  className?: string;
}

/** Pill trạng thái dùng chung cho staff-mobile — nhận thẳng label/badgeClass đã định nghĩa sẵn ở các
 * *_META (TASK_STATUS_META, ATTENDANCE_STATUS_META, HANDOVER_STATUS_META...) thay vì tự map lại màu. */
export default function StatusPill({ label, badgeClass, className = '' }: Readonly<StatusPillProps>) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass} ${className}`}>
      {label}
    </span>
  );
}
