'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AxiosError } from 'axios';
import { ChevronLeft, CheckCircle2, Info } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { formatDate, formatTime } from '@/utils/formatDate';
import { inventoryApiService } from '@/services/inventory.service';
import { orderApiService } from '@/services/order.service';
import type { CollectedEquipmentReport } from '@/types/collectedEquipmentReport';
import type { InventoryRow } from '@/types/inventory';
import { usePermission } from '@/hooks/usePermission';

// Trang chi tiết phiếu hoàn kho — nối API thật GET /api/v1/inventory/return-reports/:id (backend đang
// chạy: D:\sep490-backend-api). Bảng kiểm đếm CHỈ ĐỌC (không có endpoint sửa item của report sau khi
// tạo — số liệu này do Leader Staff ghi nhận qua mobile). Nút "Xác nhận hoàn kho" gọi thẳng
// PUT .../confirm — chỉ role MANAGER gọi được (gate qua usePermission, Admin không thấy nút này, đúng
// "Admin không xử lý vận hành hằng ngày").

const STATUS_META = {
  SUBMITTED: { label: 'CHƯA HOÀN', badgeClass: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'ĐÃ HOÀN', badgeClass: 'bg-emerald-100 text-emerald-700' },
} as const;

interface OrderSummary {
  eventName?: string;
  eventType: string;
  customerName: string;
}

export default function ManagerReturnSlipDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = usePermission();

  const [report, setReport] = useState<CollectedEquipmentReport | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [beforeStock, setBeforeStock] = useState<Record<string, InventoryRow>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    inventoryApiService
      .getReturnReport(params.id)
      .then((res) => {
        if (cancelled) return;
        const data: CollectedEquipmentReport = res.data;
        setReport(data);
        orderApiService
          .getOrder(data.orderId)
          .then((orderRes) => {
            if (cancelled) return;
            setOrderSummary({
              eventName: orderRes.data?.eventName,
              eventType: orderRes.data?.eventType,
              customerName: orderRes.data?.customerName,
            });
          })
          .catch(() => {});
        if (data.status === 'SUBMITTED') {
          Promise.all(
            data.items.map((item) =>
              inventoryApiService
                .getInventory({ itemId: item.itemId })
                .then((invRes) => [item.itemId, invRes.data?.[0] as InventoryRow | undefined] as const)
                .catch(() => [item.itemId, undefined] as const),
            ),
          ).then((pairs) => {
            if (cancelled) return;
            const map: Record<string, InventoryRow> = {};
            pairs.forEach(([itemId, row]) => {
              if (row) map[itemId] = row;
            });
            setBeforeStock(map);
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setReport(null);
        setLoadError('Không tìm thấy phiếu hoàn kho hoặc không tải được dữ liệu.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const totals = useMemo(() => {
    const items = report?.items ?? [];
    return items.reduce(
      (acc, item) => ({
        good: acc.good + item.goodQuantity,
        damaged: acc.damaged + item.damagedQuantity,
        lost: acc.lost + item.lostQuantity,
      }),
      { good: 0, damaged: 0, lost: 0 },
    );
  }, [report]);

  const handleConfirm = async () => {
    if (!report) return;
    setIsConfirming(true);
    setConfirmError('');
    try {
      const res = await inventoryApiService.confirmReturnReport(report.reportId);
      setReport(res.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string; error?: { message?: string } }>;
      const message = axiosError.response?.data?.error?.message ?? axiosError.response?.data?.message;
      setConfirmError(message ?? 'Xác nhận hoàn kho thất bại. Vui lòng thử lại sau.');
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Đang tải...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">{loadError || 'Không tìm thấy phiếu hoàn kho.'}</p>
        <Link href="/manager/inventory/returns" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isDone = report.status === 'CONFIRMED';
  const canConfirm = can('inventory:confirm-return');

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: 'Thu hồi & hoàn kho' },
          { label: 'Danh sách phiếu hoàn kho', href: '/manager/inventory/returns' },
          { label: `#${report.reportId.slice(0, 8).toUpperCase()}` },
        ]}
        className="mb-3"
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900" title={report.reportId}>
              PHIẾU HOÀN KHO #{report.reportId.slice(0, 8).toUpperCase()}
            </h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_META[report.status].badgeClass}`}>
              {STATUS_META[report.status].label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Ngày tạo: {formatDate(report.createdAt)} {formatTime(report.createdAt)} · Tạo bởi: {report.reportedBy.fullName}
          </p>
        </div>
        <Link href="/manager/inventory/returns">
          <Button variant="secondary">
            <ChevronLeft className="h-4 w-4" />
            Quay lại danh sách
          </Button>
        </Link>
      </div>

      <Reveal className="mt-6 grid grid-cols-1 gap-6 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Đơn đặt cưới</p>
          <Link href={`/manager/orders/${report.orderId}`} className="mt-1 block font-semibold text-blue-600 hover:underline">
            {report.orderCode}
            {orderSummary?.eventName ? ` - ${orderSummary.eventName}` : ''}
          </Link>
          {orderSummary && <p className="mt-1 text-sm text-slate-500">Khách hàng: {orderSummary.customerName}</p>}
        </div>
        <div className="sm:border-l sm:border-slate-100 sm:pl-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày hoàn kho thực tế</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{report.confirmedAt ? formatDate(report.confirmedAt) : '—'}</p>
          <p className="mt-1 text-sm text-slate-400">{report.confirmedAt ? `(Đã hoàn kho — xác nhận bởi ${report.confirmedBy?.fullName ?? '—'})` : '(Chưa hoàn kho)'}</p>
        </div>
      </Reveal>

      <Reveal delay={0.05} className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
            <Info className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-bold text-blue-700">Lưu ý trước khi hoàn kho</p>
            <p className="mt-1 text-sm text-blue-600">Khi xác nhận hoàn kho, hệ thống sẽ tự động cập nhật tồn kho theo công thức:</p>
            <ul className="mt-2 space-y-1 text-sm text-blue-600">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>
                  <strong>Số lượng khả dụng</strong> = Số lượng khả dụng hiện tại + Số lượng nguyên vẹn
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>
                  <strong>Số lượng hỏng</strong> = Số lượng hỏng hiện tại + Số lượng hỏng trong phiếu
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>
                  <strong>Tổng số lượng</strong> = Tổng số lượng hiện tại - Số lượng mất
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Reveal>

      <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Chi tiết thiết bị hoàn kho</h2>

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Reveal>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">STT</th>
                  <th className="px-3 py-2">Tên sản phẩm &amp; thiết bị</th>
                  <th className="px-3 py-2">Đơn vị</th>
                  <th className="px-3 py-2 text-center text-emerald-600">Nguyên vẹn</th>
                  <th className="px-3 py-2 text-center text-amber-600">Hỏng</th>
                  <th className="px-3 py-2 text-center text-red-600">Mất</th>
                  <th className="px-3 py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.items.map((item, idx) => (
                  <tr key={item.cerItemId}>
                    <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold text-slate-800">{item.itemName}</td>
                    <td className="px-3 py-3 text-slate-500">{item.unit}</td>
                    <td className="px-3 py-3 text-center font-semibold text-emerald-700">{item.goodQuantity}</td>
                    <td className="px-3 py-3 text-center font-semibold text-amber-700">{item.damagedQuantity}</td>
                    <td className="px-3 py-3 text-center font-semibold text-red-700">{item.lostQuantity}</td>
                    <td className="px-3 py-3 text-slate-500">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                  <td colSpan={3} className="px-3 py-3 text-right">
                    TỔNG CỘNG
                  </td>
                  <td className="px-3 py-3 text-center text-emerald-600">{totals.good}</td>
                  <td className="px-3 py-3 text-center text-amber-600">{totals.damaged}</td>
                  <td className="px-3 py-3 text-center text-red-600">{totals.lost}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {report.notes && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold">Ghi chú phiếu:</span> {report.notes}
            </p>
          )}

          <Link href="/manager/inventory/returns" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600">
            <ChevronLeft className="h-4 w-4" />
            Quay lại danh sách
          </Link>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Tổng hợp sau hoàn kho (dự kiến)</p>
              <Info className="h-3.5 w-3.5 text-slate-300" />
            </div>

            <div className="mt-3 space-y-4">
              {report.items.map((item) => {
                const before = beforeStock[item.itemId];
                return (
                  <div key={item.cerItemId}>
                    <p className="text-sm font-bold text-slate-800">{item.itemName}</p>
                    {!before ? (
                      <p className="mt-1.5 text-xs italic text-slate-400">Không lấy được số tồn kho hiện tại.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
                        <li className="flex items-center justify-between gap-2">
                          <span>Số lượng khả dụng sau:</span>
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">
                            {before.quantityAvailable} + {item.goodQuantity} = {before.quantityAvailable + item.goodQuantity}
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-2">
                          <span>Số lượng hỏng sau:</span>
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">
                            {before.quantityDamaged} + {item.damagedQuantity} = {before.quantityDamaged + item.damagedQuantity}
                          </span>
                        </li>
                        <li className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 font-bold text-slate-700">
                          <span>Tổng số lượng sau:</span>
                          <span className="rounded-md bg-blue-600 px-2 py-0.5 font-mono font-bold text-white">
                            {before.quantityTotal} - {item.lostQuantity} = {before.quantityTotal - item.lostQuantity}
                          </span>
                        </li>
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <Link href="/manager/inventory/stock-check">
              <Button variant="secondary" className="mt-4 w-full justify-center">
                Xem chi tiết tất cả thiết bị →
              </Button>
            </Link>
          </div>

          {isDone ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700">
              Đã xác nhận hoàn kho{report.confirmedAt ? ` ngày ${formatDate(report.confirmedAt)}` : ''}
            </p>
          ) : canConfirm ? (
            <>
              <Button onClick={handleConfirm} isLoading={isConfirming} className="mt-4 w-full justify-center">
                <CheckCircle2 className="h-4 w-4" />
                Xác nhận hoàn kho
              </Button>
              {confirmError && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-inset ring-red-600/20">{confirmError}</p>
              )}
            </>
          ) : (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs italic text-slate-400">
              Chỉ Manager mới có quyền xác nhận hoàn kho.
            </p>
          )}
        </Reveal>
      </div>
    </div>
  );
}
