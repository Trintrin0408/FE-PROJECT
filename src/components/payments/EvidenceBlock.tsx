'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { evidenceApiService } from '@/services/evidence.service';
import type { Evidence } from '@/types/evidence';

// Xem bằng chứng: GET /evidence/:id (cùng pattern đã dùng ở SurveyDetailDrawer/
// inventory/returns/picklists). Backend 2026-08-06 (commit d0db32a) đổi Deposit.evidenceId/
// Settlement.evidenceId (1 field) sang quan hệ 1:N `evidenceIds: string[]` — component nhận mảng,
// tải song song từng ảnh.
//
// Tải lên bằng chứng: PUT /deposits/:id và PUT /settlements/:id/confirm chỉ cho ghi `evidenceIds`
// CÙNG LÚC đổi trạng thái (status bắt buộc trên cả 2 endpoint, chỉ gọi được khi bản ghi còn UNPAID) —
// không có API gắn bằng chứng riêng lẻ mà không đổi trạng thái. Vì vậy việc chọn/tải file KHÔNG nằm
// trong component xem này nữa — dùng `EvidenceUploadField` (cùng file) đặt ngay trong bước xác nhận
// (modal "Xác nhận đã nhận cọc" / khối xác nhận quyết toán), rồi gọi `uploadPaymentEvidence` để lấy
// evidenceId trước khi submit cùng lúc với status.

interface EvidenceBlockProps {
  evidenceIds: string[];
  emptyLabel?: string;
  title?: string;
}

export function EvidenceBlock({
  evidenceIds,
  emptyLabel = 'Chưa có ảnh minh chứng.',
  title = 'Bằng chứng thanh toán',
}: Readonly<EvidenceBlockProps>) {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const evidenceIdsKey = evidenceIds.join('|');

  useEffect(() => {
    if (evidenceIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset khi đổi/gỡ evidenceIds, không phải vòng lặp render
      setEvidences([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all(
      evidenceIds.map((id) =>
        evidenceApiService
          .getEvidenceById(id)
          .then((res) => (res?.data ?? null) as Evidence | null)
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (!cancelled) setEvidences(results.filter((e): e is Evidence => Boolean(e)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so sánh theo nội dung mảng qua evidenceIdsKey, không theo reference
  }, [evidenceIdsKey]);

  return (
    <div className="mt-3">
      {title && <p className="text-xs font-semibold text-slate-500">{title}</p>}

      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {isLoading && (
          <p className="flex items-center gap-1.5 text-sm text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải ảnh minh chứng...
          </p>
        )}
        {!isLoading && evidences.length === 0 && <p className="text-sm italic text-slate-400">{emptyLabel}</p>}
        {!isLoading &&
          evidences.map((ev) => (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ Firebase Storage
            <img
              key={ev.evidenceId}
              src={ev.fileUrl}
              alt="Bằng chứng thanh toán"
              onClick={() => setLightboxImage(ev.fileUrl)}
              className="h-20 w-20 cursor-zoom-in rounded-lg border border-slate-100 object-cover transition-opacity hover:opacity-80"
            />
          ))}
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-8" onClick={() => setLightboxImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ Firebase Storage */}
          <img src={lightboxImage} alt="Bằng chứng thanh toán (phóng to)" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

interface EvidenceUploadFieldProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
}

/** Chọn (chưa upload) 1 file bằng chứng để gắn kèm bước xác nhận cọc/quyết toán — upload thật diễn ra
 * ở `uploadPaymentEvidence` ngay trước khi gọi API đổi trạng thái, tránh tạo bản ghi Evidence mồ côi
 * nếu người dùng chọn file rồi huỷ xác nhận. */
export function EvidenceUploadField({
  file,
  onChange,
  disabled,
  label = 'Ảnh bằng chứng (không bắt buộc)',
}: Readonly<EvidenceUploadFieldProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.type.startsWith('image/')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset khi đổi/gỡ file, không phải vòng lặp render
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {file ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3 py-2">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- xem trước cục bộ từ file vừa chọn, chưa upload lên server
              <img src={previewUrl} alt="Xem trước bằng chứng vừa chọn" className="h-10 w-10 rounded object-cover" />
            ) : (
              <FileText className="h-5 w-5 text-emerald-600" />
            )}
            <span className="text-xs font-semibold text-emerald-700">{file.name}</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              aria-label="Bỏ chọn tệp bằng chứng"
              className="text-emerald-600 hover:text-red-600 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-600 disabled:opacity-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Chọn tệp bằng chứng
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

/** Upload thật file bằng chứng (POST /evidence/upload) và trả về evidenceId để gắn kèm cùng lúc gọi
 * PUT /deposits/:id hoặc PUT /settlements/:id/confirm — 2 endpoint đó chỉ nhận evidenceIds cùng lúc
 * đổi trạng thái, không có API gắn riêng lẻ (xem comment đầu file). */
export async function uploadPaymentEvidence(file: File): Promise<string> {
  const res = await evidenceApiService.uploadEvidence({ file });
  const evidence = res?.data as Evidence | undefined;
  if (!evidence?.evidenceId) throw new Error('Tải lên bằng chứng thất bại');
  return evidence.evidenceId;
}
