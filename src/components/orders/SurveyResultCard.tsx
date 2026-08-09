import AnalyticsCard from '@/components/dashboard/AnalyticsCard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EvidenceBlock } from '@/components/payments/EvidenceBlock';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { SurveyReport } from '@/types/survey';

const STATUS_LABEL: Record<SurveyReport['status'], string> = {
  DRAFT: 'NHÁP',
  NEEDS_REVIEW: 'CẦN XEM XÉT',
  SUBMITTED: 'ĐÃ NỘP',
  CONFIRMED: 'ĐÃ XÁC NHẬN',
};

interface SurveyResultCardProps {
  report: SurveyReport | null;
  surveyorName?: string;
  isLoading: boolean;
}

// GET /survey-reports/:id không trả tên người khảo sát (chỉ có reportedBy id) — dùng surveyorName
// suy từ SchedulePlan.assigneeName (tên nhân sự được phân công khảo sát) làm fallback hiển thị.
export default function SurveyResultCard({ report, surveyorName, isLoading }: Readonly<SurveyResultCardProps>) {
  return (
    <AnalyticsCard title="Kết quả khảo sát">
      {isLoading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : !report ? (
        <p className="text-sm text-slate-500">Chưa có báo cáo khảo sát cho đơn hàng này.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={surveyorName ?? 'KSV'} size="md" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{surveyorName ?? 'Khảo sát viên'}</p>
                <p className="text-xs text-slate-400">
                  Khảo sát lúc {formatTime(report.surveyDate)} - {formatDate(report.surveyDate)}
                </p>
              </div>
            </div>
            <Badge variant="success">{STATUS_LABEL[report.status]}</Badge>
          </div>

          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-400">Địa điểm</p>
            <p className="text-sm text-slate-700">{report.location}</p>
          </div>

          {report.notes && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-slate-400">Ghi chú kỹ thuật</p>
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{report.notes}</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-400">Ảnh hiện trường</p>
            <EvidenceBlock evidenceIds={report.evidenceIds} title="" emptyLabel="Chưa có ảnh minh chứng khảo sát." />
          </div>
        </div>
      )}
    </AnalyticsCard>
  );
}
