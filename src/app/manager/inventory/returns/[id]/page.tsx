'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { formatDate, formatTime } from '@/utils/formatDate';
import {
  confirmReturnSlip,
  getReturnSlipById,
  RETURN_SLIP_STATUS_META,
  ReturnSlipItem,
  ReturnSlipStatus,
} from '@/mocks/adminInventoryReturnsMock';

// Trang thuần giao diện — mirror 1:1 từ src/app/admin/inventory/returns/[id]/page.tsx cho vai trò
// Manager (xem giải thích ở đầu src/mocks/adminInventoryReturnsMock.ts). Đây chính là bước "Manager
// xác nhận" biên bản thu hồi & kiểm đếm hỏng/mất do Leader Staff ghi nhận tại hiện trường trước đó
// (mục 1 CLAUDE.md) — xác nhận chỉ cập nhật state cục bộ qua mock (mất khi tải lại trang).

interface ItemAfterStock {
  totalAfter: number;
  damagedAfter: number;
  lockedAfter: number;
  availableAfter: number;
}

function computeAfter(item: ReturnSlipItem): ItemAfterStock {
  const totalAfter = item.warehouseBefore.totalStock - item.lost;
  const damagedAfter = item.warehouseBefore.damagedStock + item.damaged;
  const lockedAfter = item.warehouseBefore.lockedStock - item.totalToReturn;
  return { totalAfter, damagedAfter, lockedAfter, availableAfter: totalAfter - damagedAfter - lockedAfter };
}

export default function ManagerReturnSlipDetailPage() {
  const params = useParams<{ id: string }>();
  const slip = getReturnSlipById(params.id);

  const [items, setItems] = useState<ReturnSlipItem[]>(() => slip?.items.map((item) => ({ ...item })) ?? []);
  const [status, setStatus] = useState<ReturnSlipStatus | undefined>(slip?.status);
  const [actualReturnDate, setActualReturnDate] = useState<string | undefined>(slip?.actualReturnDate);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => ({
          totalToReturn: acc.totalToReturn + item.totalToReturn,
          intact: acc.intact + item.intact,
          damaged: acc.damaged + item.damaged,
          lost: acc.lost + item.lost,
        }),
        { totalToReturn: 0, intact: 0, damaged: 0, lost: 0 },
      ),
    [items],
  );

  if (!slip || !status) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Không tìm thấy phiếu hoàn kho.</p>
        <Link href="/manager/inventory/returns" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isDone = status === 'DONE';

  const updateItem = (index: number, field: 'intact' | 'damaged' | 'lost' | 'note', value: number | string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleConfirm = () => {
    confirmReturnSlip(slip.id, items);
    const updated = getReturnSlipById(slip.id);
    if (updated) {
      setStatus(updated.status);
      setActualReturnDate(updated.actualReturnDate);
      setItems(updated.items.map((item) => ({ ...item })));
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">PHIẾU HOÀN KHO #{slip.id}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${RETURN_SLIP_STATUS_META[status].badgeClass}`}>
              {RETURN_SLIP_STATUS_META[status].label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Ngày tạo: {formatDate(slip.createdAt)} {formatTime(slip.createdAt)} · Tạo bởi: {slip.createdBy}
          </p>
        </div>
        <Link href="/manager/inventory/returns">
          <Button variant="secondary">
            <ChevronLeft className="h-4 w-4" />
            Quay lại danh sách
          </Button>
        </Link>
      </div>

      <Reveal className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Đơn đặt cưới</p>
          <Link href={`/manager/orders/${slip.orderCode}`} className="mt-1 block font-semibold text-blue-600 hover:underline">
            {slip.orderCode} - {slip.orderName}
          </Link>
          <p className="mt-1 text-sm text-slate-500">Khách hàng: {slip.customerName}</p>
        </div>
        <div className="sm:border-l sm:border-slate-100 sm:pl-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngày hoàn kho thực tế</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{actualReturnDate ? formatDate(actualReturnDate) : '—'}</p>
          <p className="mt-1 text-sm text-slate-400">{actualReturnDate ? '(Đã hoàn kho)' : '(Chưa hoàn kho)'}</p>
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
                  <strong>Tổng số lượng sau hoàn kho</strong> = Tổng số lượng đang ghi nhận trong kho - Số lượng mất
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>
                  <strong>Số lượng hỏng sau hoàn kho</strong> = Số lượng hỏng đang ghi nhận trong kho (nếu có) + Số lượng
                  hỏng trong phiếu hoàn kho
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>
                  <strong>Số lượng khóa sau hoàn kho</strong> = Số lượng khóa đang ghi nhận trong kho - Tổng số lượng cần
                  hoàn
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>
                  <strong>Số lượng khả dụng</strong> = Tổng số lượng sau hoàn kho - Số lượng hỏng sau hoàn kho - Số lượng
                  khóa sau hoàn kho
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th rowSpan={2} className="px-3 py-2 align-bottom">
                    STT
                  </th>
                  <th rowSpan={2} className="px-3 py-2 align-bottom">
                    Tên sản phẩm &amp; thiết bị
                  </th>
                  <th rowSpan={2} className="px-3 py-2 align-bottom">
                    Đơn vị
                  </th>
                  <th rowSpan={2} className="px-3 py-2 text-center align-bottom">
                    Tổng số lượng cần hoàn
                  </th>
                  <th className="px-3 py-1 text-center text-emerald-600">Nguyên vẹn</th>
                  <th className="px-3 py-1 text-center text-amber-600">Hỏng</th>
                  <th className="px-3 py-1 text-center text-red-600">Mất</th>
                  <th rowSpan={2} className="px-3 py-2 align-bottom">
                    Ghi chú
                  </th>
                </tr>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wide">
                  <th className="px-3 pb-2 text-center text-emerald-500">Số lượng</th>
                  <th className="px-3 pb-2 text-center text-amber-500">Số lượng</th>
                  <th className="px-3 pb-2 text-center text-red-500">Số lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.itemName}>
                    <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold text-slate-800">{item.itemName}</td>
                    <td className="px-3 py-3 text-slate-500">{item.unit}</td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">{item.totalToReturn}</td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={item.intact}
                        disabled={isDone}
                        onChange={(e) => updateItem(idx, 'intact', Number(e.target.value))}
                        className="w-16 rounded-md border border-emerald-200 bg-emerald-50/50 py-1 text-center text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={item.damaged}
                        disabled={isDone}
                        onChange={(e) => updateItem(idx, 'damaged', Number(e.target.value))}
                        className="w-16 rounded-md border border-amber-200 bg-amber-50/50 py-1 text-center text-sm font-semibold text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={item.lost}
                        disabled={isDone}
                        onChange={(e) => updateItem(idx, 'lost', Number(e.target.value))}
                        className="w-16 rounded-md border border-red-200 bg-red-50/50 py-1 text-center text-sm font-semibold text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-60"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        placeholder="Nhập ghi chú thiết bị..."
                        value={item.note}
                        disabled={isDone}
                        onChange={(e) => updateItem(idx, 'note', e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-60"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                  <td colSpan={3} className="px-3 py-3 text-right">
                    TỔNG CỘNG
                  </td>
                  <td className="px-3 py-3 text-center">{totals.totalToReturn}</td>
                  <td className="px-3 py-3 text-center text-emerald-600">{totals.intact}</td>
                  <td className="px-3 py-3 text-center text-amber-600">{totals.damaged}</td>
                  <td className="px-3 py-3 text-center text-red-600">{totals.lost}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

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
              {items.map((item) => {
                const after = computeAfter(item);
                return (
                  <div key={item.itemName}>
                    <p className="text-sm font-bold text-slate-800">{item.itemName}</p>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
                      <li className="flex items-center justify-between gap-2">
                        <span>Tổng số lượng sau hoàn kho:</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">
                          {item.warehouseBefore.totalStock} - {item.lost} = {after.totalAfter}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Số lượng hỏng sau hoàn kho:</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">
                          {item.warehouseBefore.damagedStock} + {item.damaged} = {after.damagedAfter}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Số lượng khóa sau hoàn kho:</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono font-semibold text-blue-700">
                          {item.warehouseBefore.lockedStock} - {item.totalToReturn} = {after.lockedAfter}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 font-bold text-slate-700">
                        <span>Số lượng khả dụng:</span>
                        <span className="rounded-md bg-blue-600 px-2 py-0.5 font-mono font-bold text-white">
                          {after.totalAfter} - {after.damagedAfter} - {after.lockedAfter} = {after.availableAfter}
                        </span>
                      </li>
                    </ul>
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
              Đã xác nhận hoàn kho{actualReturnDate ? ` ngày ${formatDate(actualReturnDate)}` : ''}
            </p>
          ) : (
            <Button onClick={handleConfirm} className="mt-4 w-full justify-center">
              <CheckCircle2 className="h-4 w-4" />
              Xác nhận hoàn kho
            </Button>
          )}
        </Reveal>
      </div>
    </div>
  );
}
