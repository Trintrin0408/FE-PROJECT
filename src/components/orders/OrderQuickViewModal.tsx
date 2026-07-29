import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { orderApiService } from '@/services/order.service';
import type { OrderDetail } from '@/types/order';
import { formatDate } from '@/utils/formatDate';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { User, Phone, MapPin, Calendar, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderQuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

export default function OrderQuickViewModal({ isOpen, onClose, orderId }: OrderQuickViewModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails();
    } else {
      setOrder(null);
    }
  }, [isOpen, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      const res = await orderApiService.getOrder(orderId!);
      setOrder(res.data || res);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      toast.error('Không thể tải thông tin đơn hàng');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, { label: string, variant: any }> = {
      NEW: { label: 'Mới', variant: 'info' },
      CONFIRMED: { label: 'Đã chốt', variant: 'primary' },
      IN_PROGRESS: { label: 'Đang chạy', variant: 'warning' },
      COMPLETED: { label: 'Hoàn tất', variant: 'success' },
      CANCELLED: { label: 'Đã hủy', variant: 'error' }
    };
    return map[status] || { label: status, variant: 'neutral' };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thông tin đơn hàng liên quan" size="lg">
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="text-sm text-slate-500">Đang tải thông tin đơn hàng...</span>
          </div>
        ) : order ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{order.orderCode}</h4>
                <p className="text-sm text-slate-500 mt-1">{order.eventName || order.eventType}</p>
              </div>
              <Badge variant={getStatusLabel(order.orderStatus).variant}>
                {getStatusLabel(order.orderStatus).label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h5 className="font-semibold text-slate-900 text-sm">Thông tin khách hàng</h5>
                <div className="flex items-start gap-3 text-sm">
                  <User className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-700">{order.customerName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-700">{order.customerPhone}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-semibold text-slate-900 text-sm">Thông tin sự kiện</h5>
                <div className="flex items-start gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-500">Loại sự kiện: </span>
                    <span className="font-medium text-slate-700">{order.eventType}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-500">Ngày tổ chức: </span>
                    <span className="font-medium text-slate-700">{formatDate(order.eventDate)}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-500">Địa điểm: </span>
                    <span className="font-medium text-slate-700">{order.location}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-100 gap-2">
              <Button variant="secondary" onClick={onClose}>Đóng</Button>
            </div>
          </>
        ) : (
          <div className="flex justify-center py-8">
            <span className="text-sm text-slate-500">Không tìm thấy thông tin đơn hàng</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
