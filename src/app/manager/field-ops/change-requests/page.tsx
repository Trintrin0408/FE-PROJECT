'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, FilePlus2, XCircle } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar, FilterRow } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import DashboardStats, { KpiCardItem } from '@/components/reports/DashboardStats';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import {
  CHANGE_REQUEST_STATUS_META,
  CHANGE_REQUEST_TYPE_META,
  ChangeRequestStatus,
  ChangeRequestType,
  FIELD_TRANSPORT_FEE,
  FieldChangeRequest,
  computeChangeRequestDelta,
  getFieldChangeRequests,
  reviewFieldChangeRequest,
} from '@/mocks/db';

// Trang thuần giao diện — chưa có màn hình admin/coordination/change-requests tương ứng để mirror
// (route đó bên Admin vẫn "đang phát triển"). Hàng đợi Change Request do Leader Staff ghi nhận tại
// hiện trường, Manager duyệt/từ chối — số tiền thay đổi hóa đơn tính đúng công thức mục 1 CLAUDE.md
// (xem computeChangeRequestDelta trong src/mocks/db/changeRequests.ts).

type StatusFilter = '' | ChangeRequestStatus;
type TypeFilter = '' | ChangeRequestType;

function ManagerChangeRequestsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<FieldChangeRequest[]>(() => getFieldChangeRequests());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  // Mở sẵn modal chi tiết của đúng yêu cầu vừa bấm "Duyệt ngay"/xem từ dropdown thông báo trên Header
  // (?id=CR-xxx) — không bắt buộc phải tự tìm lại dòng đó trong bảng nữa.
  const prefillId = searchParams.get('id');
  const [viewing, setViewing] = useState<FieldChangeRequest | null>(() =>
    prefillId ? getFieldChangeRequests().find((r) => r.id === prefillId) ?? null : null,
  );

  const refresh = () => setRequests(getFieldChangeRequests());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (!term) return true;
      return r.orderId.toLowerCase().includes(term) || r.customerName.toLowerCase().includes(term);
    });
  }, [requests, search, statusFilter, typeFilter]);

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const kpis: KpiCardItem[] = [
    { label: 'Tổng yêu cầu', value: requests.length, icon: FilePlus2, iconColor: 'blue' },
    { label: 'Chờ duyệt', value: pendingCount, icon: Clock, iconColor: 'amber' },
    { label: 'Đã duyệt', value: requests.filter((r) => r.status === 'APPROVED').length, icon: CheckCircle2, iconColor: 'green' },
    { label: 'Từ chối', value: requests.filter((r) => r.status === 'REJECTED').length, icon: XCircle, iconColor: 'red' },
  ];

  const handleReview = (id: string, decision: 'APPROVED' | 'REJECTED') => {
    reviewFieldChangeRequest(id, decision, user?.fullName ?? 'Quản lý vận hành');
    refresh();
    setViewing(null);
  };

  const columns: TableColumn<FieldChangeRequest>[] = [
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
      label: 'Loại thay đổi',
      render: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CHANGE_REQUEST_TYPE_META[r.type].badgeClass}`}>{CHANGE_REQUEST_TYPE_META[r.type].label}</span>,
    },
    { key: 'reason', label: 'Lý do', render: (r) => <span className="line-clamp-2 max-w-xs text-xs text-slate-600">{r.reason}</span> },
    {
      key: 'requestedBy',
      label: 'Leader Staff ghi nhận',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.requestedBy}</p>
          <p className="text-xs text-slate-400">{formatDate(r.requestedAt)}</p>
        </div>
      ),
    },
    {
      key: 'delta',
      label: 'Thay đổi hóa đơn',
      render: (r) => {
        const delta = computeChangeRequestDelta(r);
        return <span className={`font-bold ${delta >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{delta >= 0 ? '+' : ''}{formatCurrency(delta)}</span>;
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CHANGE_REQUEST_STATUS_META[r.status].badgeClass}`}>{CHANGE_REQUEST_STATUS_META[r.status].label}</span>,
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
      <PageHeader title="Yêu cầu thay đổi tại hiện trường (Change Request)" icon={<FilePlus2 className="h-6 w-6 text-blue-600" />} />

      <div className="mt-6">
        <DashboardStats items={kpis} />
      </div>

      <FilterBar>
        <FilterRow layout="start">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã đơn, khách hàng..." />
          <div className="w-52">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              options={[{ value: '', label: 'Tất cả loại thay đổi' }, ...Object.entries(CHANGE_REQUEST_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
          <div className="w-52">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(CHANGE_REQUEST_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}
            />
          </div>
        </FilterRow>

        <div className="mt-4 overflow-x-auto">
          <Table columns={columns} rows={filtered} rowKey={(row) => row.id} />
        </div>
      </FilterBar>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? CHANGE_REQUEST_TYPE_META[viewing.type].label : ''}
        subtitle={viewing ? `${viewing.orderId} · ${viewing.eventName}` : undefined}
        footer={
          viewing ? (
            <>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Đóng
              </Button>
              {viewing.status === 'PENDING' && (
                <>
                  <Button variant="danger" onClick={() => handleReview(viewing.id, 'REJECTED')}>
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </Button>
                  <Button onClick={() => handleReview(viewing.id, 'APPROVED')}>
                    <CheckCircle2 className="h-4 w-4" />
                    Duyệt yêu cầu
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {viewing && <ChangeRequestDetail request={viewing} />}
      </Modal>
    </div>
  );
}

export default function ManagerChangeRequestsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Đang tải...</div>}>
      <ManagerChangeRequestsPageContent />
    </Suspense>
  );
}

function ChangeRequestDetail({ request }: Readonly<{ request: FieldChangeRequest }>) {
  const delta = computeChangeRequestDelta(request);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <p>
          Ghi nhận bởi: <strong className="text-slate-800">{request.requestedBy}</strong> · {formatDate(request.requestedAt)}
        </p>
      </div>
      <p className="rounded-lg border border-slate-100 bg-white p-3 text-sm leading-relaxed text-slate-700">{request.reason}</p>

      {request.type === 'ADD' && request.addItem && (
        <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs">
          <p className="font-bold text-slate-800">
            + {request.addItem.name} × {request.addItem.quantity} ({formatCurrency(request.addItem.unitPrice)}/đơn vị)
          </p>
          <p className="text-slate-500">
            Khoảng cách kho → địa điểm: <strong className="text-slate-800">{request.distanceKm} km</strong>
            {(request.distanceKm ?? 0) > 2 && <span className="text-amber-600"> - phát sinh phụ phí vận chuyển {formatCurrency(FIELD_TRANSPORT_FEE)}</span>}
          </p>
        </div>
      )}

      {request.type === 'REMOVE' && request.removeItem && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-xs">
          <p className="font-bold text-slate-800">
            − {request.removeItem.name} × {request.removeItem.quantity} ({formatCurrency(request.removeItem.unitPrice)}/đơn vị)
          </p>
          <p className="mt-1 text-slate-500">Trừ 100% giá trị thiết bị bị bớt khỏi hóa đơn theo quy định.</p>
        </div>
      )}

      {request.type === 'REPLACE' && request.oldItem && request.newItem && (
        <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs">
          <p className="text-slate-600">
            Cũ: <span className="font-semibold text-slate-800">{request.oldItem.name}</span> × {request.oldItem.quantity} ({formatCurrency(request.oldItem.unitPrice)})
          </p>
          <p className="text-slate-600">
            Mới: <span className="font-semibold text-slate-800">{request.newItem.name}</span> × {request.newItem.quantity} ({formatCurrency(request.newItem.unitPrice)})
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold">
        <span className="text-slate-700">Thay đổi trên hóa đơn:</span>
        <span className={delta >= 0 ? 'text-blue-600' : 'text-rose-600'}>
          {delta >= 0 ? '+' : ''}
          {formatCurrency(delta)}
        </span>
      </div>

      {request.status !== 'PENDING' && (
        <p className={`rounded-lg p-3 text-xs font-semibold ${request.status === 'APPROVED' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>
          {request.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'} bởi {request.reviewedBy} ngày {request.reviewedAt ? formatDate(request.reviewedAt) : ''}
        </p>
      )}
    </div>
  );
}
