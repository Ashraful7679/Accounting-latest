'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, CheckCheck, AlertTriangle, Info, AlertCircle, ChevronRight,
  Clock, Trash2, FileText, CreditCard, BookOpen
} from 'lucide-react';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationPanelProps {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === 'OVERDUE_INVOICE') return <FileText className="w-4 h-4" />;
  if (type === 'LC_EXPIRY') return <CreditCard className="w-4 h-4" />;
  if (type === 'PENDING_JOURNAL') return <BookOpen className="w-4 h-4" />;
  if (type === 'LOAN_DUE') return <AlertTriangle className="w-4 h-4" />;
  return <Info className="w-4 h-4" />;
}

export default function NotificationPanel({ companyId, isOpen, onClose }: NotificationPanelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleNotificationClick = (notif: Notification) => {
    // Mark as read immediately when clicked
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }

    onClose();

    if (!notif.entityId) return;

    const type = notif.type;
    const entityType = notif.entityType?.toLowerCase();

    if (type === 'PENDING_JOURNAL' || entityType === 'journalentry') {
      router.push(`/company/${companyId}/journals`);
    } else if (type === 'OVERDUE_INVOICE' || entityType === 'invoice') {
      router.push(`/company/${companyId}/invoices`);
    } else if (type === 'LC_EXPIRY' || entityType === 'lc') {
      router.push(`/company/${companyId}/finance`);
    } else if (type === 'LOAN_DUE' || entityType === 'loan') {
      router.push(`/company/${companyId}/finance`);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', companyId],
    queryFn: async () => {
      try {
        const res = await api.get(`/company/${companyId}/notifications`);
        if (typeof res.data === 'string' && res.data.startsWith('<!DOCTYPE')) {
          console.error('Received HTML instead of JSON from notifications API');
          return { notifications: [], unreadCount: 0 };
        }
        return res.data.data as { notifications: Notification[]; unreadCount: number };
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
        return { notifications: [], unreadCount: 0 };
      }
    },
    enabled: !!companyId && isOpen,
    refetchInterval: isOpen ? 30000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: (notifId: string) => api.patch(`/company/notifications/${notifId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', companyId] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch(`/company/${companyId}/notifications/read-all`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', companyId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (notifId: string) => api.delete(`/company/notifications/${notifId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', companyId] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const severityConfig = {
    DANGER: { bg: 'bg-red-500/10 border-red-500/20', icon: 'text-red-400', dot: 'bg-red-500' },
    WARNING: { bg: 'bg-amber-500/10 border-amber-500/20', icon: 'text-amber-400', dot: 'bg-amber-500' },
    INFO: { bg: 'bg-blue-500/10 border-blue-500/20', icon: 'text-blue-400', dot: 'bg-blue-500' },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-16 right-4 z-50 w-[400px] max-w-[calc(100vw-2rem)] bg-[#0F172A] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <p className="text-[11px] text-slate-400">{unreadCount} unread alert{unreadCount > 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-xs font-semibold transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[480px] overflow-y-auto p-3 space-y-2">
              {isLoading && (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Loading alerts...</p>
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-7 h-7 text-slate-600" />
                  </div>
                  <p className="text-slate-400 font-semibold text-sm">All clear!</p>
                  <p className="text-slate-600 text-xs mt-1">No active alerts for this company.</p>
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {notifications.map((notif, idx) => {
                  const severity = (notif.severity as keyof typeof severityConfig) in severityConfig
                    ? (notif.severity as keyof typeof severityConfig)
                    : 'INFO';
                  const config = severityConfig[severity];

                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        'p-4 rounded-2xl border relative group transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                        config.bg,
                        !notif.isRead && 'ring-1 ring-inset ring-white/5'
                      )}
                    >
                      <div className="flex gap-3">
                        <div className={cn('mt-0.5 shrink-0', config.icon)}>
                          <NotificationIcon type={notif.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-sm font-bold leading-tight', config.icon)}>
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1', config.dot)} />
                            )}
                          </div>
                          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{notif.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-slate-600 text-[10px] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(notif.createdAt)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notif.isRead && (
                                <button
                                  onClick={() => markReadMutation.mutate(notif.id)}
                                  className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                                  title="Mark as read"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteMutation.mutate(notif.id)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                title="Dismiss"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-slate-800 p-3">
                <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group">
                  View Notification History
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
