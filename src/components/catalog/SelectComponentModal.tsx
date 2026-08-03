import { useEffect, useState, useMemo } from 'react';
import { Search, X, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Item, ItemComponentDTO } from '@/types/catalog';
import { catalogApiService } from '@/services/catalog.service';

interface SelectComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: ItemComponentDTO) => void;
  existingComponentIds: string[];
}

export function SelectComponentModal({ isOpen, onClose, onSelect, existingComponentIds }: SelectComponentModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Fetch only single items (isCombo = false)
      catalogApiService.getItems({ isCombo: false })
        .then((res) => {
          setItems(res.data);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => !existingComponentIds.includes(item.itemId))
      .filter((item) => 
        item.itemName.toLowerCase().includes(search.toLowerCase()) || 
        item.itemCode.toLowerCase().includes(search.toLowerCase())
      );
  }, [items, search, existingComponentIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Thêm thiết bị con</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã hoặc tên thiết bị..."
              className="pl-9 bg-white"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <p>Không tìm thấy thiết bị nào phù hợp.</p>
              <p className="text-sm">Chỉ hiển thị các thiết bị đơn lẻ chưa được thêm vào.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group cursor-pointer"
                  onClick={() => {
                    onSelect({
                      componentId: '', // New components won't have an ID yet
                      childItemId: item.itemId,
                      childItemCode: item.itemCode,
                      childItemName: item.itemName,
                      unit: item.unit,
                      quantityAvailable: item.inventory?.quantityAvailable ?? 0,
                      quantity: 1, // Default quantity
                    });
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{item.itemName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.itemCode} • Tồn kho: {item.inventory?.quantityAvailable ?? 0} {item.unit}</div>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    Chọn
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
