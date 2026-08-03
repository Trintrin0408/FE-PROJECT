import { FormEvent, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Box, Layers, ImageIcon, Bold, Italic, List, ListOrdered, Link as LinkIcon, Calendar, Trash2 } from 'lucide-react';
import type { Item, ItemType, ItemStatus, ItemComponentDTO } from '@/types/catalog';
import { SelectComponentModal } from './SelectComponentModal';

export interface CatalogItemFormValues {
  itemCode: string;
  itemName: string;
  description: string;
  unit: string;
  rentalPrice: number;
  purchasePrice?: number;
  typeId: string;
  status?: ItemStatus;
  components?: { componentItemId: string; quantity: number }[];
}

interface CatalogItemFormProps {
  mode: 'create' | 'edit';
  item?: Item | null;
  types: ItemType[];
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (values: CatalogItemFormValues) => void;
  onCancel: () => void;
}

const EMPTY_VALUES: CatalogItemFormValues = {
  itemCode: '',
  itemName: '',
  description: '',
  unit: 'Cái',
  rentalPrice: 0,
  purchasePrice: 0,
  typeId: '',
  status: 'ACTIVE',
  components: [],
};

export function CatalogItemForm({
  mode,
  item,
  types,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: Readonly<CatalogItemFormProps>) {
  const [values, setValues] = useState<CatalogItemFormValues>(EMPTY_VALUES);
  const [validationError, setValidationError] = useState('');
  const [isCombo, setIsCombo] = useState(false);
  
  // BOM States
  const [components, setComponents] = useState<ItemComponentDTO[]>([]);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);

  useEffect(() => {
    setValidationError('');
    if (mode === 'edit' && item) {
      setValues({
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description ?? '',
        unit: item.unit,
        rentalPrice: item.rentalPrice,
        purchasePrice: item.purchasePrice ?? 0,
        typeId: item.typeId,
        status: item.status,
        components: [],
      });
      setIsCombo(item.isCombo);
      if (item.isCombo && item.components) {
        // Because the item object we receive might not have full ItemComponentDTO in it,
        // we'll assume the parent component fetches and passes the full array via item.components
        setComponents((item.components as unknown) as ItemComponentDTO[] || []);
      } else {
        setComponents([]);
      }
    } else {
      setValues(EMPTY_VALUES);
      setIsCombo(false);
      setComponents([]);
    }
  }, [mode, item]);

  const handleSetCombo = (combo: boolean) => {
    setIsCombo(combo);
    if (combo) {
      setValues((v) => ({ ...v, unit: 'Bộ' }));
    } else {
      setValues((v) => ({ ...v, unit: 'Cái' }));
    }
  };

  const generateCode = () => {
    setValues((v) => ({ ...v, itemCode: `EQ-${Math.floor(1000 + Math.random() * 9000)}` }));
  };

  const handleSubmit = () => {
    if (!values.itemName.trim()) {
      setValidationError('Vui lòng nhập tên thiết bị');
      return;
    }
    if (!values.typeId) {
      setValidationError('Vui lòng chọn thuộc nhóm thiết bị');
      return;
    }
    if (values.rentalPrice <= 0) {
      setValidationError('Giá cho thuê phải lớn hơn 0');
      return;
    }
    
    if (isCombo && components.length === 0) {
      setValidationError('Vui lòng thêm ít nhất một thiết bị con cho Combo');
      return;
    }
    
    setValidationError('');
    onSubmit({
      ...values,
      components: isCombo ? components.map(c => ({ componentItemId: c.childItemId, quantity: c.quantity })) : [],
    });
  };

  const maxComboAvailable = useMemo(() => {
    if (components.length === 0) return 0;
    return Math.min(...components.map(c => Math.floor(c.quantityAvailable / c.quantity)));
  }, [components]);

  const handleAddComponent = (comp: ItemComponentDTO) => {
    setComponents(prev => [...prev, comp]);
  };

  const handleRemoveComponent = (childItemId: string) => {
    setComponents(prev => prev.filter(c => c.childItemId !== childItemId));
  };

  const handleUpdateComponentQuantity = (childItemId: string, quantity: number) => {
    setComponents(prev => prev.map(c => c.childItemId === childItemId ? { ...c, quantity } : c));
  };

  const typeOptions = types.map((t) => ({ value: t.typeId, label: t.typeName }));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{mode === 'create' ? 'Thêm thiết bị' : 'Chỉnh sửa thiết bị'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isCombo ? 'Khai báo thông tin, giá và cấu kiện của Combo' : 'Khai báo thông tin cơ bản và giá'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} className="bg-white border-slate-200 text-slate-700 w-24 justify-center">
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit} isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] justify-center shadow-sm">
            {mode === 'create' ? 'Lưu thiết bị' : 'Cập nhật'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 relative max-w-7xl mx-auto w-full">
        {(validationError || errorMessage) && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg border border-red-100 text-sm font-medium shadow-sm">
            {validationError || errorMessage}
          </div>
        )}

        {/* Loại sản phẩm */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-[15px] font-bold text-slate-900 mb-5">Loại sản phẩm <span className="text-red-500">*</span></h3>
          <div className="flex flex-col sm:flex-row gap-4 max-w-3xl">
            {/* Đơn lẻ */}
            <label className={`flex-1 relative flex cursor-pointer rounded-xl border p-5 transition-colors ${!isCombo ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="productType" className="sr-only" checked={!isCombo} onChange={() => handleSetCombo(false)} disabled={mode === 'edit'} />
              <div className="flex items-center gap-4">
                <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${!isCombo ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                  {!isCombo && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <div className="flex items-center gap-3 text-slate-700">
                  <Box className={`w-6 h-6 ${!isCombo ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-medium text-base ${!isCombo ? 'text-blue-600' : ''}`}>Thiết bị đơn lẻ</span>
                </div>
              </div>
            </label>

            {/* Combo */}
            <label className={`flex-1 relative flex cursor-pointer rounded-xl border p-5 transition-colors ${isCombo ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="productType" className="sr-only" checked={isCombo} onChange={() => handleSetCombo(true)} disabled={mode === 'edit'} />
              <div className="flex items-center gap-4">
                <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${isCombo ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                  {isCombo && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <div className="flex items-center gap-3 text-slate-700">
                  <Layers className={`w-6 h-6 ${isCombo ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-medium text-base ${isCombo ? 'text-blue-600' : ''}`}>Combo / Ghép bộ</span>
                </div>
              </div>
            </label>
          </div>
          <p className="mt-4 text-sm text-slate-500">Loại sản phẩm không thể thay đổi sau khi lưu.</p>
        </div>

        {/* A & B Container */}
        <div className={`flex flex-col gap-8`}>
          
          {/* A. Thông tin chung */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[15px] font-bold text-slate-900 mb-6">A. Thông tin chung</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Mã thiết bị</label>
                  {mode === 'create' && (
                    <button type="button" onClick={generateCode} className="text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none">
                      Sinh mã tự động
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  disabled={mode === 'edit'}
                  value={values.itemCode}
                  onChange={(e) => setValues((v) => ({ ...v, itemCode: e.target.value }))}
                  placeholder={isCombo ? "Hệ thống tự động sinh nếu để trống" : "Hệ thống tự động sinh nếu để trống"}
                  className="block w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 transition-shadow"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Tên thiết bị <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={values.itemName}
                  onChange={(e) => setValues((v) => ({ ...v, itemName: e.target.value }))}
                  placeholder={isCombo ? "VD: Bộ bàn tiệc 6 ghế" : "VD: Bàn tròn 1m8"}
                  className="block w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
                />
              </div>

              <Select
                label="Thuộc nhóm thiết bị *"
                required
                value={values.typeId}
                onChange={(e) => setValues((v) => ({ ...v, typeId: e.target.value }))}
                options={typeOptions}
                placeholder="Chọn nhóm thiết bị"
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Đơn vị tính *"
                  required
                  value={values.unit}
                  onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
                  options={isCombo 
                    ? [{ value: 'Bộ', label: 'Bộ' }, { value: 'Gói', label: 'Gói' }, { value: 'Hệ thống', label: 'Hệ thống' }]
                    : [{ value: 'Cái', label: 'Cái' }, { value: 'Chiếc', label: 'Chiếc' }, { value: 'Mét', label: 'Mét' }]}
                />
                
                <Select
                  label="Trạng thái *"
                  required
                  value={values.status ?? 'ACTIVE'}
                  onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ItemStatus }))}
                  options={[
                    { value: 'ACTIVE', label: 'Hoạt động' },
                    { value: 'INACTIVE', label: 'Không hoạt động' },
                  ]}
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-6">
              <label className="text-sm font-medium text-slate-700">Mô tả chi tiết</label>
              <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
                <div className="relative">
                  <textarea
                    rows={4}
                    value={values.description}
                    onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                    className="w-full p-3.5 pb-8 text-[14px] focus:outline-none resize-y min-h-[100px]"
                    placeholder={isCombo ? "Nhập mô tả chi tiết về bộ thiết bị..." : "Nhập mô tả chi tiết (nếu có)..."}
                  />
                  <span className="absolute bottom-3 right-3 text-[12px] text-slate-400 font-medium">{values.description.length} / 1000</span>
                </div>
              </div>
            </div>
          </div>

          {/* B. Cấu hình giá */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
            <h3 className="text-[15px] font-bold text-slate-900 mb-6">B. Cấu hình giá</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">{isCombo ? 'Giá cho thuê trọn bộ' : 'Giá cho thuê'} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={values.rentalPrice === 0 ? '' : values.rentalPrice}
                    onChange={(e) => setValues((v) => ({ ...v, rentalPrice: Number(e.target.value) }))}
                    className="block w-full rounded-lg border border-slate-200 pl-3.5 pr-10 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow font-medium text-slate-900"
                    placeholder="0"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-medium">đ</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">{isCombo ? 'Giá đền bù bộ' : 'Giá đền bù / Mua mới'}</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={values.purchasePrice === 0 ? '' : values.purchasePrice}
                    onChange={(e) => setValues((v) => ({ ...v, purchasePrice: Number(e.target.value) }))}
                    className="block w-full rounded-lg border border-slate-200 pl-3.5 pr-10 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow font-medium text-slate-900"
                    placeholder="0"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">đ</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* C. Cấu hình BOM / Cấu kiện */}
        {isCombo && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">C. Cấu hình BOM / Cấu kiện</h3>
                <p className="text-sm text-slate-500 mt-1">Chỉ có thể chọn thiết bị đơn lẻ đang hoạt động.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setIsComponentModalOpen(true)} className="bg-white hover:bg-slate-50 text-slate-700">
                + Thêm thiết bị con
              </Button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4">Thiết bị con</th>
                    <th className="px-5 py-4 text-center w-28">Đơn vị</th>
                    <th className="px-5 py-4 text-center w-40">Tồn kho hiện tại</th>
                    <th className="px-5 py-4 text-center w-52">Số lượng cần trong bộ</th>
                    <th className="px-5 py-4 text-center w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {components.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                        Chưa có thiết bị con nào được chọn.
                      </td>
                    </tr>
                  ) : (
                    components.map((comp) => (
                      <tr key={comp.childItemId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{comp.childItemName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{comp.childItemCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center text-slate-600 font-medium">{comp.unit}</td>
                        <td className="px-5 py-4 text-center font-semibold text-emerald-600 text-base">{comp.quantityAvailable}</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <input 
                              type="number" 
                              value={comp.quantity || ''} 
                              onChange={(e) => handleUpdateComponentQuantity(comp.childItemId, parseInt(e.target.value) || 0)}
                              min={1} 
                              className="w-24 text-center border border-slate-200 rounded-lg py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium" 
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button type="button" onClick={() => handleRemoveComponent(comp.childItemId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="bg-emerald-50/50 border-t border-slate-200 p-4 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-emerald-200">
                  <span className="text-emerald-700 font-bold text-xs">✓</span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-emerald-800 mb-0.5">Khả dụng theo BOM: Có thể lắp tối đa {maxComboAvailable} bộ</p>
                  <p className="text-[13px] text-emerald-600">Tính theo cấu kiện có khả năng lắp ít nhất.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <SelectComponentModal 
        isOpen={isComponentModalOpen}
        onClose={() => setIsComponentModalOpen(false)}
        onSelect={handleAddComponent}
        existingComponentIds={components.map(c => c.childItemId)}
      />
    </div>
  );
}

export default CatalogItemForm;
