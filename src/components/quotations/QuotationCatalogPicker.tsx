'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import type { InventoryRow } from '@/types/inventory';

// Khối "Chọn nhanh từ danh mục kho thiết bị có sẵn" dùng chung cho modal "Tạo báo giá mới" và chế độ
// sửa hạng mục ở trang chi tiết báo giá. Mọi hạng mục thêm vào báo giá bắt buộc gắn itemId thật (FK NOT
// NULL trên quotation_items — Hướng A đã chốt ở docs/taobaogiamoi_api.md mục 3.1) nên chọn từ catalog
// là đường duy nhất để thêm dòng mới; dữ liệu catalog truyền từ ngoài vào (GET /api/v1/inventory).
export default function QuotationCatalogPicker({
  catalogItems,
  isLoading,
  onPick,
}: Readonly<{ catalogItems: InventoryRow[]; isLoading: boolean; onPick: (item: InventoryRow) => void }>) {
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? catalogItems.filter((it) => (it.itemName ?? '').toLowerCase().includes(term)) : catalogItems;
    const map = new Map<string, InventoryRow[]>();
    filtered.forEach((it) => {
      const category = it.typeName ?? 'Khác';
      const bucket = map.get(category) ?? [];
      bucket.push(it);
      map.set(category, bucket);
    });
    return Array.from(map.entries()).map(([category, rows]) => ({ category, items: rows }));
  }, [catalogItems, search]);

  const toggleCategory = (category: string) =>
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold text-slate-500">Chọn nhanh từ danh mục kho thiết bị có sẵn:</p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm thiết bị theo tên..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="rounded-lg bg-white py-3 text-center text-xs text-slate-400">Đang tải danh mục thiết bị...</p>
        ) : (
          <>
            {groups.map((group) => {
              const isOpenGroup = search.trim() !== '' || openCategories.has(group.category);
              return (
                <div key={group.category} className="rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <span>
                      {group.category} <span className="font-normal text-slate-400">({group.items.length})</span>
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${isOpenGroup ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpenGroup && (
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
                      {group.items.map((catalogItem) => (
                        <button
                          key={catalogItem.itemId}
                          type="button"
                          onClick={() => onPick(catalogItem)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {catalogItem.itemName} <span>({formatCurrency(catalogItem.rentalPrice ?? 0)})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {groups.length === 0 && <p className="rounded-lg bg-white py-3 text-center text-xs italic text-slate-400">Không tìm thấy thiết bị phù hợp.</p>}
          </>
        )}
      </div>
    </div>
  );
}
