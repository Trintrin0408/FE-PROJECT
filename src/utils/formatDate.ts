/** Múi giờ chuẩn toàn site — mọi hiển thị ngày/giờ đều quy về giờ Việt Nam (UTC+7),
 * không phụ thuộc múi giờ máy chạy trình duyệt/server. */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: VN_TIME_ZONE }).format(date);
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: VN_TIME_ZONE }).format(date);
}
