'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, BookOpen, Calendar, Eye, Loader2, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import PurchaseOrderFormModal from '@/components/suppliers/PurchaseOrderFormModal';
import SupplierTransactionStatusActions from '@/components/suppliers/SupplierTransactionStatusActions';
import OrderQuickViewModal from '@/components/orders/OrderQuickViewModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { supplierApiService } from '@/services/supplier.service';
import type { SupplierTransaction, TransactionItemInput } from '@/types/supplier';
import {
  SUPPLIER_TRANSACTION_PAYMENT_STATUS_META,
  SUPPLIER_TRANSACTION_STATUS_META,
  SUPPLIER_TRANSACTION_TYPE_META,
  type SupplierTransactionPaymentStatus,
  type SupplierTransactionStatus,
  type SupplierTransactionType,
} from '@/constants/supplier-transaction-status';
import toast from 'react-hot-toast';

// Đã nối API thật (2026-07-30) — trước đó là trang thuần giao diện dùng mock (xem docs/more-require.md
// mục (ap)). Admin vẫn dùng modal cục bộ riêng, cũ hơn, không import PurchaseOrderFormModal — không đụng
// tới trong đợt này (Admin không xử lý vận hành hằng ngày theo quy tắc phân quyền của dự án).
//
// CTA "Thiếu {n} · Thuê từ NCC" ở tab Thiết bị & Kho hàng của Đơn hàng giờ mở thẳng
// PurchaseOrderFormModal ngay trên trang chi tiết đơn (src/app/manager/orders/[id]/page.tsx) thay vì
// điều hướng sang trang này kèm query param `?createFor=` như trước — nên bỏ hẳn nhánh đọc query param
// ở đây (không còn nơi nào liên kết theo cách cũ).

type StatusFilter = '' | SupplierTransactionStatus;
type PaymentStatusFilter = '' | SupplierTransactionPaymentStatus;
type OrderTypeFilter = '' | SupplierTransactionType;

export default function Page() {
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [onlyHighValue, setOnlyHighValue] = useState(false);

  const [detailTransaction, setDetailTransaction] = useState<SupplierTransaction | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; transaction: SupplierTransaction | null } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoading(true);
    setLoadError(null);
    supplierApiService
      .getSupplierTransactions({ limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setTransactions(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không tải được danh sách đơn thuê/mua. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const refresh = () => setReloadTick((t) => t + 1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (paymentStatusFilter && (t.paymentStatus || 'UNPAID') !== paymentStatusFilter) return false;
      if (orderTypeFilter && t.transactionType !== orderTypeFilter) return false;
      // createdAt là ISO timestamp UTC — cắt 10 ký tự đầu để so theo ngày, có thể lệch 1 ngày gần nửa
      // đêm giờ VN so với UTC (chấp nhận được — bộ lọc chỉ mang tính tương đối, dữ liệu hiện còn ít).
      if (dateFilter && t.createdAt.slice(0, 10) !== dateFilter) return false;
      if (onlyHighValue && t.estimatedCost < 10_000_000) return false;
      if (!term) return true;
      return (
        t.transactionCode.toLowerCase().includes(term) ||
        t.supplierName.toLowerCase().includes(term) ||
        (t.orderCode || '').toLowerCase().includes(term) ||
        t.serviceTitle.toLowerCase().includes(term)
      );
    });
  }, [transactions, search, statusFilter, paymentStatusFilter, orderTypeFilter, dateFilter, onlyHighValue]);

  const handleDeleteTransaction = async (t: SupplierTransaction) => {
    if (!window.confirm(`Xóa đơn "${t.transactionCode}"? Thao tác không thể hoàn tác.`)) return;
    setDeletingId(t.transactionId);
    try {
      await supplierApiService.deleteSupplierTransaction(t.transactionId);
      toast.success('Đã xóa đơn thành công');
      refresh();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Không thể xóa đơn - chỉ xóa được đơn ở trạng thái Chờ duyệt');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: TableColumn<SupplierTransaction>[] = [
    { key: 'transactionCode', label: 'Mã giao dịch', render: (t) => <span className="font-semibold text-blue-600">{t.transactionCode}</span> },
    {
      key: 'supplier',
      label: 'Nhà cung cấp',
      render: (t) => (
        <Link href={`/manager/suppliers/${t.supplierId}`} className="flex items-center gap-2.5 hover:opacity-80">
          <Avatar name={t.supplierName} size="sm" />
          <span className="font-semibold text-slate-800">{t.supplierName}</span>
        </Link>
      ),
    },
    {
      key: 'transactionType',
      label: 'Loại đơn',
      render: (t) => {
        const meta = SUPPLIER_TRANSACTION_TYPE_META[t.transactionType as SupplierTransactionType];
        return <Badge variant={meta?.variant ?? 'neutral'}>{meta?.label ?? t.transactionType}</Badge>;
      },
    },
    {
      key: 'order',
      label: 'Đơn liên quan',
      render: (t) =>
        t.orderId ? (
          <button type="button" onClick={() => setViewOrderId(t.orderId)} className="text-sm font-medium text-blue-600 hover:underline">
            {t.orderCode || '—'}
          </button>
        ) : (
          <span className="text-sm italic text-slate-400">Nhập kho</span>
        ),
    },
    { key: 'createdAt', label: 'Ngày tạo', render: (t) => formatDate(t.createdAt) },
    { key: 'estimatedCost', label: 'Tổng tiền', render: (t) => <span className="font-bold text-slate-900">{formatCurrency(t.estimatedCost)}</span> },
    { key: 'depositAmount', label: 'Đặt cọc', render: (t) => formatCurrency(t.depositAmount) },
    {
      key: 'paymentStatus',
      label: 'Thanh toán',
      render: (t) => {
        const meta = SUPPLIER_TRANSACTION_PAYMENT_STATUS_META[t.paymentStatus as SupplierTransactionPaymentStatus];
        return <Badge variant={meta?.variant ?? 'neutral'}>{meta?.label ?? t.paymentStatus}</Badge>;
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (t) => {
        const meta = SUPPLIER_TRANSACTION_STATUS_META[t.status as SupplierTransactionStatus];
        return <Badge variant={meta?.variant ?? 'neutral'}>{meta?.label ?? t.status}</Badge>;
      },
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (t) => (
        <div className="flex items-center gap-2">
          <SupplierTransactionStatusActions transaction={t} onDone={refresh} />
          <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Chỉnh sửa"
            title="Chỉnh sửa đơn"
            onClick={() => setFormModal({ mode: 'edit', transaction: t })}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t.status === 'PENDING' ? 'Xóa' : 'Không thể xóa'}
            title={t.status === 'PENDING' ? 'Xóa đơn hàng' : 'Chỉ được xóa đơn ở trạng thái Chờ duyệt'}
            disabled={t.status !== 'PENDING' || deletingId === t.transactionId}
            onClick={() => handleDeleteTransaction(t)}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-200 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        eyebrow={
          <>
            <BookOpen className="h-3.5 w-3.5" />
            Sổ tay mua sắm &amp; thuê mượn
          </>
        }
        title="Hợp đồng &amp; Đơn thuê ngoài đối tác"
        description="Quản lý vòng đời hợp đồng phụ trợ cưới, kiểm toán công nợ phát sinh theo đơn"
        actions={
          <Button onClick={() => setFormModal({ mode: 'create', transaction: null })}>
            <Plus className="h-4 w-4" />
            Tạo đơn thuê mới
          </Button>
        }
      />

      <FilterBar>
        <FilterRow layout="start">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã giao dịch, nhà cung cấp, đơn hàng, nội dung..." />
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[{ value: '', label: 'Trạng thái' }, ...Object.entries(SUPPLIER_TRANSACTION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-44">
            <Select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatusFilter)}
              options={[
                { value: '', label: 'Thanh toán' },
                ...Object.entries(SUPPLIER_TRANSACTION_PAYMENT_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value as OrderTypeFilter)}
              options={[{ value: '', label: 'Loại đơn' }, ...Object.entries(SUPPLIER_TRANSACTION_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-40">
            <Input type="date" icon={<Calendar className="h-4 w-4" />} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <Button type="button" variant={showAdvancedFilters ? 'primary' : 'secondary'} onClick={() => setShowAdvancedFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </Button>
        </FilterRow>

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

        {loadError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải danh sách...
            </div>
          ) : (
            <Table
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.transactionId}
              onRowClick={(row) => setDetailTransaction(row)}
            />
          )}
        </div>
      </FilterBar>

      <TransactionDetailModal
        transaction={detailTransaction}
        onClose={() => setDetailTransaction(null)}
        onDone={() => {
          refresh();
          setDetailTransaction(null);
        }}
      />

      <OrderQuickViewModal isOpen={!!viewOrderId} onClose={() => setViewOrderId(null)} orderId={viewOrderId} />

      <PurchaseOrderFormModal
        isOpen={!!formModal}
        mode={formModal?.mode ?? 'create'}
        transaction={formModal?.transaction ?? null}
        onClose={() => setFormModal(null)}
        onSuccess={refresh}
      />
    </div>
  );
}

function TransactionDetailModal({ transaction, onClose, onDone }: Readonly<{ transaction: SupplierTransaction | null; onClose: () => void; onDone: () => void }>) {
  const [items, setItems] = useState<TransactionItemInput[]>([]);

  useEffect(() => {
    if (!transaction) return;
    let cancelled = false;
    supplierApiService
      .getTransactionById(transaction.transactionId)
      .then((res) => {
        if (cancelled) return;
        const detail = (res as unknown as { data?: SupplierTransaction & { items?: TransactionItemInput[] } })?.data || res;
        setItems((detail as { items?: TransactionItemInput[] })?.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [transaction]);

  if (!transaction) return null;

  const typeMeta = SUPPLIER_TRANSACTION_TYPE_META[transaction.transactionType as SupplierTransactionType];
  const statusMeta = SUPPLIER_TRANSACTION_STATUS_META[transaction.status as SupplierTransactionStatus];
  const paymentMeta = SUPPLIER_TRANSACTION_PAYMENT_STATUS_META[transaction.paymentStatus as SupplierTransactionPaymentStatus];
  const remainingDebt = transaction.paymentStatus === 'PAID' ? 0 : transaction.estimatedCost - (transaction.depositAmount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <Badge variant={typeMeta?.variant ?? 'neutral'}>{typeMeta?.label ?? transaction.transactionType}</Badge>
            <h2 className="mt-1.5 flex items-center gap-2 text-base font-bold text-slate-900">
              <Eye className="h-4 w-4 text-slate-400" />
              Chi tiết giao dịch: <span className="text-blue-600">{transaction.transactionCode}</span>
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
                <p className="text-xs text-slate-400">Nội dung:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.serviceTitle}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Nhà cung cấp:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.supplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Đơn liên quan:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.orderCode || 'Nhập kho trực tiếp'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Ngày tạo:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatDate(transaction.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái thanh toán:</p>
                <span className="mt-0.5 inline-block">
                  <Badge variant={paymentMeta?.variant ?? 'neutral'}>{paymentMeta?.label ?? transaction.paymentStatus}</Badge>
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái đơn:</p>
                <span className="mt-0.5 inline-block">
                  <Badge variant={statusMeta?.variant ?? 'neutral'}>{statusMeta?.label ?? transaction.status}</Badge>
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
                      <th className="px-3 py-2 text-right">Đơn giá (đ)</th>
                      <th className="px-3 py-2 text-right">Thành tiền (đ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={`${item.itemId}-${idx}`}>
                        <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">{item.itemName}</td>
                        <td className="px-3 py-3 text-center text-slate-600">{item.quantity}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(item.unitCost ?? 0)}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900">{formatCurrency(item.quantity * (item.unitCost ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Tổng giá trị đơn hàng:</span>
              <span className="font-bold text-slate-900">{formatCurrency(transaction.estimatedCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Đặt cọc:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(transaction.depositAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-700">Dư nợ còn lại (dự kiến):</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(remainingDebt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <div className="mr-auto">
            <SupplierTransactionStatusActions transaction={transaction} onDone={onDone} size="md" />
          </div>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}
