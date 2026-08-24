export function formatNumber(amount: number): string {
  // Use 'vi-VN' locale to automatically get '.' as thousands separator and ',' as decimal separator
  return new Intl.NumberFormat('vi-VN').format(amount);
}

export function formatCurrency(amount: number): string {
  if (amount === 0) return '0 đ';
  return `${formatNumber(amount)} đ`;
}

const DIGIT_WORDS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const TEN_WORDS = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];

function readThreeDigitGroup(group: number): string {
  const hundred = Math.floor(group / 100);
  const ten = Math.floor((group % 100) / 10);
  const unit = group % 10;

  let result = '';
  if (hundred > 0) {
    result += `${DIGIT_WORDS[hundred]} trăm `;
    if (ten === 0 && unit > 0) result += 'lẻ ';
  }
  if (ten > 0) result += `${TEN_WORDS[ten]} `;

  if (unit > 0) {
    if (ten > 1 && unit === 1) result += 'mốt';
    else if (ten > 0 && unit === 5) result += 'lăm';
    else if (ten === 0 && unit === 5) result += 'năm';
    else result += DIGIT_WORDS[unit];
  }
  return result.trim();
}

/** Đọc số tiền VNĐ thành chữ (dùng cho phiếu in/xuất PDF — báo giá, hóa đơn...). */
export function formatCurrencyInWords(amount: number): string {
  if (amount === 0) return 'Không đồng.';

  const groups = {
    billions: Math.floor(amount / 1_000_000_000),
    millions: Math.floor((amount % 1_000_000_000) / 1_000_000),
    thousands: Math.floor((amount % 1_000_000) / 1_000),
    hundreds: amount % 1_000,
  };

  let result = '';
  if (groups.billions > 0) result += `${readThreeDigitGroup(groups.billions)} tỷ `;
  if (groups.millions > 0) result += `${readThreeDigitGroup(groups.millions)} triệu `;
  if (groups.thousands > 0) result += `${readThreeDigitGroup(groups.thousands)} nghìn `;
  if (groups.hundreds > 0) result += `${readThreeDigitGroup(groups.hundreds)} `;

  const trimmed = result.trim();
  if (!trimmed) return 'Không đồng.';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)} đồng.`;
}
