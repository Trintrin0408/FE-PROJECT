import React from 'react';
import { PaginationState } from '@/hooks/usePagination';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  itemName?: string;
}

// Trả về danh sách trang để hiển thị, dùng -1 làm dấu hiệu cho dấu "...".
function getPageItems(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const items = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...items].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const withEllipsis: number[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) withEllipsis.push(-1);
    withEllipsis.push(page);
  });
  return withEllipsis;
}

export const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange, onLimitChange, itemName = 'kết quả' }) => {
  const { currentPage, totalPages, totalItems, limit } = pagination;

  if (totalItems === 0) return null;

  const pageItems = getPageItems(currentPage, totalPages);
  
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
      <div>
        Hiển thị {startItem} đến {endItem} của {totalItems} {itemName}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageItems.map((page, i) =>
            page === -1 ? (
              <span key={`ellipsis-before-${pageItems[i + 1]}`} className="inline-flex h-8 w-8 items-center justify-center text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`h-8 w-8 rounded-md border font-medium transition-colors ${
                  page === currentPage 
                    ? 'border-blue-600 bg-blue-600 text-white' 
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
          </select>
        )}
      </div>
    </div>
  );
};

export default Pagination;
