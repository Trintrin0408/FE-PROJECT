'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyText?: string;
  /** Gọi mỗi khi người dùng gõ vào ô tìm kiếm — dùng khi cần tìm kiếm thêm qua API (server-side) thay vì chỉ lọc trong `options` đã có sẵn. */
  onQueryChange?: (query: string) => void;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục',
  searchPlaceholder = 'Tìm kiếm...',
  disabled,
  required,
  emptyText = 'Không tìm thấy kết quả phù hợp.',
  onQueryChange,
}: Readonly<SearchableSelectProps>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateQuery = useCallback(
    (next: string) => {
      setQuery(next);
      onQueryChange?.(next);
    },
    [onQueryChange],
  );

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((o) => o.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        updateQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, updateQuery]);

  useEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open]);

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <span className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm transition-colors duration-150 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
        >
          <span className={selectedOption ? '' : 'text-gray-400'}>{selectedOption?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
        </button>

        {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-sm text-gray-900 focus:outline-none"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filteredOptions.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      updateQuery('');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors duration-100 hover:bg-blue-50 ${
                      opt.value === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
              {filteredOptions.length === 0 && <li className="px-3 py-2 text-sm italic text-gray-400">{emptyText}</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchableSelect;
