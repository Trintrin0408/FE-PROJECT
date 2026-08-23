// Hash 1 chuỗi seed thành index trong 1 mảng có độ dài cho trước — dùng để gán màu cố định/nhất quán
// cho 1 thực thể (khách hàng, người dùng...) dựa trên id/tên của nó. Tách ra dùng chung giữa
// Avatar.tsx (màu avatar theo tên) và schedulePlanGroups.ts (màu thanh timeline theo khách hàng).
export function hashIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % length;
  return hash;
}
