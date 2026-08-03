'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, Box, Calendar, Check, CheckCircle2, ChevronLeft, Clock, FileText, Lock, MapPin, PlayCircle, Users } from 'lucide-react';
import { Badge, getStatusBadgeVariant, type BadgeVariant } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import RecordSettlementModal from '@/components/orders/RecordSettlementModal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { getUrgencyBadgeVariant } from '@/utils/eventDate';
import { orderApiService } from '@/services/order.service';
import { customerApiService } from '@/services/customer.service';
import { paymentApiService } from '@/services/payment.service';
import { settlementApiService } from '@/services/settlement.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { ORDER_PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/constants/order-status';
import type { LiveShowChecklist, OrderDetail, OrderStatus } from '@/types/order';
import type { Customer } from '@/types/customer';
import type { Deposit } from '@/types/payment';
import type { Settlement } from '@/types/settlement';
import type { SchedulePlan } from '@/types/schedulePlan';

// Nối API thật theo docs/tongquansukien_api.md (2026-07-20) — header + mốc tiến trình + tab "Tổng
// quan sự kiện" (mặc định) đã nối `orderApiService.getOrder()`/`customerApiService.getCustomer()`
// thật, route điều hướng dùng `order_id` (UUID) đúng như doc mục 1 yêu cầu (khớp link thật từ
// `/admin/orders_audit` đã nối trước đó). Dropdown đổi trạng thái + nút "Hủy đơn hàng" gọi
// `orderApiService.updateOrderStatus` thật (mục 6).
//
// Nút "Chỉnh sửa đơn đặt" tạm khóa vì `BookingFormModal` vẫn theo shape mock cũ, chưa tương thích
// `OrderDetail` thật (cùng vấn đề đã ghi ở docs/taodondatlichtiecmoi_api.md — modal khác, đã nối
// riêng ở màn danh sách).
//
// Khối "Phân công khảo sát báo giá" tạm hiện placeholder — theo docs/tongquansukien_api.md mục 5 (đã
// chốt Hướng A: dùng `schedule_plans` + seed thêm `work_tasks` "Khảo sát hiện trường"), nhưng backend
// **chưa seed** dòng `work_tasks` đó (xác nhận qua `curl` 2026-07-20: `GET /work-tasks` chỉ có 2 dòng
// "Lắp đặt thiết bị"/"Tháo dỡ thiết bị" — xem docs/more-require.md mục (f), vẫn đang chờ).
//
// Cập nhật (tiếp) — đã nối thật tab "Tiến độ sự kiện" theo docs/tiendosukien_api.md (2026-07-20, mọi
// quyết định đã chốt ở mục 9.1): Mốc 1 (đọc `createdBy.fullName` thật — đã join sẵn, không cần round-
// trip `GET /users/:id` như doc lo ngại), Mốc 2 (cọc qua `paymentApiService`, khảo sát vẫn placeholder
// cùng lý do work_tasks), Mốc 3 (đọc nhiều dòng `schedule_plans?orderId=` thật, hiển thị read-only —
// hành động sửa/xóa/bắt đầu thuộc tab "Lịch trình & Kỹ thuật"/mobile Leader Staff, ngoài phạm vi ở
// đây), Mốc 4 (`PATCH /orders/:id/live-checklist` — xác nhận hoạt động thật qua `curl`, không có GET
// riêng nên state ban đầu luôn là tất cả `false`), Mốc 5 (luồng 4 bước đã chốt: đọc/lập settlement →
// xác nhận → tự gọi thêm `PUT /orders/:id/status COMPLETED`, dùng lại `RecordSettlementModal.tsx` có
// sẵn — trước đó mồ côi, không trang nào import), Mốc 6 (`PUT /orders/:id/close` — xác nhận hoạt động
// thật qua `curl`, backend tự chặn 400 nếu chưa `COMPLETED`+`PAID`). "N nhóm thiết bị" ở Mốc 1 đổi
// thành số lượng hạng mục (`order.items.length`) vì `GET /orders/:id` chưa join category vào
// `orderItems` (doc mục 8, chưa implement).

type DetailTab = 'overview' | 'lifecycle' | 'items' | 'plans' | 'quotation';

// Tab "Tiến độ sự kiện" đã ẩn khỏi thanh điều hướng theo yêu cầu — giữ nguyên khai báo trong DetailTab
// + nhánh render ở dưới (activeTab === 'lifecycle') để khôi phục lại dễ dàng nếu cần, chỉ bỏ khỏi TABS.
const TABS: { id: DetailTab; label: string; icon: typeof Activity; doc?: string }[] = [
  { id: 'overview', label: 'Tổng quan sự kiện', icon: Activity },
  { id: 'items', label: 'Thiết bị & Kho hàng', icon: Box, doc: 'docs/thietbikhohang_api.md' },
  { id: 'plans', label: 'Lịch trình & Kỹ thuật', icon: Calendar, doc: 'docs/lichtrinhkythuat_api.md' },
  { id: 'quotation', label: 'Báo giá & Hợp đồng', icon: FileText, doc: 'docs/baogiavahopdong_api.md' },
];

const LIFECYCLE_STEPS: { id: OrderStatus; label: string; desc: string }[] = [
  { id: 'NEW', label: `1. ${ORDER_STATUS_LABEL.NEW}`, desc: 'Lập đơn & hợp đồng' },
  { id: 'CONFIRMED', label: `2. ${ORDER_STATUS_LABEL.CONFIRMED}`, desc: 'Xác nhận cọc' },
  { id: 'IN_PROGRESS', label: `3. ${ORDER_STATUS_LABEL.IN_PROGRESS}`, desc: 'Lên kế hoạch và thực hiện' },
  { id: 'COMPLETED', label: `4. ${ORDER_STATUS_LABEL.COMPLETED}`, desc: 'Quyết toán & nghiệm thu' },
];
const LIFECYCLE_ORDER: OrderStatus[] = ['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

const PAYMENT_BADGE_VARIANT: Record<string, BadgeVariant> = {
  UNPAID: 'neutral',
  DEPOSITED: 'warning',
  PAID: 'success',
};

const SCHEDULE_STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Chờ xử lý', variant: 'neutral' },
  CONFIRMED: { label: 'Đã xác nhận', variant: 'info' },
  IN_PROGRESS: { label: 'Đang thi công', variant: 'warning' },
  COMPLETED: { label: 'Hoàn thành', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'error' },
};

const LIVE_CHECKLIST_ITEMS: { key: keyof LiveShowChecklist; label: string }[] = [
  { key: 'backdrop', label: 'Backdrop/sân khấu đã dựng xong' },
  { key: 'soundTest', label: 'Đã test âm thanh/ánh sáng' },
  { key: 'powerBackup', label: 'Đã kiểm tra nguồn điện dự phòng' },
  { key: 'operatorReady', label: 'Kỹ thuật viên vận hành đã sẵn sàng' },
];

const EMPTY_CHECKLIST: LiveShowChecklist = { backdrop: false, soundTest: false, powerBackup: false, operatorReady: false };

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [schedulePlans, setSchedulePlans] = useState<SchedulePlan[]>([]);
  const [liveChecklist, setLiveChecklist] = useState<LiveShowChecklist>(EMPTY_CHECKLIST);
  const [isConfirmingDeposit, setIsConfirmingDeposit] = useState(false);
  const [isTogglingChecklist, setIsTogglingChecklist] = useState(false);
  const [isActivatingLiveShow, setIsActivatingLiveShow] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isCompletingSettlement, setIsCompletingSettlement] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    orderApiService
      .getOrder(id)
      .then((res) => {
        const detail = res.data as OrderDetail;
        setOrder(detail);
        return Promise.all([
          customerApiService.getCustomer(detail.customerId),
          paymentApiService.getOrderDeposits(detail.orderId).catch(() => ({ data: [] })),
          settlementApiService.getOrderSettlement(detail.orderId).catch(() => ({ data: null })),
          schedulePlanApiService.getSchedulePlans({ orderId: detail.orderId }).catch(() => ({ data: [] })),
        ]);
      })
      .then(([customerRes, depositsRes, settlementRes, plansRes]) => {
        setCustomer(customerRes.data ?? null);
        setDeposits(depositsRes.data ?? []);
        setSettlement(settlementRes.data ?? null);
        setSchedulePlans(plansRes.data ?? []);
      })
      .catch(() => {
        setOrder(null);
        setLoadError('Không tải được thông tin đơn đặt.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi đổi id trên URL
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Đang tải thông tin đơn đặt...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">{loadError ?? 'Không tìm thấy đơn đặt.'}</p>
        <Link href="/admin/orders_audit" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (status: OrderStatus) => {
    setIsChangingStatus(true);
    try {
      await orderApiService.updateOrderStatus(order.orderId, { orderStatus: status });
      load();
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleCancelConfirm = async () => {
    setIsCancelling(true);
    try {
      await orderApiService.updateOrderStatus(order.orderId, { orderStatus: 'CANCELLED', cancelReason: cancelReason.trim() || undefined });
      setIsCancelOpen(false);
      setCancelReason('');
      load();
    } finally {
      setIsCancelling(false);
    }
  };

  const latestDeposit = deposits[0];
  const isDeposited = order.paymentStatus === 'DEPOSITED' || order.paymentStatus === 'PAID';
  const isMilestone2Complete = isDeposited;
  const isMilestone3Complete = order.orderStatus === 'IN_PROGRESS' || order.orderStatus === 'COMPLETED';
  const isMilestone4Complete = order.orderStatus === 'COMPLETED';
  const isReadyToClose = order.orderStatus === 'COMPLETED' && order.paymentStatus === 'PAID' && !order.closedAt;
  const depositCollected = deposits.filter((d) => d.status === 'PAID').reduce((sum, d) => sum + d.amount, 0);

  const handleConfirmDeposit = async () => {
    if (!latestDeposit) return;
    setIsConfirmingDeposit(true);
    try {
      await paymentApiService.updateDepositStatus(latestDeposit.depositId, { status: 'PAID' });
      load();
    } finally {
      setIsConfirmingDeposit(false);
    }
  };

  const handleToggleChecklist = async (key: keyof LiveShowChecklist) => {
    setIsTogglingChecklist(true);
    try {
      const res = await orderApiService.updateLiveChecklist(order.orderId, { key, checked: !liveChecklist[key] });
      setLiveChecklist(res.data ?? { ...liveChecklist, [key]: !liveChecklist[key] });
    } finally {
      setIsTogglingChecklist(false);
    }
  };

  const handleActivateLiveShow = async () => {
    setIsActivatingLiveShow(true);
    try {
      await orderApiService.updateOrderStatus(order.orderId, { orderStatus: 'IN_PROGRESS' });
      load();
    } finally {
      setIsActivatingLiveShow(false);
    }
  };

  const handleConfirmSettlement = async () => {
    if (!settlement) return;
    setIsCompletingSettlement(true);
    try {
      await settlementApiService.confirmSettlement(settlement.settlementId, { status: 'PAID' });
      await orderApiService.updateOrderStatus(order.orderId, { orderStatus: 'COMPLETED' });
      load();
    } finally {
      setIsCompletingSettlement(false);
    }
  };

  const handleCloseOrder = async () => {
    if (!confirm('Xác nhận đóng đơn hàng? Sau khi đóng sẽ không thể đổi trạng thái hoặc chỉnh sửa thêm.')) return;
    setIsClosingOrder(true);
    try {
      await orderApiService.closeOrder(order.orderId);
      load();
    } finally {
      setIsClosingOrder(false);
    }
  };

  const daysLeft = Math.round((new Date(order.eventDate).getTime() - Date.now()) / 86_400_000);
  const urgencyVariant = daysLeft >= 0 ? getUrgencyBadgeVariant(daysLeft) : null;

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: 'Đơn đặt' },
          { label: 'Danh sách đơn đặt', href: '/admin/orders_audit' },
          { label: order.orderCode },
        ]}
        className="mb-3"
      />
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/orders_audit')}
            title="Quay lại"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{order.orderCode}</h1>
              <Badge variant={getStatusBadgeVariant(order.orderStatus)}>{ORDER_STATUS_LABEL[order.orderStatus]}</Badge>
              <Badge variant={PAYMENT_BADGE_VARIANT[order.paymentStatus]}>{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}</Badge>
              {urgencyVariant && (
                <Badge variant={urgencyVariant}>Tổ chức sự kiện · Còn {daysLeft} ngày</Badge>
              )}
              {order.closedAt && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-white">
                  <Lock className="h-3 w-3" />
                  Đã đóng đơn
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-950">{order.eventName || order.eventType}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.orderStatus !== 'CANCELLED' && !order.closedAt && (
            <>
              <div className="w-44">
                <Select
                  value={order.orderStatus}
                  onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                  disabled={isChangingStatus}
                  options={LIFECYCLE_ORDER.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))}
                />
              </div>
              <Button variant="danger" onClick={() => setIsCancelOpen(true)}>
                Hủy đơn hàng
              </Button>
            </>
          )}
          <Button disabled title="Modal Chỉnh sửa đơn đặt chưa tương thích dữ liệu thật — xem docs/taodondatlichtiecmoi_api.md">
            Chỉnh sửa đơn đặt
          </Button>
        </div>
      </div>

      {order.closedAt && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
          <Lock className="h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Đơn hàng đã được đóng {order.closedBy ? <>bởi <strong className="text-slate-800">{order.closedBy}</strong> </> : ''}ngày {formatDate(order.closedAt)}. Không thể đổi trạng thái hoặc chỉnh sửa thêm.
          </p>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mốc tiến trình vận hành sự kiện</p>
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const currentActiveIdx = order.orderStatus === 'CANCELLED' ? -1 : LIFECYCLE_ORDER.indexOf(order.orderStatus);
            const stepIdx = LIFECYCLE_ORDER.indexOf(step.id);
            const isPast = stepIdx < currentActiveIdx;
            const isCurrent = step.id === order.orderStatus;

            return (
              <div key={step.id} className="flex w-full flex-1 items-center gap-3">
                <div className="flex flex-col items-center gap-2 sm:flex-row">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isPast ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-blue-600 text-white shadow shadow-blue-600/20' : 'border bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <div className="text-center sm:text-left">
                    <p className={`text-xs font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-800'}`}>{step.label}</p>
                    <p className="text-[10px] text-slate-400">{step.desc}</p>
                  </div>
                </div>
                {idx < LIFECYCLE_STEPS.length - 1 && <div className={`hidden h-0.5 flex-1 md:block ${isPast ? 'bg-emerald-600' : 'bg-slate-100'}`} />}
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="flex h-fit flex-col gap-1 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs lg:col-span-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-bold transition ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <tab.icon className="h-4 w-4 text-slate-400" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-6 lg:col-span-3">
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-950">Hồ sơ thông tin sự kiện</h4>
                <p className="text-xs text-slate-400">Các tham số địa điểm, ngày thi công và khối lượng khách mời.</p>
              </div>

              <div className="grid grid-cols-1 gap-6 text-xs sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="block font-semibold uppercase text-slate-400">Ngày diễn ra sự kiện</span>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {formatDate(order.eventDate)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="block font-semibold uppercase text-slate-400">Ngày kết thúc</span>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {order.endDate ? formatDate(order.endDate) : '—'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="block font-semibold uppercase text-slate-400">Khách mời dự kiến</span>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Users className="h-4 w-4 text-slate-400" />
                    {order.guestCount != null ? `${order.guestCount} khách mời` : 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <span className="block font-semibold uppercase text-slate-400">Địa điểm tổ chức</span>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {order.location}
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <span className="block font-semibold uppercase text-slate-400">Mô tả và dặn dò đặc biệt</span>
                  <p className="whitespace-pre-line rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                    {order.notes || 'Không có ghi chú gì thêm.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl bg-slate-900 p-5 text-xs text-slate-100">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300">Hồ sơ khách hàng liên đới</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <p>
                    <span className="text-slate-400">Họ tên:</span> <strong className="text-white">{customer?.customerName ?? order.customerName}</strong>
                  </p>
                  <p>
                    <span className="text-slate-400">Điện thoại:</span> <strong className="text-white">{customer?.phone ?? order.customerPhone}</strong>
                  </p>
                  <p className="truncate">
                    <span className="text-slate-400">Địa chỉ:</span> <strong className="text-white">{customer?.address || 'Chưa cập nhật'}</strong>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'lifecycle' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hồ sơ giám sát tiến độ sự kiện</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tiến độ chung: {[true, isMilestone2Complete, isMilestone3Complete, isMilestone4Complete, order.paymentStatus === 'PAID'].filter(Boolean).length}/5 Mốc
                </p>
              </div>

              {/* Mốc 1 */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900">Mốc 1: Khởi tạo đơn & khai lập hợp đồng</h4>
                  <Badge variant="success">Hoàn thành</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-slate-400">Mã đơn</p>
                    <p className="font-bold text-slate-800">{order.orderCode}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Giá trị đơn hàng</p>
                    <p className="font-bold text-slate-800">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Điều phối viên</p>
                    <p className="font-bold text-slate-800">{order.createdBy.fullName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Hạng mục thiết bị</p>
                    <p className="font-bold text-slate-800">{order.items.length} hạng mục</p>
                  </div>
                </div>
              </div>

              {/* Mốc 2 */}
              <div className={`rounded-xl border p-5 ${isMilestone2Complete ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2">
                  {isMilestone2Complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-500" />}
                  <h4 className="text-sm font-bold text-slate-900">Mốc 2: Xác nhận cọc & khảo sát hiện trường</h4>
                  <Badge variant={isMilestone2Complete ? 'success' : 'warning'}>{isMilestone2Complete ? 'Hoàn thành' : 'Đang chờ'}</Badge>
                </div>
                <div className="mt-3 space-y-3 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div>
                      <p className="font-semibold text-slate-700">Thu tiền tạm ứng đặt cọc</p>
                      {latestDeposit ? (
                        <p className="mt-0.5 text-slate-500">
                          {formatCurrency(latestDeposit.amount)} · {latestDeposit.status === 'PAID' ? 'Đã nhận' : 'Chờ xác nhận'}
                        </p>
                      ) : (
                        <p className="mt-0.5 italic text-slate-400">Chưa có yêu cầu cọc cho đơn này.</p>
                      )}
                    </div>
                    {latestDeposit && latestDeposit.status !== 'PAID' && (
                      <Button size="sm" onClick={handleConfirmDeposit} isLoading={isConfirmingDeposit}>
                        Xác nhận đã nhận cọc
                      </Button>
                    )}
                  </div>
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 italic text-slate-400">
                    Khảo sát hiện trường: chưa nối API thật — backend chưa seed danh mục công việc &quot;Khảo sát hiện trường&quot; (xem docs/more-require.md mục (f)).
                  </div>
                </div>
              </div>

              {/* Mốc 3 */}
              <div className={`rounded-xl border p-5 ${isMilestone3Complete ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2">
                  {isMilestone3Complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-500" />}
                  <h4 className="text-sm font-bold text-slate-900">Mốc 3: Lập kế hoạch & thi công hạ tầng kỹ thuật</h4>
                  <Badge variant={isMilestone3Complete ? 'success' : 'warning'}>{isMilestone3Complete ? 'Đang/đã triển khai' : 'Chưa bắt đầu'}</Badge>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  {schedulePlans.length === 0 ? (
                    <p className="italic text-slate-400">Chưa có lịch trình kỹ thuật nào được lập cho đơn này.</p>
                  ) : (
                    schedulePlans.map((plan) => (
                      <div key={plan.planId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-800">{plan.taskName ?? plan.planCode}</p>
                          <Badge variant={SCHEDULE_STATUS_META[plan.status]?.variant ?? 'neutral'}>{SCHEDULE_STATUS_META[plan.status]?.label ?? plan.status}</Badge>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {formatDate(plan.startTime)} · {plan.location ?? order.location}
                        </p>
                        {plan.assignees && plan.assignees.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-2 text-slate-500">
                            {plan.assignees.map((a) => (
                              <span key={a.userId} className="rounded bg-white px-2 py-0.5 ring-1 ring-inset ring-slate-200">
                                {a.fullName} ({a.role === 'LEAD' ? 'Trưởng nhóm' : 'Kỹ thuật viên'})
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                  <p className="italic text-slate-400">Xem/sửa chi tiết ở tab &quot;Lịch trình & Kỹ thuật&quot; khi tab đó được nối API.</p>
                </div>
              </div>

              {/* Mốc 4 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">Mốc 4: Vận hành chạy chương trình sự kiện (Live Show)</h4>
                  <Badge variant={order.orderStatus === 'IN_PROGRESS' ? 'warning' : order.orderStatus === 'COMPLETED' ? 'success' : 'neutral'}>
                    {order.orderStatus === 'IN_PROGRESS' ? 'Đang chạy trực tiếp' : order.orderStatus === 'COMPLETED' ? 'Đã kết thúc' : 'Chưa bắt đầu'}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Ngày tổ chức chính thức: <strong className="text-slate-800">{formatDate(order.eventDate)}</strong>
                  {order.endDate && (
                    <>
                      {' '}— Ngày kết thúc: <strong className="text-slate-800">{formatDate(order.endDate)}</strong>
                    </>
                  )}
                </p>
                <div className="mt-3 space-y-1.5">
                  {LIVE_CHECKLIST_ITEMS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={liveChecklist[item.key]}
                        disabled={isTogglingChecklist}
                        onChange={() => handleToggleChecklist(item.key)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[10px] italic text-slate-400">
                  Checklist chưa có nơi lưu trạng thái cũ — luôn khởi động lại từ đầu khi mở lại trang.
                </p>
                {order.orderStatus === 'CONFIRMED' && (
                  <div className="mt-3">
                    <Button size="sm" onClick={handleActivateLiveShow} isLoading={isActivatingLiveShow}>
                      Kích hoạt chạy Live Show
                    </Button>
                  </div>
                )}
              </div>

              {/* Mốc 5 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">Mốc 5: Quyết toán đối soát & nghiệm thu tháo dỡ</h4>
                  <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'warning'}>
                    {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus]}
                  </Badge>
                </div>
                {settlement ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <p className="text-slate-400">Số tiền quyết toán cuối</p>
                      <p className="font-bold text-slate-800">{formatCurrency(settlement.finalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Trạng thái biên bản</p>
                      <p className="font-bold text-slate-800">{settlement.status}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs italic text-slate-400">Chưa có biên bản quyết toán cho đơn này.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setIsSettlementModalOpen(true)}>
                    {settlement ? 'Điều chỉnh biên bản quyết toán' : 'Lập biên bản quyết toán'}
                  </Button>
                  {settlement && settlement.status !== 'PAID' && order.orderStatus !== 'COMPLETED' && (
                    <Button size="sm" onClick={handleConfirmSettlement} isLoading={isCompletingSettlement}>
                      <Check className="h-4 w-4" />
                      Xác nhận thu nốt & Quyết toán
                    </Button>
                  )}
                </div>
              </div>

              {/* Mốc 6 */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-bold text-slate-900">Mốc 6: Đóng đơn hàng</h4>
                  <Badge variant={order.closedAt ? 'success' : 'neutral'}>{order.closedAt ? 'Đã đóng' : 'Chưa đóng'}</Badge>
                </div>
                {order.closedAt ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Đã đóng ngày <strong className="text-slate-800">{formatDate(order.closedAt)}</strong>.
                  </p>
                ) : isReadyToClose ? (
                  <div className="mt-3">
                    <Button size="sm" onClick={handleCloseOrder} isLoading={isClosingOrder}>
                      Đóng đơn hàng
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs italic text-slate-400">Chỉ đóng được khi đơn đã Hoàn thành và đã thanh toán đủ (PAID).</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab !== 'overview' && activeTab !== 'lifecycle' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="text-center rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <p className="text-sm font-medium text-slate-500">
                Tab &quot;{TABS.find((t) => t.id === activeTab)?.label}&quot; chưa nối API thật.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {TABS.find((t) => t.id === activeTab)?.doc
                  ? <>Sẽ triển khai ở lượt kế tiếp theo <code>{TABS.find((t) => t.id === activeTab)?.doc}</code>.</>
                  : 'Chưa có tài liệu API riêng cho tab này.'}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Hủy đơn đặt"
        subtitle={`Bạn có chắc muốn hủy đơn "${order.orderCode}"? Đơn sẽ chuyển sang trạng thái Đã hủy, dữ liệu vẫn được giữ lại để đối chiếu.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCancelOpen(false)} disabled={isCancelling}>
              Đóng
            </Button>
            <Button variant="danger" onClick={handleCancelConfirm} isLoading={isCancelling}>
              Hủy đơn
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="cancel-reason">
            Lý do hủy (không bắt buộc)
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            className="block w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </Modal>

      <RecordSettlementModal
        isOpen={isSettlementModalOpen}
        orderId={order.orderId}
        orderTotal={order.totalAmount}
        depositCollected={depositCollected}
        onClose={() => setIsSettlementModalOpen(false)}
        onSuccess={load}
      />
    </div>
  );
}
