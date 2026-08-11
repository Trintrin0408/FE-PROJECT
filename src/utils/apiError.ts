import axios from 'axios';
import { formatDate } from './formatDate';

/** Chi tiết lỗi 409 overbooking từ backend (reserveOrderStock) — khớp AppError.conflict details. */
interface OverbookDetails {
  itemId?: string;
  itemName?: string | null;
  requested?: number;
  available?: number;
  windowStart?: string;
  windowEnd?: string;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: OverbookDetails };
  message?: string;
}

/**
 * Dựng thông báo lỗi tiếng Việt từ lỗi API.
 * - Ưu tiên lỗi 409 overbooking (kèm tên thiết bị + khả dụng vs yêu cầu + khoảng thời gian).
 * - Còn lại: lấy message lồng `data.error.message`, rồi `data.message`, cuối cùng là fallback.
 */
export function parseApiError(err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
    const d = data?.error?.details;
    if (err.response?.status === 409 && data?.error?.code === 'CONFLICT' && d?.itemName) {
      const win =
        d.windowStart && d.windowEnd ? ` trong khoảng ${formatDate(d.windowStart)}–${formatDate(d.windowEnd)}` : '';
      return `Không đủ thiết bị: "${d.itemName}" chỉ còn ${d.available ?? 0} khả dụng nhưng đơn cần ${d.requested ?? 0}${win}.`;
    }
    return data?.error?.message ?? data?.message ?? fallback;
  }
  return fallback;
}
