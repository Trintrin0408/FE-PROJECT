import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  href: string;
  className?: string;
}

/** Nút tròn quay lại trang danh sách cha — đặt cạnh tiêu đề ở mọi trang chi tiết, đi kèm Breadcrumb. */
export function BackButton({ href, className = '' }: Readonly<BackButtonProps>) {
  return (
    <Link
      href={href}
      title="Quay lại"
      aria-label="Quay lại"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 ${className}`}
    >
      <ChevronLeft className="h-5 w-5" />
    </Link>
  );
}

export default BackButton;
