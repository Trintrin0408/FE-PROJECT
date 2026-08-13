// docs/api/10-survey-assignment.md — ĐÃ LỖI THỜI sau đợt backend refactor 2026-07-06. Field thật
// khác hẳn (không còn workTaskId/evidences[]/surveyedBy) — SurveyReport giờ có đầy đủ thông tin
// khảo sát hiện trường (kích thước, lối vào, ràng buộc mặt bằng...) gắn trực tiếp vào Order.
// Cập nhật 2026-07-20 (theo docs/khaosathientruong_api.md mục 1/7): GET /survey-reports (list, MỚI —
// trước đây chỉ có bản theo 1 đơn) và GET /survey-reports/:id đã join sẵn orderCode/customerName/
// eventName/reportedByName/confirmedByName — khác nhận định cũ ("KHÔNG join reporter/confirmer") viết
// trước khi Backend bổ sung.
// Cập nhật 2026-08-09: Backend migration `20260805221925_add_multiple_evidences_support` đổi
// survey_reports.evidence_id (cột đơn) sang bảng join nhiều-nhiều `survey_report_evidences` — giống
// hệt Deposit/Settlement (xem comment EvidenceBlock.tsx). GET /survey-reports/:id giờ trả
// `evidenceIds: string[]` (survey.service.ts mapDetail), không còn field `evidenceId`/`evidence` object
// nữa — đã xác nhận qua đối chiếu trực tiếp D:\sep490-backend-api (survey.repository.ts/service.ts) và
// MySQL MCP (bảng survey_report_evidences).
// Nguồn: D:\sep490-backend-api prisma/schema.prisma (model SurveyReport), operations.route.ts.

export type SurveyStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'SUBMITTED' | 'CONFIRMED';

export interface SurveyReport {
  surveyId: string;
  reportCode: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName?: string;
  planId?: string;
  evidenceIds: string[];
  surveyDate: string;
  location: string;
  area?: number;
  length?: number;
  width?: number;
  entrance?: string;
  siteConstraints?: string;
  additionalRequests?: string;
  proposedItems?: string;
  notes?: string;
  status: SurveyStatus;
  reportedBy: string;
  reportedByName?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/v1/survey-reports — danh sách toàn cục, join sẵn orderCode/customerName/eventName/
// reportedByName (không kèm field đo đạc chi tiết — chỉ có ở GET /survey-reports/:id).
export interface SurveyReportListItem {
  surveyId: string;
  reportCode: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  eventName?: string;
  surveyDate: string;
  location: string;
  evidenceIds: string[];
  status: SurveyStatus;
  reportedByName?: string;
}

export interface GetSurveyReportsQuery {
  search?: string;
  status?: SurveyStatus;
  page?: number;
  limit?: number;
}

export interface SurveyReportListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: {
    all: number;
    draft: number;
    needsReview: number;
    submitted: number;
    confirmed: number;
  };
}

// POST /api/v1/survey-reports
export interface CreateSurveyReportPayload {
  orderId: string;
  planId?: string;
  evidenceIds?: string[];
  surveyDate: string; // ISO datetime
  location: string;
  area?: number;
  length?: number;
  width?: number;
  entrance?: string;
  siteConstraints?: string;
  additionalRequests?: string;
  proposedItems?: string;
  notes?: string;
}

// PUT /api/v1/survey-reports/:id/confirm
export interface ConfirmSurveyReportPayload {
  status: SurveyStatus;
}
