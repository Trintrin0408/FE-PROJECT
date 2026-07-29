import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  /** Bỏ trống nếu mục này không phải link (vd tên section cha, hoặc chính mục hiện tại). */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Thanh điều hướng breadcrumb dùng chung cho mọi trang chi tiết — mục cuối luôn là trang hiện tại
 * (in đậm, không phải link), các mục có `href` ở giữa là link "back" về trang danh sách cha. */
export function Breadcrumb({ items, className = '' }: Readonly<BreadcrumbProps>) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-sm text-slate-400 print:hidden ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-blue-600 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-slate-600' : ''}>{item.label}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default Breadcrumb;
