'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, Ban, Box, Calendar, Check, CheckCircle2, ChevronLeft, Clock, Eye, FileText, Lock, Link2, MapPin, Package, Pencil, Phone, PlayCircle, Plus, Printer, Users } from 'lucide-react';
import { Badge, getStatusBadgeVariant, type BadgeVariant } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import RecordSettlementModal from '@/components/orders/RecordSettlementModal';
import CreateSchedulePlanModal from '@/components/schedule/CreateSchedulePlanModal';
import CreateQuotationWizardModal from '@/components/quotations/CreateQuotationWizardModal';
import PurchaseOrderFormModal, { type CreateFormPrefill } from '@/components/suppliers/PurchaseOrderFormModal';
import PlanFormDrawer from '@/components/planning/PlanFormDrawer';
import { groupPlansByOrder } from '@/utils/schedulePlanGroups';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate, formatTime } from '@/utils/formatDate';
import { getUrgencyBadgeVariant } from '@/utils/eventDate';
import { orderApiService } from '@/services/order.service';
import { customerApiService } from '@/services/customer.service';
import { paymentApiService } from '@/services/payment.service';
import { settlementApiService } from '@/services/settlement.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { inventoryApiService } from '@/services/inventory.service';
import { evidenceApiService } from '@/services/evidence.service';
import { quotationApiService } from '@/services/quotation.service';
import { surveyApiService } from '@/services/survey.service';
import { supplierApiService } from '@/services/supplier.service';
import { QUOTATION_STATUS_META } from '@/mocks/db/quotations';
import { ORDER_PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/constants/order-status';
import type { CreateOrderItemPayload, LiveShowChecklist, OrderDetail, OrderItemSource, OrderStatus } from '@/types/order';
import type { Customer } from '@/types/customer';
import type { Deposit } from '@/types/payment';
import type { Settlement } from '@/types/settlement';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { InventoryRow } from '@/types/inventory';
import type { Evidence } from '@/types/evidence';
import type { QuotationDetailApi, QuotationDetailItem, QuotationListItem } from '@/types/quotation';
import type { SurveyReportListItem } from '@/types/survey';

// Nối API thật theo docs/tongquansukien_api.md (2026-07-20) — header + mốc tiến trình + tab "Tổng
// quan sự kiện" (mặc định) đã nối `orderApiService.getOrder()`/`customerApiService.getCustomer()`
// thật, route điều hướng dùng `order_id` (UUID) đúng như doc mục 1 yêu cầu (khớp link thật từ
// `/manager/orders` đã nối trước đó). Dropdown đổi trạng thái + nút "Hủy đơn hàng" gọi
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
// trip `GET /users/:id` như doc lo ngại), Mốc 2 (cọc qua `paymentApiService`), Mốc 3 (đọc nhiều dòng
// `schedule_plans?orderId=` thật, hiển thị read-only — hành động sửa/xóa/bắt đầu thuộc tab "Lịch
// trình & Kỹ thuật"/mobile Leader Staff, ngoài phạm vi ở đây), Mốc 4 (`PATCH /orders/:id/live-
// checklist` — xác nhận hoạt động thật qua `curl`, không có GET riêng nên state ban đầu luôn là tất cả
// `false`), Mốc 5 (luồng 4 bước đã chốt: đọc/lập settlement → xác nhận → tự gọi thêm `PUT /orders/:id/
// status COMPLETED`, dùng lại `RecordSettlementModal.tsx` có sẵn — trước đó mồ côi, không trang nào
// import), Mốc 6 (`PUT /orders/:id/close` — xác nhận hoạt động thật qua `curl`, backend tự chặn 400
// nếu chưa `COMPLETED`+`PAID`). "N nhóm thiết bị" ở Mốc 1 đổi thành số lượng hạng mục
// (`order.items.length`) vì `GET /orders/:id` chưa join category vào `orderItems` (doc mục 8, chưa
// implement).
//
// Cập nhật 2026-07-21 (theo yêu cầu người dùng — "Ở mốc 2 phải xác nhận 2 công việc là cọc và khảo
// sát"): work_tasks "Khảo sát hiện trường" (TSK-SURVEY) đã được Backend seed (khác ghi nhận cũ ở
// docs/more-require.md mục (f)), và `GET /survey-reports` (đã nối cho màn `/manager/survey` trước đó)
// dùng được luôn ở đây — Mốc 2 giờ đọc báo cáo khảo sát thật của đúng đơn này (lọc qua `search=
// orderCode` rồi khớp chính xác `orderId`, vì `GET /survey-reports` không có param `orderId` lọc thật
// — test qua `curl` xác nhận param này bị bỏ qua, chỉ `search` hoạt động) và yêu cầu CẢ 2 việc (cọc
// `SUCCESS` + khảo sát `CONFIRMED`) mới coi Mốc 2 là hoàn thành — khớp đúng yêu cầu "đơn tạo sẵn đã cọc/
// đã khảo sát thì tự động hiện hoàn thành ngay, không cần bấm xác nhận lại" vì cả 2 điều kiện đọc thẳng
// từ dữ liệu thật, không phải cờ thủ công.
//
// Mốc 3 bổ sung hiển thị giờ check-in/check-out thật của từng nhân sự (schedule_plan_assignees.
// check_in_at/check_out_at — cùng field đã dùng ở tab "Lịch trình & Kỹ thuật") thay vì chỉ có giờ dự
// kiến (startTime/endTime) — đáp ứng yêu cầu "cập nhật trạng thái làm việc (bắt đầu lúc mấy giờ, hoàn
// thành lúc mấy giờ)". Khối "tiến độ sắp xếp kho vật tư" (thanh % dựng từ mock cũ) đã không còn tồn
// tại ở Mốc 3 từ lần viết lại tab này theo docs/tiendosukien_api.md (2026-07-20) — xác nhận lại không
// còn sót lại chỗ nào.
//
// Cập nhật (tiếp) — đã nối thật tab "Thiết bị & Kho hàng" theo docs/thietbikhohang_api.md (2026-07-20,
// mọi quyết định đã chốt ở mục 7.1): 2 cột "Đã bàn giao"/"Người phụ trách" đổi thành read-only (Hướng
// B đã chốt — dữ liệu do Leader Staff ghi qua mobile qua `PATCH /orders/:id/items/:itemId`, xác nhận
// hoạt động thật qua `curl`, nhưng web không gọi vì đây không phải hành động của Manager/Admin). Giá
// tiền đọc thẳng `subtotal` thật, không tự tính `unitPrice * quantity`. Modal Picklist đơn giản hoá
// theo Hướng A (bỏ BOM/vật tư cấu thành dựng sẵn), có thêm cột "Tồn kho khả dụng" thật qua
// `inventoryApiService` (bảng `inventory` đã có — xem docs/more-require.md mục (u)/(v), khác giả định
// "chưa có bảng inventory" của doc gốc). Nút "Xác nhận đã chuẩn bị xong" tạm khóa — endpoint
// `PUT /orders/:id/items/confirm-prepared` (mục 2b doc) test qua `curl` không hoạt động như mô tả
// (rơi vào validate của route khác), xem docs/more-require.md mục (w).

type DetailTab = 'overview' | 'lifecycle' | 'items' | 'plans' | 'quotation';

// Cho phép mở thẳng 1 tab qua URL (?tab=items...) — dùng bởi nút "Xuất thiết bị" ở trang chi tiết
// báo giá (docs/xuatthietbi_tubaogia_api.md mục 5: điều hướng sang tab "Thiết bị & Kho hàng").
function parseTabParam(value: string | null): DetailTab {
  const valid: DetailTab[] = ['overview', 'lifecycle', 'items', 'plans', 'quotation'];
  return valid.includes(value as DetailTab) ? (value as DetailTab) : 'overview';
}

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

// Đã cọc/đã thanh toán thì đơn coi như được xác nhận — cùng quy tắc hiển thị với bảng "Danh sách đơn
// đặt" (src/app/manager/orders/page.tsx) để 2 màn không lệch pha nhau khi dữ liệu cũ vẫn còn kẹt ở
// "Mới" (vd tạo trước khi handleConfirmDeposit tự đẩy orderStatus lên CONFIRMED). Chỉ ảnh hưởng phần
// hiển thị (badge/dropdown/mốc tiến trình) — không tự ghi ngược lên backend.
function getDisplayOrderStatus(order: { orderStatus: OrderStatus; paymentStatus: string }): OrderStatus {
  if (order.orderStatus === 'NEW' && (order.paymentStatus === 'DEPOSITED' || order.paymentStatus === 'PAID')) {
    return 'CONFIRMED';
  }
  return order.orderStatus;
}

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

// Enum thật (types/order.ts) — khác hẳn mock cũ ('internal'/'external' viết thường), xem
// docs/thietbikhohang_api.md mục 1.
const ORDER_ITEM_SOURCE_LABEL: Record<OrderItemSource, string> = {
  INTERNAL: 'Kho nhà',
  SUPPLIER: 'Thuê ngoài',
};

const ASSIGNEE_ROLE_LABEL: Record<string, string> = {
  LEAD: 'Trưởng nhóm kỹ thuật',
  TECHNICAL: 'Nhân viên kỹ thuật',
};

function ManagerOrderDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>(() => parseTabParam(searchParams.get('tab')));

  // Toast sau khi "Xuất thiết bị" từ trang chi tiết báo giá điều hướng sang đây
  // (docs/xuatthietbi_tubaogia_api.md mục 5.3/5.4 bản v2: 'unchanged' = đơn đã khớp báo giá, no-op)
  // — đọc từ ?exported= rồi xóa param khỏi URL ngay để không hiện lại khi refresh.
  const [exportToast, setExportToast] = useState<'success' | 'unchanged' | null>(() => {
    const value = searchParams.get('exported');
    return value === 'success' || value === 'unchanged' ? value : null;
  });

  useEffect(() => {
    if (!exportToast) return;
    router.replace(`/manager/orders/${id}`, { scroll: false });
    const timer = setTimeout(() => setExportToast(null), 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy 1 lần cho toast đọc từ URL lúc mở trang
  }, []);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [schedulePlans, setSchedulePlans] = useState<SchedulePlan[]>([]);
  const [surveyReport, setSurveyReport] = useState<SurveyReportListItem | null>(null);
  const [liveChecklist, setLiveChecklist] = useState<LiveShowChecklist>(EMPTY_CHECKLIST);
  const [isConfirmingDeposit, setIsConfirmingDeposit] = useState(false);
  const [isConfirmingSurvey, setIsConfirmingSurvey] = useState(false);
  const [isTogglingChecklist, setIsTogglingChecklist] = useState(false);
  const [isActivatingLiveShow, setIsActivatingLiveShow] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isCompletingSettlement, setIsCompletingSettlement] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);

  const [isPicklistOpen, setIsPicklistOpen] = useState(false);
  const [picklistInventory, setPicklistInventory] = useState<Record<string, InventoryRow>>({});
  const [itemSupplierMap, setItemSupplierMap] = useState<Record<string, { supplierName: string; quantity: number }>>({});

  const [viewingScheduleItem, setViewingScheduleItem] = useState<SchedulePlan | null>(null);
  const [cancelingPlanId, setCancelingPlanId] = useState<string | null>(null);
  const [isUpdatingPlanStatus, setIsUpdatingPlanStatus] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState<{ isLoading: boolean; evidence: Evidence | null } | null>(null);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [supplierRentalPrefill, setSupplierRentalPrefill] = useState<CreateFormPrefill | null>(null);
  const [supplierRentalToast, setSupplierRentalToast] = useState(false);
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);

  const [quotationDetail, setQuotationDetail] = useState<QuotationDetailApi | null>(null);
  const [linkableQuotations, setLinkableQuotations] = useState<QuotationListItem[]>([]);
  const [selectedLinkQuoteId, setSelectedLinkQuoteId] = useState('');
  const [isLinkingQuote, setIsLinkingQuote] = useState(false);
  const [linkQuoteError, setLinkQuoteError] = useState<string | null>(null);
  const [isCreateQuotationOpen, setIsCreateQuotationOpen] = useState(false);

  const load = () => {
    setIsLoading(true);
    setLoadError(null);
    let orderId = '';
    return orderApiService
      .getOrder(id)
      .then((res) => {
        const detail = res.data as OrderDetail;
        setOrder(detail);
        orderId = detail.orderId;
        return Promise.all([
          customerApiService.getCustomer(detail.customerId),
          paymentApiService.getOrderDeposits(detail.orderId).catch(() => ({ data: [] })),
          settlementApiService.getOrderSettlement(detail.orderId).catch(() => ({ data: null })),
          schedulePlanApiService.getSchedulePlans({ orderId: detail.orderId }).catch(() => ({ data: [] })),
          // GET /survey-reports không có param lọc orderId thật (test qua curl xác nhận bị bỏ qua) —
          // dùng search=orderCode rồi khớp chính xác orderId phía client (mục 6.1 comment đầu file).
          surveyApiService.getSurveyReports({ search: detail.orderCode }).catch(() => ({ data: [] })),
        ]);
      })
      .then(([customerRes, depositsRes, settlementRes, plansRes, surveyRes]) => {
        setCustomer(customerRes.data ?? null);
        setDeposits(depositsRes.data ?? []);
        setSettlement(settlementRes.data ?? null);
        setSchedulePlans(plansRes.data ?? []);
        const surveys: SurveyReportListItem[] = surveyRes.data ?? [];
        setSurveyReport(surveys.find((s) => s.orderId === orderId) ?? null);
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

  // Tab "Báo giá & Hợp đồng" — GET /customers/:id/quotations vẫn lỗi thật (docs/more-require.md mục
  // (p.1), chưa được Backend sửa), dùng workaround GET /quotations?customerId= (endpoint phẳng, xác
  // nhận hoạt động đúng qua curl) để liệt kê báo giá có thể liên kết.
  useEffect(() => {
    if (!order) return;
    if (order.quotationId) {
      setLinkableQuotations([]);
      quotationApiService
        .getQuotation(order.quotationId)
        .then((res) => setQuotationDetail(res.data ?? null))
        .catch(() => setQuotationDetail(null));
    } else {
      setQuotationDetail(null);
      quotationApiService
        // Không lọc theo status ở đây nữa — hiện tất cả báo giá của khách (kể cả nháp) chưa liên kết đơn
        // nào, để Manager tự chọn rồi mới quyết định duyệt trước khi liên kết nếu cần.
        .getQuotations({ customerId: order.customerId })
        .then((res) => {
          const candidates: QuotationListItem[] = res.data ?? [];
          return Promise.all(
            candidates.map((q) =>
              quotationApiService
                .getQuotation(q.quotationId)
                .then((r) => ({ item: q, linkedOrderId: (r.data?.linkedOrderId as string | null) ?? null }))
                .catch(() => ({ item: q, linkedOrderId: null as string | null })),
            ),
          );
        })
        // Loại báo giá đã "Từ chối" — không có lý do nghiệp vụ nào để liên kết báo giá bị từ chối vào đơn.
        .then((pairs) => setLinkableQuotations(pairs.filter((p) => !p.linkedOrderId && p.item.status !== 'rejected').map((p) => p.item)))
        .catch(() => setLinkableQuotations([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi order thay đổi thật sự
  }, [order?.orderId, order?.quotationId, order?.customerId]);

  // Tồn kho khả dụng theo từng hạng mục — tải ngay khi order sẵn sàng (không chỉ khi mở Picklist) để
  // tab "Thiết bị & Kho hàng" hiện được cảnh báo thiếu hàng ngay trên bảng chính.
  useEffect(() => {
    if (!order || order.items.length === 0) return;
    Promise.all(
      order.items.map((item) =>
        inventoryApiService
          .getInventory({ itemId: item.itemId, limit: 1 })
          .then((res) => [item.itemId, (res.data ?? [])[0]] as const)
          .catch(() => [item.itemId, undefined] as const),
      ),
    ).then((pairs) => {
      const next: Record<string, InventoryRow> = {};
      pairs.forEach(([itemId, row]) => {
        if (row) next[itemId] = row;
      });
      setPicklistInventory(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi danh sách hạng mục đổi
  }, [order?.orderId, order?.items]);

  // Tên NCC cho các hạng mục nguồn "Thuê ngoài" — tra theo giao dịch thuê (supplier-transactions) của
  // đơn này rồi khớp itemId trong từng giao dịch, vì OrderItem không có sẵn field supplierId/supplierName.
  useEffect(() => {
    if (!order || order.items.length === 0) {
      setItemSupplierMap({});
      return;
    }
    // Không lọc theo item.source ở đây — hạng mục "Kho nhà" cũng có thể có phần thiếu đã được thuê bù
    // từ NCC (giao dịch supplier-transaction riêng, không đổi source gốc của order item), nên luôn thử
    // tra giao dịch thuê của đơn rồi khớp itemId, bất kể source hiện tại là gì.
    supplierApiService
      .getSupplierTransactions({ orderId: order.orderId })
      .then((res) =>
        Promise.all(
          (res.data ?? []).map((t) =>
            supplierApiService
              .getTransactionById(t.transactionId)
              .then((res) => {
                const detail = (res as unknown as { data?: { items?: { itemId?: string; quantity?: number }[] } })?.data || res;
                return { supplierName: t.supplierName, items: (detail as { items?: { itemId?: string; quantity?: number }[] })?.items ?? [] };
              })
              .catch(() => ({ supplierName: t.supplierName, items: [] as { itemId?: string; quantity?: number }[] })),
          ),
        ),
      )
      .then((transactions) => {
        // Cộng dồn quantity nếu 1 itemId xuất hiện ở nhiều giao dịch (thuê bổ sung nhiều lần), không
        // ghi đè theo giao dịch cuối cùng.
        const next: Record<string, { supplierName: string; quantity: number }> = {};
        transactions.forEach(({ supplierName, items }) => {
          items.forEach((it) => {
            if (!it.itemId) return;
            const prev = next[it.itemId];
            next[it.itemId] = { supplierName, quantity: (prev?.quantity ?? 0) + (it.quantity ?? 0) };
          });
        });
        setItemSupplierMap(next);
      })
      .catch(() => setItemSupplierMap({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi danh sách hạng mục đổi
  }, [order?.orderId, order?.items]);

  if (isLoading && !order) {
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
        <Link href="/manager/orders" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
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

  const displayStatus = getDisplayOrderStatus(order);
  const latestDeposit = deposits[0];
  const isDeposited = order.paymentStatus === 'DEPOSITED' || order.paymentStatus === 'PAID';
  const isSurveyDone = surveyReport?.status === 'CONFIRMED';
  const isMilestone2Complete = isDeposited && isSurveyDone;
  const isMilestone3Complete = order.orderStatus === 'IN_PROGRESS' || order.orderStatus === 'COMPLETED';
  const isMilestone4Complete = order.orderStatus === 'COMPLETED';
  const isReadyToClose = order.orderStatus === 'COMPLETED' && order.paymentStatus === 'PAID' && !order.closedAt;
  const depositCollected = deposits.filter((d) => d.status === 'PAID').reduce((sum, d) => sum + d.amount, 0);

  const handleConfirmDeposit = async () => {
    if (!latestDeposit) return;
    setIsConfirmingDeposit(true);
    try {
      await paymentApiService.updateDepositStatus(latestDeposit.depositId, { status: 'PAID' });
      // Yêu cầu người dùng (2026-07-22): xác nhận cọc thành công tự chuyển mốc tiến trình sang
      // "2. Đã xác nhận" — chỉ chuyển tiếp (không lùi lại) nên chỉ áp dụng khi đơn còn ở "1. Mới".
      if (order.orderStatus === 'NEW') {
        await orderApiService.updateOrderStatus(order.orderId, { orderStatus: 'CONFIRMED' });
      }
      load();
    } finally {
      setIsConfirmingDeposit(false);
    }
  };

  const handleConfirmSurvey = async () => {
    if (!surveyReport) return;
    setIsConfirmingSurvey(true);
    try {
      await surveyApiService.confirmSurveyReport(surveyReport.surveyId, { status: 'CONFIRMED' });
      load();
    } finally {
      setIsConfirmingSurvey(false);
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

  const handleOpenPicklist = () => {
    setIsPicklistOpen(true);
  };

  const handleCancelPlan = async (planId: string) => {
    setIsUpdatingPlanStatus(true);
    try {
      await schedulePlanApiService.updateSchedulePlanStatus(planId, { status: 'CANCELLED' });
      setCancelingPlanId(null);
      load();
    } finally {
      setIsUpdatingPlanStatus(false);
    }
  };

  const handleViewEvidence = (evidenceId: string) => {
    setEvidenceModal({ isLoading: true, evidence: null });
    evidenceApiService
      .getEvidenceById(evidenceId)
      .then((res) => setEvidenceModal({ isLoading: false, evidence: res.data ?? null }))
      .catch(() => setEvidenceModal({ isLoading: false, evidence: null }));
  };

  const handleLinkQuotation = async (quotationIdOverride?: string) => {
    const targetQuotationId = quotationIdOverride ?? selectedLinkQuoteId;
    if (!targetQuotationId) return;
    setIsLinkingQuote(true);
    setLinkQuoteError(null);
    try {
      // Cho phép liên kết báo giá ở bất kỳ trạng thái nào (kể cả nháp) miễn chưa gắn đơn khác — Manager
      // chủ động chọn, không giới hạn chỉ báo giá đã duyệt.
      const quoRes = await quotationApiService.getQuotation(targetQuotationId);
      await orderApiService.updateOrderQuotation(order.orderId, { quotationId: targetQuotationId });

      // Cộng dồn số lượng từ báo giá vừa liên kết vào danh sách hạng mục hiện có của đơn — tab "Thiết
      // bị & Kho hàng" phải phản ánh đúng số lượng đã báo giá ngay khi đơn được liên kết báo giá, thay
      // vì giữ nguyên order.items cũ (độc lập hoàn toàn với báo giá) như trước. Hạng mục đã có sẵn trên
      // đơn: giữ nguyên đơn giá đã chốt, chỉ cộng thêm số lượng. Hạng mục mới từ báo giá: thêm dòng mới,
      // đơn giá = lineTotal/quantity (giá thực tế sau chiết khấu đã chốt ở báo giá).
      const mergedByItemId = new Map<string, CreateOrderItemPayload>();
      order.items.forEach((it) => {
        mergedByItemId.set(it.itemId, { itemId: it.itemId, quantity: it.quantity, unitPrice: it.unitPrice, source: it.source, notes: it.notes });
      });
      (quoRes.data?.items as QuotationDetailItem[] | undefined ?? []).forEach((qi) => {
        const existing = mergedByItemId.get(qi.itemId);
        if (existing) {
          existing.quantity += qi.quantity;
        } else {
          mergedByItemId.set(qi.itemId, {
            itemId: qi.itemId,
            quantity: qi.quantity,
            unitPrice: qi.quantity > 0 ? Math.round(qi.lineTotal / qi.quantity) : qi.price,
            source: 'INTERNAL',
          });
        }
      });
      await orderApiService.updateOrderItems(order.orderId, { items: Array.from(mergedByItemId.values()) });

      // Cập nhật state cục bộ ngay để hiện báo giá liên kết tức thì trên tab, không chờ load() lại toàn
      // bộ dữ liệu đơn (customer/deposits/settlement/schedule/survey — mất vài giây) mới thấy kết quả.
      // load() ở finally bên dưới vẫn chạy để đồng bộ đầy đủ (số lượng hạng mục, ...) nhưng không còn
      // chặn việc hiển thị báo giá vừa liên kết.
      if (quoRes.data) setQuotationDetail(quoRes.data);
      setOrder((prev) => (prev ? { ...prev, quotationId: targetQuotationId } : prev));
      setSelectedLinkQuoteId('');
    } catch {
      setLinkQuoteError('Liên kết báo giá thất bại. Vui lòng thử lại.');
    } finally {
      // Luôn load() lại dù thành công hay lỗi nửa chừng — nếu updateOrderQuotation đã ghi thành công
      // nhưng updateOrderItems lỗi sau đó, backend đã lưu liên kết rồi nhưng UI vẫn hiện "chưa liên kết"
      // nếu không load() lại, khiến Manager tưởng phải bấm lại (thật ra chỉ cần F5 là thấy đã liên kết).
      // Chờ load() xong (cập nhật order.quotationId) trước khi mở khóa nút — tránh cửa sổ đua (race) để
      // Manager bấm "Liên kết ngay" lần 2 với báo giá khác trước khi UI kịp chuyển sang trạng thái "đã
      // liên kết", vốn khiến backend chấp nhận đổi liên kết hàng loạt lần mà không cảnh báo gì (xem
      // gating theo order.quotationId thay vì quotationDetail bên dưới — đây là lớp phòng thủ thứ 2).
      await load();
      setIsLinkingQuote(false);
    }
  };

  // Yêu cầu người dùng (2026-07-22): chỉ tạo lịch trình loại việc "Lắp đặt thiết bị" (tab "Lịch trình
  // & Kỹ thuật") mới tự chuyển mốc tiến trình đơn sang "3. Đang thực hiện" — các loại việc khác (khảo
  // sát, vận chuyển, thu hồi...) không kích hoạt transition này. Chỉ chuyển tiếp (không lùi lại), nên
  // bỏ qua nếu đơn đã ở IN_PROGRESS/COMPLETED/CANCELLED.
  const handleSchedulePlanCreated = async (taskName: string) => {
    const shouldActivate =
      taskName === 'Lắp đặt thiết bị' &&
      order.orderStatus !== 'IN_PROGRESS' &&
      order.orderStatus !== 'COMPLETED' &&
      order.orderStatus !== 'CANCELLED';
    if (shouldActivate) {
      await orderApiService.updateOrderStatus(order.orderId, { orderStatus: 'IN_PROGRESS' });
    }
    await load();
  };

  const daysLeft = Math.round((new Date(order.eventDate).getTime() - Date.now()) / 86_400_000);
  const urgencyVariant = daysLeft >= 0 ? getUrgencyBadgeVariant(daysLeft) : null;

  return (
    <div className="p-6">
      {exportToast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed right-6 top-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
            exportToast === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {exportToast === 'success' ? 'Xuất thiết bị thành công.' : 'Đơn đã khớp báo giá, không có gì cần xuất thêm.'}
        </motion.div>
      )}
      {supplierRentalToast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed right-6 top-6 z-50 flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Đã tạo yêu cầu thuê từ nhà cung cấp.
        </motion.div>
      )}
      <Breadcrumb
        items={[
          { label: 'Đơn đặt' },
          { label: 'Danh sách đơn đặt', href: '/manager/orders' },
          { label: order.orderCode },
        ]}
        className="mb-3"
      />
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/manager/orders')}
            title="Quay lại"
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{order.orderCode}</h1>
              <Badge variant={getStatusBadgeVariant(displayStatus)}>{ORDER_STATUS_LABEL[displayStatus]}</Badge>
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
                  value={displayStatus}
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
            const currentActiveIdx = displayStatus === 'CANCELLED' ? -1 : LIFECYCLE_ORDER.indexOf(displayStatus);
            const stepIdx = LIFECYCLE_ORDER.indexOf(step.id);
            const isPast = stepIdx < currentActiveIdx;
            const isCurrent = step.id === displayStatus;

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
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div>
                      <p className="font-semibold text-slate-700">Khảo sát hiện trường</p>
                      {surveyReport ? (
                        <p className="mt-0.5 text-slate-500">
                          {surveyReport.reportCode} · {formatDate(surveyReport.surveyDate)} · {surveyReport.location} ·{' '}
                          {surveyReport.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                          {surveyReport.reportedByName && <> · Khảo sát bởi {surveyReport.reportedByName}</>}
                        </p>
                      ) : (
                        <p className="mt-0.5 italic text-slate-400">Chưa có báo cáo khảo sát nào cho đơn này.</p>
                      )}
                    </div>
                    {surveyReport && surveyReport.status !== 'CONFIRMED' && (
                      <Button size="sm" onClick={handleConfirmSurvey} isLoading={isConfirmingSurvey}>
                        Xác nhận khảo sát
                      </Button>
                    )}
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
                          Dự kiến: {formatDate(plan.startTime)} · {formatTime(plan.startTime)}
                          {plan.endTime ? ` - ${formatTime(plan.endTime)}` : ''} · {plan.location ?? order.location}
                        </p>
                        {plan.assignees && plan.assignees.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-slate-500">
                            {plan.assignees.map((a) => (
                              <span key={a.userId} className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 ring-1 ring-inset ring-slate-200">
                                {a.fullName} ({a.role === 'LEAD' ? 'Trưởng nhóm' : 'Kỹ thuật viên'})
                                {/* Chỉ giờ check-in/out của LEAD ảnh hưởng status của plan (docs/more-require.md mục (ah)) — TECHNICAL không hiện giờ để tránh gây hiểu nhầm là có tác dụng tương tự. */}
                                {a.role === 'LEAD' &&
                                  (a.checkInAt ? (
                                    <span className="text-emerald-600">· Bắt đầu làm {formatTime(a.checkInAt)}</span>
                                  ) : (
                                    <span className="italic text-slate-400">· Chưa check-in</span>
                                  ))}
                                {a.role === 'LEAD' && a.checkOutAt && <span className="text-emerald-600">· Hoàn thành {formatTime(a.checkOutAt)}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <p className="italic text-slate-400">Xem/xác nhận/hủy kế hoạch chi tiết ở tab &quot;Lịch trình & Kỹ thuật&quot;.</p>
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
                <p className="mt-2 text-xs text-slate-500">Ngày tổ chức chính thức: <strong className="text-slate-800">{formatDate(order.eventDate)}</strong></p>
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
                {displayStatus === 'CONFIRMED' && (
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

          {activeTab === 'items' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-950">Quản lý phân bổ thiết bị & chuẩn bị kho</h4>
                </div>
                <Button size="sm" variant="secondary" onClick={handleOpenPicklist}>
                  <Package className="h-4 w-4" />
                  Xem phiếu chuẩn bị
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5">Hạng mục thiết bị/Dịch vụ</th>
                      <th className="px-3 py-2.5">Nguồn</th>
                      <th className="px-3 py-2.5 text-center">SL đặt</th>
                      <th className="px-3 py-2.5 text-center">Tồn kho khả dụng</th>
                      <th className="px-3 py-2.5 text-right">Giá tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item) => {
                      const inv = picklistInventory[item.itemId];
                      // Khi tồn kho khả dụng đã bị trừ âm (bug Backend "Vẫn xuất" trừ thẳng toàn bộ SL
                      // đặt khỏi quantity_total thay vì chỉ trừ theo delta còn thiếu — xem
                      // docs/more-require.md mục (ar)), phần âm CHÍNH LÀ số thiếu thật: nếu
                      // postAvailable = preAvailable - SL đặt thì SL đặt - preAvailable = -postAvailable.
                      // Công thức "SL đặt - tồn kho hiện tại" sẽ tính gấp đôi số thiếu trong trường hợp này.
                      const shortfall = !inv
                        ? 0
                        : inv.quantityAvailable < 0
                          ? Math.abs(inv.quantityAvailable)
                          : Math.max(item.quantity - inv.quantityAvailable, 0);
                      const isShort = item.source === 'INTERNAL' && shortfall > 0;
                      return (
                        <tr key={item.orderItemId}>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-900">{item.itemName}</p>
                            <p className="text-xs text-slate-400">{item.unit}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1.5">
                              <div>
                                <Badge variant={item.source === 'INTERNAL' ? 'neutral' : 'info'}>{ORDER_ITEM_SOURCE_LABEL[item.source]}</Badge>
                                {item.source === 'SUPPLIER' && (
                                  <p className="mt-1 text-xs text-slate-500">{itemSupplierMap[item.itemId]?.supplierName ?? 'Đang xác định NCC'}</p>
                                )}
                              </div>
                              {isShort &&
                                (itemSupplierMap[item.itemId] ? (
                                  <span
                                    className="flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-inset ring-emerald-200"
                                    title={`Đã có đơn thuê từ NCC "${itemSupplierMap[item.itemId].supplierName}" cho phần thiếu`}
                                  >
                                    Thuê {itemSupplierMap[item.itemId].quantity} · từ {itemSupplierMap[item.itemId].supplierName}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSupplierRentalPrefill({
                                        orderId: order.orderId,
                                        itemId: item.itemId,
                                        itemName: item.itemName ?? '',
                                        qty: shortfall,
                                      })
                                    }
                                    className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-100"
                                    title="Số lượng đặt vượt tồn kho khả dụng — tạo giao dịch thuê từ Nhà cung cấp cho phần thiếu"
                                  >
                                    Thiếu {shortfall} · Thuê từ NCC
                                  </button>
                                ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-slate-900">{item.quantity}</td>
                          <td className="px-3 py-3 text-center">
                            {inv ? (
                              <span className={`font-bold ${inv.quantityAvailable < item.quantity ? 'text-red-600' : 'text-emerald-600'}`}>
                                {inv.quantityAvailable}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-slate-900">{formatCurrency(item.subtotal ?? item.unitPrice * item.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-sm font-bold text-slate-900">
                      <td colSpan={4} className="px-3 py-3 text-right uppercase tracking-wide text-slate-500">
                        Tổng cộng tài chính đơn hàng
                      </td>
                      <td className="px-3 py-3 text-right text-blue-600">{formatCurrency(order.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-[10px] italic text-slate-400">
                Cột "Tồn kho khả dụng" là số hiện tại tại thời điểm xem — hệ thống chưa hỗ trợ khóa tồn kho theo ngày lắp đặt (Date-based Inventory Lock).
              </p>

              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  disabled
                  title="Endpoint PUT /orders/:id/items/confirm-prepared chưa hoạt động đúng như tài liệu — xem docs/more-require.md mục (w)"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Xác nhận đã chuẩn bị xong
                </Button>
              </div>
            </motion.div>
          )}

          {activeTab === 'plans' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-950">Lịch thi công & đơn vị phụ trách kỹ thuật</h4>
                  <p className="text-xs text-slate-400">
                    Trạng thái thi công/ảnh minh chứng do Leader Staff cập nhật qua mobile — web chỉ xác nhận kế hoạch trước khi thi công.
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsCreatePlanOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Tạo lịch trình
                </Button>
              </div>

              {schedulePlans.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                  Chưa có kế hoạch điều phối nào được lập cho đơn hàng này.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {schedulePlans.map((plan, idx) => {
                    const canEdit = plan.status !== 'IN_PROGRESS' && plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED';
                    const canCancel = canEdit;
                    return (
                      <div key={plan.planId} className="rounded-xl border border-slate-150 bg-white p-4 shadow-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              LICH-{String(idx + 1).padStart(3, '0')}
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-slate-900">{plan.taskName ?? plan.planCode}</p>
                          </div>
                          <Badge variant={SCHEDULE_STATUS_META[plan.status]?.variant ?? 'neutral'}>
                            {SCHEDULE_STATUS_META[plan.status]?.label ?? plan.status}
                          </Badge>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                          <p className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(plan.startTime)} · {formatTime(plan.startTime)}
                            {plan.endTime ? ` - ${formatTime(plan.endTime)}` : ''}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {plan.location ?? order.location}
                          </p>
                        </div>

                        {plan.assignees && plan.assignees.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {plan.assignees.map((a) => (
                              <span key={a.userId} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-slate-150">
                                <Users className="h-3 w-3 text-slate-400" />
                                {a.fullName} · {ASSIGNEE_ROLE_LABEL[a.role] ?? a.role}
                                {a.phone && (
                                  <span className="flex items-center gap-0.5 text-slate-400">
                                    <Phone className="h-3 w-3" />
                                    {a.phone}
                                  </span>
                                )}
                                {/* Chỉ giờ check-in/out của LEAD ảnh hưởng status của plan (docs/more-require.md mục (ah)) — TECHNICAL không hiện giờ để tránh gây hiểu nhầm là có tác dụng tương tự. */}
                                {a.role === 'LEAD' && a.checkInAt && <span className="text-emerald-600">· Check-in {formatTime(a.checkInAt)}</span>}
                                {a.role === 'LEAD' && a.checkOutAt && <span className="text-emerald-600">· Check-out {formatTime(a.checkOutAt)}</span>}
                              </span>
                            ))}
                          </div>
                        )}

                        {plan.notes && <p className="mt-2 text-xs italic text-slate-500">{plan.notes}</p>}

                        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => setViewingScheduleItem(plan)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem chi tiết
                          </button>
                          {plan.status === 'COMPLETED' && plan.evidenceId && (
                            <button
                              type="button"
                              onClick={() => handleViewEvidence(plan.evidenceId as string)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-slate-50"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Xem ảnh minh chứng
                            </button>
                          )}
                          {plan.status === 'COMPLETED' && !plan.evidenceId && (
                            <span className="text-xs italic text-slate-400">Chưa có ảnh minh chứng</span>
                          )}
                          <button
                            type="button"
                            disabled={!canEdit}
                            title={canEdit ? undefined : 'Chỉ sửa được khi kế hoạch chưa thi công/hoàn thành'}
                            onClick={() => {
                              setIsEditPlanOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Sửa
                          </button>
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => setCancelingPlanId(plan.planId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Hủy
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[10px] italic text-slate-400">
                Danh mục loại việc hiện chỉ có "Lắp đặt thiết bị"/"Tháo dỡ thiết bị" — chưa có "Khảo sát hiện trường"/"Vận chuyển thiết bị" (xem docs/more-require.md mục (f)).
              </p>
            </motion.div>
          )}

          {activeTab === 'quotation' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs">
                <h4 className="text-sm font-bold text-slate-950">Hồ sơ báo giá liên kết</h4>
                <p className="mt-1 text-xs text-slate-400">
                  Không còn khái niệm "Hợp đồng" riêng — đơn đặt đã liên kết báo giá chính là hồ sơ vận hành chính thức (xem docs/danhsachhopdong_api.md).
                </p>

                {/*
                  Cố ý gate theo `order.quotationId` (cập nhật đồng bộ ngay khi `load()` xong) thay vì
                  `quotationDetail` (fetch phụ, tới sau) — trước đây gate theo `quotationDetail` để hở 1
                  cửa sổ đua: sau khi liên kết thành công, `order.quotationId` đã đổi nhưng
                  `quotationDetail` chưa kịp fetch xong nên UI vẫn hiện lại y hệt màn "chưa liên kết",
                  cho phép bấm "Liên kết ngay" tiếp với báo giá KHÁC — backend chấp nhận đổi liên kết
                  ngay lập tức không cảnh báo (đã xác nhận qua curl), khiến Manager tưởng đã "liên kết
                  được nhiều báo giá" dù thật ra mỗi lần chỉ ghi đè lại đúng 1 liên kết cuối cùng.
                */}
                {order.quotationId ? (
                  <div className="mt-4 space-y-3">
                    {quotationDetail ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{quotationDetail.quotationCode}</p>
                            <p className="text-xs text-slate-400">Phiên bản {quotationDetail.version}</p>
                          </div>
                          <Badge variant={QUOTATION_STATUS_META[quotationDetail.status]?.variant ?? 'neutral'}>
                            {QUOTATION_STATUS_META[quotationDetail.status]?.label ?? quotationDetail.status}
                          </Badge>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 text-xs">
                          <p className="text-slate-400">Giá trị giao kèo (chốt lúc duyệt báo giá)</p>
                          <p className="mt-0.5 text-lg font-extrabold text-blue-600">{formatCurrency(quotationDetail.totalAmount)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/manager/quotations/${quotationDetail.quotationId}`}>
                            <Button size="sm" variant="secondary">
                              <Eye className="h-4 w-4" />
                              Xem báo giá
                            </Button>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">Đang tải báo giá liên kết...</p>
                    )}
                  </div>
                ) : isLinkingQuote ? (
                  <div className="mt-4 space-y-3">
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">Đang liên kết báo giá vừa tạo...</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">Đơn này chưa liên kết báo giá nào.</p>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">Liên kết báo giá có sẵn</p>
                        <Button size="sm" variant="secondary" onClick={() => setIsCreateQuotationOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Tạo báo giá liên kết
                        </Button>
                      </div>
                      {linkableQuotations.length === 0 ? (
                        <p className="mt-2 text-xs italic text-slate-400">Khách hàng chưa có báo giá nào có thể liên kết.</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <div className="min-w-[220px] flex-1">
                            <Select
                              value={selectedLinkQuoteId}
                              onChange={(e) => setSelectedLinkQuoteId(e.target.value)}
                              options={[
                                { value: '', label: '-- Chọn báo giá --' },
                                ...linkableQuotations.map((q) => ({
                                  value: q.quotationId,
                                  label: `${q.code} · ${formatCurrency(q.totalAmount)} · ${QUOTATION_STATUS_META[q.status]?.label ?? q.status}`,
                                })),
                              ]}
                            />
                          </div>
                          <Button size="sm" onClick={() => handleLinkQuotation()} disabled={!selectedLinkQuoteId} isLoading={isLinkingQuote}>
                            <Link2 className="h-4 w-4" />
                            Liên kết ngay
                          </Button>
                        </div>
                      )}
                      {linkQuoteError && <p className="mt-2 text-xs font-medium text-red-600">{linkQuoteError}</p>}
                    </div>
                  </div>
                )}

                <CreateQuotationWizardModal
                  isOpen={isCreateQuotationOpen}
                  presetCustomer={{
                    customerId: order.customerId,
                    customerName: order.customerName,
                    phone: order.customerPhone,
                    email: '',
                    address: null,
                    notes: null,
                    status: 'active',
                    totalBookings: 0,
                    totalSpent: 0,
                  }}
                  autoApprove
                  onClose={() => setIsCreateQuotationOpen(false)}
                  onSaved={(createdQuotationId) => {
                    setIsCreateQuotationOpen(false);
                    if (createdQuotationId) handleLinkQuotation(createdQuotationId);
                  }}
                />
              </div>
            </motion.div>
          )}

          {activeTab !== 'overview' && activeTab !== 'lifecycle' && activeTab !== 'items' && activeTab !== 'plans' && activeTab !== 'quotation' && (
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

      <Modal
        isOpen={isPicklistOpen}
        onClose={() => setIsPicklistOpen(false)}
        title="Phiếu chuẩn bị (Picklist)"
        subtitle={`PKL-${order.orderCode}-01 · Đơn hàng ${order.orderCode}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPicklistOpen(false)}>
              Đóng
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              In phiếu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 p-4 text-xs">
            <div>
              <p className="font-bold uppercase tracking-wide text-slate-400">Khách hàng thụ hưởng</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{customer?.customerName ?? order.customerName}</p>
            </div>
            <div className="text-right">
              <p className="font-bold uppercase tracking-wide text-slate-400">Tổng số hạng mục</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{order.items.length} hạng mục</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-white font-semibold text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Hạng mục</th>
                  <th className="px-3 py-2.5 text-center">SL cần</th>
                  <th className="px-3 py-2.5 text-center">Nguồn</th>
                  <th className="px-3 py-2.5 text-center">Tồn kho khả dụng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => {
                  const inv = picklistInventory[item.itemId];
                  return (
                    <tr key={item.orderItemId}>
                      <td className="px-3 py-3 font-semibold text-slate-800">{item.itemName}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-900">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ORDER_ITEM_SOURCE_LABEL[item.source]}
                        {item.source === 'SUPPLIER' && (
                          <p className="mt-0.5 text-[11px] font-normal text-slate-400">{itemSupplierMap[item.itemId]?.supplierName ?? 'Đang xác định NCC'}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {inv ? (
                          <span className={`font-bold ${inv.quantityAvailable < item.quantity ? 'text-red-600' : 'text-emerald-600'}`}>
                            {inv.quantityAvailable}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] italic text-slate-400">
            Đã bỏ phần "vật tư cấu thành" (BOM) dựng sẵn — DB thật không có bảng lưu quan hệ này, xem docs/thietbikhohang_api.md mục 5.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(viewingScheduleItem)}
        onClose={() => setViewingScheduleItem(null)}
        title={viewingScheduleItem?.taskName ?? viewingScheduleItem?.planCode}
        subtitle={viewingScheduleItem?.planCode}
        footer={
          <Button variant="secondary" onClick={() => setViewingScheduleItem(null)}>
            Đóng
          </Button>
        }
      >
        {viewingScheduleItem && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-500">Người/đội phụ trách</p>
              {viewingScheduleItem.assignees && viewingScheduleItem.assignees.length > 0 ? (
                <div className="mt-1 space-y-1.5">
                  {viewingScheduleItem.assignees.map((a) => (
                    <p key={a.userId} className="flex items-center gap-3 text-xs text-slate-700">
                      <span className="font-medium text-slate-900">{a.fullName}</span>
                      <span>{ASSIGNEE_ROLE_LABEL[a.role] ?? a.role}</span>
                      {a.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {a.phone}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">Chưa phân công.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Ngày/giờ kế hoạch</p>
                <p className="text-slate-900">
                  {formatDate(viewingScheduleItem.startTime)} · {formatTime(viewingScheduleItem.startTime)}
                  {viewingScheduleItem.endTime ? ` - ${formatTime(viewingScheduleItem.endTime)}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Địa điểm</p>
                <p className="text-slate-900">{viewingScheduleItem.location ?? order.location}</p>
              </div>
            </div>
            {viewingScheduleItem.notes && (
              <div>
                <p className="text-xs font-semibold text-slate-500">Ghi chú</p>
                <p className="italic text-slate-600">{viewingScheduleItem.notes}</p>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
              <Badge variant={SCHEDULE_STATUS_META[viewingScheduleItem.status]?.variant ?? 'neutral'}>
                {SCHEDULE_STATUS_META[viewingScheduleItem.status]?.label ?? viewingScheduleItem.status}
              </Badge>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(cancelingPlanId)}
        onClose={() => setCancelingPlanId(null)}
        title="Hủy kế hoạch thi công?"
        subtitle="Kế hoạch chuyển sang trạng thái Đã hủy, vẫn giữ lại lịch sử để đối chiếu."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelingPlanId(null)} disabled={isUpdatingPlanStatus}>
              Đóng
            </Button>
            <Button variant="danger" onClick={() => cancelingPlanId && handleCancelPlan(cancelingPlanId)} isLoading={isUpdatingPlanStatus}>
              Hủy kế hoạch
            </Button>
          </>
        }
      >
        <div />
      </Modal>

      <Modal
        isOpen={Boolean(evidenceModal)}
        onClose={() => setEvidenceModal(null)}
        title="Ảnh minh chứng thi công"
        footer={
          <Button variant="secondary" onClick={() => setEvidenceModal(null)}>
            Đóng
          </Button>
        }
      >
        {evidenceModal?.isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Đang tải ảnh minh chứng...</p>
        ) : evidenceModal?.evidence?.fileUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ Firebase Storage */}
            <img src={evidenceModal.evidence.fileUrl} alt="Ảnh minh chứng thi công" className="max-h-96 w-full rounded-lg border border-slate-200 object-contain" />
            {evidenceModal.evidence.description && <p className="text-xs text-slate-500">{evidenceModal.evidence.description}</p>}
          </div>
        ) : (
          <p className="py-6 text-center text-sm italic text-slate-400">Chưa có ảnh minh chứng.</p>
        )}
      </Modal>

      <CreateSchedulePlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        orderId={order.orderId}
        defaultLocation={order.location}
        eventDate={order.eventDate}
        onCreated={handleSchedulePlanCreated}
      />

      <PurchaseOrderFormModal
        isOpen={!!supplierRentalPrefill}
        mode="create"
        transaction={null}
        prefill={supplierRentalPrefill}
        onClose={() => setSupplierRentalPrefill(null)}
        onSuccess={() => {
          setSupplierRentalToast(true);
          setTimeout(() => setSupplierRentalToast(false), 4000);
          load();
        }}
      />

      {isEditPlanOpen && (
        <PlanFormDrawer
          isOpen={isEditPlanOpen}
          editingGroup={schedulePlans.length > 0 ? groupPlansByOrder(schedulePlans)[0] : null}
          selectableOrders={[]} // Không cần chọn đơn ở đây vì đã ở trong trang đơn hàng
          onClose={() => {
            setIsEditPlanOpen(false);
          }}
          onSaved={load}
        />
      )}
    </div>
  );
}

// useSearchParams bắt buộc bọc Suspense (node_modules/next/dist/docs/01-app/03-api-reference/
// 04-functions/use-search-params.md) — cùng pattern với manager/field-ops/change-requests.
export default function ManagerOrderDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Đang tải thông tin đơn đặt...</div>}>
      <ManagerOrderDetailContent />
    </Suspense>
  );
}
