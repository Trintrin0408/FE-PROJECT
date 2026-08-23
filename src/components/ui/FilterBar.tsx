'use client';

import type { ReactNode } from 'react';
import Reveal from './Reveal';

export interface FilterBarProps {
  children: ReactNode;
  /**
   * `default` = `mt-6` (khoảng cách chuẩn dưới `PageHeader`).
   * `none` = không margin — dùng khi card không nằm ngay sau header (vd sau hàng KPI đã có `mt-6`).
   */
  spacing?: 'default' | 'none';
  /** Trễ scroll-reveal (giây) — dùng để so le khi có nhiều card liền nhau trên cùng trang. */
  delay?: number;
  /** Class phụ cho card (vd `sm:p-6` ở màn có bảng rất rộng). */
  className?: string;
}

/**
 * Card trắng bọc khu vực danh sách của một trang: hàng filter + bảng + phân trang.
 *
 * Tên gọi "FilterBar" theo cách gọi quen của dự án, nhưng phạm vi thật là cả khối danh sách —
 * phần lớn chỗ đang dùng card này chứa `<Table>` và `<Pagination>` bên trong, không chỉ filter.
 * Vì vậy `children` để tự do thay vì ép slot cứng.
 *
 * Đã bọc sẵn `Reveal` (scroll-reveal bắt buộc theo CLAUDE.md mục 4) — nơi gọi không cần viết
 * lại khối `motion.div` thủ công nữa.
 */
export function FilterBar({ children, spacing = 'default', delay, className = '' }: Readonly<FilterBarProps>) {
  const marginClass = spacing === 'none' ? '' : 'mt-6';
  return (
    <Reveal delay={delay} className={`${marginClass} rounded-xl border border-slate-200 bg-white p-4 shadow-xs ${className}`}>
      {children}
    </Reveal>
  );
}

/** Kiểu sắp xếp hàng filter, gom từ nhiều biến thể đang có trong repo. */
export type FilterRowLayout = 'between' | 'start' | 'end' | 'stack';

const layoutClasses: Record<FilterRowLayout, string> = {
  /** Nhóm trái (tabs/nhãn) đẩy sang trái, nhóm phải (ô search/nút) đẩy sang phải. Phổ biến nhất. */
  between: 'flex flex-wrap items-center justify-between gap-3',
  /** Các control xếp liền nhau từ trái. Dùng khi có nhiều Select cùng chiều cao. */
  start: 'flex flex-wrap items-center gap-3',
  /** Căn đáy — dùng khi trộn control CÓ label với control KHÔNG label (nếu không sẽ lệch đáy). */
  end: 'flex flex-wrap items-end gap-3',
  /** Xếp dọc trên mobile, ngang từ `lg` — cho hàng filter dài dễ tràn. */
  stack: 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
};

export interface FilterRowProps {
  children: ReactNode;
  /** Mặc định `between`. */
  layout?: FilterRowLayout;
  /** Thêm đường kẻ ngăn cách dưới hàng filter (khi bên dưới là bảng dày đặc). */
  divider?: boolean;
  /** Class phụ (vd `mb-4`, `gap-1.5` cho hàng chỉ toàn chip). */
  className?: string;
}

/**
 * Một hàng control filter bên trong `FilterBar`. Tách riêng để các trang không phải nhớ chuỗi
 * flex nào là chuẩn — nhưng vẫn cho `className` để giữ được các ca đặc thù.
 *
 * Trang có filter nâng cao bung/thu chỉ việc đặt `FilterRow` thứ hai với `divider` hoặc
 * `className="mt-3 border-t border-slate-100 pt-3"`.
 */
export function FilterRow({ children, layout = 'between', divider = false, className = '' }: Readonly<FilterRowProps>) {
  const dividerClass = divider ? 'border-b border-slate-100 pb-3.5' : '';
  return <div className={`${layoutClasses[layout]} ${dividerClass} ${className}`}>{children}</div>;
}

export default FilterBar;
