'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Box, Layers, ImageIcon, Bold, Italic, List, ListOrdered, Link as LinkIcon, Calendar, Trash2 } from 'lucide-react';
import type { Item, ItemType, ItemStatus } from '@/types/catalog';

export interface CatalogItemFormValues {
  itemCode: string;
  itemName: string;
  description: string;
  unit: string;
  rentalPrice: number;
  typeId: string;
  status?: ItemStatus;
}

interface CatalogItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  item?: Item | null;
  types: ItemType[];
  isSubmitting: boolean;
  errorMessage?: string;
  onSubmit: (values: CatalogItemFormValues) => void;
}

const EMPTY_VALUES: CatalogItemFormValues = {
  itemCode: '',
  itemName: '',
  description: '',
  unit: 'Cái',
  rentalPrice: 0,
  typeId: '',
  status: 'ACTIVE',
};

export function CatalogItemFormModal({
  isOpen,
  onClose,
  mode,
  item,
  types,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Readonly<CatalogItemFormModalProps>) {
  const [values, setValues] = useState<CatalogItemFormValues>(EMPTY_VALUES);
  const [validationError, setValidationError] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [isCombo, setIsCombo] = useState(false);

  useEffect(() => {
    if (isOpen !== wasOpen) {
      setWasOpen(isOpen);
      if (isOpen) {
        setValidationError('');
        if (mode === 'edit' && item) {
          setValues({
            itemCode: item.itemCode,
            itemName: item.itemName,
            description: item.description ?? '',
            unit: item.unit,
            rentalPrice: item.rentalPrice,
            typeId: item.typeId,
            status: item.status,
          });
          setIsCombo(item.unit.toLowerCase() === 'bộ');
        } else {
          setValues(EMPTY_VALUES);
          setIsCombo(false);
        }
      }
    }
  }, [isOpen, wasOpen, mode, item]);

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
    if (!values.itemCode.trim()) {
      setValidationError('Vui lòng nhập mã thiết bị');
      return;
    }
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
    
    setValidationError('');
    onSubmit(values);
  };

  const typeOptions = Object.entries(
    types.reduce(
      (acc, t) => {
        const cat = t.categoryName || 'Khác';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({ value: t.typeId, label: t.typeName });
        return acc;
      },
      {} as Record<string, { value: string; label: string }[]>
    )
  ).map(([cat, opts]) => ({ label: cat, options: opts }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" className="bg-slate-50 p-0 flex flex-col overflow-hidden max-h-[95vh] rounded-xl border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{mode === 'create' ? 'Thêm thiết bị' : 'Chỉnh sửa thiết bị'}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isCombo ? 'Khai báo thông tin, giá và cấu kiện của Combo' : 'Khai báo thông tin và giá'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="bg-white border-slate-200 text-slate-700 w-24 justify-center">
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit} isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white w-32 justify-center">
            {mode === 'create' ? 'Lưu thiết bị' : 'Cập nhật'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 relative">
        {(validationError || errorMessage) && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg border border-red-100 text-sm font-medium">
            {validationError || errorMessage}
          </div>
        )}

        {/* Loại sản phẩm */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Loại sản phẩm <span className="text-red-500">*</span></h3>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Đơn lẻ */}
            <label className={`flex-1 relative flex cursor-pointer rounded-lg border p-4 transition-colors ${!isCombo ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="productType" className="sr-only" checked={!isCombo} onChange={() => handleSetCombo(false)} disabled={mode === 'edit'} />
              <div className="flex items-center gap-3">
                <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${!isCombo ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                  {!isCombo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div className="flex items-center gap-2 text-slate-700">
                  <Box className={`w-5 h-5 ${!isCombo ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-medium ${!isCombo ? 'text-blue-600' : ''}`}>Thiết bị đơn lẻ</span>
                </div>
              </div>
            </label>

            {/* Combo */}
            <label className={`flex-1 relative flex cursor-pointer rounded-lg border p-4 transition-colors ${isCombo ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="productType" className="sr-only" checked={isCombo} onChange={() => handleSetCombo(true)} disabled={mode === 'edit'} />
              <div className="flex items-center gap-3">
                <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${isCombo ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                  {isCombo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <div className="flex items-center gap-2 text-slate-700">
                  <Layers className={`w-5 h-5 ${isCombo ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-medium ${isCombo ? 'text-blue-600' : ''}`}>Combo / Ghép bộ</span>
                </div>
              </div>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Loại sản phẩm không thể thay đổi sau khi lưu.</p>
        </div>

        {/* A & B Container */}
        <div className={`flex ${isCombo ? 'flex-col lg:flex-row' : 'flex-col'} gap-6`}>
          
          {/* A. Thông tin chung */}
          <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-xs ${isCombo ? 'flex-1' : ''}`}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-5">A. Thông tin chung</h3>
            <div className={`flex ${isCombo ? 'flex-col xl:flex-row' : 'flex-col md:flex-row'} gap-6`}>
              {/* Ảnh */}
              <div className={`w-full ${isCombo ? 'xl:w-48' : 'md:w-64'} shrink-0`}>
                <p className="text-sm font-medium text-slate-700 mb-2">Hình ảnh sản phẩm</p>
                <div className={`border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer ${isCombo ? 'h-[160px]' : 'h-[200px]'} transition-colors group`}>
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-2 group-hover:bg-blue-50 transition-colors">
                    <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <p className="text-[13px] text-slate-600 leading-snug">Kéo thả ảnh vào đây hoặc <span className="text-blue-600 font-medium">Chọn ảnh</span></p>
                  <p className="text-[11px] text-slate-400 mt-1">PNG, JPG hoặc WEBP, tối đa 5 MB</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="flex-1 flex flex-col gap-4">
                <Select
                  label="Thuộc nhóm thiết bị *"
                  required
                  value={values.typeId}
                  onChange={(e) => setValues((v) => ({ ...v, typeId: e.target.value }))}
                  options={typeOptions}
                  placeholder="Chọn nhóm thiết bị"
                />
                
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Mã thiết bị <span className="text-red-500">*</span></label>
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
                    placeholder={isCombo ? "VD: BOM-TABLE-06" : "VD: EQ-TBL-R180"}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 transition-shadow"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Tên thiết bị <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={values.itemName}
                    onChange={(e) => setValues((v) => ({ ...v, itemName: e.target.value }))}
                    placeholder={isCombo ? "VD: Bộ bàn tiệc 6 ghế" : "VD: Bàn tròn 1m8"}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Đơn vị tính *"
                    required
                    value={values.unit}
                    onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
                    options={[
                      { value: 'Bộ', label: 'Bộ' },
                      { value: 'Cái', label: 'Cái' },
                      { value: 'Chiếc', label: 'Chiếc' },
                      { value: 'M²', label: 'M²' },
                      { value: 'Dải', label: 'Dải' },
                    ]}
                  />
                  
                  <Select
                    label="Trạng thái *"
                    required
                    value={values.status ?? 'ACTIVE'}
                    onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ItemStatus }))}
                    options={[
                      { value: 'ACTIVE', label: 'Đang hoạt động' },
                      { value: 'INACTIVE', label: 'Ngừng hoạt động' },
                      { value: 'MAINTENANCE', label: 'Bảo trì' },
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Mô tả chi tiết</label>
                  <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
                    <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/50 p-2">
                      <button type="button" className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"><Bold className="w-[15px] h-[15px]" /></button>
                      <button type="button" className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"><Italic className="w-[15px] h-[15px]" /></button>
                      <div className="w-px h-3 bg-slate-300 mx-1" />
                      <button type="button" className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"><List className="w-[15px] h-[15px]" /></button>
                      <button type="button" className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"><ListOrdered className="w-[15px] h-[15px]" /></button>
                      <div className="w-px h-3 bg-slate-300 mx-1" />
                      <button type="button" className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"><LinkIcon className="w-[15px] h-[15px]" /></button>
                    </div>
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={values.description}
                        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                        className="w-full p-3 pb-8 text-[13px] focus:outline-none resize-y min-h-[80px]"
                        placeholder={isCombo ? "Nhập mô tả chi tiết về thiết bị..." : "Nhập mô tả chi tiết..."}
                      />
                      <span className="absolute bottom-2 right-3 text-[11px] text-slate-400">0 / 1000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* B. Cấu hình giá */}
          <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-xs ${isCombo ? 'w-full lg:w-[320px] xl:w-[380px] shrink-0' : 'mb-4'}`}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-5">B. Cấu hình giá</h3>
            <div className={`grid ${isCombo ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-x-6 gap-y-5`}>
              
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Giá cho thuê <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={values.rentalPrice === 0 ? '' : values.rentalPrice}
                    onChange={(e) => setValues((v) => ({ ...v, rentalPrice: Number(e.target.value) }))}
                    className="block w-full rounded-lg border border-slate-200 pl-3 pr-8 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">đ</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Giá mua vào</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    className="block w-full rounded-lg border border-slate-200 pl-3 pr-8 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">đ</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Hiệu lực từ</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    className="block w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    placeholder="dd/mm/yyyy"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Đến ngày</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    className="block w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                    placeholder="dd/mm/yyyy"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* C. Cấu hình BOM / Cấu kiện */}
        {isCombo && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">C. Cấu hình BOM / Cấu kiện</h3>
                <p className="text-sm text-slate-500 mt-0.5">Chỉ có thể chọn thiết bị đơn lẻ đang hoạt động.</p>
              </div>
              <Button type="button" variant="secondary" className="bg-white border-blue-600 text-blue-600 hover:bg-blue-50 text-sm h-9 px-4 font-medium flex items-center gap-1.5 rounded-lg">
                <span className="text-lg leading-none mb-0.5">+</span> Thêm thiết bị con
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Thiết bị con</th>
                    <th className="px-4 py-3 font-medium text-center w-24">Đơn vị</th>
                    <th className="px-4 py-3 font-medium text-center w-36">Tồn kho hiện tại</th>
                    <th className="px-4 py-3 font-medium text-center w-48">Số lượng cần trong bộ</th>
                    <th className="px-4 py-3 font-medium text-center w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Mock item 1 */}
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Bàn tròn 1m8</div>
                          <div className="text-xs text-slate-500 mt-0.5">EQ-TBL-R180</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">Cái</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600">42</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <input type="number" defaultValue={1} min={1} className="w-20 text-center border border-slate-200 rounded-md py-1.5 focus:outline-none focus:border-blue-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  
                  {/* Mock item 2 */}
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Ghế Chiavari</div>
                          <div className="text-xs text-slate-500 mt-0.5">EQ-CHAIR-CHI</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">Cái</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600">180</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <input type="number" defaultValue={6} min={1} className="w-20 text-center border border-slate-200 rounded-md py-1.5 focus:outline-none focus:border-blue-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Mock item 3 */}
                  <tr>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">Khăn trải bàn trắng</div>
                          <div className="text-xs text-slate-500 mt-0.5">EQ-CLOTH-WHT</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">Cái</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600">90</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <input type="number" defaultValue={1} min={1} className="w-20 text-center border border-slate-200 rounded-md py-1.5 focus:outline-none focus:border-blue-500" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-emerald-50 border-t border-slate-200 p-3 flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-emerald-600 font-bold text-[10px]">✓</span>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-emerald-800">Khả dụng theo BOM: Có thể lắp tối đa 30 bộ</p>
                  <p className="text-[12px] text-emerald-600">Tính theo cấu kiện có khả năng lắp ít nhất.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Absolute Header with close icon - NO, we use footer style buttons */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex justify-end gap-3 sticky bottom-0 z-10">
        <Button type="button" variant="secondary" onClick={onClose} className="bg-white border-slate-200 text-slate-700 w-24 justify-center">
          Hủy
        </Button>
        <Button type="button" onClick={handleSubmit} isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white w-32 justify-center">
          {mode === 'create' ? 'Lưu thiết bị' : 'Cập nhật'}
        </Button>
      </div>
    </Modal>
  );
}

export default CatalogItemFormModal;
