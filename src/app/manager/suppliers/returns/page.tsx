'use client';

import { useMemo, useState } from 'react';
import { Box, CheckCircle2, Eye, FileText, Plus, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate, formatTime } from '@/utils/formatDate';
import {
  CreateSupplierReturnSlipInput,
  SUPPLIER_RETURN_STATUS_META,
  SupplierReturnItem,
  SupplierReturnSlip,
  SupplierReturnStatus,
  approveSupplierReturnSlip,
  createSupplierReturnSlip,
  getSupplierRentalOrderByCode,
  getSupplierRentalOrders,
  getSupplierReturnSlipById,
  getSupplierReturnSlips,
} from '@/mocks/db/suppliers';

// Trang thuần giao diện — mirror 1:1 từ src/app/admin/suppliers/returns/page.tsx cho vai trò Manager
// (xem giải thích ở đầu src/mocks/adminSupplierReturnsMock.ts). Đáp ứng checklist "Hoàn kho & trả
// Supplier" (phần trả thiết bị thuê ngoài) — Admin và Manager dùng chung 1 bộ mock/service.

type StatusFilter = '' | SupplierReturnStatus;

export default function Page() {
  const [slips, setSlips] = useState<SupplierReturnSlip[]>(() => getSupplierReturnSlips());
  const [search, setSearch] = useState('');
  const [orderCodeFilter, setOrderCodeFilter] = useState('');
  const [orderNameFilter, setOrderNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const refresh = () => setSlips(getSupplierReturnSlips());

  const supplierNames = useMemo(() => Array.from(new Set(getSupplierRentalOrders().map((o) => o.supplierName))), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return slips.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (orderCodeFilter && !s.orderCode.toLowerCase().includes(orderCodeFilter.trim().toLowerCase())) return false;
      if (orderNameFilter && !s.orderName.toLowerCase().includes(orderNameFilter.trim().toLowerCase())) return false;
      if (supplierFilter && s.supplierName !== supplierFilter) return false;
      if (!term) return true;
      return s.id.toLowerCase().includes(term) || s.orderCode.toLowerCase().includes(term) || s.orderName.toLowerCase().includes(term);
    });
  }, [slips, search, orderCodeFilter, orderNameFilter, statusFilter, supplierFilter]);

  const handleResetFilters = () => {
    setSearch('');
    setOrderCodeFilter('');
    setOrderNameFilter('');
    setStatusFilter('');
    setSupplierFilter('');
  };

  const handleCreated = (slip: SupplierReturnSlip) => {
    refresh();
    setIsCreateOpen(false);
    setDetailId(slip.id);
  };

  const handleApprove = (id: string) => {
    approveSupplierReturnSlip(id);
    refresh();
  };

  const columns: TableColumn<SupplierReturnSlip>[] = [
    { key: 'id', label: 'ID', render: (s) => <span className="font-semibold text-slate-700">{s.id}</span> },
    {
      key: 'orderCode',
      label: 'Mã đơn',
      render: (s) => (
        <button type="button" onClick={() => setOrderCodeFilter(s.orderCode)} className="font-semibold text-blue-600 hover:underline">
          {s.orderCode}
        </button>
      ),
    },
    { key: 'orderName', label: 'Tên đơn', render: (s) => s.orderName },
    { key: 'createdAt', label: 'Ngày tạo', render: (s) => `${formatDate(s.createdAt)} ${formatTime(s.createdAt)}` },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (s) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${SUPPLIER_RETURN_STATUS_META[s.status].badgeClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {SUPPLIER_RETURN_STATUS_META[s.status].listLabel}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (s) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDetailId(s.id)}
            aria-label="Xem chi tiết phiếu trả"
            title="Xem chi tiết phiếu trả"
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Reveal className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div>
          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-500">
            Đối tác &amp; thiết bị
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Trả thiết bị cho nhà cung cấp</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý và theo dõi quá trình hoàn trả thiết bị thuê ngoài, đối soát hư tổn và quyết toán.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo báo cáo mới
        </Button>
      </Reveal>

      <Reveal delay={0.05} className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input placeholder="Tìm kiếm ID, mã đơn, tên đơn..." icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Input placeholder="Mã đơn thuê NCC" value={orderCodeFilter} onChange={(e) => setOrderCodeFilter(e.target.value)} />
          </div>
          <div className="w-48">
            <Input placeholder="Tên đơn khách hàng" value={orderNameFilter} onChange={(e) => setOrderNameFilter(e.target.value)} />
          </div>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                ...Object.entries(SUPPLIER_RETURN_STATUS_META).map(([value, meta]) => ({ value, label: meta.listLabel })),
              ]}
            />
          </div>
          <Button type="button" variant="secondary" onClick={handleResetFilters}>
            <RotateCcw className="h-4 w-4" />
            Làm mới
          </Button>
          <Button type="button" variant={showAdvancedFilters ? 'primary' : 'secondary'} onClick={() => setShowAdvancedFilters((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-400">Nhà cung cấp:</span>
            <div className="w-56">
              <Select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                options={[{ value: '', label: 'Tất cả nhà cung cấp' }, ...supplierNames.map((n) => ({ value: n, label: n }))]}
              />
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.id} />
        </div>
      </Reveal>

      <CreateReturnSlipModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={handleCreated} />

      <ReturnSlipDetailModal
        slip={detailId ? getSupplierReturnSlipById(detailId) ?? null : null}
        onClose={() => setDetailId(null)}
        onApprove={handleApprove}
      />
    </div>
  );
}

function ReturnSlipDetailModal({
  slip,
  onClose,
  onApprove,
}: Readonly<{ slip: (SupplierReturnSlip & { items: SupplierReturnItem[] }) | null; onClose: () => void; onApprove: (id: string) => void }>) {
  if (!slip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-slate-400" />
            Chi tiết phiếu trả thiết bị: <span className="text-blue-600">{slip.id}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mã đơn thuê</p>
              <p className="mt-0.5 font-bold text-slate-900">{slip.orderCode}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái phiếu</p>
              <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${SUPPLIER_RETURN_STATUS_META[slip.status].badgeClass}`}>
                {SUPPLIER_RETURN_STATUS_META[slip.status].detailLabel}
              </span>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tên đơn hàng / đám cưới</p>
              <p className="mt-0.5 font-bold text-slate-900">{slip.orderName}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày tạo phiếu</p>
              <p className="mt-0.5 font-semibold text-slate-700">
                {formatDate(slip.createdAt)} {formatTime(slip.createdAt)}
              </p>
            </div>
          </div>

          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Box className="h-4 w-4 text-slate-500" />
              Danh sách thiết bị hoàn trả
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Tên thiết bị</th>
                    <th className="px-3 py-2 text-center">SL thuê</th>
                    <th className="px-3 py-2 text-center text-emerald-600">Nguyên vẹn</th>
                    <th className="px-3 py-2 text-center text-red-600">Hỏng</th>
                    <th className="px-3 py-2 text-center text-amber-600">Mất</th>
                    <th className="px-3 py-2 text-right">Đền bù</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slip.items.map((item) => (
                    <tr key={item.itemName}>
                      <td className="px-3 py-3 font-medium text-slate-800">{item.itemName}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{item.quantityRented}</td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-600">{item.intact}</td>
                      <td className="px-3 py-3 text-center font-bold text-red-600">{item.damaged}</td>
                      <td className="px-3 py-3 text-center font-bold text-amber-600">{item.lost}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">{formatCurrency(item.compensationAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {slip.status === 'NEW' && (
            <Button
              onClick={() => {
                onApprove(slip.id);
                onClose();
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Phê duyệt hoàn trả
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateReturnSlipModal({
  isOpen,
  onClose,
  onCreated,
}: Readonly<{ isOpen: boolean; onClose: () => void; onCreated: (slip: SupplierReturnSlip) => void }>) {
  const [orderCode, setOrderCode] = useState('');
  const [orderName, setOrderName] = useState('');
  const [items, setItems] = useState<SupplierReturnItem[]>([]);
  const [error, setError] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);

  const orders = getSupplierRentalOrders();
  const selectedOrder = orderCode ? getSupplierRentalOrderByCode(orderCode) : undefined;

  const resetAndClose = () => {
    setOrderCode('');
    setOrderName('');
    setItems([]);
    setError('');
    onClose();
  };

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setOrderCode('');
      setOrderName('');
      setItems([]);
      setError('');
    }
  }

  const handleSelectOrder = (code: string) => {
    setOrderCode(code);
    const order = getSupplierRentalOrderByCode(code);
    setOrderName(order?.eventName ?? '');
    setItems(
      (order?.items ?? []).map((item) => ({
        itemName: item.itemName,
        quantityRented: item.quantityRented,
        intact: item.quantityRented,
        damaged: 0,
        lost: 0,
        compensationAmount: 0,
      })),
    );
  };

  const updateItem = (index: number, patch: Partial<SupplierReturnItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = () => {
    if (!orderCode || !orderName.trim()) {
      setError('Vui lòng chọn đơn thuê và nhập tên đơn hàng/đám cưới');
      return;
    }
    const input: CreateSupplierReturnSlipInput = { orderCode, orderName: orderName.trim(), items };
    const slip = createSupplierReturnSlip(input);
    onCreated(slip);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Plus className="h-5 w-5 text-blue-500" />
            Tạo báo cáo trả thiết bị mới
          </h2>
          <button type="button" onClick={resetAndClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Select
            label="Chọn đơn thuê của nhà cung cấp"
            required
            value={orderCode}
            onChange={(e) => handleSelectOrder(e.target.value)}
            options={orders.map((o) => ({ value: o.code, label: `${o.code} - ${o.eventName} (${o.supplierName})` }))}
            placeholder="-- Chọn đơn thuê --"
          />
          <Input label="Tên đơn hàng / đám cưới" required value={orderName} onChange={(e) => setOrderName(e.target.value)} />

          {selectedOrder && (
            <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nhà cung cấp</p>
                <p className="mt-0.5 font-semibold text-slate-800">{selectedOrder.supplierName}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Thời gian thuê</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {formatDate(selectedOrder.rentalStart)} - {formatDate(selectedOrder.rentalEnd)}
                </p>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Box className="h-4 w-4 text-slate-500" />
                Danh sách thiết bị hoàn trả &amp; hiện trạng
              </p>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Tên thiết bị</th>
                      <th className="px-3 py-2 text-center">Số lượng thuê</th>
                      <th className="px-3 py-2 text-center text-emerald-600">Nguyên vẹn</th>
                      <th className="px-3 py-2 text-center text-red-600">Hỏng</th>
                      <th className="px-3 py-2 text-center text-amber-600">Mất</th>
                      <th className="px-3 py-2 text-right">Tiền đền bù</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.itemName}>
                        <td className="px-3 py-3 font-medium text-slate-800">{item.itemName}</td>
                        <td className="px-3 py-3 text-center text-slate-600">{item.quantityRented}</td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={item.intact}
                            onChange={(e) => updateItem(idx, { intact: Number(e.target.value) })}
                            className="w-16 rounded-md border border-emerald-200 bg-emerald-50/50 py-1 text-center text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={item.damaged}
                            onChange={(e) => updateItem(idx, { damaged: Number(e.target.value) })}
                            className="w-16 rounded-md border border-red-200 bg-red-50/50 py-1 text-center text-sm font-semibold text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={item.lost}
                            onChange={(e) => updateItem(idx, { lost: Number(e.target.value) })}
                            className="w-16 rounded-md border border-amber-200 bg-amber-50/50 py-1 text-center text-sm font-semibold text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.compensationAmount}
                            onChange={(e) => updateItem(idx, { compensationAmount: Number(e.target.value) })}
                            className="w-28 rounded-md border border-slate-200 py-1 text-right text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="secondary" onClick={resetAndClose}>
            Hủy bỏ
          </Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4" />
            Lưu báo cáo
          </Button>
        </div>
      </div>
    </div>
  );
}
