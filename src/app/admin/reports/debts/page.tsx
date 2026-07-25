'use client';

import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, FileText, Search, SlidersHorizontal, UploadCloud, Wallet, X, Zap } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import {
  FlatSupplierTransaction,
  getAdminSuppliers,
  getAllSupplierTransactions,
  getSupplierTransactionRemainingDebt,
  recordSupplierPayment,
} from '@/mocks/db/suppliers';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminSuppliersMock.ts. Khớp ảnh mẫu "Công nợ
// nhà cung cấp": 3 thẻ tổng hợp, thanh lọc, bảng sổ nợ theo từng đơn (loại trừ đơn đã hủy — đơn hủy
// không tính công nợ), modal "Ghi nhận thanh toán nhà cung cấp". Số liệu 3 thẻ tổng hợp tính động từ
// dữ liệu giao dịch NCC đang có (7 đơn còn hiệu lực) — không khớp số tuyệt đối trong ảnh mẫu (ảnh có
// vẻ dựng trên bộ dữ liệu lớn hơn, 12 đơn) nhưng luôn nhất quán với 2 trang liên quan (hồ sơ đối tác,
// đơn thuê/mua).

type StatusFilter = '' | 'UNPAID' | 'PAID';

function customerLabelOf(t: { customerLabel: string }): string {
  return t.customerLabel.replace(/^KH:\s*/, '');
}

export default function Page() {
  const [transactions, setTransactions] = useState<FlatSupplierTransaction[]>(() => getAllSupplierTransactions().filter((t) => t.status !== 'CANCELLED'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [onlyWithDeduction, setOnlyWithDeduction] = useState(false);

  const [paymentTransaction, setPaymentTransaction] = useState<FlatSupplierTransaction | null>(null);

  const refresh = () => setTransactions(getAllSupplierTransactions().filter((t) => t.status !== 'CANCELLED'));

  const suppliers = getAdminSuppliers();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      const remaining = getSupplierTransactionRemainingDebt(t);
      if (statusFilter === 'UNPAID' && remaining <= 0) return false;
      if (statusFilter === 'PAID' && remaining > 0) return false;
      if (supplierFilter && t.supplierId !== supplierFilter) return false;
      if (onlyWithDeduction && t.supplierDeduction <= 0) return false;
      if (!term) return true;
      return t.supplierName.toLowerCase().includes(term) || t.requestCode.toLowerCase().includes(term);
    });
  }, [transactions, search, statusFilter, supplierFilter, onlyWithDeduction]);

  const stats = useMemo(() => {
    const totalPayable = transactions.reduce((sum, t) => sum + t.value + t.compensationAmount, 0);
    const unpaidOnes = transactions.filter((t) => getSupplierTransactionRemainingDebt(t) > 0);
    const totalUnpaid = unpaidOnes.reduce((sum, t) => sum + getSupplierTransactionRemainingDebt(t), 0);
    const totalPaid = transactions.reduce((sum, t) => sum + t.paidAmount, 0);
    return {
      totalPayable,
      totalCount: transactions.length,
      totalUnpaid,
      unpaidCount: unpaidOnes.length,
      totalPaid,
      paidCount: transactions.length - unpaidOnes.length,
    };
  }, [transactions]);

  const handleConfirmPayment = (amount: number, date: string, evidenceFileName: string) => {
    if (!paymentTransaction) return;
    recordSupplierPayment(paymentTransaction.supplierId, paymentTransaction.requestCode, { amount, date, evidenceFileName });
    refresh();
    setPaymentTransaction(null);
  };

  const columns: TableColumn<FlatSupplierTransaction>[] = [
    {
      key: 'supplier',
      label: 'Nhà cung cấp',
      render: (t) => {
        const supplier = suppliers.find((s) => s.supplierId === t.supplierId);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={t.supplierName} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{t.supplierName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    supplier?.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {supplier?.status === 'ACTIVE' ? 'Đang cung cấp' : 'Ngừng cung cấp'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{supplier?.phone}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'requestCode',
      label: 'Mã đơn thuê / mua',
      render: (t) => (
        <div>
          <p className="font-semibold text-blue-600">{t.requestCode}</p>
          <p className="text-xs text-slate-400">{formatDate(t.executionDate)}</p>
        </div>
      ),
    },
    { key: 'supplierDeduction', label: 'Đền bù', render: (t) => <span className="font-medium text-slate-700">{formatCurrency(t.supplierDeduction)}</span> },
    {
      key: 'remaining',
      label: 'Còn nợ',
      render: (t) => {
        const remaining = getSupplierTransactionRemainingDebt(t);
        return <span className={`font-bold ${remaining > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrency(remaining)}</span>;
      },
    },
    { key: 'value', label: 'Tổng tiền', render: (t) => <span className="font-bold text-slate-900">{formatCurrency(t.value + t.compensationAmount)}</span> },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (t) => {
        const remaining = getSupplierTransactionRemainingDebt(t);
        return remaining > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Chưa trả</span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Đã trả</span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Hành động',
      render: (t) => (
        <Button size="sm" variant={getSupplierTransactionRemainingDebt(t) > 0 ? 'secondary' : 'secondary'} onClick={() => setPaymentTransaction(t)}>
          {getSupplierTransactionRemainingDebt(t) > 0 ? 'Ghi nhận thanh toán' : 'Xem thanh toán'}
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Công nợ nhà cung cấp</h1>
      <p className="mt-1 text-sm text-slate-500">Theo dõi và quản lý các khoản phải trả cho nhà cung cấp.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Reveal className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-slate-400">Tổng phải trả</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.totalPayable)}</p>
            <p className="text-xs text-slate-400">{stats.totalCount} đơn</p>
          </div>
        </Reveal>
        <Reveal delay={0.05} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-slate-400">Chưa thanh toán</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.totalUnpaid)}</p>
            <p className="text-xs text-slate-400">{stats.unpaidCount} đơn</p>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm text-slate-400">Đã thanh toán</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(stats.totalPaid)}</p>
            <p className="text-xs text-slate-400">{stats.paidCount} đơn</p>
          </div>
        </Reveal>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1">
            <Input
              placeholder="Tìm kiếm nhà cung cấp, mã đơn..."
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[
                { value: '', label: 'Trạng thái' },
                { value: 'UNPAID', label: 'Chưa trả' },
                { value: 'PAID', label: 'Đã trả' },
              ]}
            />
          </div>
          <div className="w-52">
            <Select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              options={[{ value: '', label: 'Tất cả nhà cung cấp' }, ...suppliers.map((s) => ({ value: s.supplierId, label: s.supplierName }))]}
            />
          </div>
          <Button type="button" variant={showAdvancedFilters ? 'primary' : 'secondary'} onClick={() => setShowAdvancedFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <input
              id="only-deduction"
              type="checkbox"
              checked={onlyWithDeduction}
              onChange={(e) => setOnlyWithDeduction(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="only-deduction" className="text-sm font-medium text-slate-600">
              Chỉ hiển thị đơn có đền bù từ nhà cung cấp
            </label>
          </div>
        )}
      </Reveal>

      <Reveal delay={0.05} className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-base font-bold text-slate-900">Sổ nợ chi tiết theo từng đơn hàng cụ thể</p>
          <p className="mt-0.5 text-sm text-slate-400">Tổng hợp đối soát gối đầu cuốn chiếu từng thương vụ thuê ngoài</p>
        </div>
        <div className="overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.requestCode} />
        </div>
      </Reveal>

      <RecordPaymentModal transaction={paymentTransaction} onClose={() => setPaymentTransaction(null)} onConfirm={handleConfirmPayment} />
    </div>
  );
}

interface RecordPaymentModalProps {
  transaction: FlatSupplierTransaction | null;
  onClose: () => void;
  onConfirm: (amount: number, date: string, evidenceFileName: string) => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function RecordPaymentModal({ transaction, onClose, onConfirm }: Readonly<RecordPaymentModalProps>) {
  const remaining = transaction ? getSupplierTransactionRemainingDebt(transaction) : 0;
  const [amount, setAmount] = useState(remaining > 0 ? remaining : 0);
  const [date, setDate] = useState(todayStr());
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [wasOpenFor, setWasOpenFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!transaction) return null;

  if (wasOpenFor !== transaction.requestCode) {
    setWasOpenFor(transaction.requestCode);
    setAmount(remaining > 0 ? remaining : 0);
    setDate(todayStr());
    setEvidenceFileName('');
  }

  const isAlreadyPaid = remaining <= 0;
  const canConfirm = amount > 0 && amount <= remaining && !!date && !!evidenceFileName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Ghi nhận Thanh toán Nhà cung cấp</h2>
              <p className="text-xs text-slate-400">Khớp dữ liệu chi trả, đối chiếu minh chứng chuyển khoản</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Thông tin gốc (read-only)</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Nhà cung cấp đối tác</p>
                <p className="font-semibold text-slate-800">{transaction.supplierName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mã đơn thuê/mua</p>
                <p className="font-semibold text-blue-600">{transaction.requestCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Tổng chi phí đơn</p>
                <p className="font-semibold text-slate-800">{formatCurrency(transaction.value + transaction.compensationAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Đã thanh toán trước đó</p>
                <p className="font-semibold text-slate-800">{formatCurrency(transaction.paidAmount)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <span className="text-xs font-bold text-red-500">⚠ Dư nợ hiện tại</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(Math.max(remaining, 0))}</span>
            </div>
          </div>

          {isAlreadyPaid ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-bold text-emerald-700">Đã thanh toán đủ</p>
                <p className="mt-0.5 text-sm text-emerald-600">Đơn này đã được thanh toán hết công nợ, không cần ghi nhận thêm.</p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Số tiền thanh toán (VND)</label>
                  <button
                    type="button"
                    onClick={() => setAmount(remaining)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Trả hết nợ (Tối đa)
                  </button>
                </div>
                <Input type="number" min={0} max={remaining} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              </div>

              <Input label="Ngày thanh toán" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tải lên minh chứng chuyển khoản (bắt buộc)</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-center hover:border-blue-300 hover:bg-blue-50/30"
                >
                  {evidenceFileName ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      <p className="text-sm font-semibold text-slate-700">{evidenceFileName}</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-6 w-6 text-slate-400" />
                      <p className="text-sm text-slate-500">
                        Kéo thả ảnh biên lai hoặc <span className="text-blue-600">Click để chọn tệp</span>
                      </p>
                      <p className="text-xs text-slate-400">Hỗ trợ PNG, JPG, PDF (Tối đa 10MB)</p>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                  onChange={(e) => setEvidenceFileName(e.target.files?.[0]?.name ?? '')}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Hoặc thử nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setEvidenceFileName('Uy_nhiem_chi_Vietcombank.pdf')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Ủy nhiệm chi Vietcombank
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceFileName('Bien_lai_Techcombank.jpg')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Biên lai Techcombank
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <p className="text-sm font-bold text-amber-700">Quy tắc Nghiệp vụ Kế toán:</p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-700">
                  <li>• Bắt buộc phải đính kèm tệp biên lai để làm cơ sở đối soát ngân quỹ.</li>
                  <li>• Nút &quot;Xác nhận ghi nhận&quot; sẽ mở khóa khi số tiền hợp lệ và đã có minh chứng.</li>
                  <li>• Nợ sẽ tự động trừ lùi trực tiếp trên Sổ dư đối tác gốc ngay sau khi lưu.</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            {isAlreadyPaid ? 'Đóng' : 'Hủy bỏ'}
          </Button>
          {!isAlreadyPaid && (
            <Button disabled={!canConfirm} onClick={() => onConfirm(amount, date, evidenceFileName)}>
              <CheckCircle2 className="h-4 w-4" />
              Xác nhận ghi nhận
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
