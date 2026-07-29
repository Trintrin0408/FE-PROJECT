'use client';

import { Building2, Coins, Mail, MapPin, Package, User, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { SUPPLIER_TRANSACTION_STATUS_META } from '@/mocks/db/suppliers';
import type { Supplier } from '@/types/supplier';

interface SupplierDetailModalProps {
  supplier: Supplier | null;
  onClose: () => void;
}

/** Hồ sơ chi tiết 1 đối tác (đối tác, công nợ, lịch sử giao dịch thuê/mua, danh mục cung cấp) — dùng
 * chung cho trang /admin/suppliers và /admin/suppliers/purchase-orders. */
export function SupplierDetailModal({ supplier, onClose }: Readonly<SupplierDetailModalProps>) {
  if (!supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Building2 className="h-5 w-5 text-slate-400" />
            Hồ sơ chi tiết Đối tác <span className="text-slate-300">•</span> <span className="text-blue-600">{supplier.supplierCode}</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
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
                  {supplier.address}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Coins className="h-4 w-4 text-teal-500" />
                Khối tài chính &amp; tổng hợp công nợ
              </p>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tổng dư nợ hiện tại</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(supplier.debtBalance)}</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Lịch sử giao dịch thuê/mua ngoài</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              {((supplier as any).transactions ?? []).length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-slate-400">Chưa có giao dịch nào.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Mã Yêu Cầu</th>
                      <th className="px-3 py-2">Nội Dung Yêu Cầu</th>
                      <th className="px-3 py-2">Ngày Thực Hiện</th>
                      <th className="px-3 py-2">Giá Trị</th>
                      <th className="px-3 py-2">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {((supplier as any).transactions ?? []).map((t: any) => (
                      <tr key={t.requestCode}>
                        <td className="px-3 py-3 font-semibold text-blue-600">{t.requestCode}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-800">{t.title}</p>
                          <p className="text-xs text-slate-400">{t.customerLabel}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-500">{formatDate(t.executionDate)}</td>
                        <td className="px-3 py-3 font-bold text-slate-900">{formatCurrency(t.value)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${(SUPPLIER_TRANSACTION_STATUS_META as any)[t.status]?.badgeClass}`}>
                            {(SUPPLIER_TRANSACTION_STATUS_META as any)[t.status]?.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Package className="h-4 w-4 text-slate-500" />
              Danh mục hạng mục &amp; giá thiết bị cung cấp
            </p>
            {((supplier as any).catalogItems ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Chưa cập nhật hạng mục cung cấp.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {((supplier as any).catalogItems ?? []).map((item: any) => (
                  <div key={item.itemCode} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{item.itemName}</p>
                      <p className="text-xs text-slate-400">Mã hạng mục: {item.itemCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{formatCurrency(item.price)}</p>
                      <p className="text-xs text-slate-400">Đơn vị: /{item.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <Button onClick={onClose}>Đóng hồ sơ</Button>
        </div>
      </div>
    </div>
  );
}

export default SupplierDetailModal;
