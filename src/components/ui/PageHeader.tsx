import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';
import { BackButton } from './BackButton';

export interface PageHeaderProps {
  /** Tiêu đề trang. Luôn render thành `<h1 className="text-2xl font-bold text-slate-900">`. */
  title: ReactNode;
  /** Icon đứng trước tiêu đề, cùng hàng (căn giữa theo chiều dọc với `<h1>`) — vd `<ClipboardList className="h-6 w-6 text-blue-600" />`. */
  icon?: ReactNode;
  /** Mô tả phụ một dòng dưới tiêu đề. */
  description?: ReactNode;
  /**
   * Chip nhỏ phía TRÊN tiêu đề (vd "Sổ tay mua sắm & thuê mượn").
   * Truyền nội dung thôi — khung pill xanh do component tự dựng.
   */
  eyebrow?: ReactNode;
  /** Phần tử nằm NGANG HÀNG với tiêu đề, bên phải chữ — thường là `<Badge>` trạng thái. */
  titleAdornment?: ReactNode;
  /** Hàng thông tin phụ dưới mô tả (avatar khách, địa điểm, ngày sự kiện...). */
  meta?: ReactNode;
  /** Nút hành động ở mép phải (Button, nhóm Button, dropdown...). */
  actions?: ReactNode;
  /** Breadcrumb render phía trên toàn bộ header. Mục cuối là trang hiện tại. */
  breadcrumb?: BreadcrumbItem[];
  /** Có giá trị thì hiện nút tròn quay lại bên trái khối tiêu đề (trang chi tiết). */
  backHref?: string;
  className?: string;
}

/**
 * Header chuẩn cho mọi trang — gom các biến thể `<h1>` và kiểu wrapper đang rải rác về một chỗ.
 *
 * Chuẩn đã chốt: `text-2xl font-bold text-slate-900` cho `<h1>`, `mt-1 text-sm text-slate-500`
 * cho mô tả (đã là chuẩn de-facto ở đa số trang), wrapper `flex flex-wrap items-start
 * justify-between gap-3` (biến thể phổ biến nhất).
 *
 * KHÔNG bọc `Reveal`: header luôn nằm trên màn hình ngay khi vào trang, animation ở đây chỉ
 * tạo cảm giác giật chứ không phải scroll-reveal thật. Scroll-reveal áp cho các card bên dưới
 * (`FilterBar`, `Reveal`).
 *
 * Trang vẫn tự chịu trách nhiệm container `<div className="p-6">` bao ngoài như hiện tại.
 */
export function PageHeader({
  title,
  icon,
  description,
  eyebrow,
  titleAdornment,
  meta,
  actions,
  breadcrumb,
  backHref,
  className = '',
}: Readonly<PageHeaderProps>) {
  const titleBlock = (
    <div className="min-w-0">
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-600">
          {eyebrow}
        </span>
      )}
      <div className={`flex flex-wrap items-center gap-3 ${eyebrow ? 'mt-2' : ''}`}>
        {icon}
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {titleAdornment}
      </div>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {meta && <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">{meta}</div>}
    </div>
  );

  return (
    <div className={className}>
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className={`flex flex-wrap items-start justify-between gap-3 ${breadcrumb ? 'mt-2' : ''}`}>
        {backHref ? (
          <div className="flex min-w-0 items-start gap-3">
            <BackButton href={backHref} />
            {titleBlock}
          </div>
        ) : (
          titleBlock
        )}
        {actions && <div className="flex items-center gap-2 print:hidden">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
