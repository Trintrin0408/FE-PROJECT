'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Eye, Power, Building2, User, Phone, Mail, MapPin, DollarSign, ClipboardList, FileText, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supplierApiService } from '@/services/supplier.service';
import type { Supplier, SupplierItem, SupplierTransaction } from '@/types/supplier';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AssignSupplierItemModal from '@/components/suppliers/AssignSupplierItemModal';
import UpdateSupplierItemModal from '@/components/suppliers/UpdateSupplierItemModal';
import { SupplierFormModal, type SupplierFormValues } from '@/components/suppliers/SupplierFormModal';
import OrderQuickViewModal from '@/components/orders/OrderQuickViewModal';
import CreateSupplierTransactionModal from '@/components/suppliers/CreateSupplierTransactionModal';
import UpdateSupplierTransactionModal from '@/components/suppliers/UpdateSupplierTransactionModal';

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [isCreateTxModalOpen, setIsCreateTxModalOpen] = useState(false);
  const [isUpdateTxModalOpen, setIsUpdateTxModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<SupplierTransaction | null>(null);
  const [txModalMode, setTxModalMode] = useState<'edit' | 'view'>('edit');
  const [selectedItem, setSelectedItem] = useState<SupplierItem | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'transactions'>('info');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  const handleUpdateSupplier = async (values: SupplierFormValues) => {
    try {
      await supplierApiService.updateSupplier(id, values);
      toast.success('Cập nhật thông tin nhà cung cấp thành công');
      setIsSupplierFormOpen(false);
      fetchSupplierData();
    } catch (error) {
      toast.error('Lỗi khi cập nhật thông tin nhà cung cấp');
    }
  };

  const fetchSupplierData = async () => {
    try {
      setIsLoading(true);
      const [supplierRes, itemsRes, transactionsRes] = await Promise.all([
        supplierApiService.getSupplierById(id),
        supplierApiService.getSupplierItems(id),
        supplierApiService.getSupplierTransactions({ supplierId: id, limit: 10 }),
      ]);
      
      setSupplier(supplierRes.data || supplierRes); // Handle depending on exact envelope
      setItems(itemsRes.data || itemsRes || []);
      setTransactions(transactionsRes.data || []);
    } catch (error: any) {
      console.error('Failed to fetch supplier details:', error);
      toast.error('Không thể tải thông tin nhà cung cấp');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierData();
  }, [id]);

  const handleToggleStatus = async () => {
    if (!supplier) return;
    if (supplier.status === 'ACTIVE' && (supplier.debtBalance || 0) > 0) {
      toast.error('Không thể ngừng hợp tác nhà cung cấp đang có công nợ');
      return;
    }
    const newStatus = supplier.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await supplierApiService.updateSupplierStatus(id, { status: newStatus });
      toast.success(`Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'ngừng hợp tác'} nhà cung cấp`);
      fetchSupplierData();
    } catch (error) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hạng mục này khỏi nhà cung cấp?')) return;
    try {
      await supplierApiService.removeSupplierItem(id, itemId);
      toast.success('Đã xóa hạng mục');
      fetchSupplierData();
    } catch (error) {
      toast.error('Lỗi khi xóa hạng mục');
    }
  };

  const handleRemoveTransaction = async (txId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
    try {
      await supplierApiService.deleteSupplierTransaction(txId);
      toast.success('Đã xóa giao dịch');
      fetchSupplierData();
    } catch (error) {
      toast.error('Lỗi khi xóa giao dịch');
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center flex flex-col items-center gap-4 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      Đang tải dữ liệu...
    </div>;
  }

  if (!supplier) {
    return <div className="p-6 text-center text-red-500">Không tìm thấy nhà cung cấp!</div>;
  }

  // Generate initials for avatar
  const initials = supplier.supplierName?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'SP';

  // Format date safely
  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('vi-VN').format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-3xl font-bold text-blue-600">
            {initials}
          </div>
          <div className="pt-1">
            <h1 className="text-2xl font-bold text-slate-900">{supplier.supplierName}</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-600">
                {supplier.supplierCode}
              </span>
              <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {supplier.status === 'ACTIVE' ? 'Đang hợp tác' : 'Ngừng hợp tác'}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Building2 className="h-4 w-4 text-slate-400" />
              <span>{supplier.serviceType}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            onClick={handleToggleStatus}
            className={`bg-white shadow-sm h-10 ${supplier.status === 'ACTIVE' ? 'text-red-600 hover:bg-red-50 border-red-200 ring-1 ring-inset ring-slate-200' : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 ring-1 ring-inset ring-slate-200'}`}
          >
            <Power className="h-4 w-4 mr-2" />
            {supplier.status === 'ACTIVE' ? 'Ngừng hợp tác' : 'Hợp tác lại'}
          </Button>
        </div>
      </div>

      {/* Stats row - 3 columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
        {/* Stat 1: Debt */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Công nợ hiện tại</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{(supplier.debtBalance || 0).toLocaleString('vi-VN')} <span className="text-lg underline">đ</span></p>
            </div>
          </div>
        </div>

        {/* Stat 2: Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Hạng mục đang cung cấp</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{items.length} hạng mục</p>
              <p className="mt-1 text-sm text-slate-500">{items.filter(i => i.isActive).length} đang hoạt động</p>
            </div>
          </div>
        </div>

        {/* Stat 3: Orders */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Lịch sử giao dịch</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{transactions.length} giao dịch</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mt-6 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('info')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Thông tin chung & Hạng mục
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Danh sách các giao dịch
          </button>
        </nav>
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Info */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-1 h-full">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Thông tin liên hệ</h3>
            <Button variant="secondary" size="sm" onClick={() => setIsSupplierFormOpen(true)} className="h-8 text-blue-600 hover:bg-blue-50 border-blue-200">
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Chỉnh sửa
            </Button>
          </div>
          <div className="p-5 space-y-6 text-sm">
            <div className="flex items-start gap-4">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="grid grid-cols-3 w-full gap-2 items-center">
                <span className="text-slate-500 col-span-1 font-medium">Chuyên cung cấp</span>
                <span className="font-medium text-slate-900 col-span-2">{supplier.serviceType}</span>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start gap-4">
              <User className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="grid grid-cols-3 w-full gap-2 items-center">
                <span className="text-slate-500 col-span-1 font-medium">Người đại diện</span>
                <span className="font-medium text-slate-900 col-span-2">{supplier.contactPerson || '—'}</span>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start gap-4">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="grid grid-cols-3 w-full gap-2 items-center">
                <span className="text-slate-500 col-span-1 font-medium">Số điện thoại</span>
                <Link href={`tel:${supplier.phone}`} className="font-medium text-blue-600 hover:underline col-span-2">{supplier.phone || '—'}</Link>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start gap-4">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="grid grid-cols-3 w-full gap-2 items-center">
                <span className="text-slate-500 col-span-1 font-medium">Email</span>
                <Link href={`mailto:${supplier.email}`} className="font-medium text-blue-600 hover:underline col-span-2 break-all">{supplier.email || '—'}</Link>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100"></div>
            <div className="flex items-start gap-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="grid grid-cols-3 w-full gap-2">
                <span className="text-slate-500 col-span-1 font-medium">Địa chỉ</span>
                <span className="font-medium text-slate-900 col-span-2 leading-relaxed">{supplier.address || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Items */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2 h-full flex flex-col">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Hạng mục đang cung cấp</h3>
            <Button size="sm" onClick={() => setIsAssignModalOpen(true)}>+ Thêm hạng mục</Button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-4 font-semibold text-slate-500">Hạng mục</th>
                  <th className="px-5 py-4 font-semibold text-slate-500 text-right">Giá thuê</th>
                  <th className="px-5 py-4 font-semibold text-slate-500 text-right">Giá mua</th>
                  <th className="px-5 py-4 text-center font-semibold text-slate-500">Trạng thái</th>
                  <th className="px-5 py-4 text-right font-semibold text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      Nhà cung cấp này chưa được gán hạng mục nào.
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr key={item.itemId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-slate-900 text-[15px]">{item.itemName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-right font-medium">
                      <span className="text-slate-900">{(item.rentalPrice || 0).toLocaleString('vi-VN')} ₫</span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-right font-medium">
                      <span className="text-slate-900">{item.purchasePrice != null ? `${item.purchasePrice.toLocaleString('vi-VN')} ₫` : '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge variant={item.isActive ? 'success' : 'neutral'} className={`px-3 py-1 font-medium ${item.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        {item.isActive ? 'Hoạt động' : 'Tạm ẩn'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          onClick={() => { setSelectedItem(item); setIsUpdateModalOpen(true); }}
                          title="Chỉnh sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          onClick={() => handleRemoveItem(item.itemId)}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'transactions' && (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Danh sách các giao dịch</h3>
          <Button size="sm" onClick={() => setIsCreateTxModalOpen(true)}>+ Tạo giao dịch</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500">Mã giao dịch</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-center">Loại giao dịch</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-center">Đơn liên quan</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-center">Ngày tạo</th>
                <th className="px-6 py-4 font-semibold text-slate-500 text-center">Tổng tiền</th>
                <th className="px-6 py-4 text-center font-semibold text-slate-500">Thanh toán</th>
                <th className="px-6 py-4 text-center font-semibold text-slate-500">Trạng thái</th>
                <th className="px-6 py-4 text-center font-semibold text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    Chưa có giao dịch nào
                  </td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.transactionId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 text-slate-600 font-medium">{tx.transactionCode}</td>
                  <td className="px-6 py-5 text-center">
                    <Badge variant="neutral" className="px-2.5 py-1">
                      {tx.transactionType === 'RENTAL' ? 'Thuê ngoài' : tx.transactionType === 'PURCHASE' ? 'Mua hàng' : tx.transactionType}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {tx.orderId ? (
                      <button onClick={() => setViewOrderId(tx.orderId)} className="text-blue-600 hover:underline font-medium">
                        {tx.orderCode || '—'}
                      </button>
                    ) : (
                      <span className="text-slate-500 italic text-sm">Nhập kho</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-slate-600 text-center font-medium">{formatDate(tx.createdAt)}</td>
                  <td className="px-6 py-5 font-bold text-slate-900 text-center">{(tx.estimatedCost || 0).toLocaleString('vi-VN')} ₫</td>
                  <td className="px-6 py-5 text-center">
                    {tx.paymentStatus === 'PAID' ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                        Đã thanh toán
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                        {tx.paymentStatus === 'UNPAID' ? 'Chưa thanh toán' : tx.paymentStatus === 'DEPOSITED' ? 'Đã đặt cọc' : tx.paymentStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Badge variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'CANCELLED' ? 'error' : tx.status === 'RECEIVED' ? 'success' : tx.status === 'PENDING' ? 'neutral' : 'info'} className="px-3 py-1 font-medium">
                      {tx.status === 'PENDING' ? 'Chờ duyệt' : tx.status === 'APPROVED' ? 'Đã duyệt' : tx.status === 'RECEIVED' ? 'Đã nhận' : tx.status === 'COMPLETED' ? 'Hoàn thành' : tx.status === 'CANCELLED' ? 'Đã hủy' : tx.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedTransaction(tx);
                          setTxModalMode('view');
                          setIsUpdateTxModalOpen(true);
                        }}
                        title="Xem chi tiết"
                        className="px-2 py-1 h-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedTransaction(tx);
                          setTxModalMode('edit');
                          setIsUpdateTxModalOpen(true);
                        }}
                        title="Cập nhật"
                        className="px-2 py-1 h-auto text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRemoveTransaction(tx.transactionId)}
                        title="Xóa"
                        className="px-2 py-1 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <AssignSupplierItemModal 
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        supplierId={id}
        onSuccess={fetchSupplierData}
      />

      <UpdateSupplierItemModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        supplierId={id}
        item={selectedItem}
        onSuccess={fetchSupplierData}
      />

      <SupplierFormModal
        isOpen={isSupplierFormOpen}
        mode="edit"
        supplier={supplier}
        onClose={() => setIsSupplierFormOpen(false)}
        onSubmit={handleUpdateSupplier}
      />

      <CreateSupplierTransactionModal
        isOpen={isCreateTxModalOpen}
        onClose={() => setIsCreateTxModalOpen(false)}
        supplierId={id}
        onSuccess={fetchSupplierData}
      />

      {isUpdateTxModalOpen && (
        <UpdateSupplierTransactionModal
          isOpen={isUpdateTxModalOpen}
          onClose={() => setIsUpdateTxModalOpen(false)}
          supplierId={id}
          transaction={selectedTransaction}
          onSuccess={fetchSupplierData}
          mode={txModalMode}
        />
      )}

      {/* Quick View Modal */}
      {viewOrderId && (
        <OrderQuickViewModal
          isOpen={!!viewOrderId}
          onClose={() => setViewOrderId(null)}
          orderId={viewOrderId}
        />
      )}
    </div>
  );
}
