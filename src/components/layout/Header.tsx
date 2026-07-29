'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, HelpCircle, UserCircle, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { computeApproachingEvents, type ApproachingEvent } from '@/utils/approachingEvents';
import { orderApiService } from '@/services/order.service';
import { schedulePlanApiService } from '@/services/schedulePlan.service';
import { changeRequestApiService } from '@/services/changeRequest.service';
import type { Order } from '@/types/order';
import type { ChangeRequest } from '@/types/changeRequest';

const CHANGE_REQUEST_TYPE_LABEL: Record<ChangeRequest['type'], string> = {
  add: 'Thêm thiết bị',
  remove: 'Bớt thiết bị',
  replace: 'Thay thiết bị',
};

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role.roleName === 'Admin';
  const basePath = isAdmin ? '/admin' : '/manager';

  const [approachingEvents, setApproachingEvents] = useState<ApproachingEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const withinDays = 7;
    const today = new Date();
    const referenceDate = today.toISOString().slice(0, 10);
    const dateTo = new Date(today.getTime() + withinDays * 86_400_000).toISOString().slice(0, 10);

    Promise.all([
      // Backend chặn cứng limit tối đa 100 (listOrdersQuerySchema `.max(100)`) — 200 luôn bị 400.
      orderApiService.getOrders({ limit: 100 }).catch(() => ({ data: [] })),
      schedulePlanApiService.getSchedulePlans({ dateFrom: referenceDate, dateTo }).catch(() => ({ data: [] })),
    ]).then(([ordersRes, plansRes]) => {
      if (cancelled) return;
      const orders: Order[] = ordersRes.data ?? [];
      setApproachingEvents(computeApproachingEvents(orders, plansRes.data ?? [], withinDays, referenceDate));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Yêu cầu thay đổi chờ duyệt (ChangeRequest — UC 2.27) — backend đã có đủ route thật (docs/more-require.md
  // mục (an)): GET /change-requests, PUT /change-requests/:id/approve.
  const [pendingChangeRequests, setPendingChangeRequests] = useState<ChangeRequest[]>([]);

  useEffect(() => {
    if (isAdmin) {
      setPendingChangeRequests([]);
      return;
    }
    let cancelled = false;

    changeRequestApiService
      .getChangeRequests({ status: 'pending' })
      .then((res) => {
        if (cancelled) return;
        setPendingChangeRequests(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setPendingChangeRequests([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleReviewChangeRequest = (changeRequestId: string, status: 'approved' | 'rejected') => {
    changeRequestApiService
      .approveChangeRequest(changeRequestId, status)
      .then(() => setPendingChangeRequests((prev) => prev.filter((cr) => cr.changeRequestId !== changeRequestId)))
      .catch(() => {});
  };

  const totalNotifications = approachingEvents.length + pendingChangeRequests.length;

  const orderDetailPath = (orderId: string) =>
    `${user?.role.roleName === 'Admin' ? '/admin/orders_audit' : '/manager/orders'}/${orderId}`;

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isNotifOpen) return;
    const handleClickOutsideNotif = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNotif);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotif);
  }, [isNotifOpen]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end border-b border-slate-100 bg-white px-6 shadow-xs">
      <div className="flex items-center gap-1">
        <div ref={notifRef} className="relative">
          <button
            type="button"
            aria-label="Thông báo"
            onClick={() => setIsNotifOpen((open) => !open)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-600"
          >
            <Bell className="h-5 w-5" />
            {totalNotifications > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                {totalNotifications > 9 ? '9+' : totalNotifications}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl bg-white py-1.5 shadow-lg ring-1 ring-slate-100"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <p className="text-sm font-semibold text-slate-900">Mốc sắp diễn ra</p>
                  {approachingEvents.length > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      {approachingEvents.length}
                    </span>
                  )}
                </div>
                <div className="h-px bg-slate-100" />
                <div className="max-h-80 overflow-y-auto">
                  {approachingEvents.length === 0 ? (
                    <p className="px-3.5 py-6 text-center text-xs text-slate-400">
                      Không có mốc thời gian nào sắp diễn ra trong 7 ngày tới.
                    </p>
                  ) : (
                    approachingEvents.map((event) => (
                      <Link
                        key={`${event.orderId}-${event.label}`}
                        href={orderDetailPath(event.orderId)}
                        onClick={() => setIsNotifOpen(false)}
                        className="flex items-start gap-2.5 px-3.5 py-2.5 text-sm transition-colors duration-150 hover:bg-slate-50"
                      >
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${event.daysLeft <= 3 ? 'bg-red-500' : 'bg-amber-500'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800">
                            {event.customerName} — {event.venue}
                          </span>
                          <span
                            className={`text-xs font-semibold ${event.daysLeft <= 3 ? 'text-red-600' : 'text-amber-600'}`}
                          >
                            {event.label} · Còn {event.daysLeft} ngày ({event.orderId})
                          </span>
                        </span>
                      </Link>
                    ))
                  )}
                </div>

                {!isAdmin && (
                  <>
                    <div className="h-px bg-slate-100" />
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <p className="text-sm font-semibold text-slate-900">Yêu cầu thay đổi chờ duyệt</p>
                      {pendingChangeRequests.length > 0 && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                          {pendingChangeRequests.length}
                        </span>
                      )}
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="max-h-80 overflow-y-auto">
                      {pendingChangeRequests.length === 0 ? (
                        <p className="px-3.5 py-6 text-center text-xs text-slate-400">
                          Không có yêu cầu thay đổi nào chờ duyệt.
                        </p>
                      ) : (
                        pendingChangeRequests.map((cr) => (
                          <div
                            key={cr.changeRequestId}
                            className="flex items-start gap-2 px-3.5 py-2.5 text-sm transition-colors duration-150 hover:bg-slate-50"
                          >
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            <Link
                              href={orderDetailPath(cr.orderId)}
                              onClick={() => setIsNotifOpen(false)}
                              className="min-w-0 flex-1"
                            >
                              <span className="block truncate font-medium text-slate-800">{cr.customerName}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {CHANGE_REQUEST_TYPE_LABEL[cr.type]}
                                {cr.items[0] ? ` · ${cr.items[0].itemName} x${cr.items[0].quantity}` : ''}
                              </span>
                            </Link>
                            <div className="mt-0.5 flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => handleReviewChangeRequest(cr.changeRequestId, 'approved')}
                                className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 transition-colors duration-150 hover:bg-emerald-100"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewChangeRequest(cr.changeRequestId, 'rejected')}
                                className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition-colors duration-150 hover:bg-rose-100"
                              >
                                Từ chối
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={menuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex items-center rounded-full p-0.5 transition-colors duration-150 hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {user?.fullName?.charAt(0) ?? '?'}
            </div>
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl bg-white py-1.5 shadow-lg ring-1 ring-slate-100"
              >
                <div className="px-3.5 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName ?? 'Khách'}</p>
                  <p className="truncate text-xs text-slate-400">{user?.role.roleName}</p>
                </div>
                <div className="h-px bg-slate-100" />
                <Link
                  href={`${basePath}/profile`}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                >
                  <UserCircle className="h-4 w-4 text-slate-400" />
                  Hồ sơ cá nhân
                </Link>
                <Link
                  href={`${basePath}/profile/change-password`}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  Đổi mật khẩu
                </Link>
                <div className="h-px bg-slate-100" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-600 transition-colors duration-150 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
