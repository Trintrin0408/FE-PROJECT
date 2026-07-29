'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ClipboardList, Clock, Eye, FileText, Search, Truck, Users } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatDate';
import {
  OUTBOUND_STATUS_META,
  OutboundVoucher,
  OutboundVoucherItem,
  confirmOutboundExport,
  getAdminOutboundVouchers,
} from '@/mocks/adminWarehouseOutboundMock';

// Trang thuần giao diện — xem giải thích ở đầu src/mocks/adminWarehouseOutboundMock.ts. Bố cục port từ
// docs/components/WarehouseOutView.tsx do người dùng cung cấp: danh sách phiếu xuất kho + bộ lọc, và
// khi bấm vào một phiếu sẽ chuyển sang màn chi tiết (giữ đúng kiểu điều hướng master/detail bằng state
// tại chỗ như bản gốc, không tách route riêng). Xác nhận xuất kho sẽ trừ tồn kho khả dụng thật ở
// adminEquipmentMock để khớp với trang "Gói sản phẩm & dịch vụ" / "Tồn kho doanh nghiệp".

export default function AdminWarehouseOutboundPage() {
  const [vouchers, setVouchers] = useState<OutboundVoucher[]>(() => getAdminOutboundVouchers());
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [bookingFilter, setBookingFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exported' | 'not_exported'>('all');
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [confirmingVoucherId, setConfirmingVoucherId] = useState<string | null>(null);

  const refresh = () => setVouchers(getAdminOutboundVouchers());

  const uniqueBookings = useMemo(() => Array.from(new Set(vouchers.map((v) => v.bookingName))).sort(), [vouchers]);

  const kpis = useMemo(() => {
    const exported = vouchers.filter((v) => v.status === 'exported').length;
    const notExported = vouchers.length - exported;
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = vouchers.filter((v) => v.expectedDate === today && v.status === 'not_exported').length;
    return { exported, notExported, dueToday };
  }, [vouchers]);

  const kpiItems: KpiCardItem[] = [
    { label: 'Tổng phiếu xuất', value: vouchers.length, icon: ClipboardList, iconColor: 'blue' },
    { label: 'Đã xuất kho', value: kpis.exported, icon: CheckCircle2, iconColor: 'green' },
    { label: 'Chưa xuất kho', value: kpis.notExported, icon: Clock, iconColor: 'amber' },
    { label: 'Cần xuất hôm nay', value: kpis.dueToday, icon: Truck, iconColor: 'red' },
  ];

  const filteredVouchers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (bookingFilter && v.bookingName !== bookingFilter) return false;
      if (dateFilter && v.expectedDate !== dateFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (!term) return true;
      return (
        v.id.toLowerCase().includes(term) ||
        v.bookingName.toLowerCase().includes(term) ||
        v.receiver.toLowerCase().includes(term) ||
        v.truckNumber.toLowerCase().includes(term)
      );
    });
  }, [vouchers, search, bookingFilter, dateFilter, statusFilter]);

  const handleConfirmExport = (id: string) => {
    confirmOutboundExport(id);
    refresh();
    setConfirmingVoucherId(null);
  };

  const selectedVoucher = selectedVoucherId ? vouchers.find((v) => v.id === selectedVoucherId) : null;

  if (selectedVoucher) {
    const totalUnits = selectedVoucher.items.reduce((sum, item) => sum + item.requestedQty, 0);

    const itemColumns: TableColumn<OutboundVoucherItem>[] = [
      { key: 'equipmentId', label: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-400">{row.equipmentId}</span> },
      { key: 'name', label: 'Tên sản phẩm & thiết bị', render: (row) => <span className="font-semibold text-slate-800">{row.name}</span> },
      { key: 'unit', label: 'Đơn vị' },
      { key: 'requestedQty', label: 'Số lượng cần xuất', className: 'text-center font-bold text-slate-800', render: (row) => row.requestedQty },
      { key: 'note', label: 'Ghi chú', render: (row) => row.note || <span className="italic text-slate-300">Không có ghi chú</span> },
    ];

    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => setSelectedVoucherId(null)}
          className="mb-3.5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-xs transition hover:bg-slate-50 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Chi tiết phiếu xuất kho</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi thông tin phiếu xuất kho và danh sách thiết bị cần xuất cho đơn đặt cưới.</p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25 }}
          className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-center rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:col-span-9">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <FileText className="h-5 w-5 text-slate-400" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Số phiếu xuất</p>
                <p className="font-mono text-base font-bold text-blue-600">{selectedVoucher.id}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <Users className="h-5 w-5 text-slate-400" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tên đơn đặt</p>
                <p className="text-sm font-bold text-slate-800">{selectedVoucher.bookingName}</p>
                <Link href={`/admin/orders_audit/${selectedVoucher.orderId}`} className="text-xs font-semibold text-blue-600 hover:underline">
                  {selectedVoucher.orderId}
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <Calendar className="h-5 w-5 text-slate-400" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày dự kiến xuất kho</p>
                <p className="font-mono text-sm font-bold text-slate-700">{formatDate(selectedVoucher.expectedDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <Clock className="h-5 w-5 text-slate-400" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày thực tế xuất kho</p>
                {selectedVoucher.actualDate ? (
                  <p className="text-xs font-bold text-emerald-600">Đã xuất kho · {selectedVoucher.actualDate}</p>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">Chưa xuất kho</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2.5 border-t border-slate-100 pt-5 text-center xl:col-span-3 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            {selectedVoucher.status === 'not_exported' ? (
              <>
                <Button className="w-full" onClick={() => setConfirmingVoucherId(selectedVoucher.id)}>
                  Xác nhận xuất kho
                </Button>
                <p className="max-w-[220px] text-[11px] leading-normal text-slate-400">
                  Khi xác nhận, trạng thái phiếu sẽ chuyển sang Đã xuất và hệ thống sẽ trừ tồn kho khả dụng tương ứng.
                </p>
              </>
            ) : (
              <div className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-xs font-black uppercase tracking-wider">Đã xuất kho thành công</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <h2 className="text-sm font-semibold text-slate-900">Danh sách thiết bị cần xuất</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Tổng cộng <span className="font-bold text-blue-600">{selectedVoucher.items.length}</span> thiết bị /{' '}
            <span className="font-bold text-blue-600">{totalUnits}</span> đơn vị cần xuất
          </p>
          <div className="mt-4">
            <Table columns={itemColumns} rows={selectedVoucher.items} rowKey={(row) => row.equipmentId} />
          </div>
        </motion.div>

        <Modal
          isOpen={Boolean(confirmingVoucherId)}
          onClose={() => setConfirmingVoucherId(null)}
          title="Xác nhận bàn giao xuất kho?"
          subtitle={`Bạn đang chuẩn bị xuất kho cho phiếu ${confirmingVoucherId}. Hệ thống sẽ trừ tồn kho khả dụng tương ứng và chuyển trạng thái sang "Đã xuất" ngay lập tức.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingVoucherId(null)}>
                Hủy bỏ
              </Button>
              <Button onClick={() => confirmingVoucherId && handleConfirmExport(confirmingVoucherId)}>Xác nhận & Xuất kho</Button>
            </>
          }
        >
          <div className="flex items-start gap-3 text-sm text-slate-500">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <p>Hành động này không thể hoàn tác trong phiên làm việc hiện tại.</p>
          </div>
        </Modal>
      </div>
    );
  }

  const columns: TableColumn<OutboundVoucher>[] = [
    {
      key: 'id',
      label: 'Số phiếu xuất',
      render: (row) => (
        <button type="button" onClick={() => setSelectedVoucherId(row.id)} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
          {row.id}
        </button>
      ),
    },
    { key: 'bookingName', label: 'Đơn đặt cưới', render: (row) => <span className="font-medium text-slate-700">{row.bookingName}</span> },
    { key: 'expectedDate', label: 'Ngày dự kiến xuất kho', render: (row) => <span className="font-mono text-slate-500">{formatDate(row.expectedDate)}</span> },
    {
      key: 'actualDate',
      label: 'Ngày xuất kho thực tế',
      render: (row) => (row.actualDate ? <span className="font-mono text-slate-600">{row.actualDate}</span> : <span className="italic text-slate-300">—</span>),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) =>
        row.status === 'exported' ? (
          <Badge variant={OUTBOUND_STATUS_META.exported.variant}>{OUTBOUND_STATUS_META.exported.label}</Badge>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingVoucherId(row.id)}
            title="Bấm để xác nhận xuất kho"
            className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100"
          >
            {OUTBOUND_STATUS_META.not_exported.label}
          </button>
        ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedVoucherId(row.id)}
            aria-label="Xem chi tiết"
            title="Xem chi tiết"
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Xuất kho</h1>
        <p className="mt-1 text-sm text-slate-500">Quản lý danh sách phiếu xuất kho cho các đơn đặt cưới.</p>
      </div>

      <div className="mt-6">
        <DashboardStats items={kpiItems} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo số phiếu, đơn đặt, người nhận, biển số xe..."
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-3 text-sm hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-56">
              <Select
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                options={[{ value: '', label: 'Tất cả đơn đặt cưới' }, ...uniqueBookings.map((b) => ({ value: b, label: b }))]}
              />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
            <div className="w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'exported', label: 'Đã xuất' },
                  { value: 'not_exported', label: 'Chưa xuất' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Table columns={columns} rows={filteredVouchers} rowKey={(row) => row.id} />
        </div>
      </motion.div>

      <Modal
        isOpen={Boolean(confirmingVoucherId)}
        onClose={() => setConfirmingVoucherId(null)}
        title="Xác nhận bàn giao xuất kho?"
        subtitle={`Bạn đang chuẩn bị xuất kho cho phiếu ${confirmingVoucherId}. Hệ thống sẽ trừ tồn kho khả dụng tương ứng và chuyển trạng thái sang "Đã xuất" ngay lập tức.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingVoucherId(null)}>
              Hủy bỏ
            </Button>
            <Button onClick={() => confirmingVoucherId && handleConfirmExport(confirmingVoucherId)}>Xác nhận & Xuất kho</Button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-sm text-slate-500">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <p>Hành động này không thể hoàn tác trong phiên làm việc hiện tại.</p>
        </div>
      </Modal>
    </div>
  );
}
