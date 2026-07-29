'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Calendar, Eye, Pencil, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { SupplierDetailModal } from '@/components/suppliers/SupplierDetailModal';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import {
  AdminSupplier,
  FlatSupplierTransaction,
  SUPPLIER_ORDER_TYPE_META,
  SUPPLIER_TRANSACTION_STATUS_META,
  SupplierOrderType,
  SupplierTransactionFormValues,
  SupplierTransactionStatus,
  createSupplierTransaction,
  getAdminSupplierById,
  getAdminSuppliers,
  getAllSupplierTransactions,
  getSupplierTransactionRemainingDebt,
  updateSupplierTransaction,
} from '@/mocks/db/suppliers';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminSuppliersMock.ts. Khớp ảnh mẫu "Hợp
// đồng & Đơn thuê ngoài đối tác": thanh lọc (tìm kiếm + trạng thái + loại đơn + ngày + bộ lọc), bảng
// đơn thuê/mua gộp từ mọi đối tác. "Xem chi tiết" (icon mắt) mở modal chi tiết đơn hàng (vật tư/dịch
// vụ, công nợ) khớp ảnh mẫu; bấm tên đối tác mở lại hồ sơ đối tác đầy đủ (dùng chung với trang
// /admin/suppliers). "Chỉnh sửa" mở form sửa riêng đơn này.

type StatusFilter = '' | SupplierTransactionStatus;
type OrderTypeFilter = '' | SupplierOrderType;

function customerLabelOf(t: { customerLabel: string }): string {
  return t.customerLabel.replace(/^KH:\s*/, '');
}

export default function Page() {
  const [transactions, setTransactions] = useState<FlatSupplierTransaction[]>(() => getAllSupplierTransactions());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [onlyHighValue, setOnlyHighValue] = useState(false);

  const [detailSupplier, setDetailSupplier] = useState<AdminSupplier | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<FlatSupplierTransaction | null>(null);
  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; transaction: FlatSupplierTransaction | null } | null>(null);

  const refresh = () => setTransactions(getAllSupplierTransactions());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (orderTypeFilter && t.orderType !== orderTypeFilter) return false;
      if (dateFilter && t.executionDate !== dateFilter) return false;
      if (onlyHighValue && t.value < 10_000_000) return false;
      if (!term) return true;
      return (
        t.requestCode.toLowerCase().includes(term) ||
        t.supplierName.toLowerCase().includes(term) ||
        customerLabelOf(t).toLowerCase().includes(term)
      );
    });
  }, [transactions, search, statusFilter, orderTypeFilter, dateFilter, onlyHighValue]);

  const handleSubmitForm = (values: SupplierTransactionFormValues) => {
    if (formModal?.mode === 'edit' && formModal.transaction) {
      updateSupplierTransaction(formModal.transaction.supplierId, formModal.transaction.requestCode, values);
    } else {
      createSupplierTransaction(values);
    }
    refresh();
    setFormModal(null);
  };

  const columns: TableColumn<FlatSupplierTransaction>[] = [
    { key: 'requestCode', label: 'Mã đơn', render: (t) => <span className="font-semibold text-blue-600">{t.requestCode}</span> },
    {
      key: 'supplier',
      label: 'Nhà cung cấp',
      render: (t) => (
        <button
          type="button"
          onClick={() => setDetailSupplier(getAdminSupplierById(t.supplierId) ?? null)}
          className="flex items-center gap-2.5 text-left hover:opacity-80"
          title="Xem hồ sơ đối tác"
        >
          <Avatar name={t.supplierName} size="sm" />
          <span className="font-semibold text-slate-800">{t.supplierName}</span>
        </button>
      ),
    },
    {
      key: 'event',
      label: 'Sự kiện liên quan',
      render: (t) => (
        <div>
          <p className="font-medium text-slate-800">{customerLabelOf(t)}</p>
          <p className="text-xs text-slate-400">{formatDate(t.executionDate)}</p>
        </div>
      ),
    },
    {
      key: 'orderType',
      label: 'Loại đơn',
      render: (t) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${SUPPLIER_ORDER_TYPE_META[t.orderType].badgeClass}`}>
          {SUPPLIER_ORDER_TYPE_META[t.orderType].label}
        </span>
      ),
    },
    { key: 'executionDate', label: 'Ngày đặt', render: (t) => formatDate(t.executionDate) },
    { key: 'expectedDate', label: 'Ngày dự kiến', render: (t) => formatDate(t.expectedDate) },
    { key: 'value', label: 'Tổng tiền', render: (t) => <span className="font-bold text-slate-900">{formatCurrency(t.value)}</span> },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (t) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${SUPPLIER_TRANSACTION_STATUS_META[t.status].badgeClass}`}>
          {SUPPLIER_TRANSACTION_STATUS_META[t.status].label}
        </span>
      ),
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
            onClick={() => setDetailTransaction(t)}
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
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Hợp đồng &amp; Đơn thuê ngoài đối tác</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý vòng đời hợp đồng phụ trợ cưới, kiểm toán công nợ phát sinh theo đơn</p>
        </div>
        <Button onClick={() => setFormModal({ mode: 'create', transaction: null })}>
          <Plus className="h-4 w-4" />
          Tạo đơn thuê mới
        </Button>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder="Tìm theo mã đơn, nhà cung cấp, sự kiện..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[{ value: '', label: 'Trạng thái' }, ...Object.entries(SUPPLIER_TRANSACTION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-40">
            <Select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value as OrderTypeFilter)}
              options={[{ value: '', label: 'Loại đơn' }, ...Object.entries(SUPPLIER_ORDER_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))]}
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
          <Table columns={columns} rows={filtered} rowKey={(row) => row.requestCode} />
        </div>
      </Reveal>

      <SupplierDetailModal supplier={(detailSupplier as any) ?? null} onClose={() => setDetailSupplier(null)} />

      <OrderDetailModal transaction={detailTransaction} onClose={() => setDetailTransaction(null)} />

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

function OrderDetailModal({ transaction, onClose }: Readonly<{ transaction: FlatSupplierTransaction | null; onClose: () => void }>) {
  if (!transaction) return null;

  const remainingDebt = getSupplierTransactionRemainingDebt(transaction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
              {transaction.orderType === 'RENT' ? 'Đơn thuê ngoài' : 'Đơn mua ngoài'}
            </span>
            <h2 className="mt-1.5 flex items-center gap-2 text-base font-bold text-slate-900">
              <Eye className="h-4 w-4 text-slate-400" />
              Chi tiết đơn hàng: <span className="text-blue-600">{transaction.requestCode}</span>
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
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.title}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Nhà cung cấp:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{transaction.supplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Sự kiện đám cưới:</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {customerLabelOf(transaction)} ({transaction.orderLinkCode})
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Loại đơn hàng:</p>
                <p className="mt-0.5 font-semibold text-slate-800">{SUPPLIER_ORDER_TYPE_META[transaction.orderType].fullLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Thời gian thuê:</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {formatDate(transaction.executionDate)} → {formatDate(transaction.expectedDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Trạng thái đơn:</p>
                <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${SUPPLIER_TRANSACTION_STATUS_META[transaction.status].badgeClass}`}>
                  {SUPPLIER_TRANSACTION_STATUS_META[transaction.status].label}
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
                  {transaction.lineItems.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`}>
                      <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900">{formatCurrency(item.quantity * item.unitPrice)}</td>
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
              <span className="font-bold text-slate-900">{formatCurrency(transaction.value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Đã thanh toán:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(transaction.paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bồi thường phát sinh (nếu có):</span>
              <span className="font-semibold text-red-500">{formatCurrency(transaction.compensationAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-700">Dư nợ còn lại:</span>
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

const EMPTY_TX_FORM: SupplierTransactionFormValues = {
  supplierId: '',
  title: '',
  customerLabel: '',
  executionDate: '',
  expectedDate: '',
  orderType: 'RENT',
  value: 0,
  status: 'NEW',
  paidAmount: 0,
  compensationAmount: 0,
  supplierDeduction: 0,
};

interface TransactionFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  transaction: FlatSupplierTransaction | null;
  onClose: () => void;
  onSubmit: (values: SupplierTransactionFormValues) => void;
}

function TransactionFormModal({ isOpen, mode, transaction, onClose, onSubmit }: Readonly<TransactionFormModalProps>) {
  const [values, setValues] = useState<SupplierTransactionFormValues>(EMPTY_TX_FORM);
  const [error, setError] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);
  const suppliers = getAdminSuppliers();

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setError('');
      setValues(
        mode === 'edit' && transaction
          ? {
              supplierId: transaction.supplierId,
              title: transaction.title,
              customerLabel: customerLabelOf(transaction),
              executionDate: transaction.executionDate,
              expectedDate: transaction.expectedDate,
              orderType: transaction.orderType,
              value: transaction.value,
              status: transaction.status,
              paidAmount: transaction.paidAmount,
              compensationAmount: transaction.compensationAmount,
              supplierDeduction: transaction.supplierDeduction,
            }
          : EMPTY_TX_FORM,
      );
    }
  }

  const handleSubmit = () => {
    if (!values.supplierId || !values.title.trim() || !values.customerLabel.trim() || !values.executionDate) {
      setError('Vui lòng chọn nhà cung cấp và nhập đủ thông tin đơn');
      return;
    }
    if (!values.value || values.value <= 0) {
      setError('Vui lòng nhập tổng tiền hợp lệ');
      return;
    }
    onSubmit({ ...values, customerLabel: `KH: ${values.customerLabel.replace(/^KH:\s*/, '')}` });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo đơn thuê/mua mới' : 'Chỉnh sửa đơn thuê/mua'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>{mode === 'create' ? 'Tạo đơn' : 'Lưu thay đổi'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Nhà cung cấp"
          required
          disabled={mode === 'edit'}
          value={values.supplierId}
          onChange={(e) => setValues((v) => ({ ...v, supplierId: e.target.value }))}
          options={suppliers.map((s) => ({ value: s.supplierId, label: s.supplierName }))}
          placeholder="-- Chọn nhà cung cấp --"
        />
        <Input
          label="Nội dung yêu cầu"
          required
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="VD: Bộ âm thanh ánh sáng tiệc cưới chuyên nghiệp"
        />
        <Input
          label="Sự kiện / khách hàng"
          required
          value={values.customerLabel}
          onChange={(e) => setValues((v) => ({ ...v, customerLabel: e.target.value }))}
          placeholder="VD: Lễ cưới Minh Anh - Thu Hà"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Ngày đặt" type="date" required value={values.executionDate} onChange={(e) => setValues((v) => ({ ...v, executionDate: e.target.value }))} />
          <Input label="Ngày dự kiến" type="date" value={values.expectedDate} onChange={(e) => setValues((v) => ({ ...v, expectedDate: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Loại đơn"
            value={values.orderType}
            onChange={(e) => setValues((v) => ({ ...v, orderType: e.target.value as SupplierOrderType }))}
            options={Object.entries(SUPPLIER_ORDER_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))}
          />
          <Input
            label="Tổng tiền"
            type="number"
            min={0}
            required
            value={values.value}
            onChange={(e) => setValues((v) => ({ ...v, value: Number(e.target.value) }))}
          />
        </div>
        <Select
          label="Trạng thái"
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as SupplierTransactionStatus }))}
          options={Object.entries(SUPPLIER_TRANSACTION_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Đã thanh toán"
            type="number"
            min={0}
            value={values.paidAmount}
            onChange={(e) => setValues((v) => ({ ...v, paidAmount: Number(e.target.value) }))}
          />
          <Input
            label="Bồi thường phát sinh (nếu có)"
            type="number"
            min={0}
            value={values.compensationAmount}
            onChange={(e) => setValues((v) => ({ ...v, compensationAmount: Number(e.target.value) }))}
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{error}</p>}
      </div>
    </Modal>
  );
}
