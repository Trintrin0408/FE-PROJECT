import React, { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: (SelectOption | SelectOptionGroup)[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helpText,
  options,
  placeholder,
  id,
  className = '',
  ...props
}) => {
  const borderColor = error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={id}
        {...props}
        className={`block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-150 ${borderColor} ${className}`}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((opt, i) => {
          if ('options' in opt) {
            return (
              <optgroup key={i} label={opt.label}>
                {opt.options.map((subOpt) => (
                  <option key={subOpt.value} value={subOpt.value}>
                    {subOpt.label}
                  </option>
                ))}
              </optgroup>
            );
          }
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
      {helpText && !error && <p className="text-xs text-gray-500 mt-0.5">{helpText}</p>}
    </div>
  );
};

export default Select;
