'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SelectOption, SelectOptionGroup } from './Select';

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | SelectOptionGroup)[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyText?: string;
  /** Gọi mỗi khi người dùng gõ vào ô — dùng khi cần tìm kiếm thêm qua API (server-side) thay vì chỉ lọc trong `options` đã có sẵn. */
  onQueryChange?: (query: string) => void;
  /** `sm` dùng cho các hàng dày đặc (padding/chữ nhỏ hơn) — mặc định `md` giữ nguyên kích thước gốc. */
  size?: 'md' | 'sm';
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục',
  searchPlaceholder,
  disabled,
  required,
  emptyText = 'Không tìm thấy kết quả phù hợp.',
  onQueryChange,
  size = 'md',
}: Readonly<SearchableSelectProps>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const flatOptions = useMemo(() => options.flatMap((o) => ('options' in o ? o.options : [o])), [options]);

  // Đồng bộ chữ hiển thị trong ô theo `value` do bên ngoài kiểm soát, chỉ khi không đang gõ dở —
  // phụ thuộc cả `flatOptions` để nếu `options` tải xong sau (async) vẫn tự điền đúng tên đã chọn sẵn.
  useEffect(() => {
    if (open) return;
    setQuery(flatOptions.find((o) => o.value === value)?.label ?? '');
  }, [value, flatOptions, open]);

  type FilteredEntry = { group: false; option: SelectOption } | { group: true; label: string; options: SelectOption[] };

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = (o: SelectOption) => !normalizedQuery || o.label.toLowerCase().includes(normalizedQuery);
    const entries: FilteredEntry[] = [];
    for (const opt of options) {
      if ('options' in opt) {
        const groupOptions = opt.options.filter(matches);
        if (groupOptions.length > 0) entries.push({ group: true, label: opt.label, options: groupOptions });
      } else if (matches(opt)) {
        entries.push({ group: false, option: opt });
      }
    }
    return entries;
  }, [options, query]);

  const totalResults = filteredEntries.reduce((sum, e) => sum + (e.group ? e.options.length : 1), 0);

  const sizeClass = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectOption = (opt: SelectOption) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && (
        <span className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange('');
            onQueryChange?.(next);
            setOpen(true);
          }}
          placeholder={searchPlaceholder ?? placeholder}
          className={`block w-full rounded-lg border border-gray-300 bg-white text-gray-900 shadow-sm placeholder:text-gray-400 transition-colors duration-150 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${sizeClass}`}
        />

        {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <ul className="max-h-56 overflow-y-auto py-1">
              {filteredEntries.map((entry, i) =>
                entry.group ? (
                  <li key={`group-${i}-${entry.label}`}>
                    <span className="block px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{entry.label}</span>
                    <ul>
                      {entry.options.map((opt) => (
                        <li key={opt.value}>
                          <button
                            type="button"
                            onClick={() => selectOption(opt)}
                            className={`w-full text-left transition-colors duration-100 hover:bg-blue-50 ${sizeClass} ${
                              opt.value === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={entry.option.value}>
                    <button
                      type="button"
                      onClick={() => selectOption(entry.option)}
                      className={`w-full text-left transition-colors duration-100 hover:bg-blue-50 ${sizeClass} ${
                        entry.option.value === value ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {entry.option.label}
                    </button>
                  </li>
                ),
              )}
              {totalResults === 0 && <li className="px-3 py-2 text-sm italic text-gray-400">{emptyText}</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchableSelect;
