import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onTrailingIconClick?: () => void;
  variant?: 'bordered' | 'underline';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helpText,
  icon,
  trailingIcon,
  onTrailingIconClick,
  variant = 'bordered',
  id,
  className = '',
  ...props
}) => {
  const isUnderline = variant === 'underline';
  const isNumber = props.type === 'number';

  const formatNumber = (val: string | number | readonly string[] | undefined) => {
    if (val === undefined || val === null || val === '') return '';
    let str = val.toString().replace(/[^0-9.-]/g, '');
    if (str === '-' || str === '.') return str;
    
    str = str.replace(/^(-?)0+(?=\d)/, '$1'); // Remove leading zeros (05 -> 5)
    
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isNumber && props.onChange) {
      let rawValue = e.target.value;
      
      // Allow users to type dot or comma as decimal if they haven't typed thousands separators yet?
      // No, let's stick to standard VN format: dot is thousands, comma is decimal.
      rawValue = rawValue.replace(/\./g, ''); // Remove thousands separators
      rawValue = rawValue.replace(/,/g, '.'); // Convert decimal comma back to dot for JS

      rawValue = rawValue.replace(/^(-?)0+(?=\d)/, '$1'); // Remove leading zeros
      
      const newEvent = { ...e } as any;
      newEvent.target = { ...e.target, value: rawValue, name: e.target.name, id: e.target.id };
      props.onChange(newEvent);
    } else if (props.onChange) {
      props.onChange(e);
    }
  };

  const displayValue = isNumber && props.value !== undefined ? formatNumber(props.value) : props.value;
  const displayDefaultValue = isNumber && props.defaultValue !== undefined ? formatNumber(props.defaultValue) : props.defaultValue;

  let leadingPadding = '';
  if (icon) leadingPadding = isUnderline ? 'pl-7' : 'pl-10';

  let trailingPadding = '';
  if (trailingIcon) trailingPadding = isUnderline ? 'pr-7' : 'pr-10';

  let borderColor = isUnderline ? 'border-slate-200' : 'border-slate-300 bg-white';
  if (error) borderColor = isUnderline ? 'border-red-400' : 'border-red-400 bg-red-50';

  let fieldClassName = `
        block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm
        placeholder:text-slate-400
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
        transition-colors duration-150
        ${leadingPadding} ${trailingPadding} ${borderColor}
      `;
  if (isUnderline) {
    fieldClassName = `
        block w-full border-0 border-b-2 bg-transparent px-0 py-2 text-sm text-slate-900
        placeholder:text-slate-400
        focus:outline-none focus:border-blue-600
        disabled:text-slate-400 disabled:cursor-not-allowed
        transition-colors duration-150
        ${leadingPadding} ${trailingPadding} ${borderColor}
      `;
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className={`pointer-events-none absolute inset-y-0 left-0 flex items-center text-slate-400 ${variant === 'underline' ? '' : 'pl-3'}`}
          >
            {icon}
          </span>
        )}
        <input 
          id={id} 
          {...props} 
          type={isNumber ? 'text' : props.type}
          inputMode={isNumber ? 'numeric' : props.inputMode}
          value={displayValue}
          defaultValue={displayDefaultValue}
          onChange={handleChange}
          className={`${fieldClassName} ${className}`} 
        />
        {trailingIcon && onTrailingIconClick && (
          <button
            type="button"
            onClick={onTrailingIconClick}
            className={`absolute inset-y-0 right-0 flex items-center text-slate-400 hover:text-slate-600 ${isUnderline ? '' : 'pr-3'}`}
          >
            {trailingIcon}
          </button>
        )}
        {trailingIcon && !onTrailingIconClick && (
          <span className={`pointer-events-none absolute inset-y-0 right-0 flex items-center text-blue-500 ${isUnderline ? '' : 'pr-3'}`}>
            {trailingIcon}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
      {helpText && !error && <p className="text-xs text-slate-500 mt-0.5">{helpText}</p>}
    </div>
  );
};

export default Input;
