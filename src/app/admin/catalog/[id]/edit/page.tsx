'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CatalogItemForm, CatalogItemFormValues } from '@/components/catalog/CatalogItemForm';
import { catalogApiService } from '@/services/catalog.service';
import type { Item, ItemType } from '@/types/catalog';

export default function EditCatalogItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [item, setItem] = useState<Item | null>(null);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    
    setIsLoading(true);
    Promise.all([
      catalogApiService.getItem(id),
      catalogApiService.getTypes(),
      catalogApiService.getItemComponents(id).catch(() => ({ data: [] }))
    ])
      .then(([itemRes, typesRes, componentsRes]) => {
        const itemData = itemRes.data;
        if (itemData.isCombo) {
          itemData.components = componentsRes.data;
        }
        setItem(itemData);
        setTypes(typesRes.data ?? []);
      })
      .catch((error) => {
        console.error(error);
        setErrorMessage('Không thể tải thông tin thiết bị.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  const handleSubmit = async (values: CatalogItemFormValues) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await catalogApiService.updateItem(id, values);
      router.push('/admin/catalog');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Có lỗi xảy ra khi cập nhật thiết bị');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/catalog');
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Đang tải thông tin thiết bị...</div>;
  }

  if (!item) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="mb-4">Không tìm thấy thiết bị này.</p>
        <button onClick={handleCancel} className="text-blue-600 hover:underline">Quay lại danh sách</button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] -mx-6 -mt-6">
      <CatalogItemForm
        mode="edit"
        item={item}
        types={types}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
