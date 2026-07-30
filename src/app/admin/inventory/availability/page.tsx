'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, Search } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { orderApiService } from '@/services/order.service';
import { inventoryApiService } from '@/services/inventory.service';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/formatDate';
import type { Order } from '@/types/order';
import type { PicklistItem } from '@/types/inventory';

interface ReservationRow {
  id: string; // orderItemId + source
  orderId: string;
  orderCode: string;
  customerName: string;
  eventDate: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityAvailable: number; // For INTERNAL items only
}

export default function AdminAvailabilityPage() {
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [dateFilter, setDateFilter] = useState('');
  const [onlyShortage, setOnlyShortage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    async function loadData() {
      try {
        const orderRes = await orderApiService.getOrders({ orderStatus: 'CONFIRMED,IN_PROGRESS', limit: 100 });
        const orders = orderRes.data ?? [];
        
        // Fetch picklist for all active orders
        const picklistPromises = orders.map(async (order) => {
          try {
            const res = await inventoryApiService.getPicklist(order.orderId);
            return { order, items: (res.data ?? []) as PicklistItem[] };
          } catch {
            return { order, items: [] as PicklistItem[] };
          }
        });

        const picklistResults = await Promise.all(picklistPromises);
        
        if (cancelled) return;

        // Flatten to ReservationRow
        const flattened: ReservationRow[] = [];
        picklistResults.forEach(({ order, items }) => {
          items.forEach((item) => {
            // We only care about INTERNAL items for stock availability
            if (item.source !== 'INTERNAL') return;
            
            flattened.push({
              id: `${item.orderItemId}-${item.source}`,
              orderId: order.orderId,
              orderCode: order.orderCode,
              customerName: order.customerName,
              eventDate: order.eventDate,
              itemId: item.itemId,
              itemName: item.itemName,
              unit: item.unit,
              quantityOrdered: item.quantityOrdered,
              quantityAvailable: item.quantityAvailable ?? 0,
            });
          });
        });

        // Sort by eventDate ascending
        flattened.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

        setRows(flattened);
      } catch (error) {
        if (!cancelled) setLoadError('Lỗi khi tải dữ liệu. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (dateFilter && (!row.eventDate || !row.eventDate.startsWith(dateFilter))) return false;
      
      const shortage = Math.max(0, row.quantityOrdered - row.quantityAvailable);
      if (onlyShortage && shortage <= 0) return false;

      if (!term) return true;
      return (
        row.orderCode.toLowerCase().includes(term) ||
        row.customerName.toLowerCase().includes(term) ||
        row.itemName.toLowerCase().includes(term)
      );
    });
  }, [rows, search, dateFilter, onlyShortage]);

  const columns: TableColumn<ReservationRow>[] = [
    {
      key: 'orderCode',
      label: 'Đơn hàng',
      render: (row) => (
        <Link href={`/admin/orders_audit/${row.orderId}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
          {row.orderCode}
        </Link>
      ),
    },
    { key: 'customerName', label: 'Khách hàng', render: (row) => <span className="font-medium text-slate-800">{row.customerName}</span> },
    { key: 'eventDate', label: 'Ngày sự kiện', render: (row) => <span className="font-mono text-slate-600">{formatDate(row.eventDate)}</span> },
    {
      key: 'itemName',
      label: 'Thiết bị cần xuất',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.itemName}</p>
          <p className="font-mono text-[10px] text-slate-400">{row.itemId}</p>
        </div>
      ),
    },
    { key: 'quantityOrdered', label: 'SL Cần', className: 'text-center font-bold text-slate-800', render: (row) => row.quantityOrdered },
    {
      key: 'status',
      label: 'Trạng thái cấp phát',
      className: 'text-center',
      render: (row) => {
        const shortage = Math.max(0, row.quantityOrdered - row.quantityAvailable);
        if (shortage > 0) {
          return (
            <div className="flex flex-col items-center justify-center">
              <span className="font-bold text-red-600">Thiếu {shortage}</span>
              <span className="text-[10px] text-slate-500">(Kho hiện có: {row.quantityAvailable})</span>
            </div>
          );
        }
        return <span className="font-bold text-emerald-600">✓ Đủ hàng</span>;
      },
    },
  ];

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thiết bị đang bị giữ theo đơn</h1>
        <p className="mt-1 text-sm text-slate-500">Xem danh sách thiết bị đang bị "giữ chỗ" bởi các đơn đặt hàng đã xác nhận nhưng chưa xuất kho.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.25 }}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo mã đơn, khách hàng, tên thiết bị..."
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-3 text-sm hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 hover:bg-slate-50">
               <Calendar className="h-4 w-4 text-slate-400" />
               <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-sm focus:outline-none"
              />
            </div>
            
            <button
              type="button"
              onClick={() => setOnlyShortage(!onlyShortage)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                onlyShortage
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Chỉ hiện đơn thiếu hàng
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 flex justify-center"><p className="text-sm text-slate-400">Đang tải danh sách thiết bị...</p></div>
        ) : loadError ? (
          <div className="mt-8 text-center text-sm text-red-500">{loadError}</div>
        ) : rows.length === 0 ? (
           <div className="mt-8 text-center text-sm text-slate-400">Hiện không có thiết bị nào đang bị giữ bởi đơn hàng.</div>
        ) : (
          <div className="mt-4">
            <Table columns={columns} rows={filteredRows} rowKey={(row) => row.id} />
          </div>
        )}
      </motion.div>
    </div>
  );
}
