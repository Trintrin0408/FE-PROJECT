// Xác nhận trực tiếp qua curl với backend thật (localhost:3001) ngày 2026-07-21 — GET
// /api/v1/supplier-transactions?supplierId=X khớp đúng shape dưới đây, kể cả `orderCode` (join sẵn,
// trước đó type thiếu field này). SupplierTransaction gộp thuê/mua qua field transactionType;
// paymentStatus tách riêng khỏi status vận hành.

export type SupplierTransactionType = 'RENTAL' | 'PURCHASE';
export type SupplierTransactionStatus = 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type SupplierTransactionPaymentStatus = 'UNPAID' | 'DEPOSITED' | 'PAID';

export interface SupplierTransactionItem {
  stItemId?: string;
  itemId?: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  subtotal?: number;
  receivedQuantity?: number;
  notes?: string;
}

export interface SupplierTransaction {
  transactionId: string;
  transactionCode: string;
  supplierId: string;
  supplierName?: string; // join thêm khi GET
  orderId: string;
  orderCode?: string; // join thêm khi GET
  transactionType: SupplierTransactionType;
  serviceTitle: string;
  estimatedCost: number;
  depositAmount: number;
  paymentStatus: SupplierTransactionPaymentStatus;
  status: SupplierTransactionStatus;
  items?: SupplierTransactionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierTransactionPayload {
  supplierId: string;
  orderId: string;
  transactionType: SupplierTransactionType;
  serviceTitle: string;
  depositAmount?: number;
  items: { itemId?: string; itemName: string; quantity: number; unitCost: number; notes?: string }[];
}

export interface GetSupplierTransactionsQuery {
  page?: number;
  limit?: number;
  supplierId?: string;
  paymentStatus?: SupplierTransactionPaymentStatus;
  status?: SupplierTransactionStatus;
}

// PATCH /api/v1/supplier-transactions/:id/status
export interface UpdateSupplierTransactionStatusPayload {
  status: SupplierTransactionStatus;
  notes?: string;
}

// PATCH /api/v1/supplier-transactions/:id/payment-status
export interface UpdateSupplierTransactionPaymentStatusPayload {
  paymentStatus: SupplierTransactionPaymentStatus;
}

// POST /api/v1/supplier-transactions/:id/receive
export interface ReceiveSupplierTransactionPayload {
  items: { stItemId: string; receivedQuantity: number }[];
}
