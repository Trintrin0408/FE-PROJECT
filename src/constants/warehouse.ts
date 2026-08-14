import type { LatLng } from '@/utils/geo';

// TODO: Thay bằng tọa độ kho THẬT — hiện hệ thống chưa có địa chỉ/tọa độ kho nào được lưu ở đâu cả
// (không có bảng/field "warehouse address" trong DB thật lẫn docs). Giá trị dưới đây CHỈ LÀ PLACEHOLDER
// (tọa độ mới) để demo tính năng "~X km từ kho" ở form tạo đơn — KHÔNG dùng để tính
// phụ phí vận chuyển thật cho tới khi được thay bằng tọa độ kho thật.
export const WAREHOUSE_COORDINATES: LatLng = { lat: 20.989312, lng: 105.858438 };

/** Ngưỡng km áp phụ phí vận chuyển — đúng quy tắc nghiệp vụ CLAUDE.md mục 1 ("phụ phí vận chuyển nếu
 * khoảng cách kho → địa điểm > 2km"). */
export const WAREHOUSE_SURCHARGE_THRESHOLD_KM = 2;
