'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Calendar, Eye, Pencil, Plus, Search, SlidersHorizontal, X, Loader2, Trash2 } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { supplierApiService } from '@/services/supplier.service';
import { orderApiService } from '@/services/order.service';
import type { 
  SupplierTransaction, 
  CreateSupplierTransactionPayload, 
  UpdateSupplierTransactionPayload 
} from '@/types/supplier';
import type { Order } from '@/types/order';
import { toast } from 'react-hot-toast';

const TRANSACTION_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  PENDING: { label: 'Chờ duyệt', badgeClass: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', badgeClass: 'bg-blue-100 text-blue-800' },
  RECEIVED: { label: 'Đã nhận hàng', badgeClass: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Hoàn thành', badgeClass: 'bg-slate-100 text-slate-800' },
  CANCELLED: { label: 'Đã hủy', badgeClass: 'bg-red-100 text-red-800' },
};

const ORDER_TYPE_META: Record<string, { label: string; fullLabel: string; badgeClass: string }> = {
  RENTAL: { label: 'Thuê', fullLabel: 'Đơn thuê ngoài', badgeClass: 'bg-blue-50 text-blue-600' },
  PURCHASE: { label: 'Mua', fullLabel: 'Đơn mua ngoài', badgeClass: 'bg-emerald-50 text-emerald-600' },
};

const PAYMENT_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  UNPAID: { label: 'Chưa thanh toán', badgeClass: 'bg-rose-100 text-rose-700' },
  DEPOSITED: { label: 'Đã đặt cọc', badgeClass: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Đã thanh toán', badgeClass: 'bg-emerald-100 text-emerald-700' }
};

export default function Page() {
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [onlyHighValue, setOnlyHighValue] = useState(false);

  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; transaction: SupplierTransaction | null } | null>(null);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await supplierApiService.getSupplierTransactions({ limit: 200 });
      setTransactions(res.data);
    } catch (err) {
      toast.error('Lỗi khi tải danh sách đơn thuê ngoài');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (paymentStatusFilter && (t.paymentStatus || 'UNPAID') !== paymentStatusFilter) return false;
      if (orderTypeFilter && t.transactionType !== orderTypeFilter) return false;
      // Convert createdAt to YYYY-MM-DD for comparison with dateFilter
      if (dateFilter && t.createdAt.split('T')[0] !== dateFilter) return false;
      if (onlyHighValue && Number(t.estimatedCost) < 10_000_000) return false;
      if (!term) return true;
      return (
        t.transactionCode.toLowerCase().includes(term) ||
        t.supplierName.toLowerCase().includes(term) ||
        t.serviceTitle.toLowerCase().includes(term) ||
        (t.orderCode && t.orderCode.toLowerCase().includes(term))
      );
    });
  }, [transactions, search, statusFilter, paymentStatusFilter, orderTypeFilter, dateFilter, onlyHighValue]);

  const handleSubmitForm = async (values: CreateSupplierTransactionPayload & { transactionId?: string }) => {
    try {
      if (formModal?.mode === 'edit' && formModal.transaction) {
        const payload: UpdateSupplierTransactionPayload = {
          serviceTitle: values.serviceTitle,
          depositAmount: values.depositAmount,
          items: values.items
        };
        await supplierApiService.updateSupplierTransaction(formModal.transaction.transactionId, payload);
        toast.success('Cập nhật đơn thành công');
      } else {
        await supplierApiService.createSupplierTransaction(values);
        toast.success('Tạo đơn thành công');
      }
      fetchTransactions();
      setFormModal(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đơn hàng này? Thao tác không thể hoàn tác.')) return;
    try {
      await supplierApiService.deleteSupplierTransaction(id);
      toast.success('Đã xóa đơn hàng thành công');
      fetchTransactions();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa đơn hàng');
    }
  };

  const columns: TableColumn<SupplierTransaction>[] = [
    { key: 'transactionCode', label: 'Mã đơn', render: (t) => <span className="font-semibold text-blue-600">{t.transactionCode}</span> },
    {
      key: 'supplier',
      label: 'Nhà cung cấp',
      render: (t) => (
        <Link
          href={`/admin/suppliers/${t.supplierId}`}
          className="flex items-center gap-2.5 text-left hover:opacity-80"
          title="Xem hồ sơ đối tác"
        >
          <Avatar name={t.supplierName} size="sm" />
          <span className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">{t.supplierName}</span>
        </Link>
      ),
    },
    {
      key: 'event',
      label: 'Dịch vụ / Sự kiện',
      render: (t) => (
        <div>
          <p className="font-medium text-slate-800">{t.serviceTitle}</p>
          {t.orderCode && <p className="text-xs text-slate-400">Order: {t.orderCode}</p>}
        </div>
      ),
    },
    {
      key: 'transactionType',
      label: 'Loại đơn',
      render: (t) => {
        const meta = ORDER_TYPE_META[t.transactionType] || { label: t.transactionType, badgeClass: 'bg-slate-100 text-slate-800' };
        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}>
            {meta.label}
          </span>
        );
      },
    },
    { key: 'createdAt', label: 'Ngày tạo', render: (t) => formatDate(t.createdAt) },
    { key: 'estimatedCost', label: 'Tổng tiền', render: (t) => <span className="font-bold text-slate-900">{formatCurrency(t.estimatedCost)}</span> },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (t) => {
        const meta = TRANSACTION_STATUS_META[t.status] || { label: t.status, badgeClass: 'bg-slate-100 text-slate-800' };
        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'paymentStatus',
      label: 'Thanh toán',
      render: (t) => {
        const meta = PAYMENT_STATUS_META[t.paymentStatus || 'UNPAID'] || { label: t.paymentStatus || 'Chưa thanh toán', badgeClass: 'bg-slate-100 text-slate-800' };
        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.badgeClass}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (t) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Xem chi tiết"
            title="Xem chi tiết đơn hàng"
            onClick={() => setDetailTransactionId(t.transactionId)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Chỉnh sửa"
            title="Chỉnh sửa đơn"
            onClick={() => setFormModal({ mode: 'edit', transaction: t })}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {t.status === 'PENDING' ? (
            <button
              type="button"
              aria-label="Xóa"
              title="Xóa đơn hàng"
              onClick={() => handleDeleteTransaction(t.transactionId)}
              className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Không thể xóa"
              title="Chỉ được xóa đơn hàng ở trạng thái Chờ duyệt"
              disabled
              className="inline-flex rounded-md p-1.5 text-slate-200 cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-600">
            <BookOpen className="h-3.5 w-3.5" />
            Sổ tay mua sắm &amp; thuê mượn
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Danh sách thuê/mua của đối tác</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý vòng đời hợp đồng phụ trợ cưới, kiểm toán công nợ phát sinh theo đơn</p>
        </div>
        <Button onClick={() => setFormModal({ mode: 'create', transaction: null })}>
          <Plus className="h-4 w-4" />
          Tạo đơn thuê/mua mới
        </Button>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder="Tìm theo mã đơn, nhà cung cấp, dịch vụ..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(TRANSACTION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-44">
            <Select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              options={[{ value: '', label: 'Tất cả thanh toán' }, ...Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-40">
            <Select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              options={[{ value: '', label: 'Loại đơn' }, ...Object.entries(ORDER_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-40">
            <Input type="date" icon={<Calendar className="h-4 w-4" />} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <Button type="button" variant={showAdvancedFilters ? 'primary' : 'secondary'} onClick={() => setShowAdvancedFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <input
              id="only-high-value"
              type="checkbox"
              checked={onlyHighValue}
              onChange={(e) => setOnlyHighValue(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="only-high-value" className="text-sm font-medium text-slate-600">
              Chỉ hiển thị đơn từ 10.000.000đ trở lên
            </label>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.transactionId} isLoading={isLoading} />
        </div>
      </Reveal>

      {detailTransactionId && (
        <OrderDetailModal transactionId={detailTransactionId} onClose={() => setDetailTransactionId(null)} />
      )}

      <TransactionFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        transaction={formModal?.transaction ?? null}
        onClose={() => setFormModal(null)}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}

function OrderDetailModal({ transactionId, onClose }: Readonly<{ transactionId: string; onClose: () => void }>) {
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supplierApiService.getTransactionById(transactionId)
      .then(res => setTransaction((res as any).data || res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
         <div className="flex h-40 w-full max-w-2xl items-center justify-center rounded-2xl bg-white shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
         </div>
      </div>
    );
  }

  if (!transaction) return null;

  const orderTypeMeta = ORDER_TYPE_META[transaction.transactionType] || { label: transaction.transactionType, fullLabel: transaction.transactionType, badgeClass: '' };
  const statusMeta = TRANSACTION_STATUS_META[transaction.status] || { label: transaction.status, badgeClass: '' };
  const paymentStatusMeta = PAYMENT_STATUS_META[transaction.paymentStatus || 'UNPAID'] || { label: transaction.paymentStatus || 'Chưa thanh toán', badgeClass: 'bg-slate-100 text-slate-800' };

  const remainingDebt = transaction.paymentStatus === 'PAID'
    ? 0
    : Number(transaction.estimatedCost) - Number(transaction.depositAmount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
              {transaction.transactionType === 'RENTAL' ? 'Đơn thuê ngoài' : 'Đơn mua ngoài'}
            </span>
            <h2 className="mt-1.5 flex items-center gap-2 text-base font-bold text-slate-900">
              <Eye className="h-4 w-4 text-slate-400" />
              Chi tiết đơn hàng: <span className="text-blue-600">{transaction.transactionCode}</span>
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Thông tin chung</p>
            <div className="mt-2 grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Tiêu đề / Nội dung:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.serviceTitle}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Nhà cung cấp:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.supplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mã đơn hàng liên kết:</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {transaction.orderCode || 'Không có'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Loại đơn hàng:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{orderTypeMeta.fullLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Ngày tạo đơn:</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {formatDate(transaction.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái đơn:</p>
                <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta.badgeClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Thanh toán:</p>
                <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentStatusMeta.badgeClass}`}>
                  {paymentStatusMeta.label}
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Danh sách vật tư / dịch vụ</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">STT</th>
                    <th className="px-3 py-2">Tên vật tư / dịch vụ</th>
                    <th className="px-3 py-2 text-center">Số lượng</th>
                    <th className="px-3 py-2 text-right">Đơn giá</th>
                    <th className="px-3 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transaction.items && transaction.items.length > 0 ? transaction.items.map((item: any, idx: number) => (
                    <tr key={`${item.stItemId}-${idx}`}>
                      <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{item.itemName}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(item.unitCost)}</td>
                      <td className="px-3 py-3 text-right font-medium text-slate-800">{formatCurrency(item.subtotal || (item.quantity * item.unitCost))}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-500">Không có hạng mục nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng giá trị đơn hàng ước tính:</span>
              <span className="font-bold text-slate-900">{formatCurrency(transaction.estimatedCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Đã thanh toán (Cọc):</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(transaction.depositAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-700">Dư nợ còn lại (Dự kiến):</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(remainingDebt)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_TX_FORM = {
  supplierId: '',
  orderId: '',
  serviceTitle: '',
  transactionType: 'RENTAL' as 'PURCHASE' | 'RENTAL',
  depositAmount: 0,
  items: [{ itemId: '', itemName: '', quantity: 1, unitCost: 0 }] as any[],
};

interface TransactionFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  transaction: SupplierTransaction | null;
  onClose: () => void;
  onSubmit: (values: CreateSupplierTransactionPayload) => void;
}

function TransactionFormModal({ isOpen, mode, transaction, onClose, onSubmit }: Readonly<TransactionFormModalProps>) {
  const [values, setValues] = useState<any>(EMPTY_TX_FORM);
  const [error, setError] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);
  
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierItems, setSupplierItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (isOpen) {
      supplierApiService.getSuppliers({ limit: 200 }).then(res => setSuppliers(res.data)).catch(console.error);
      orderApiService.getOrders({ limit: 50 }).then(res => setOrders(res.data as Order[])).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && values.supplierId) {
      supplierApiService.getSupplierItems(values.supplierId).then((res: any) => {
        const items = res.data || res || [];
        setSupplierItems(Array.isArray(items) ? items : []);
      }).catch(console.error);
    } else {
      setSupplierItems([]);
    }
  }, [isOpen, values.supplierId]);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setError('');
      if (mode === 'edit' && transaction) {
         supplierApiService.getTransactionById(transaction.transactionId).then(res => {
           const data = (res as any).data || res;
           setValues({
              supplierId: data.supplierId,
              orderId: data.orderId || '',
              serviceTitle: data.serviceTitle,
              transactionType: data.transactionType as 'PURCHASE' | 'RENTAL',
              depositAmount: Number(data.depositAmount || 0),
              items: data.items?.map((it: any) => ({ itemId: it.itemId || '', itemName: it.itemName, quantity: it.quantity, unitCost: Number(it.unitPrice || 0) })) || [],
           });
         });
      } else {
        setValues(EMPTY_TX_FORM);
      }
    }
  }

  const handleItemChange = (idx: number, field: string, value: any) => {
    setValues((v: any) => {
      const newItems = [...(v.items || [])];
      if (field === 'itemId') {
        const selectedSupplierItem = supplierItems.find(si => si.itemId === value);
        newItems[idx] = {
          ...newItems[idx],
          itemId: value,
          itemName: selectedSupplierItem?.itemName || '',
          unitCost: selectedSupplierItem ? (v.transactionType === 'RENTAL' ? selectedSupplierItem.rentalPrice : selectedSupplierItem.purchasePrice) ?? undefined : 0
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          [field]: value
        };
      }
      return { ...v, items: newItems };
    });
  };

  const addItemRow = () => setValues((v: any) => ({ ...v, items: [...(v.items ?? []), { itemId: '', itemName: '', quantity: 1, unitCost: 0 }] }));
  const removeItemRow = (idx: number) => setValues((v: any) => ({ ...v, items: (v.items ?? []).filter((_: any, i: number) => i !== idx) }));

  const calculateTotal = () => {
    return (values.items || []).reduce((total: number, item: any) => total + (item.quantity * (item.unitCost || 0)), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!values.supplierId && mode === 'create') {
      setError('Vui lòng chọn nhà cung cấp');
      return;
    }
    if (values.transactionType === 'RENTAL' && !values.orderId) {
      setError('Giao dịch thuê bắt buộc phải chọn đơn hàng');
      return;
    }
    if (!values.serviceTitle.trim()) {
      setError('Vui lòng nhập tiêu đề dịch vụ');
      return;
    }
    
    const validItems = (values.items ?? []).filter((it: any) => it.itemId);
    if (validItems.length === 0) {
      setError('Vui lòng chọn ít nhất 1 hạng mục thiết bị');
      return;
    }
    for (const item of validItems) {
      if (item.quantity <= 0) {
        setError('Số lượng phải lớn hơn 0');
        return;
      }
    }
    
    onSubmit({ 
      supplierId: values.supplierId,
      orderId: values.orderId || undefined,
      serviceTitle: values.serviceTitle,
      transactionType: values.transactionType,
      depositAmount: values.depositAmount,
      items: validItems
    } as any);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo đơn thuê/mua mới' : 'Cập nhật đơn thuê/mua'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Nhà cung cấp <span className="text-red-500">*</span></label>
          <select
            value={values.supplierId}
            onChange={(e) => setValues((v: any) => ({ ...v, supplierId: e.target.value }))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
            required
            disabled={mode === 'edit'}
          >
            <option value="">-- Chọn nhà cung cấp --</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Đơn hàng gốc {values.transactionType === 'RENTAL' && <span className="text-red-500">*</span>}</label>
            <select
              value={values.orderId}
              onChange={(e) => setValues((v: any) => ({ ...v, orderId: e.target.value }))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required={values.transactionType === 'RENTAL'}
            >
              <option value="">{values.transactionType === 'RENTAL' ? '-- Chọn đơn hàng --' : '-- Nhập kho trực tiếp (Không gắn đơn) --'}</option>
              {orders.map(order => (
                <option key={order.orderId} value={order.orderId}>
                  {order.orderCode} - {order.customerName} ({order.eventName || order.eventType})
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Loại giao dịch <span className="text-red-500">*</span></label>
            <select
              value={values.transactionType}
              onChange={(e) => setValues((v: any) => ({ ...v, transactionType: e.target.value as 'RENTAL' | 'PURCHASE' }))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
              required
              disabled={mode === 'edit'}
            >
              <option value="RENTAL">Thuê ngoài</option>
              <option value="PURCHASE">Mua hàng</option>
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Tiêu đề dịch vụ <span className="text-red-500">*</span></label>
            <Input
              value={values.serviceTitle}
              onChange={(e) => setValues((v: any) => ({ ...v, serviceTitle: e.target.value }))}
              placeholder="Vd: Thuê âm thanh ánh sáng cho sự kiện..."
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Tiền cọc (₫)</label>
            <Input
              type="number"
              min="0"
              value={values.depositAmount || ''}
              onChange={(e) => setValues((v: any) => ({ ...v, depositAmount: Number(e.target.value) }))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Chi tiết hạng mục ({values.transactionType === 'RENTAL' ? 'Thuê' : 'Mua'})</h4>
            <Button type="button" variant="secondary" size="sm" onClick={addItemRow} className="h-8">
              <Plus className="h-4 w-4 mr-1" /> Thêm hạng mục
            </Button>
          </div>
          
          <div className="space-y-3">
            {(values.items || []).map((item: any, index: number) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 items-end">
                <div className="w-full md:w-2/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Hạng mục cung cấp</label>
                  <select
                    value={item.itemId}
                    onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                    required
                    disabled={!values.supplierId}
                  >
                    <option value="">{values.supplierId ? '-- Chọn hạng mục --' : '-- Vui lòng chọn NCC trước --'}</option>
                    {supplierItems
                      .filter(si => si.isActive)
                      .map(si => (
                      <option key={si.itemId} value={si.itemId}>
                        {si.itemName || 'Unknown Item'}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="w-full md:w-1/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Số lượng</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity?.toString() ?? '1'}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>
                
                <div className="w-full md:w-1/5 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Đơn giá ({values.transactionType === 'RENTAL' ? 'Thuê' : 'Mua'})</label>
                  <Input
                    type="number"
                    min="0"
                    value={item.unitCost?.toString() ?? '0'}
                    onChange={(e) => handleItemChange(index, 'unitCost', e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>

                <div className="w-full md:w-auto pb-1.5">
                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    disabled={(values.items || []).length === 1}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:hover:bg-transparent"
                    title="Xóa hạng mục này"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <span className="text-sm text-slate-500 mr-3">Tổng cộng:</span>
              <span className="text-lg font-bold text-blue-600">{calculateTotal().toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
        </div>
        
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{error}</p>}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary">
            {mode === 'create' ? 'Tạo đơn' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
