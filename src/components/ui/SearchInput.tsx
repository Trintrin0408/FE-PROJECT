'use client';

import { Search, X } from 'lucide-react';
import { Input } from './Input';

/** Bề rộng ô tìm kiếm — 3 preset gom từ nhiều giá trị đang rải rác trong repo. */
export type SearchInputWidth = 'grow' | 'fixed' | 'full';

const widthClasses: Record<SearchInputWidth, string> = {
  /** Chiếm phần còn lại của hàng filter, tối thiểu 240px rồi mới xuống dòng. */
  grow: 'min-w-[240px] flex-1',
  /** Rộng cố định trên desktop, full-width trên mobile. */
  fixed: 'w-full sm:w-64',
  /** Chiếm trọn dòng — dùng trong modal, drawer, hoặc filter xếp dọc. */
  full: 'w-full',
};

export interface SearchInputProps {
  /** Giá trị đang gõ (controlled). */
  value: string;
  /**
   * Nhận thẳng chuỗi, không phải event — ô tìm kiếm chỉ có một payload duy nhất.
   * Muốn debounce thì bọc bằng `useDebounce` ở tầng trang như các màn hiện có đang làm.
   */
  onChange: (value: string) => void;
  /** Mặc định "Tìm kiếm..." — nên truyền chuỗi cụ thể (vd "Tìm theo tên, SĐT, email..."). */
  placeholder?: string;
  /** Preset bề rộng của wrapper. Mặc định `grow`. */
  width?: SearchInputWidth;
  /** Class phụ cho wrapper (KHÔNG phải cho thẻ `<input>`) — dùng cho vài chỗ đặc thù như `lg:max-w-sm`. */
  className?: string;
  /**
   * Truyền hàm này để hiện nút xoá nhanh khi đang có chữ.
   * Không truyền = không có nút xoá (giữ đúng giao diện các ô search hiện tại).
   */
  onClear?: () => void;
  disabled?: boolean;
  /** Nhãn a11y khi ô không có label nhìn thấy được. Mặc định "Tìm kiếm". */
  'aria-label'?: string;
  id?: string;
}

/**
 * Ô tìm kiếm chuẩn của toàn site — bọc `ui/Input` với icon kính lúp bên trái.
 *
 * Ra đời để dẹp các biến thể style ô search đang tồn tại (nhiều trang tự viết `<input>` thô với
 * `rounded-md`/`pl-8`/không shadow, một số trang dùng đúng `Input`). Chuẩn đã chốt là kiểu của
 * `ui/Input`: `rounded-lg`, `shadow-sm`, icon `pl-10`, `focus:ring-2`.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  width = 'grow',
  className = '',
  onClear,
  disabled,
  id,
  'aria-label': ariaLabel = 'Tìm kiếm',
}: Readonly<SearchInputProps>) {
  const showClear = Boolean(onClear) && value.length > 0;

  return (
    <div className={`${widthClasses[width]} ${className}`}>
      <Input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        icon={<Search className="h-4 w-4" />}
        trailingIcon={showClear ? <X className="h-4 w-4" /> : undefined}
        onTrailingIconClick={showClear ? onClear : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default SearchInput;
