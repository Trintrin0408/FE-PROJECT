'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Power, Package, Anchor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Reveal from '@/components/ui/Reveal';
import type { Item, ItemSupplierDetails } from '@/types/catalog';
import { catalogApiService } from '@/services/catalog.service';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [suppliers, setSuppliers] = useState<ItemSupplierDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItemData = async () => {
    try {
      setIsLoading(true);
      const [itemRes, suppliersRes] = await Promise.all([
        catalogApiService.getItem(id),
        catalogApiService.getItemSuppliers(id),
      ]);
      
      setItem(itemRes.data || itemRes);
      setSuppliers(suppliersRes.data || suppliersRes || []);
    } catch (error) {
      console.error('Failed to fetch item details:', error);
      toast.error('Không thể tải thông tin thiết bị');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItemData();
  }, [id]);

  if (isLoading) {
    return <div className="p-10 text-center flex flex-col items-center gap-4 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      Đang tải dữ liệu...
    </div>;
  }

  if (!item) return <div className="p-6 text-center text-red-500">Không tìm thấy thiết bị!</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{item.itemName}</h1>
              <Badge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-sm text-slate-500">Mã TB: {item.itemCode}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="bg-white shadow-sm" onClick={() => router.push(`/admin/catalog/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Sửa thiết bị
          </Button>
          <Button variant="secondary" className={`bg-white shadow-sm ${item.status === 'ACTIVE' ? 'text-red-600 hover:bg-red-50 border-red-200' : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'}`}>
            <Power className="h-4 w-4 mr-2" />
            {item.status === 'ACTIVE' ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
          </Button>
        </div>
      </div>

      <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Package className="h-5 w-5 text-blue-600" /> Thông tin chính
          </h3>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <span className="block text-slate-500 mb-1">Phân loại</span>
              <span className="font-medium text-slate-900">{item.typeName || '—'}</span>
            </div>
            <div>
              <span className="block text-slate-500 mb-1">Đơn vị tính</span>
              <span className="font-medium text-slate-900">{item.unit}</span>
            </div>
            <div>
              <span className="block text-slate-500 mb-1">Đơn giá thuê (Tham khảo)</span>
              <span className="font-medium text-blue-700">{(item.rentalPrice || 0).toLocaleString('vi-VN')} ₫</span>
            </div>
            <div className="col-span-2">
              <span className="block text-slate-500 mb-1">Mô tả</span>
              <p className="text-slate-700">{item.description || 'Chưa có mô tả'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Anchor className="h-5 w-5 text-emerald-600" /> Tồn kho nội bộ
          </h3>
          {item.inventory ? (
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                <span className="text-slate-500">Tổng số lượng</span>
                <span className="font-semibold text-slate-900">{item.inventory.quantityTotal}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                <span className="text-slate-500">Có sẵn</span>
                <span className="font-semibold text-emerald-600">{item.inventory.quantityAvailable}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                <span className="text-slate-500">Hư hỏng/Mất</span>
                <span className="font-semibold text-red-600">{item.inventory.quantityTotal - item.inventory.quantityAvailable}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-slate-400">Không có dữ liệu tồn kho.</p>
          )}
        </div>
      </Reveal>

      {item.isCombo && item.components && item.components.length > 0 && (
        <Reveal>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm mt-6 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Package className="h-5 w-5 text-indigo-600" /> Thiết bị thành phần trong Combo
            </h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">Mã TB</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Tên thiết bị con</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Đơn vị</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">SL trong 1 Combo</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Kho đang có</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {item.components.map((comp) => (
                    <tr key={comp.componentId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-500">{comp.childItemCode}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{comp.childItemName}</td>
                      <td className="px-4 py-3 text-slate-600">{comp.unit}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">{comp.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {comp.quantityAvailable != null ? comp.quantityAvailable : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm mt-6">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Đối tác cung cấp (Thuê ngoài)</h3>
              <p className="text-sm text-slate-500 mt-1">Danh sách các nhà cung cấp có thể thuê món đồ này khi thiếu hụt.</p>
            </div>
            <Button size="sm">+ Thêm đối tác</Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-4 font-semibold text-slate-500">Tên nhà cung cấp</th>
                  <th className="px-5 py-4 text-right font-semibold text-slate-500">Giá thuê</th>
                  <th className="px-5 py-4 text-right font-semibold text-slate-500">Giá mua</th>
                  <th className="px-5 py-4 text-center font-semibold text-slate-500">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      Chưa có nhà cung cấp nào cung cấp mặt hàng này.
                    </td>
                  </tr>
                ) : suppliers.map((supplier) => (
                  <tr key={supplier.supplierId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/admin/suppliers/${supplier.supplierId}`} className="font-medium text-blue-600 hover:underline">
                        {supplier.supplierName}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{supplier.supplierCode}</div>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-900">
                      {(supplier.rentalPrice || 0).toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-900">
                      {(supplier.purchasePrice || 0).toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge variant={supplier.isActive ? 'success' : 'neutral'} className={`px-3 py-1 font-medium ${supplier.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        {supplier.isActive ? 'Đang cung cấp' : 'Tạm ẩn'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
