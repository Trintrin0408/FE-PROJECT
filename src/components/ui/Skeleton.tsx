'use client';

// Shimmer skeleton dùng chung cho trạng thái loading độc lập từng khối dữ liệu (dùng class `.shimmer`
// định nghĩa ở globals.css). Mỗi widget báo cáo tự bọc shimmer riêng, không chờ 1 loading toàn trang.

export function Skeleton({ className = '' }: Readonly<{ className?: string }>) {
  return <div className={`shimmer rounded-md ${className}`} />;
}

/** Shimmer cho 1 thẻ KPI (khớp bố cục KpiTile). */
export function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

/** Shimmer cho 1 khối chart/bảng — có tiêu đề giả + vùng nội dung cao tuỳ chỉnh. */
export function ChartSkeleton({ heightClass = 'h-64' }: Readonly<{ heightClass?: string }>) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-1.5 h-3 w-28" />
      <Skeleton className={`mt-5 w-full ${heightClass}`} />
    </div>
  );
}

/**
 * Bọc 1 khối dữ liệu: đang tải → hiện `fallback` (shimmer); lỗi → hiện thông báo lỗi; xong → hiện children.
 * Cho phép mỗi khối trên dashboard load & shimmer ĐỘC LẬP với nhau.
 */
export function DataBlock({
  loading,
  error,
  fallback,
  children,
}: Readonly<{ loading: boolean; error?: string | null; fallback: React.ReactNode; children: React.ReactNode }>) {
  if (loading) return <>{fallback}</>;
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5 text-xs text-red-600 shadow-xs">
        Không tải được dữ liệu. {error}
      </div>
    );
  }
  return <>{children}</>;
}
