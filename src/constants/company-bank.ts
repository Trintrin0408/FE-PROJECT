// Sinh URL ảnh mã QR chuyển khoản qua SePay ("Tạo QR Code" — https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code).
// KHÔNG còn hardcode tài khoản: Admin cấu hình trong app (GET/PUT /settings/bank-account, useBankAccount),
// FE lấy về rồi dựng URL này. Tham số SePay: acc (số TK), bank (BIN/short_name), amount, des (nội dung CK),
// template (qronly/compact/standee), holder (tên chủ TK không dấu). Vẫn nhúng ảnh trực tiếp phía client.
export interface BankAccountInfo {
  bankBin: string;
  accountNumber: string;
  accountName?: string | null;
}

interface BuildSepayQrUrlParams {
  amount: number;
  des: string;
  template?: 'compact' | 'qronly' | 'standee' | '';
}

export const SEPAY_QR_BASE = 'https://qr.sepay.vn/img';

export function buildSepayQrUrl(account: BankAccountInfo, { amount, des, template = 'qronly' }: BuildSepayQrUrlParams): string {
  const params = new URLSearchParams({
    acc: account.accountNumber,
    bank: account.bankBin,
    amount: String(Math.max(0, Math.round(amount))),
    des,
  });
  if (template) params.set('template', template);
  if (account.accountName) params.set('holder', account.accountName);
  return `${SEPAY_QR_BASE}?${params.toString()}`;
}
