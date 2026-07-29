// docs/api/11-payments-settlement.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Server tự
// tính finalAmount, FE chỉ gửi 3 field điều chỉnh — không còn originalValue/paidAmount/
// remainingAmount tự tính phía FE, không còn evidences[] lồng nhau.
// Nguồn: D:\bnwems-backend-api prisma/schema.prisma (model Settlement), order.route.ts (GET/POST
// theo orderId), settlement.route.ts (confirm theo settlementId), order.validator.ts.
// Backend refactor 2026-07-26 (commit 4157a7f): rút gọn SettlementStatus từ DRAFT/AGREED/REQUESTED/
// PAID/CONFIRMED xuống UNPAID/PAID/CANCELLED — `PUT /settlements/:id/confirm` giờ chỉ nhận literal
// `status: 'PAID'` (khác giá trị cũ 'CONFIRMED').
export type SettlementStatus = 'UNPAID' | 'PAID' | 'CANCELLED';

// GET /api/v1/orders/:orderId/settlement — trả bản ghi mới nhất (settlementId desc) hoặc null nếu
// chưa có settlement nào cho order này.
export interface Settlement {
  settlementId: string;
  orderId: string;
  additionalFee: number;
  compensation: number;
  discount: number;
  finalAmount: number; // server tự tính = totalAmount(Order) + additionalFee + compensation - depositAmount(PAID) - discount
  paymentMethod?: string;
  qrCodeUrl?: string;
  paidAt?: string;
  evidenceId?: string;
  status: SettlementStatus;
  requestedBy?: string;
  requestedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/orders/:orderId/settlement — field số ít `additionalFee` (không phải `additionalFees`)
export interface RecordSettlementPayload {
  additionalFee?: number;
  compensation?: number;
  discount?: number;
  paymentMethod?: string;
  notes?: string;
}

// POST .../settlement — response chỉ trả { settlementId }
export interface RecordSettlementResult {
  settlementId: string;
}

// PUT /api/v1/settlements/:id/confirm — status đủ enum, không chỉ 'confirmed'
export interface ConfirmSettlementPayload {
  status: SettlementStatus;
  notes?: string;
}
