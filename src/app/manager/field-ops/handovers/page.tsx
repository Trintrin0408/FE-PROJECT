'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Camera, CheckCircle2, Clock, FileCheck2, HardHat, MapPin, Search } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/formatDate';
import {
  FieldHandoverRecord,
  HANDOVER_STATUS_META,
  HANDOVER_TYPE_META,
  HandoverStatus,
  HandoverType,
  confirmFieldHandover,
  getFieldHandovers,
} from '@/mocks/db';

// Trang thuần giao diện — thay placeholder cũ. Chưa có màn hình admin/coordination/handover tương ứng
// để mirror (route đó bên Admin vẫn "đang phát triển") nên dựng mới theo đúng luồng nghiệp vụ mục 1
// CLAUDE.md: Leader Staff (mobile) ghi nhận biên bản bàn giao/nghiệm thu tại hiện trường — Manager chỉ
// xác nhận (confirm) trên web trước khi coi là chính thức. Xem giải thích mock ở đầu
// src/mocks/db/changeRequests.ts.

type StatusFilter = '' | HandoverStatus;
type TypeFilter = '' | HandoverType;

export default function ManagerHandoversPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FieldHandoverRecord[]>(() => getFieldHandovers());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [viewing, setViewing] = useState<FieldHandoverRecord | null>(null);

  const refresh = () => setRecords(getFieldHandovers());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (!term) return true;
      return r.orderId.toLowerCase().includes(term) || r.customerName.toLowerCase().includes(term);
    });
  }, [records, search, statusFilter, typeFilter]);

  const pendingCount = records.filter((r) => r.status === 'PENDING_CONFIRM').length;

  const kpis: KpiCardItem[] = [
    { label: 'Tổng biên bản', value: records.length, icon: FileCheck2, iconColor: 'blue' },
    { label: 'Chờ xác nhận', value: pendingCount, icon: Clock, iconColor: 'amber' },
    { label: 'Đã xác nhận', value: records.length - pendingCount, icon: CheckCircle2, iconColor: 'green' },
  ];

  const handleConfirm = (record: FieldHandoverRecord) => {
    confirmFieldHandover(record.id, user?.fullName ?? 'Quản lý vận hành');
    refresh();
    setViewing(null);
  };

  const columns: TableColumn<FieldHandoverRecord>[] = [
    {
      key: 'order',
      label: 'Đơn đặt cưới',
      render: (r) => (
        <div>
          <Link href={`/manager/orders/${r.orderId}`} className="font-semibold text-blue-600 hover:underline">
            {r.orderId}
          </Link>
          <p className="text-xs text-slate-400">{r.customerName}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Loại biên bản',
      render: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${HANDOVER_TYPE_META[r.type].badgeClass}`}>{HANDOVER_TYPE_META[r.type].label}</span>,
    },
    {
      key: 'submittedBy',
      label: 'Leader Staff ghi nhận',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.submittedBy}</p>
          <p className="text-xs text-slate-400">{formatDate(r.submittedAt)}</p>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Địa điểm',
      render: (r) => (
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {r.location}
        </p>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${HANDOVER_STATUS_META[r.status].badgeClass}`}>{HANDOVER_STATUS_META[r.status].label}</span>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r) => (
        <button type="button" onClick={() => setViewing(r)} className="text-xs font-semibold text-blue-600 hover:underline">
          Xem chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
          <HardHat className="h-6 w-6 text-blue-600" />
          Nghiệm thu &amp; bàn giao
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Hàng đợi biên bản bàn giao thiết bị / nghiệm thu hoàn thành do Leader Staff ghi nhận tại hiện trường — Manager xác nhận trước khi coi là chính thức.
        </p>
      </div>

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input placeholder="Tìm theo mã đơn, khách hàng..." icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-52">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              options={[{ value: '', label: 'Tất cả loại biên bản' }, ...Object.entries(HANDOVER_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-52">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(HANDOVER_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.id} />
        </div>
      </motion.div>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? HANDOVER_TYPE_META[viewing.type].label : ''}
        subtitle={viewing ? `${viewing.orderId} · ${viewing.eventName}` : undefined}
        footer={
          viewing ? (
            <>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Đóng
              </Button>
              {viewing.status === 'PENDING_CONFIRM' && (
                <Button onClick={() => handleConfirm(viewing)}>
                  <CheckCircle2 className="h-4 w-4" />
                  Xác nhận biên bản
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                Ghi nhận bởi: <strong className="text-slate-800">{viewing.submittedBy}</strong> · {formatDate(viewing.submittedAt)}
              </p>
              <p className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {viewing.location}
              </p>
            </div>
            <p className="whitespace-pre-line rounded-lg border border-slate-100 bg-white p-3 text-sm leading-relaxed text-slate-700">{viewing.notes}</p>
            {viewing.evidencePhotoName && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <Camera className="h-3.5 w-3.5" />
                Đính kèm minh chứng: {viewing.evidencePhotoName}
              </p>
            )}
            {viewing.status === 'CONFIRMED' && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                Đã xác nhận bởi {viewing.confirmedBy} ngày {viewing.confirmedAt ? formatDate(viewing.confirmedAt) : ''}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
