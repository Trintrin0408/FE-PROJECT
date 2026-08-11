'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Pencil, Search, Boxes, CheckCircle2, Wrench } from 'lucide-react';
import { catalogApiService } from '@/services/catalog.service';
import { inventoryApiService } from '@/services/inventory.service';
import { Table, TableColumn } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { CategoryFormModal, CategoryFormValues } from '@/components/catalog/CategoryFormModal';
import Reveal from '@/components/ui/Reveal';
import { usePermission } from '@/hooks/usePermission';
import type { ItemCategory, ItemType, Item } from '@/types/catalog';
import type { InventoryRow } from '@/types/inventory';

interface ItemRow {
  itemId: string;
  itemName: string;
  totalQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
}

function StatTile({
  icon: Icon,
  iconClassName,
  value,
  label,
}: Readonly<{ icon: typeof Boxes; iconClassName: string; value: number; label: string }>) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4 text-center">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermission();
  const canManage = can('master-data:manage');

  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag toggled before/after the fetch below, not a render loop
    setIsLoading(true);
    Promise.all([
      catalogApiService.getCategory(id),
      catalogApiService.getTypes({ categoryId: id, limit: 200 }),
      catalogApiService.getItems({ limit: 500 }),
      inventoryApiService.getInventory({ limit: 200 }),
    ])
      .then(([categoryRes, typesRes, itemsRes, inventoryRes]) => {
        setCategory(categoryRes.data);

        const categoryTypeIds = new Set((typesRes.data as ItemType[]).map((t) => t.typeId));
        const categoryItems = (itemsRes.data as Item[]).filter((item) => categoryTypeIds.has(item.typeId));
        const categoryItemIds = new Set(categoryItems.map((item) => item.itemId));
        const itemsById = new Map(categoryItems.map((item) => [item.itemId, item]));

        const rows: ItemRow[] = (inventoryRes.data as InventoryRow[])
          .filter((row) => categoryItemIds.has(row.itemId))
          .map((row) => ({
            itemId: row.itemId,
            itemName: itemsById.get(row.itemId)?.itemName ?? row.itemName ?? row.itemId,
            totalQuantity: row.quantityTotal,
            availableQuantity: row.quantityAvailable,
            damagedQuantity: row.quantityDamaged,
          }));

        setItemRows(rows);
      })
      .finally(() => setIsLoading(false));
  }, [id, refreshToken]);

  const stats = useMemo(() => {
    return itemRows.reduce(
      (acc, row) => ({
        total: acc.total + row.totalQuantity,
        available: acc.available + row.availableQuantity,
        maintenance: acc.maintenance + row.damagedQuantity,
      }),
      { total: 0, available: 0, maintenance: 0 },
    );
  }, [itemRows]);

  const filteredRows = useMemo(
    () => itemRows.filter((row) => row.itemName.toLowerCase().includes(search.trim().toLowerCase())),
    [itemRows, search],
  );

  const handleEditSubmit = async (values: CategoryFormValues) => {
    if (!category) return;
    setIsSubmittingForm(true);
    setFormError('');
    try {
      await catalogApiService.updateCategory(category.categoryId, values);
      setIsEditOpen(false);
      setRefreshToken((t) => t + 1);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Cập nhật danh mục thất bại'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const itemColumns: TableColumn<ItemRow>[] = [
    { key: 'itemId', label: 'Mã thiết bị' },
    { key: 'itemName', label: 'Tên thiết bị' },
    { key: 'totalQuantity', label: 'Tổng số lượng' },
    { key: 'availableQuantity', label: 'Có sẵn' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <Badge variant={getStatusBadgeVariant(row.damagedQuantity > 0 ? 'MAINTENANCE' : 'ACTIVE')}>
          {row.damagedQuantity > 0 ? 'Đang sửa chữa' : 'Đang hoạt động'}
        </Badge>
      ),
    },
  ];

  if (isLoading || !category) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          { label: 'Danh mục kho' },
          { label: 'Danh sách danh mục', href: '/admin/catalog/categories' },
          { label: category.categoryName },
        ]}
        className="mb-3"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/catalog/categories"
            aria-label="Quay lại"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-slate-500 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{category.categoryName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">Quản lý và theo dõi thiết bị trong danh mục này.</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setIsEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Sửa danh mục
          </Button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900">Thông tin cơ bản</h3>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mã danh mục</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{category.categoryId}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tên danh mục</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{category.categoryName}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mô tả</p>
              <p className="mt-1 text-sm text-slate-700">{category.description || '—'}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.05} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900">Thống kê</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile icon={Boxes} iconClassName="bg-blue-100 text-blue-600" value={stats.total} label="Tổng số" />
            <StatTile icon={CheckCircle2} iconClassName="bg-green-100 text-green-600" value={stats.available} label="Có sẵn" />
            <StatTile icon={Wrench} iconClassName="bg-red-100 text-red-600" value={stats.maintenance} label="Đang sửa chữa" />
          </div>
        </Reveal>
      </div>

      <Reveal className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Danh sách thiết bị</h3>
          <div className="w-full sm:w-64">
            <Input placeholder="Tìm thiết bị..." icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <Table columns={itemColumns} rows={filteredRows} rowKey={(row) => row.itemId} />
        </div>
      </Reveal>

      <CategoryFormModal
        isOpen={isEditOpen}
        mode="edit"
        category={category}
        isSubmitting={isSubmittingForm}
        errorMessage={formError}
        onClose={() => {
          setIsEditOpen(false);
          setFormError('');
        }}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}
