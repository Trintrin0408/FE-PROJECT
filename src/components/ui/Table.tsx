import React from 'react';
import { TABLE_STYLES, type TableDensity } from './tableStyles';

export interface TableColumn<T> {
  key: string;
  label: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  /** Áp cho CẢ `<th>` và `<td>` — giữ nguyên hành vi cũ để không phá các call site đang có. */
  className?: string;
  /** Chỉ áp cho `<th>` — dùng khi header cần class riêng (vd width cố định) mà không ảnh hưởng `<td>`. */
  headerClassName?: string;
  /**
   * Căn lề cột. Ưu tiên dùng prop này thay vì nhét `text-right`/`text-center` vào `className`:
   * repo không có tailwind-merge nên hai class `text-align` cùng lúc sẽ chọi nhau tuỳ thứ tự
   * Tailwind sinh CSS. `align` chọn đúng một token đã căn lề sẵn.
   */
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  rowClassName?: (row: T) => string;
  isLoading?: boolean;
  emptyText?: React.ReactNode;
  /** Nội dung hiện khi `isLoading`. Mặc định "Đang tải...". */
  loadingText?: React.ReactNode;
  /** Thông báo lỗi tải dữ liệu — có giá trị thì hiện thay cho rows/empty (khi không loading). */
  errorText?: React.ReactNode;
  /** `sm` cho bảng lồng trong modal/card hẹp. Mặc định `md`. */
  density?: TableDensity;
  /** Bỏ viền + bo góc của wrapper khi bảng đã nằm trong card có viền sẵn (tránh viền chồng viền). */
  flush?: boolean;
  /** Dòng tổng cộng render trong `<tfoot>` — dùng `tableStyles.tfootLabel`/`.tfootValue` cho các ô. */
  footer?: React.ReactNode;
}

function cellClass(base: string, center: string, right: string, align: 'left' | 'center' | 'right' | undefined, extra?: string) {
  const alignClass = align === 'right' ? right : align === 'center' ? center : base;
  return extra ? `${alignClass} ${extra}` : alignClass;
}

/** Giữ đúng hành vi gốc: cột không có `render` thì ép giá trị về string (tránh boolean/number bị JSX bỏ qua). */
function renderCellValue<T>(row: T, col: TableColumn<T>): React.ReactNode {
  if (col.render) return col.render(row);
  const value = (row as Record<string, unknown>)[col.key];
  return value == null ? '' : String(value);
}

function renderBody<T>(props: Readonly<TableProps<T>>, s: (typeof TABLE_STYLES)['md']) {
  const { columns, rows, rowKey, rowClassName, isLoading, emptyText, loadingText, errorText } = props;

  if (isLoading) {
    return (
      <tr>
        <td colSpan={columns.length} className={s.stateCell}>
          {loadingText ?? 'Đang tải...'}
        </td>
      </tr>
    );
  }

  if (errorText) {
    return (
      <tr>
        <td colSpan={columns.length} className={s.stateCell}>
          {errorText}
        </td>
      </tr>
    );
  }

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={columns.length} className={s.stateCell}>
          {emptyText}
        </td>
      </tr>
    );
  }

  return rows.map((row) => (
    <tr key={rowKey(row)} className={`${s.bodyRow} ${rowClassName?.(row) ?? ''}`}>
      {columns.map((col) => (
        <td key={col.key} className={cellClass(s.td, s.tdCenter, s.tdRight, col.align, col.className)}>
          {renderCellValue(row, col)}
        </td>
      ))}
    </tr>
  ));
}

export function Table<T>(props: Readonly<TableProps<T>>) {
  const { columns, isLoading = false, emptyText = 'Không có dữ liệu', density = 'md', flush = false, footer } = props;
  const s = TABLE_STYLES[density];

  return (
    <div className={flush ? s.wrapperInner : s.wrapper}>
      <table className={s.table}>
        <thead className={s.thead}>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cellClass(s.th, s.thCenter, s.thRight, col.align, `${col.className ?? ''} ${col.headerClassName ?? ''}`.trim())}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={s.tbody}>{renderBody({ ...props, isLoading, emptyText }, s)}</tbody>
        {footer && <tfoot className={s.tfoot}>{footer}</tfoot>}
      </table>
    </div>
  );
}

export default Table;
