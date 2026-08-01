'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Table, TableColumn } from '@/components/ui/Table';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { orderApiService } from '@/services/order.service';
import { attendanceApiService } from '@/services/attendance.service';
import { workTaskApiService } from '@/services/workTask.service';
import type { AttendanceListItem, ListAttendancesMeta } from '@/types/attendance';
import type { Order } from '@/types/order';
import type { WorkTask } from '@/types/workTask';

export default function AttendancesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  
  const [attendances, setAttendances] = useState<AttendanceListItem[]>([]);
  const [meta, setMeta] = useState<ListAttendancesMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Load orders and tasks for filters
  useEffect(() => {
    async function loadFilterData() {
      try {
        const [ordersRes, tasksRes] = await Promise.all([
          orderApiService.getOrders({ limit: 100 }),
          workTaskApiService.getWorkTasks({ limit: 100 })
        ]);
        setOrders(ordersRes.data);
        // Bỏ qua lỗi của api getWorkTasks vì có thể data nằm trực tiếp trong tasksRes hoặc tasksRes.data
        setTasks((tasksRes as any).data || tasksRes || []);
      } catch (error) {
        console.error('Failed to load filter data', error);
      }
    }
    loadFilterData();
  }, []);

  const orderOptions = useMemo(() => {
    const opts = orders.map(order => ({
      value: order.orderId,
      label: `[${order.orderCode}] ${order.eventName || 'Đơn hàng'}`,
    }));
    return [{ value: '', label: 'Tất cả dự án' }, ...opts];
  }, [orders]);

  const taskOptions = useMemo(() => {
    const opts = (Array.isArray(tasks) ? tasks : []).map(task => ({
      value: task.taskId,
      label: task.taskName,
    }));
    return [{ value: '', label: 'Tất cả công việc' }, ...opts];
  }, [tasks]);

  // Load attendances
  const loadAttendances = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await attendanceApiService.getAttendances({
        search: searchQuery || undefined,
        taskId: selectedTaskId || undefined,
        orderId: selectedOrderId || undefined,
        page: currentPage,
        limit: 10,
      });
      setAttendances(result.data);
      setMeta(result.meta ?? null);
    } catch (error) {
      console.error('Failed to load attendances', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTaskId, selectedOrderId, currentPage]);

  useEffect(() => {
    loadAttendances();
  }, [loadAttendances]);

  const handleOrderChange = (value: string) => {
    setSelectedOrderId(value);
    setCurrentPage(1);
  };

  const columns: TableColumn<AttendanceListItem>[] = [
    {
      key: 'user',
      label: 'Nhân sự',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.user.fullName} size="md" />
          <div>
            <div className="font-medium text-slate-900">{row.user.fullName}</div>
            <div className="text-xs text-slate-500">{row.user.employeeCode || 'N/A'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'task',
      label: 'Công việc',
      render: (row) => (
        <span className="font-medium text-slate-800">{row.plan.task.taskName}</span>
      ),
    },
    {
      key: 'order',
      label: 'Dự án',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row.plan.order.eventName || 'Sự kiện'}</div>
          <div className="text-xs text-slate-500">Mã: {row.plan.order.orderCode}</div>
        </div>
      ),
    },
    {
      key: 'checkIn',
      label: 'Check-in',
      render: (row) => {
        if (!row.attendance?.checkInAt) return <span className="text-slate-400 italic">Chưa check-in</span>;
        const date = new Date(row.attendance.checkInAt);
        const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('en-GB');
        return <span className="text-slate-700">{`${timeStr} ${dateStr}`}</span>;
      },
    },
    {
      key: 'checkOut',
      label: 'Check-out',
      render: (row) => {
        if (!row.attendance?.checkOutAt) return <span className="text-slate-400 italic">Chưa check-out</span>;
        const date = new Date(row.attendance.checkOutAt);
        const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('en-GB');
        return <span className="text-slate-700">{`${timeStr} ${dateStr}`}</span>;
      },
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Điểm danh / Chấm công</h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách nhân sự thực địa tại các sự kiện</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Tìm kiếm nhân sự</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Nhập tên hoặc mã nhân sự"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <Select
            label="Công việc"
            options={taskOptions}
            value={selectedTaskId}
            onChange={(e) => {
              setSelectedTaskId(e.target.value);
              setCurrentPage(1);
            }}
          />

          <SearchableSelect
            label="Dự án"
            value={selectedOrderId}
            onChange={handleOrderChange}
            options={orderOptions}
            placeholder="Tất cả dự án"
          />
        </div>

        <Table
          columns={columns}
          rows={attendances}
          rowKey={(row) => row.assigneeId}
          isLoading={isLoading}
          emptyText="Không tìm thấy dữ liệu điểm danh phù hợp."
        />

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex justify-end">
            <Pagination
              pagination={{
                currentPage,
                totalPages: meta.totalPages,
                totalItems: meta.totalItems,
                limit: meta.limit,
              }}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
