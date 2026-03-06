'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Bell, Search, Filter, Calendar, ChevronRight, 
  ArrowLeft, Clock, User, Briefcase, FileText,
  AlertCircle, CheckCircle2, History
} from 'lucide-react';
import api from '@/lib/api';
import Header from '@/components/Header';
import { ActivityLog, renderActivityMessage } from '@/utils/activityRenderer';
import { motion, AnimatePresence } from 'framer-motion';

export default function ActivityHistoryPage() {
  const { id: companyId } = useParams() as { id: string };
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'journal' | 'invoice' | 'payment'>('all');

  // Get current user for renderer (following dashboard pattern)
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? JSON.parse(userStr) : null;
  const currentUserId = user?.id || '';

  const { data: activities, isLoading } = useQuery({
    queryKey: ['company-activities', companyId, filter],
    queryFn: async () => {
      const res = await api.get(`/company/${companyId}/activities`);
      return res.data.data as ActivityLog[];
    },
    enabled: !!companyId,
    refetchInterval: 60000,
  });

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter(activity => {
      const message = renderActivityMessage(activity, currentUserId, 'Owner'); // Role placeholder, refined later
      const matchesSearch = message.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || activity.entityType.toLowerCase() === filter;
      return matchesSearch && matchesFilter;
    });
  }, [activities, search, filter, currentUserId]);

  const stats = useMemo(() => {
    if (!activities) return { total: 0, journals: 0, invoices: 0, payments: 0 };
    return {
      total: activities.length,
      journals: activities.filter(a => a.entityType === 'journal').length,
      invoices: activities.filter(a => a.entityType === 'invoice').length,
      payments: activities.filter(a => a.entityType === 'payment').length,
    };
  }, [activities]);

  const breadcrumbs = `Dashboard / Activity Audit`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header 
        companyId={companyId} 
        breadcrumbs={breadcrumbs} 
        role={user?.role || 'User'} 
        unreadCount={0} 
      />

      <main className="p-4 sm:p-8 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <History className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Activity Audit Trail</h1>
            </div>
            <p className="text-slate-500 font-medium">A complete, role-based history of all critical actions</p>
          </div>

          <div className="flex items-center gap-3">
             <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="text-center px-4 border-r border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Logs</p>
                  <p className="text-xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Pending Actions</p>
                  <p className="text-xl font-black text-blue-600">{activities?.filter(a => a.action === 'CREATED' || a.action === 'VERIFIED').length || 0}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-3 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 mb-8 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by action, user, or document number..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
            {(['all', 'journal', 'invoice', 'payment'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={t === filter 
                  ? "px-5 py-2 bg-white text-blue-600 shadow-sm rounded-xl font-black text-xs uppercase tracking-wider transition-all"
                  : "px-5 py-2 text-slate-500 hover:text-slate-700 font-bold text-xs uppercase tracking-wider transition-all"
                }
              >
                {t}
              </button>
            ))}
          </div>
          
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 ml-auto">
            <Calendar className="w-4 h-4" />
            Date Range
          </button>
        </div>

        {/* List Section */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 font-bold">Synchronizing activity stream...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="bg-white rounded-[40px] border border-slate-100 p-20 text-center shadow-sm">
               <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                 <History className="w-10 h-10 text-slate-300" />
               </div>
               <h3 className="text-xl font-black text-slate-900 mb-2">No Activities Found</h3>
               <p className="text-slate-500 font-medium max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredActivities.map((activity, idx) => {
                  const message = renderActivityMessage(activity, currentUserId, user?.role || 'User');
                  const href = activity.entityType === 'journal' ? `/company/${companyId}/journals` : '#';
                  
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all flex flex-col md:flex-row md:items-center gap-6"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors group-hover:scale-110 duration-300 ${
                          activity.action.includes('REJECTED') ? 'bg-red-50 text-red-500' :
                          activity.action === 'APPROVED' ? 'bg-emerald-50 text-emerald-500' :
                          'bg-blue-50 text-blue-500'
                        }`}>
                          {activity.entityType === 'journal' ? <FileText className="w-6 h-6" /> :
                           activity.entityType === 'invoice' ? <Briefcase className="w-6 h-6" /> :
                           <Bell className="w-6 h-6" />}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                               {activity.entityType}
                             </span>
                             <span className="text-[10px] font-black text-slate-400">•</span>
                             <span className="text-[10px] font-bold text-slate-400">
                               {new Date(activity.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                             </span>
                          </div>
                          <p className="text-slate-900 font-bold leading-tight group-hover:text-blue-600 transition-colors">
                            {message}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-center md:items-end gap-2 md:gap-1 shrink-0 ml-auto md:ml-0">
                         <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </div>
                         <button 
                           onClick={() => href !== '#' && router.push(href)}
                           className="flex items-center gap-1 px-4 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"
                         >
                           View Details
                           <ChevronRight className="w-3 h-3" />
                         </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
