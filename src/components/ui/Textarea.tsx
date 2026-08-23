import React, { type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
  /** Cho phép kéo giãn chiều cao. Mặc định `false` (`resize-none`). */
  resizable?: boolean;
}

/**
 * Ô nhập nhiều dòng dùng chung — thay cho chuỗi `textareaClassName` từng bị copy-paste y hệt
 * ở nhiều modal form (ghi chú, mô tả, lý do hủy...).
 *
 * API cố ý khớp `ui/Input` (cùng `label`/`error`/`helpText`, cùng wrapper `flex flex-col gap-1`,
 * cùng nấc bo góc/shadow/focus ring) để trong một form trộn Input và Textarea vẫn thẳng hàng.
 */
export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helpText,
  resizable = false,
  rows = 3,
  id,
  className = '',
  ...props
}) => {
  const borderColor = error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white';
  const resizeClass = resizable ? 'resize-y' : 'resize-none';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        {...props}
        className={`block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm
          placeholder:text-slate-400
          focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500
          transition-colors duration-150
          ${resizeClass} ${borderColor} ${className}`}
      />
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      {helpText && !error && <p className="mt-0.5 text-xs text-slate-500">{helpText}</p>}
    </div>
  );
};

export default Textarea;
