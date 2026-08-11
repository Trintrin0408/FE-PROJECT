/** Múi giờ chuẩn toàn site — mọi hiển thị ngày/giờ đều quy về giờ Việt Nam (UTC+7),
 * không phụ thuộc múi giờ máy chạy trình duyệt/server. */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: VN_TIME_ZONE }).format(date);
}

export function formatTime(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN_TIME_ZONE }).format(date);
}

/** Ngày + giờ trên cùng 1 chuỗi (vd "03/08/2026 14:30") — dùng khi cần hiện cả mốc giờ, không chỉ ngày. */
export function formatDateTime(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

/** Chuỗi ngày dạng YYYY-MM-DD theo giờ Việt Nam — dùng làm value cho <input type="date"> khi nguồn là
 * epoch ms/ISO string có kèm giờ (vd mốc khóa kho ±6h), tránh lệch ngày do quy đổi timezone mặc định
 * của trình duyệt/server. */
export function toDateInputValue(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIME_ZONE }).format(date);
}
