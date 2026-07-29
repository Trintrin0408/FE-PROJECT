// Xác nhận trực tiếp qua curl với backend thật (localhost:3001) ngày 2026-07-21 — GET/POST/PUT
// /api/v1/suppliers đã hoạt động (trước đó 404, xem docs/supplier_api.md mục 6.0). `debtBalance` được
// backend tính sẵn (denormalized) và trả kèm trong mọi response Supplier — không cần FE tự tính lại từ
// supplier-transactions. `email` gửi lên bị bỏ qua âm thầm (không lưu, không trả về).

export type SupplierStatus = 'ACTIVE' | 'INACTIVE';

export interface Supplier {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  notes?: string;
  status: SupplierStatus;
  /** Tổng dư nợ hiện tại — backend tính sẵn (denormalized) từ supplier_transactions, trả kèm mọi
   * response Supplier. Không tự tính lại ở FE (xem comment đầu file). */
  debtBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierPayload {
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
}

export interface UpdateSupplierPayload {
  supplierName?: string;
  serviceType?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  status?: SupplierStatus;
}

export interface GetSuppliersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SupplierStatus;
}

export interface SupplierItem {
  itemId: string;
  itemName: string;
  typeId: string;
  rentalPrice: number;
  purchasePrice: number | null;
  isActive: boolean;
  minQuantity: number | null;
  supplierItemCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransaction {
  transactionId: string;
  transactionCode: string;
  supplierId: string;
  supplierName: string;
  orderId: string | null;
  orderCode: string | null;
  transactionType: string;
  serviceTitle: string;
  estimatedCost: number;
  depositAmount: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  updater?: { fullName: string };
}

export interface SupplierTransactionListResult {
  data: SupplierTransaction[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface AssignSupplierItemPayload {
  itemId: string;
  rentalPrice: number;
  purchasePrice: number;
  isActive?: boolean;
  minQuantity?: number | null;
  supplierItemCode?: string | null;
}

export interface TransactionItemInput {
  itemId: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
  itemName?: string;
}

export interface CreateSupplierTransactionPayload {
  supplierId: string;
  orderId?: string;
  transactionType: 'PURCHASE' | 'RENTAL';
  serviceTitle: string;
  depositAmount?: number;
  items: TransactionItemInput[];
}

export interface UpdateSupplierTransactionPayload {
  serviceTitle?: string;
  depositAmount?: number;
  items?: TransactionItemInput[];
}

export interface UpdateSupplierItemPayload {
  rentalPrice?: number;
  purchasePrice?: number;
  isActive?: boolean;
  minQuantity?: number | null;
  supplierItemCode?: string | null;
}

export interface UpdateSupplierStatusPayload {
  status: SupplierStatus;
}

export interface ListSupplierTransactionsQuery {
  supplierId?: string;
  orderId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

