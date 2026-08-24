/**
 * Token style dùng chung cho MỌI bảng trong hệ thống — cả `ui/Table.tsx` lẫn các bảng viết tay
 * (có `<tfoot>` dòng tổng, ô nhập liệu trong cell, cột sinh động theo dữ liệu... mà `ui/Table`
 * không hỗ trợ nên phải tự viết `<table>`). Thay vì ép các bảng đó vào `ui/Table` và mất tính
 * năng, ta tách class ra token dùng chung: bảng viết tay giữ nguyên cấu trúc JSX, chỉ dán token
 * vào `className`.
 *
 * `ui/Table.tsx` render bằng chính token này — đổi padding/màu ở đây là đổi cho cả hai.
 *
 * Cách dùng cho bảng viết tay:
 * ```tsx
 * import { tableStyles } from '@/components/ui/tableStyles';
 *
 * <div className={tableStyles.wrapper}>
 *   <table className={tableStyles.table}>
 *     <thead className={tableStyles.thead}>
 *       <tr>
 *         <th className={tableStyles.th}>Tên hạng mục</th>
 *         <th className={tableStyles.thRight}>Thành tiền</th>
 *       </tr>
 *     </thead>
 *     <tbody className={tableStyles.tbody}>
 *       {rows.map((r) => (
 *         <tr key={r.id} className={tableStyles.bodyRow}>
 *           <td className={tableStyles.td}>{r.name}</td>
 *           <td className={tableStyles.tdRight}>{formatCurrency(r.amount)}</td>
 *         </tr>
 *       ))}
 *     </tbody>
 *     <tfoot className={tableStyles.tfoot}>
 *       <tr>
 *         <td className={tableStyles.tfootLabel}>Tổng cộng</td>
 *         <td className={tableStyles.tfootValue}>{formatCurrency(total)}</td>
 *       </tr>
 *     </tfoot>
 *   </table>
 * </div>
 * ```
 */

/**
 * `md` = mật độ chuẩn của trang danh sách. `sm` = bảng lồng trong modal/card hẹp.
 * `compact` = bảng ERP/SaaS gọn (row ~72-88px, header không uppercase nặng) — dùng khi trang cần
 * scan nhiều dữ liệu mà không phá layout các trang khác đang dùng `md`/`sm`.
 */
export type TableDensity = 'md' | 'sm' | 'compact';

export interface TableStyleTokens {
  /** Bọc ngoài `<table>` khi bảng đứng độc lập — tự có viền, bo góc và cuộn ngang. */
  wrapper: string;
  /** Bọc ngoài `<table>` khi bảng ĐÃ nằm trong card có viền — chỉ giữ cuộn ngang, tránh viền chồng viền. */
  wrapperInner: string;
  table: string;
  thead: string;
  /** Ô tiêu đề, căn trái (mặc định). */
  th: string;
  thCenter: string;
  thRight: string;
  tbody: string;
  /** Hàng dữ liệu — đã gồm hover. Nối thêm class riêng của hàng vào sau (vd nền cảnh báo). */
  bodyRow: string;
  /**
   * Ô dữ liệu — KHÔNG chứa class căn lề (giữ đúng hành vi `ui/Table` hiện tại). Muốn căn giữa/phải
   * thì dùng `tdCenter`/`tdRight` thay vì nối thêm `text-right` vào `td`: repo không có
   * tailwind-merge nên hai class `text-align` cùng lúc sẽ chọi nhau tuỳ thứ tự build.
   */
  td: string;
  tdCenter: string;
  tdRight: string;
  tfoot: string;
  /** Ô nhãn của dòng tổng (`<tfoot>`), thường đi kèm `colSpan`. */
  tfootLabel: string;
  /** Ô số liệu của dòng tổng. */
  tfootValue: string;
  /**
   * Ô `colSpan` full-width cho trạng thái đang tải / trống / lỗi.
   * Chỉ định nghĩa khung ô — nội dung (chuỗi, icon, nhiều dòng) do nơi gọi tự quyết.
   */
  stateCell: string;
  /** `<input>` / `<select>` nhúng trực tiếp trong ô (bảng sửa được tại chỗ). */
  cellControl: string;
  /** Cột đầu ghim khi cuộn ngang (bảng heatmap/lịch nhiều cột). Nối cùng `th`/`td`. */
  stickyFirstCol: string;
}

const HEAD_CELL_BASE = 'whitespace-nowrap font-semibold uppercase tracking-wide text-slate-500';
const BODY_CELL_BASE = 'text-sm text-slate-700';

/**
 * Token theo mật độ. Nhánh `md` giữ **giống hệt từng ký tự** class mà `ui/Table.tsx` render
 * trước khi tách file này ra — refactor không đổi giao diện.
 */
export const TABLE_STYLES: Record<TableDensity, TableStyleTokens> = {
  md: {
    wrapper: 'overflow-x-auto rounded-2xl border border-slate-200',
    wrapperInner: 'overflow-x-auto',
    table: 'min-w-full divide-y divide-slate-100 text-sm',
    thead: 'bg-slate-50/80',
    th: `px-5 py-3.5 text-left text-[11px] ${HEAD_CELL_BASE}`,
    thCenter: `px-5 py-3.5 text-center text-[11px] ${HEAD_CELL_BASE}`,
    thRight: `px-5 py-3.5 text-right text-[11px] ${HEAD_CELL_BASE}`,
    tbody: 'divide-y divide-slate-100 bg-white',
    bodyRow: 'transition-colors hover:bg-slate-50/70',
    td: `px-5 py-4 ${BODY_CELL_BASE}`,
    tdCenter: `px-5 py-4 text-center ${BODY_CELL_BASE}`,
    tdRight: `px-5 py-4 text-right ${BODY_CELL_BASE}`,
    tfoot: 'border-t border-slate-200 bg-slate-50',
    tfootLabel: 'px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500',
    tfootValue: 'px-5 py-3.5 text-right text-sm font-bold text-slate-900',
    stateCell: 'px-5 py-8 text-center text-slate-400',
    cellControl:
      'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500',
    stickyFirstCol: 'sticky left-0 z-10 bg-white',
  },
  sm: {
    wrapper: 'overflow-x-auto rounded-xl border border-slate-200',
    wrapperInner: 'overflow-x-auto',
    table: 'min-w-full divide-y divide-slate-100 text-sm',
    thead: 'bg-slate-50/80',
    th: `px-3 py-2.5 text-left text-[11px] ${HEAD_CELL_BASE}`,
    thCenter: `px-3 py-2.5 text-center text-[11px] ${HEAD_CELL_BASE}`,
    thRight: `px-3 py-2.5 text-right text-[11px] ${HEAD_CELL_BASE}`,
    tbody: 'divide-y divide-slate-100 bg-white',
    bodyRow: 'transition-colors hover:bg-slate-50/70',
    td: `px-3 py-2.5 ${BODY_CELL_BASE}`,
    tdCenter: `px-3 py-2.5 text-center ${BODY_CELL_BASE}`,
    tdRight: `px-3 py-2.5 text-right ${BODY_CELL_BASE}`,
    tfoot: 'border-t border-slate-200 bg-slate-50',
    tfootLabel: 'px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500',
    tfootValue: 'px-3 py-2.5 text-right text-sm font-bold text-slate-900',
    stateCell: 'px-3 py-6 text-center text-slate-400',
    cellControl:
      'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500',
    stickyFirstCol: 'sticky left-0 z-10 bg-white',
  },
  compact: {
    wrapper: 'overflow-x-auto rounded-2xl border border-slate-200',
    wrapperInner: 'overflow-x-auto',
    table: 'min-w-full divide-y divide-slate-100 text-sm',
    thead: 'bg-slate-50/80',
    th: 'px-4 py-3 text-left text-xs font-semibold text-slate-500',
    thCenter: 'px-4 py-3 text-center text-xs font-semibold text-slate-500',
    thRight: 'px-4 py-3 text-right text-xs font-semibold text-slate-500',
    tbody: 'divide-y divide-slate-100 bg-white',
    bodyRow: 'transition-colors hover:bg-slate-50/70',
    td: `px-4 py-4 align-middle ${BODY_CELL_BASE}`,
    tdCenter: `px-4 py-4 text-center align-middle ${BODY_CELL_BASE}`,
    tdRight: `px-4 py-4 text-right align-middle ${BODY_CELL_BASE}`,
    tfoot: 'border-t border-slate-200 bg-slate-50',
    tfootLabel: 'px-4 py-3 text-right text-xs font-semibold text-slate-500',
    tfootValue: 'px-4 py-3 text-right text-sm font-bold text-slate-900',
    stateCell: 'px-4 py-8 text-center text-slate-400',
    cellControl:
      'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500',
    stickyFirstCol: 'sticky left-0 z-10 bg-white',
  },
};

/** Alias mật độ chuẩn — dùng thẳng cho hầu hết bảng, khỏi phải viết `TABLE_STYLES.md`. */
export const tableStyles = TABLE_STYLES.md;

/** Alias mật độ nén — bảng trong modal, drawer, card hẹp. */
export const tableStylesSm = TABLE_STYLES.sm;
