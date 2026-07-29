'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, CheckCircle2, Clock, MapPin, Package, User, X } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/formatDate';
import { evidenceApiService } from '@/services/evidence.service';
import type { SurveyReport, SurveyStatus } from '@/types/survey';
import type { Evidence } from '@/types/evidence';

// Nối API thật theo docs/khaosathientruong_api.md mục 3 (2026-07-20, mọi quyết định đã chốt) —
// report giờ là shape thật (types/survey.ts) từ GET /survey-reports/:id, không phải mock
// AdminSurveyReport nữa.
// 2026-07-21 (theo yêu cầu người dùng): đã ẩn hẳn "Chiều cao trần"/"Công suất nguồn điện" (mock, không
// có cột thật), "Các yêu cầu bổ sung" (additionalRequests), và ảnh minh họa mẫu ở khối "Minh chứng
// hình ảnh" khỏi UI — giờ chỉ hiện đúng 1 ảnh thật qua evidence_id nếu có, không chèn ảnh giả nữa.
// Cập nhật (theo yêu cầu người dùng): đã bỏ hẳn khối "Danh sách thiết bị báo giá" (đọc báo giá liên
// kết qua orders.quotationId) — chỉ còn "Đồ đạc/thiết bị đề xuất thuê" ghi tay của Leader Staff.

const SURVEY_STATUS_META: Record<SurveyStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Bản nháp', variant: 'neutral' },
  NEEDS_REVIEW: { label: 'Chờ xác nhận', variant: 'warning' },
  SUBMITTED: { label: 'Chờ xác nhận', variant: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', variant: 'success' },
};

interface SurveyDetailDrawerProps {
  report: SurveyReport;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export default function SurveyDetailDrawer({ report, onClose, onConfirm }: Readonly<SurveyDetailDrawerProps>) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);

  useEffect(() => {
    if (!report.evidenceId) {
      setEvidence(null);
      return;
    }
    evidenceApiService
      .getEvidenceById(report.evidenceId)
      .then((res) => setEvidence(res.data ?? null))
      .catch(() => setEvidence(null));
  }, [report.evidenceId]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col justify-between border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chi tiết báo cáo khảo sát</span>
              <Badge variant={SURVEY_STATUS_META[report.status].variant}>{SURVEY_STATUS_META[report.status].label}</Badge>
            </div>
            <h3 className="mt-1 text-base font-bold text-slate-900">{report.reportCode}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-200/50 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-150 bg-slate-50/60 p-4 text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Mã đơn đặt</span>
              <span className="mt-1 block font-mono font-bold text-slate-800">{report.orderCode}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Khách hàng</span>
              <span className="mt-1 block font-semibold text-slate-800">{report.customerName}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Sự kiện</span>
              <span className="mt-1 block font-semibold text-slate-800">{report.eventName || '—'}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-400">Ngày khảo sát</span>
              <span className="mt-1 inline-flex items-center gap-1 font-bold text-blue-600">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(report.surveyDate)}
              </span>
            </div>
            <div className="col-span-2">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Địa điểm hiện trường</span>
              <span className="mt-1 inline-flex items-center gap-1 font-medium text-slate-800">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {report.location}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">Thông tin đo đạc</h4>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                <span className="block font-medium text-slate-500">Diện tích</span>
                <span className="mt-0.5 block font-bold text-slate-800">{report.area != null ? `${report.area} m²` : 'Chưa có'}</span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                <span className="block font-medium text-slate-500">Chiều dài</span>
                <span className="mt-0.5 block font-bold text-slate-800">{report.length != null ? `${report.length} m` : 'Chưa có'}</span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                <span className="block font-medium text-slate-500">Chiều rộng</span>
                <span className="mt-0.5 block font-bold text-slate-800">{report.width != null ? `${report.width} m` : 'Chưa có'}</span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                <span className="block font-medium text-slate-500">Thông tin lối vào</span>
                <span className="mt-0.5 block font-bold text-slate-800">{report.entrance || 'Chưa có'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">Ghi nhận hiện trường</h4>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs leading-relaxed text-slate-600">
              <p className="mb-2 font-medium text-slate-800">Các hạn chế tại địa điểm:</p>
              {report.siteConstraints || 'Chưa ghi nhận.'}
            </div>
            {report.notes && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 text-xs text-slate-600">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Lưu ý thi công quan trọng:
                </p>
                {report.notes}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">
              <Package className="h-4 w-4 text-blue-600" />
              Đồ đạc / thiết bị đề xuất thuê
            </h4>
            <div className="rounded-xl border border-slate-150 bg-white p-3.5 text-xs leading-relaxed text-slate-700 shadow-xs">
              {report.proposedItems || (
                <span className="italic text-slate-400">Chưa khai báo trang bị / đồ thuê kèm theo.</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="border-l-2 border-blue-500 pl-2 text-xs font-bold uppercase tracking-wider text-slate-900">Minh chứng hình ảnh</h4>
            <div className="grid grid-cols-3 gap-2">
              {evidence?.fileUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ Firebase Storage, không cần tối ưu qua next/image
                <img
                  src={evidence.fileUrl}
                  alt="Ảnh hiện trường khảo sát (thật)"
                  onClick={() => setLightboxImage(evidence.fileUrl)}
                  className="h-24 w-full cursor-zoom-in rounded-lg border border-slate-100 object-cover transition-opacity hover:opacity-80"
                />
              )}
            </div>
            {!evidence?.fileUrl && (
              <p className="text-[10px] italic text-slate-400">Chưa có ảnh minh chứng thật (evidence_id chưa gắn hoặc chưa tải được).</p>
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Khảo sát viên: <strong>{report.reportedByName || '—'}</strong>
            </span>
            {report.confirmedByName && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Đã xác nhận bởi: <strong>{report.confirmedByName}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-150 bg-slate-50 p-5">
          <Button variant="secondary" onClick={onClose}>
            Đóng lại
          </Button>
          {(report.status === 'NEEDS_REVIEW' || report.status === 'SUBMITTED') && (
            <Button onClick={() => onConfirm(report.surveyId)}>
              <CheckCircle2 className="h-4 w-4" />
              Xác nhận báo cáo khảo sát
            </Button>
          )}
        </div>
      </motion.div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-8"
          onClick={() => setLightboxImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh mock/thật từ URL ngoài */}
          <img src={lightboxImage} alt="Ảnh hiện trường khảo sát (phóng to)" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}
