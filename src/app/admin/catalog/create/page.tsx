'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogItemForm, CatalogItemFormValues } from '@/components/catalog/CatalogItemForm';
import { catalogApiService } from '@/services/catalog.service';
import type { ItemType } from '@/types/catalog';

export default function CreateCatalogItemPage() {
  const router = useRouter();
  const [types, setTypes] = useState<ItemType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    catalogApiService.getTypes()
      .then(res => setTypes(res.data ?? []))
      .catch(console.error);
  }, []);

  const handleSubmit = async (values: CatalogItemFormValues) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await catalogApiService.createItem(values);
      router.push('/admin/catalog');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Có lỗi xảy ra khi thêm thiết bị');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/catalog');
  };

  return (
    <div className="h-[calc(100vh-64px)] -mx-6 -mt-6">
      <CatalogItemForm
        mode="create"
        types={types}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
