'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, Building2, Coins, Loader2, Mail, MapPin, Package, Phone, Star, User } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import Reveal from '@/components/ui/Reveal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { procurementApiService } from '@/services/procurement.service';
import { supplierApiService } from '@/services/supplier.service';
import { SUPPLIER_TRANSACTION_STATUS_META, SUPPLIER_TRANSACTION_TYPE_META } from '@/constants/supplier-transaction-status';
import type { Supplier } from '@/types/supplier';
import type { SupplierTransaction } from '@/types/procurement';

// Trang chi tiết đối tác — thay cho SupplierProfileModal (popup) trước đây, dùng chung cho cả
// /admin/suppliers/[id] và /manager/suppliers/[id] (2 vai trò chỉ khác backHref). Nội dung hiển thị
// giữ nguyên như modal cũ (thông tin liên hệ, công nợ, lịch sử giao dịch thuê/mua) — chỉ đổi bố cục
// thành trang riêng có breadcrumb quay lại danh sách.

interface SupplierDetailViewProps {
  backHref: string;
}

export default function SupplierDetailView({ backHref }: Readonly<SupplierDetailViewProps>) {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoadingSupplier, setIsLoadingSupplier] = useState(true);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoadingSupplier(true);
    setSupplierError(null);
    supplierApiService
      .getSupplier(id)
      .then((res) => {
        if (!cancelled) setSupplier(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setSupplierError('Không tải được thông tin đối tác.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSupplier(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bật cờ loading khi bắt đầu gọi API thật
    setIsLoadingTransactions(true);
    setTransactionsError(null);
    procurementApiService
      .getTransactions({ supplierId: id, limit: 50 })
      .then((res) => {
        if (!cancelled) setTransactions(res.data);
      })
      .catch(() => {
        if (!cancelled) setTransactionsError('Không tải được lịch sử giao dịch. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTransactions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoadingSupplier) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải thông tin đối tác...
      </div>
    );
  }

  if (supplierError || !supplier) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {supplierError ?? 'Không tìm thấy đối tác.'}
        </div>
        <Link href={backHref} className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: 'Nhà cung cấp' },
          { label: 'Danh sách đối tác', href: backHref },
          { label: supplier.supplierCode },
        ]}
      />

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BackButton href={backHref} />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Building2 className="h-6 w-6 text-blue-600" />
              {supplier.supplierName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Hồ sơ chi tiết đối tác <span className="text-slate-300">•</span>{' '}
              <span className="font-medium text-blue-600">{supplier.supplierCode}</span>
            </p>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(supplier.status)}>{supplier.status === 'ACTIVE' ? 'Đang hợp tác' : 'Ngừng hợp tác'}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Reveal className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Lĩnh vực chuyên môn</p>
                  <span className="mt-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600">
                    {supplier.serviceType}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Người liên hệ</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <User className="h-4 w-4 text-slate-400" />
                    {supplier.contactPerson || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Số điện thoại</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {supplier.phone || '—'}
                  </p>
                </div>
                {supplier.rating != null && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Đánh giá</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Star className="h-4 w-4 text-amber-400" />
                      {supplier.rating.toFixed(1)} / 5
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Email liên lạc</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {supplier.email || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Địa chỉ</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {supplier.address || '—'}
                  </p>
                </div>
                {supplier.notes && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ghi chú</p>
                    <p className="mt-1 text-sm text-slate-700">{supplier.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.05} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Coins className="h-4 w-4 text-teal-500" />
              Lịch sử giao dịch thuê/mua ngoài
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              {isLoadingTransactions ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải lịch sử giao dịch...
                </div>
              ) : transactionsError ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {transactionsError}
                </div>
              ) : transactions.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-slate-400">Chưa có giao dịch nào.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">Mã Giao Dịch</th>
                        <th className="px-3 py-2">Nội Dung</th>
                        <th className="px-3 py-2">Loại</th>
                        <th className="px-3 py-2">Ngày Tạo</th>
                        <th className="px-3 py-2">Giá Trị</th>
                        <th className="px-3 py-2">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((t) => (
                        <tr key={t.transactionId}>
                          <td className="px-3 py-3 font-semibold text-blue-600">{t.transactionCode}</td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-800">{t.serviceTitle}</p>
                            {t.orderCode && <p className="text-xs text-slate-400">Đơn: {t.orderCode}</p>}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{SUPPLIER_TRANSACTION_TYPE_META[t.transactionType].label}</td>
                          <td className="px-3 py-3 text-slate-500">{formatDate(t.createdAt)}</td>
                          <td className="px-3 py-3 font-bold text-slate-900">{formatCurrency(t.estimatedCost)}</td>
                          <td className="px-3 py-3">
                            <Badge variant={SUPPLIER_TRANSACTION_STATUS_META[t.status].variant}>
                              {SUPPLIER_TRANSACTION_STATUS_META[t.status].label}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Package className="h-4 w-4 text-slate-500" />
              Danh mục hạng mục &amp; giá thiết bị cung cấp
            </p>
            <p className="mt-2 text-sm text-slate-400">Chưa cập nhật hạng mục cung cấp.</p>
          </Reveal>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Reveal className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">Tổng hợp công nợ</h2>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tổng dư nợ hiện tại</p>
              <p className="mt-1 text-xl font-bold text-red-500">{formatCurrency(supplier.debtBalance)}</p>
            </div>
          </Reveal>

          <Reveal delay={0.05} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-900">Thông tin hồ sơ</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ngày tạo</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatDate(supplier.createdAt)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Cập nhật gần nhất</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatDate(supplier.updatedAt)}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
