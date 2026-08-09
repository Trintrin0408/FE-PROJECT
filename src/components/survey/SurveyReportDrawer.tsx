'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Package, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EvidenceBlock } from '@/components/payments/EvidenceBlock';
import { formatDate } from '@/utils/formatDate';
import type { SchedulePlan } from '@/types/schedulePlan';
import type { SurveyReport } from '@/types/survey';
import type { Order } from '@/types/order';
import type { Customer } from '@/types/customer';

export interface SurveyRow {
  orderId: string;
  plan: SchedulePlan | null;
  order?: Order;
  customer?: Customer;
  report: SurveyReport | null;
}

interface SurveyReportDrawerProps {
  row: SurveyRow | null;
  onClose: () => void;
}

export default function SurveyReportDrawer({ row, onClose }: Readonly<SurveyReportDrawerProps>) {
  return (
    <AnimatePresence>
      {row && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <button type="button" className="flex-1 cursor-default" aria-label="Đóng" onClick={onClose} />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2 }}
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hồ sơ định vị khảo sát</span>
                <div className="mt-1 flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-slate-900">Báo cáo khảo sát {row.report?.reportCode ?? `đơn #${row.orderId}`}</h2>
                  {row.report ? <Badge variant="success">Đã nộp</Badge> : <Badge variant="warning">Chờ nộp</Badge>}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Scrollable body ─────────────────────────────────────────── */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Thông tin chung sự kiện */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Thông tin chung sự kiện</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <div>
                    <span className="font-semibold text-slate-700">Khách hàng:</span> <span className="text-slate-900">{row.customer?.customerName ?? '—'}</span>{' '}
                    <span className="text-xs text-slate-400">
                      (Mã đơn:{' '}
                      <Link href={`/manager/orders/${row.orderId}`} onClick={onClose} className="font-semibold text-blue-600 hover:underline">
                        {row.order?.orderCode ?? row.orderId}
                      </Link>
                      )
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Ngày tiến hành:</span>{' '}
                    <span className="text-slate-600">
                      {row.report ? formatDate(row.report.surveyDate) : row.plan ? formatDate(row.plan.startTime) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Nhân sự khảo sát:</span>{' '}
                    <span className="text-slate-600">{row.plan?.assigneeName ?? 'Chưa phân công'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold text-slate-700">Địa điểm đo đạc:</span>{' '}
                    <span className="text-slate-900">{row.report?.location ?? row.order?.location ?? '—'}</span>
                  </div>
                </div>
              </div>

              {row.report ? (
                <>
                  {/* Số đo kỹ thuật — dữ liệu thật từ SurveyReport */}
                  {(row.report.length || row.report.width || row.report.area) && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">Số đo kỹ thuật mặt bằng sảnh</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {(
                          [
                            { label: 'Chiều dài', value: row.report.length != null ? `${row.report.length} m` : '—' },
                            { label: 'Chiều rộng', value: row.report.width != null ? `${row.report.width} m` : '—' },
                            { label: 'Diện tích sảnh', value: row.report.area != null ? `${row.report.area} m²` : '—' },
                          ] as const
                        ).map((metric) => (
                          <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                      {row.report.entrance && (
                        <p className="mt-3 text-sm text-slate-600">
                          <span className="font-semibold">Lối đi bốc xếp thiết bị:</span> <span className="text-slate-500">{row.report.entrance}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Ràng buộc & Ghi chú — dữ liệu thật từ backend */}
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">Ràng buộc &amp; Ghi chú thực tế sảnh</h3>

                    {row.report.notes ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{row.report.notes}</div>
                    ) : (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic text-slate-400">Chưa có ghi chú khảo sát.</div>
                    )}

                    <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                      {row.report.siteConstraints && (
                        <p>
                          <span className="font-semibold">Giới hạn lắp đặt:</span> <span className="text-slate-500">{row.report.siteConstraints}</span>
                        </p>
                      )}
                      {row.report.additionalRequests && (
                        <p>
                          <span className="font-semibold">Yêu cầu bổ sung của khách:</span> <span className="text-slate-500">{row.report.additionalRequests}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Hình ảnh hiện trường — evidence từ backend thật */}
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span>🖼️</span> Hình ảnh hiện trường
                    </h3>
                    <EvidenceBlock evidenceIds={row.report.evidenceIds} title="" emptyLabel="Chưa có ảnh minh chứng khảo sát." />
                  </div>

                  {/* Đề xuất bổ sung thiết bị — dữ liệu thật (chuỗi tự do) */}
                  {row.report.proposedItems && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">Đề xuất bổ sung thiết bị sau khảo sát</h3>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">{row.report.proposedItems}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm italic text-slate-400">
                  Chưa có báo cáo khảo sát nào được nộp cho đơn hàng này.
                </div>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-6 py-4">
              <Link
                href={`/manager/orders/${row.orderId}`}
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Quay lại xem đơn hàng
              </Link>
              <Link
                href="/manager/inventory/stock-status"
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Package className="h-3.5 w-3.5" />
                Kiểm tra lại tồn kho
              </Link>
              <Link
                href={`/manager/orders/${row.orderId}?tab=quotation`}
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <FileText className="h-3.5 w-3.5" />
                Cập nhật báo giá
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
