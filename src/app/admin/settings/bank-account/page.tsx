'use client';

import { useEffect, useState } from 'react';
import { Landmark, Save, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { usePermission } from '@/hooks/usePermission';
import { settingsApiService } from '@/services/settings.service';
import { buildSepayQrUrl } from '@/constants/company-bank';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { Bank } from '@/types/settings';

// Trang Admin cấu hình TÀI KHOẢN NGÂN HÀNG công ty (GET/PUT /settings/bank-account). Mã QR nhận cọc/
// quyết toán (SePay) trên web + mobile đều dựng từ cấu hình này — thay cho hardcode cũ ở FE/mobile.
export default function Page() {
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [bankBin, setBankBin] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    settingsApiService
      .getBankAccount()
      .then((a) => {
        if (cancelled) return;
        setBankBin(a.bankBin ?? '');
        setBankName(a.bankName ?? '');
        setAccountNumber(a.accountNumber ?? '');
        setAccountName(a.accountName ?? '');
        setUpdatedAt(a.updatedAt);
        setConfigured(a.configured);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được cấu hình tài khoản ngân hàng.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Danh sách ngân hàng (proxy banks.json) để Admin CHỌN thay vì gõ tay mã BIN.
  useEffect(() => {
    let cancelled = false;
    settingsApiService
      .getBanks()
      .then((list) => {
        if (!cancelled) setBanks(list);
      })
      .catch(() => {
        if (!cancelled) setBanks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectBank = (bin: string) => {
    setBankBin(bin);
    const b = banks.find((x) => x.bin === bin);
    if (b) setBankName(b.shortName);
  };

  const canPreview = Boolean(bankBin.trim() && accountNumber.trim());
  const previewUrl = canPreview
    ? buildSepayQrUrl(
        { bankBin: bankBin.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() || undefined },
        { amount: 100000, des: 'DEMO QR' },
      )
    : null;

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!bankBin.trim() || !bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setError('Vui lòng nhập đầy đủ mã ngân hàng, tên ngân hàng, số tài khoản và tên chủ tài khoản.');
      return;
    }
    setIsSaving(true);
    try {
      const a = await settingsApiService.updateBankAccount({
        bankBin: bankBin.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
      setUpdatedAt(a.updatedAt);
      setConfigured(a.configured);
      setSuccess('Đã lưu cấu hình tài khoản ngân hàng.');
    } catch {
      setError('Lưu cấu hình thất bại. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Landmark className="h-5 w-5 text-blue-600" />
          Tài khoản ngân hàng nhận thanh toán
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Cấu hình tài khoản công ty dùng để sinh mã QR (SePay) nhận cọc &amp; quyết toán. Áp dụng cho cả web và mobile.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-400">Đang tải cấu hình…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <SearchableSelect
                  label="Ngân hàng"
                  value={bankBin}
                  onChange={handleSelectBank}
                  options={banks.map((b) => ({ value: b.bin, label: `${b.shortName} — ${b.name}` }))}
                  placeholder={banks.length === 0 ? 'Đang tải danh sách ngân hàng…' : 'Chọn ngân hàng…'}
                  searchPlaceholder="Tìm ngân hàng (tên/mã)…"
                  disabled={!canManage || banks.length === 0}
                />
              </div>
              <Input
                label="Số tài khoản"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="VD: 0828937456"
                disabled={!canManage}
              />
              <Input
                label="Tên chủ tài khoản (không dấu, viết hoa)"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="VD: CUOI HOI BN"
                disabled={!canManage}
              />
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Chọn ngân hàng từ danh sách (banks.json của VietQR/SePay) rồi nhập số tài khoản &amp; tên chủ tài khoản.
              {bankBin ? (
                <>
                  {' '}Mã ngân hàng đã chọn: <span className="font-mono font-semibold text-slate-600">{bankName || bankBin}</span> (BIN {bankBin}).
                </>
              ) : null}
            </p>

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{error}</p>}
            {success && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 ring-1 ring-inset ring-emerald-600/20">{success}</p>}

            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleSave} disabled={!canManage || isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? 'Đang lưu…' : 'Lưu cấu hình'}
              </Button>
              {updatedAt && (
                <span className="text-xs text-slate-400">
                  Cập nhật lần cuối: {formatDate(updatedAt)} {formatTime(updatedAt)}
                </span>
              )}
            </div>

            {!canManage && (
              <p className="mt-3 text-xs italic text-slate-400">Chỉ Admin (quyền quản trị master data) mới sửa được cấu hình này.</p>
            )}
          </Reveal>

          <Reveal delay={0.05} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <QrCode className="h-4 w-4 text-slate-500" />
              Xem trước mã QR
            </p>
            <p className="mt-1 text-xs text-slate-400">Mẫu với số tiền 100.000đ, nội dung &quot;DEMO QR&quot;.</p>
            {previewUrl ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="w-full max-w-[220px] rounded-xl border border-slate-200 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh động từ SePay (qr.sepay.vn) */}
                  <img src={previewUrl} alt="Xem trước mã QR SePay" className="w-full" />
                </div>
                <div className="text-center text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">{bankName || bankBin}</p>
                  <p>STK: <span className="font-mono font-semibold text-slate-700">{accountNumber}</span></p>
                  {accountName && <p>{accountName}</p>}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">
                Nhập mã ngân hàng và số tài khoản để xem trước mã QR.
              </p>
            )}
            {!configured && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-700 ring-1 ring-inset ring-amber-600/20">
                Chưa cấu hình — mã QR sẽ KHÔNG hiển thị ở trang cọc/quyết toán cho tới khi lưu.
              </p>
            )}
          </Reveal>
        </div>
      )}
    </div>
  );
}
