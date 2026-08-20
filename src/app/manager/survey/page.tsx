'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Compass, Eye, FileText, MapPin, Plus, Search, User } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationState } from '@/hooks/usePagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatDate';
import SurveyDetailDrawer from '@/components/survey-reports/SurveyDetailDrawer';
import SurveyReportCreateDrawer from '@/components/survey-reports/SurveyReportCreateDrawer';
import { surveyApiService } from '@/services/survey.service';
import type { SurveyReport, SurveyReportListItem, SurveyReportListMeta, SurveyStatus } from '@/types/survey';

// Nối API thật theo docs/khaosathientruong_api.md (2026-07-20, mọi quyết định đã chốt — mục 8).
// GET /api/v1/survey-reports (danh sách toàn cục, MỚI — trước đây chỉ có bản theo 1 đơn) đã join sẵn
// orderCode/customerName/eventName/reportedByName + meta.counts đúng 4 giá trị enum thật, dùng thẳng
// cho 4 thẻ KPI + tab lọc. `PENDING_CONFIRM` (mock) = `NEEDS_REVIEW` (thật, theo mục 2) —
// `SUBMITTED` tạm gộp hiển thị cùng nhóm "Chờ xác nhận" tới khi Backend làm rõ thêm sự khác biệt.
// 2026-07-21 (theo yêu cầu người dùng): đã thêm lại nút "+ Tạo báo cáo khảo sát" (đã bỏ trước đó vì
// mặc định coi là hành động Leader Staff/mobile) — chỉ gắn ở trang Manager này, KHÔNG gắn ở
// src/app/admin/reports/survey/page.tsx vì Admin không xử lý vận hành hằng ngày (mục 1). Form tạo
// mới nằm ở SurveyReportCreateDrawer.tsx (bám shape thật, không tái dùng SurveyCreateDrawer cũ/mock).
// 2026-07-22: Backend xác nhận `POST /api/v1/survey-reports` hiện CHỈ cho role LEADER gọi — nút này
// sẽ nhận 403 khi Manager bấm cho tới khi Backend nới lỏng thêm role MANAGER. Người dùng chọn giữ
// nguyên nút (chờ Backend), không revert — chi tiết + yêu cầu Backend xem docs/more-require.md mục (ai).

const STATUS_TABS: { value: SurveyStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NEEDS_REVIEW', label: 'Chờ xác nhận' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'DRAFT', label: 'Bản nháp' },
];

const SURVEY_STATUS_META: Record<SurveyStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Bản nháp', variant: 'neutral' },
  NEEDS_REVIEW: { label: 'Chờ xác nhận', variant: 'warning' },
  SUBMITTED: { label: 'Chờ xác nhận', variant: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', variant: 'success' },
};

const emptyMeta: SurveyReportListMeta = {
  page: 1,
  limit: 10,
  totalItems: 0,
  totalPages: 1,
  counts: { all: 0, draft: 0, needsReview: 0, submitted: 0, confirmed: 0 },
};

export default function ManagerSurveyReportsPage() {
  const [reports, setReports] = useState<SurveyReportListItem[]>([]);
  const [meta, setMeta] = useState<SurveyReportListMeta>(emptyMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<SurveyStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [selectedReport, setSelectedReport] = useState<SurveyReport | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    surveyApiService
      .getSurveyReports({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setReports(res.data ?? []);
        setMeta(res.meta ?? emptyMeta);
      })
      .catch(() => {
        if (cancelled) return;
        setReports([]);
        setLoadError('Không tải được danh sách báo cáo khảo sát. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter, refreshToken]);

  const handleCreated = () => {
    setIsCreateOpen(false);
    setPage(1);
    setRefreshToken((t) => t + 1);
  };

  const paginationState: PaginationState = {
    currentPage: meta.page,
    totalPages: Math.max(1, meta.totalPages),
    totalItems: meta.totalItems,
    limit: meta.limit,
  };

  const handleOpenDetail = (surveyId: string) => {
    setIsDetailLoading(true);
    surveyApiService
      .getSurveyReportById(surveyId)
      .then((res) => setSelectedReport(res.data ?? null))
      .catch(() => setSelectedReport(null))
      .finally(() => setIsDetailLoading(false));
  };

  const handleConfirm = (id: string) => {
    setConfirmingId(id);
  };

  const handleConfirmAction = async () => {
    if (!confirmingId) return;
    setIsConfirming(true);
    try {
      await surveyApiService.confirmSurveyReport(confirmingId, { status: 'CONFIRMED' });
      setSelectedReport((prev) => (prev && prev.surveyId === confirmingId ? { ...prev, status: 'CONFIRMED' } : prev));
      setConfirmingId(null);
      setPage(1);
      const res = await surveyApiService.getSurveyReports({
        page: 1,
        limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setReports(res.data ?? []);
      setMeta(res.meta ?? emptyMeta);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Khảo sát hiện trường</h1>
          {/* <p className="mt-1 text-sm text-slate-500">Xem lại báo cáo khảo sát hiện trường do Leader Staff ghi nhận, hoặc tự tạo báo cáo, và xác nhận trước khi lập kế hoạch & báo giá.</p> */}
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo báo cáo khảo sát
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25 }}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng số báo cáo</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{meta.counts.all}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            <Compass className="h-5 w-5" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Chờ xác nhận</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{meta.counts.needsReview + meta.counts.submitted}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Đã xác nhận</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{meta.counts.confirmed}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bản nháp/Khác</p>
            <p className="mt-1 text-xl font-bold text-slate-600">{meta.counts.draft}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <FileText className="h-5 w-5" />
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm mã báo cáo, mã đơn đặt, khách hàng, địa điểm..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Mã báo cáo</th>
                <th className="px-4 py-3">Mã đơn đặt</th>
                <th className="px-4 py-3">Khách hàng / Sự kiện</th>
                <th className="px-4 py-3">Ngày khảo sát</th>
                <th className="px-4 py-3">Địa điểm</th>
                <th className="px-4 py-3">Người phụ trách</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    Đang tải danh sách báo cáo khảo sát...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-red-500">
                    {loadError}
                  </td>
                </tr>
              ) : reports.length > 0 ? (
                reports.map((r) => (
                  <tr key={r.surveyId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.reportCode}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-1 font-mono font-medium text-slate-800">{r.orderCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{r.customerName}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{r.eventName || '—'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">{formatDate(r.surveyDate)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={r.location}>
                      {r.location}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {r.reportedByName || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={SURVEY_STATUS_META[r.status].variant}>{SURVEY_STATUS_META[r.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(r.surveyId)}
                        disabled={isDetailLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:border-blue-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <MapPin className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-500">Không tìm thấy báo cáo khảo sát nào</p>
                    <p className="text-xs text-slate-400">Nhập lại từ khóa hoặc chuyển đổi trạng thái xem.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={paginationState} onPageChange={setPage} />
      </motion.div>

      <AnimatePresence>
        {selectedReport && (
          <SurveyDetailDrawer report={selectedReport} onClose={() => setSelectedReport(null)} onConfirm={handleConfirm} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreateOpen && <SurveyReportCreateDrawer onClose={() => setIsCreateOpen(false)} onCreated={handleCreated} />}
      </AnimatePresence>

      <Modal
        isOpen={Boolean(confirmingId)}
        onClose={() => setConfirmingId(null)}
        title="Xác nhận báo cáo khảo sát?"
        subtitle={
          confirmingId
            ? `Bạn đang phê duyệt thông số khảo sát của báo cáo. Dữ liệu đo đạc này sẽ dùng làm căn cứ lập kế hoạch & báo giá.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingId(null)} disabled={isConfirming}>
              Hủy bỏ
            </Button>
            <Button onClick={handleConfirmAction} isLoading={isConfirming}>
              <CheckCircle2 className="h-4 w-4" />
              Đồng ý phê duyệt
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}
