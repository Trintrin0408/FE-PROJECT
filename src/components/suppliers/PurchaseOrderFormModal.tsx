'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import { orderApiService } from '@/services/order.service';
import { supplierApiService } from '@/services/supplier.service';
import { catalogApiService } from '@/services/catalog.service';
import type { Order } from '@/types/order';
import type { Supplier, SupplierItem, SupplierTransaction, TransactionItemInput, CreateSupplierTransactionPayload, UpdateSupplierTransactionPayload } from '@/types/supplier';
import type { ItemSupplierDetails } from '@/types/catalog';
import type { CollectedEquipmentReport } from '@/types/collectedEquipmentReport';
import { inventoryApiService } from '@/services/inventory.service';
import {
  SUPPLIER_TRANSACTION_TYPE_META,
  type SupplierTransactionType,
  type SupplierTransactionStatus,
  type SupplierTransactionPaymentStatus,
} from '@/constants/supplier-transaction-status';
import toast from 'react-hot-toast';

/** Prefill khi mở modal để tạo nhanh 1 đơn thuê/mua đã gắn sẵn đơn hàng + hạng mục thiếu — dùng bởi CTA
 * "Thiếu {n} · Thuê từ NCC" ở tab Thiết bị & Kho hàng của Đơn hàng (src/app/manager/orders/[id]/page.tsx).
 * `itemId` là itemId catalog thật, dùng để tra NCC nào thật sự có hạng mục này qua getItemSuppliers. */
export interface CreateFormPrefill {
  orderId: string;
  itemId?: string;
  itemName: string;
  qty: number;
}

interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  transaction: SupplierTransaction | null;
  /** Chỉ dùng ở mode 'create'. */
  prefill?: CreateFormPrefill | null;
  onClose: () => void;
  /** Modal tự gọi supplierApiService và tự đóng qua onClose() sau khi thành công (giống
   * CreateSupplierTransactionModal.tsx/UpdateSupplierTransactionModal.tsx) — onSuccess chỉ để báo trang
   * cha refetch danh sách, không nhận lại form values như trước (khi còn dùng mock). */
  onSuccess: () => void;
}

const EMPTY_ITEM: TransactionItemInput = { itemId: '', itemName: '', quantity: 1, unitCost: 0 };

export default function PurchaseOrderFormModal({ isOpen, mode, transaction, prefill = null, onClose, onSuccess }: Readonly<PurchaseOrderFormModalProps>) {
  const [supplierId, setSupplierId] = useState('');
  const [transactionType, setTransactionType] = useState<SupplierTransactionType>('RENTAL');
  const [serviceTitle, setServiceTitle] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [orderId, setOrderId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SupplierTransactionStatus>('PENDING');
  const [paymentStatus, setPaymentStatus] = useState<SupplierTransactionPaymentStatus>('UNPAID');
  const [items, setItems] = useState<TransactionItemInput[]>([EMPTY_ITEM]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  // true ngay khi đã thử tự điền hạng mục theo prefill (dù thành công hay không) — chỉ thử đúng 1 lần
  // sau khi supplierItems nạp xong lần đầu, tránh điền đè lại mỗi khi người dùng đổi NCC qua lại (cùng
  // dạng lỗi snap-back đã sửa cho "Ngày dự kiến" ở bản mock trước đây).
  const [prefillApplied, setPrefillApplied] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [matchingSuppliers, setMatchingSuppliers] = useState<ItemSupplierDetails[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [reports, setReports] = useState<CollectedEquipmentReport[]>([]);

  // Reset form — lazy khi mở lại (không phải effect): tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect), cùng pattern đã dùng ở bản mock trước đây của file này.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setPrefillApplied(false);
      if (mode === 'edit' && transaction) {
        setSupplierId(transaction.supplierId);
        setTransactionType(transaction.transactionType as SupplierTransactionType);
        setServiceTitle(transaction.serviceTitle);
        setDepositAmount(transaction.depositAmount);
        setOrderId(transaction.orderId ?? undefined);
        setStatus(transaction.status as SupplierTransactionStatus);
        setPaymentStatus(transaction.paymentStatus as SupplierTransactionPaymentStatus);
        setItems([]); // nạp qua getTransactionById ở effect bên dưới (SupplierTransaction list-shape không có items)
      } else {
        setSupplierId('');
        setTransactionType('RENTAL');
        setServiceTitle(prefill ? `Thuê bổ sung: ${prefill.itemName}` : '');
        setDepositAmount(0);
        setOrderId(prefill?.orderId);
        setStatus('PENDING');
        setPaymentStatus('UNPAID');
        setItems(prefill ? [{ ...EMPTY_ITEM, itemName: prefill.itemName, quantity: prefill.qty }] : [EMPTY_ITEM]);
      }
    }
  }

  // Danh sách đơn hàng thật cho dropdown "Đơn hàng liên kết" — đơn được trỏ tới từ prefill/giao dịch đang
  // sửa luôn được đảm bảo có mặt dù không nằm trong 100 đơn gần nhất.
  useEffect(() => {
    if (!isOpen) return;
    orderApiService
      .getOrders({ limit: 100 })
      .then((res) => setOrders((res.data as Order[]) ?? []))
      .catch(() => setOrders([]));
  }, [isOpen]);

  useEffect(() => {
    const targetOrderId = prefill?.orderId || (mode === 'edit' ? transaction?.orderId ?? undefined : undefined);
    if (!isOpen || !targetOrderId) return;
    orderApiService
      .getOrder(targetOrderId)
      .then((res) => {
        const o = res.data as Order | undefined;
        if (!o) return;
        setOrders((prev) => (prev.some((p) => p.orderId === o.orderId) ? prev : [o, ...prev]));
      })
      .catch(() => {});
  }, [isOpen, prefill?.orderId, mode, transaction?.orderId]);

  // Danh sách NCC — chỉ cần ở mode create (mode edit hiện NCC cố định từ transaction.supplierName sẵn
  // có, không cần fetch). Ưu tiên NCC thật sự khai báo prefill.itemId (qua catalogApiService.getItemSuppliers)
  // — nếu rỗng/lỗi thì rơi về toàn bộ NCC đang hợp tác, không toast lỗi vì đây chỉ là gợi ý tiện lợi.
  useEffect(() => {
    if (!isOpen || mode !== 'create') return;
    let cancelled = false;
    Promise.all([
      supplierApiService.getSuppliers({ status: 'ACTIVE', limit: 100 }).catch(() => ({ data: [] as Supplier[] })),
      prefill?.itemId
        ? catalogApiService
            .getItemSuppliers(prefill.itemId)
            .then((res) => ((res?.data || res || []) as ItemSupplierDetails[]))
            .catch(() => [] as ItemSupplierDetails[])
        : Promise.resolve([] as ItemSupplierDetails[]),
    ]).then(([suppliersRes, itemSuppliers]) => {
      if (cancelled) return;
      const activeItemSuppliers = itemSuppliers.filter((s) => s.isActive);
      setAllSuppliers(suppliersRes.data || []);
      setMatchingSuppliers(activeItemSuppliers);
      if (activeItemSuppliers.length === 1) {
        setSupplierId(activeItemSuppliers[0].supplierId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, prefill?.itemId]);

  // Hạng mục thật của NCC đang chọn — supplierId là state phản ứng theo lựa chọn người dùng (khác 2 modal
  // tham chiếu, ở đó supplierId là prop cố định) nên PHẢI dùng cờ cancelled: đổi NCC nhanh 2 lần có thể
  // khiến response chậm của lần chọn trước ghi đè dữ liệu của lần chọn sau.
  useEffect(() => {
    if (!isOpen || !supplierId) return;
    let cancelled = false;
    supplierApiService
      .getSupplierItems(supplierId)
      .then((res) => {
        if (cancelled) return;
        const list = ((res as unknown as { data?: SupplierItem[] })?.data || res || []).filter((i) => i.isActive);
        setSupplierItems(list);
        if (!prefillApplied && prefill?.itemId) {
          const match = list.find((si) => si.itemId === prefill.itemId);
          if (match) {
            setItems((prev) => {
              const next = [...prev];
              next[0] = {
                itemId: match.itemId,
                itemName: match.itemName,
                quantity: prefill.qty,
                unitCost: (transactionType === 'RENTAL' ? match.rentalPrice : match.purchasePrice) ?? undefined,
              };
              return next;
            });
          }
          setPrefillApplied(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSupplierItems([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi đổi NCC, không phải khi transactionType/prefillApplied đổi
  }, [isOpen, supplierId]);

  // Chi tiết giao dịch (kèm items) khi sửa — SupplierTransaction (list-shape) không có items, phải gọi
  // riêng getTransactionById, đúng pattern UpdateSupplierTransactionModal.tsx.
  useEffect(() => {
    if (!isOpen || mode !== 'edit' || !transaction) return;
    let cancelled = false;
    supplierApiService
      .getTransactionById(transaction.transactionId)
      .then((res) => {
        if (cancelled) return;
        const detail = (res as unknown as { data?: SupplierTransaction & { items?: TransactionItemInput[] } })?.data || res;
        const rawItems = (detail as { items?: TransactionItemInput[] })?.items || [];
        if (rawItems.length > 0) {
          setItems(
            rawItems.map((it) => ({
              itemId: it.itemId || '',
              itemName: it.itemName || '',
              quantity: it.quantity,
              unitCost: it.unitCost ?? 0,
            })),
          );
        }
        if ((detail as any).transactionType === 'RENTAL') {
          inventoryApiService.getReturnReports({ transactionId: transaction.transactionId })
            .then(res => setReports(res.data as CollectedEquipmentReport[]))
            .catch(() => setReports([]));
        } else {
          setReports([]);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Lỗi khi tải chi tiết giao dịch');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, transaction]);

  const selectedOrder = orders.find((o) => o.orderId === orderId) ?? null;
  const isLocked = mode === 'edit' && (status === 'COMPLETED' || status === 'CANCELLED');
  const isPending = mode === 'create' || !transaction || transaction.status === 'PENDING';

  const supplierOptions =
    mode === 'edit' && transaction
      ? [{ value: transaction.supplierId, label: transaction.supplierName }]
      : (matchingSuppliers.length > 0
          ? matchingSuppliers.map((s) => ({ value: s.supplierId, label: s.supplierName }))
          : allSuppliers.map((s) => ({ value: s.supplierId, label: s.supplierName }))
        );

  const addItemRow = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItemRow = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItemRow = (idx: number, itemId: string) => {
    const match = supplierItems.find((si) => si.itemId === itemId);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              itemId,
              itemName: match?.itemName ?? it.itemName,
              unitCost: match ? ((transactionType === 'RENTAL' ? match.rentalPrice : match.purchasePrice) ?? undefined) : it.unitCost,
            }
          : it,
      ),
    );
  };
  const updateItemField = (idx: number, patch: Partial<TransactionItemInput>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const itemsTotal = items.reduce((sum, it) => sum + it.quantity * (it.unitCost ?? 0), 0);

  const handleSubmit = async () => {
    if (mode === 'edit' && !transaction) return;
    if (transactionType === 'RENTAL' && !orderId) {
      toast.error('Giao dịch thuê ngoài bắt buộc phải chọn đơn hàng liên kết');
      return;
    }
    if (!serviceTitle.trim()) {
      toast.error('Vui lòng nhập nội dung yêu cầu');
      return;
    }
    const validItems = items.filter((it) => it.itemId);
    if (validItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 hạng mục');
      return;
    }
    if (validItems.some((it) => it.quantity <= 0)) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreateSupplierTransactionPayload = {
          supplierId,
          orderId: orderId || undefined,
          transactionType,
          serviceTitle: serviceTitle.trim(),
          depositAmount,
          items: validItems,
        };
        await supplierApiService.createSupplierTransaction(payload);
        toast.success('Tạo giao dịch thành công');
      } else if (transaction) {
        if (transaction.status === 'PENDING') {
          const payload: UpdateSupplierTransactionPayload = {
            serviceTitle: serviceTitle.trim(),
            depositAmount,
            items: validItems,
          };
          await supplierApiService.updateSupplierTransaction(transaction.transactionId, payload);
        }
        if (status !== transaction.status) {
          await supplierApiService.updateTransactionStatus(transaction.transactionId, status);
        }
        if (paymentStatus !== transaction.paymentStatus) {
          await supplierApiService.updateTransactionPaymentStatus(transaction.transactionId, paymentStatus);
        }
        toast.success('Đã cập nhật giao dịch thành công');
      }
      onSuccess();
      onClose();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || (mode === 'create' ? 'Có lỗi xảy ra khi tạo giao dịch' : 'Có lỗi xảy ra khi cập nhật giao dịch'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Tạo đơn thuê/mua mới' : 'Chỉnh sửa đơn thuê/mua'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          {!isLocked && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo đơn' : 'Lưu thay đổi'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Nhà cung cấp"
          required
          disabled={mode === 'edit'}
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          options={supplierOptions}
          placeholder="-- Chọn nhà cung cấp --"
        />
        {mode === 'create' &&
          prefill?.itemName &&
          (matchingSuppliers.length > 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Đã lọc <span className="font-semibold text-slate-800">{matchingSuppliers.length}</span> nhà cung cấp có sẵn &quot;
              {prefill.itemName}&quot;.
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Chưa có nhà cung cấp nào khai báo &quot;{prefill.itemName}&quot; trong catalog — hiển thị tất cả nhà cung cấp.
            </p>
          ))}

        <Input
          label="Nội dung yêu cầu"
          required
          value={serviceTitle}
          onChange={(e) => setServiceTitle(e.target.value)}
          placeholder="VD: Bộ âm thanh ánh sáng tiệc cưới chuyên nghiệp"
          disabled={!isPending}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Loại đơn"
            disabled={mode === 'edit'}
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as SupplierTransactionType)}
            options={Object.entries(SUPPLIER_TRANSACTION_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))}
          />
          <Select
            label="Đơn hàng liên kết"
            required={transactionType === 'RENTAL'}
            disabled={mode === 'edit'}
            value={orderId ?? ''}
            onChange={(e) => setOrderId(e.target.value || undefined)}
            options={orders.map((o) => ({ value: o.orderId, label: `${o.orderCode} — ${o.customerName}` }))}
            placeholder={transactionType === 'RENTAL' ? '-- Chọn đơn hàng --' : '-- Nhập kho trực tiếp (không gắn đơn) --'}
          />
        </div>
        {selectedOrder && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Sự kiện: <span className="font-semibold text-slate-800">Lễ cưới {selectedOrder.customerName}</span> ({selectedOrder.orderCode})
          </p>
        )}

        {mode === 'edit' && transaction && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Trạng thái giao dịch"
                disabled={isLocked}
                value={status}
                onChange={(e) => setStatus(e.target.value as SupplierTransactionStatus)}
                options={
                  transaction.status === 'PENDING'
                    ? [
                        { value: 'PENDING', label: 'Chờ duyệt' },
                        { value: 'APPROVED', label: 'Đã duyệt' },
                        { value: 'CANCELLED', label: 'Đã hủy' },
                      ]
                    : transaction.status === 'APPROVED'
                      ? [
                          { value: 'APPROVED', label: 'Đã duyệt' },
                          { value: 'RECEIVED', label: 'Đã nhận' },
                          { value: 'CANCELLED', label: 'Đã hủy' },
                        ]
                      : transaction.status === 'RECEIVED'
                        ? [
                            { value: 'RECEIVED', label: 'Đã nhận' },
                            { value: 'COMPLETED', label: 'Hoàn thành' },
                          ]
                        : [{ value: transaction.status, label: transaction.status === 'COMPLETED' ? 'Hoàn thành' : 'Đã hủy' }]
                }
              />
              <Select
                label="Trạng thái thanh toán"
                disabled={isLocked}
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as SupplierTransactionPaymentStatus)}
                options={[
                  { value: 'UNPAID', label: 'Chưa thanh toán' },
                  { value: 'DEPOSITED', label: 'Đã đặt cọc' },
                  { value: 'PAID', label: 'Đã thanh toán' },
                ]}
              />
            </div>
            {status === 'APPROVED' && transaction.status === 'PENDING' && (
              <p className="text-sm font-medium text-amber-600">
                Lưu ý: Sau khi chuyển sang Đã duyệt và lưu lại, sẽ không thể sửa hạng mục của giao dịch này nữa.
              </p>
            )}
            <p className="text-xs text-slate-400">
              Ngày tạo: {formatDate(transaction.createdAt)}
              {transaction.updater?.fullName ? ` · Người cập nhật cuối: ${transaction.updater.fullName}` : ''}
            </p>
          </>
        )}

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Hạng mục thuê/mua</label>
            {isPending && (
              <button type="button" onClick={addItemRow} className="text-xs font-semibold text-blue-600 hover:underline">
                + Thêm hạng mục
              </button>
            )}
          </div>
          {!supplierId ? (
            <p className="text-xs text-slate-400">Chọn nhà cung cấp để xem danh sách hạng mục.</p>
          ) : (
            items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-5">
                  <Select
                    disabled={!isPending}
                    value={it.itemId}
                    onChange={(e) => updateItemRow(idx, e.target.value)}
                    options={
                      it.itemId && !supplierItems.some((si) => si.itemId === it.itemId)
                        ? [...supplierItems.map((si) => ({ value: si.itemId, label: si.itemName })), { value: it.itemId, label: `${it.itemName || 'Hạng mục'} (đã bị xoá)` }]
                        : supplierItems.map((si) => ({ value: si.itemId, label: si.itemName }))
                    }
                    placeholder="-- Chọn hạng mục --"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="SL"
                    value={it.quantity}
                    disabled={!isPending}
                    onChange={(e) => updateItemField(idx, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Đơn giá"
                    value={it.unitCost ?? 0}
                    disabled={!isPending}
                    onChange={(e) => updateItemField(idx, { unitCost: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2 text-right">
                  {isPending && items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(idx)} className="text-xs font-medium text-red-500 hover:underline">
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {items.length > 0 && <p className="text-right text-xs font-semibold text-slate-600">Tổng theo hạng mục: {formatCurrency(itemsTotal)}</p>}
          
          {reports.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Vật tư thu hồi &amp; Phí đền bù</h4>
              {reports.map((report) => {
                let reportPenalty = 0;
                return (
                  <div key={report.reportId} className="mb-3 rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">Biên bản: {report.reportId.slice(0, 8)}...</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${report.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {report.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                      </span>
                    </div>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-1 font-medium">Hạng mục</th>
                          <th className="pb-1 text-center font-medium">Tổng</th>
                          <th className="pb-1 text-center font-medium text-emerald-600">Tốt</th>
                          <th className="pb-1 text-center font-medium text-red-600">Hỏng</th>
                          <th className="pb-1 text-center font-medium text-amber-600">Mất</th>
                          <th className="pb-1 text-right font-medium">Phí</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.items.map((item, idx) => {
                          const penaltyQty = item.damagedQuantity + item.lostQuantity;
                          const totalQty = item.goodQuantity + item.damagedQuantity + item.lostQuantity;
                          const supplierItem = supplierItems.find(si => si.itemId === item.itemId);
                          const purchasePrice = supplierItem?.purchasePrice ?? 0;
                          const linePenalty = purchasePrice * penaltyQty;
                          reportPenalty += linePenalty;
                          return (
                            <tr key={idx} className="border-b border-slate-100">
                              <td className="py-1 text-slate-700">{item.itemName}</td>
                              <td className="py-1 text-center font-medium text-slate-700">{totalQty}</td>
                              <td className="py-1 text-center font-medium text-emerald-600">{item.goodQuantity}</td>
                              <td className="py-1 text-center font-medium text-red-600">{item.damagedQuantity}</td>
                              <td className="py-1 text-center font-medium text-amber-600">{item.lostQuantity}</td>
                              <td className="py-1 text-right text-slate-700">{formatCurrency(linePenalty)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reportPenalty > 0 ? (
                      <div className="mt-2 text-right text-xs font-semibold text-red-600">
                        Cộng thêm phí đền bù: {formatCurrency(reportPenalty)}
                      </div>
                    ) : (
                      <div className="mt-2 text-right text-xs text-slate-500">
                        Không phát sinh phí đền bù
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Input
          label="Đặt cọc"
          type="number"
          min={0}
          disabled={!isPending}
          value={depositAmount}
          onChange={(e) => setDepositAmount(Number(e.target.value))}
        />
      </div>
    </Modal>
  );
}
