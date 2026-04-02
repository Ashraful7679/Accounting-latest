'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Users, FileText, Receipt, TrendingUp, LogOut, 
  CreditCard, Package, FileBarChart, Settings, DollarSign,
  LayoutDashboard, BookOpen, ClipboardList, Bell, ChevronRight,
  Plus, AlertCircle, ArrowUpRight, ArrowDownRight, Briefcase, User,
  Globe, TrendingDown, Landmark, Filter, Download, Printer, ArrowLeft,
  Calendar, Layers, Search, ArrowUp, ArrowDown, RefreshCw, Clock, ExternalLink
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ActivityLog, renderActivityMessage } from '@/utils/activityRenderer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899'];

interface DashboardData {
  role: string;
  companyName: string;
  kpis: Record<string, any>;
  charts: { name: string; data: any[]; type: string }[];
  alerts: any[];
  unreadCount: number;
  lastBackup?: {
    timestamp: string;
    fileName: string;
    status: string;
  } | null;
  actions: { label: string; href: string; icon?: string }[];
}

export default function CompanyDashboard() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) router.push('/login');
  }, [router]);

  const { data: dashboardResponse, isLoading, isError, error } = useQuery({
    queryKey: ['company-dashboard-stats', companyId],
    queryFn: async () => {
      const res = await api.get(`/company/${companyId}/dashboard-stats`);
      return res.data.data as DashboardData;
    },
    enabled: !!companyId,
    refetchInterval: 30000,
  });

  if (!mounted || isLoading || !dashboardResponse) return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold tracking-tight">Syncing Command Center...</p>
      </div>
    </div>
  );

  const { kpis, charts, alerts, actions, companyName } = dashboardResponse;

  const formatCurrency = (val: any) => {
    const num = Number(val);
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(num || 0);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs font-bold" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50/30 p-4 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8 text-blue-600" />
              Pulse Dashboard
            </h1>
            <p className="text-slate-500 font-bold mt-1 ml-11 uppercase text-[10px] tracking-widest">{companyName} &bull; Operational Health</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden md:flex flex-col items-end mr-4">
                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Today's Date</p>
                <p className="text-sm font-black text-slate-700">{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
             </div>
             <button onClick={() => window.location.reload()} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
                <RefreshCw className="w-5 h-5 text-slate-600" />
             </button>
             <Link href={`/company/${companyId}/reports`} className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
                <FileBarChart className="w-4 h-4" />
                Reports
             </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Content Area (75%) */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* KPI Row (Compact) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Revenue', key: 'revenue', icon: <TrendingUp />, color: 'text-emerald-600', bg: 'bg-emerald-50', reportId: 'p-l' },
                { label: 'Cash Flow', key: 'cash', icon: <DollarSign />, color: 'text-blue-600', bg: 'bg-blue-50', reportId: 'cash-flow' },
                { label: 'Receivables', key: 'receivables', icon: <ArrowUpRight />, color: 'text-indigo-600', bg: 'bg-indigo-50', reportId: 'receivables' },
                { label: 'Payables', key: 'payables', icon: <ArrowDownRight />, color: 'text-rose-600', bg: 'bg-rose-50', reportId: 'payables' }
              ].map((kpi) => (
                <motion.div 
                  key={kpi.key}
                  whileHover={{ y: -4 }}
                  className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group cursor-pointer"
                  onClick={() => router.push(`/company/${companyId}/reports?id=${kpi.reportId}`)}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform", kpi.bg, kpi.color)}>
                    {kpi.icon}
                  </div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{kpi.label}</p>
                  <h3 className="text-lg font-black text-slate-900 mt-1">{formatCurrency(kpis[kpi.key]?.value || kpis[kpi.key])}</h3>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Charts Row 1: Primary Trends */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Revenue vs Expenses Bar Chart */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Revenue vs Expenses</h3>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-600"/>Revenue</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300"/>Expenses</div>
                  </div>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.find(c => c.name === 'Revenue vs Expenses')?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748B' }} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={24} name="Revenue" />
                      <Bar dataKey="expense" fill="#E2E8F0" radius={[6, 6, 0, 0]} barSize={24} name="Expense" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Net Cash Flow Area Chart */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Net Cash Flow Trend</h3>
                  <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black">LAST 6 MONTHS</div>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.find(c => c.name === 'Monthly Net Cash Flow')?.data || []}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748B' }} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name="Net Flow" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 2: Distribution Mix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Buyer Distribution Pie */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8">Revenue Mix by Buyer</h3>
                <div className="h-[300px] flex items-center">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.find(c => c.name === 'Revenue by Buyer')?.data || []}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {charts.find(c => c.name === 'Revenue by Buyer')?.data?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-3">
                    {charts.find(c => c.name === 'Revenue by Buyer')?.data?.slice(0, 5).map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-[10px] font-black text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-900">{formatCurrency(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Liquidity Breakdown Pie */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-8">Liquidity Position</h3>
                <div className="h-[300px] flex items-center">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.find(c => c.name === 'Cash Position')?.data || []}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {charts.find(c => c.name === 'Cash Position')?.data?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-3">
                    {charts.find(c => c.name === 'Cash Position')?.data?.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[(idx + 2) % COLORS.length] }} />
                          <span className="text-[10px] font-black text-slate-600 truncate max-w-[100px]">{entry.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-900">{formatCurrency(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[
                 { label: 'Reconcile Bank', href: `/company/${companyId}/bank/reconcile`, icon: <Landmark />, color: 'bg-indigo-600' },
                 { label: 'New Journal', href: `/company/${companyId}/journals`, icon: <Plus />, color: 'bg-slate-900' },
                 { label: 'Procurement', href: `/company/${companyId}/purchase/orders`, icon: <Package />, color: 'bg-blue-600' }
               ].map((action, i) => (
                 <Link key={i} href={action.href} className={cn("p-6 rounded-[28px] text-white flex items-center justify-between group hover:scale-[1.02] transition-all shadow-lg", action.color)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                        {action.icon}
                      </div>
                      <div>
                        <h4 className="font-black text-lg leading-tight">{action.label}</h4>
                        <p className="text-[10px] font-bold opacity-70 uppercase">Trigger Workflow</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
                 </Link>
               ))}
            </div>

          </div>

          {/* Right Sidebar (25%) - Activity Hub */}
          <div className="lg:col-span-1">
            <div className="bg-[#0F172A] rounded-[40px] p-8 shadow-2xl sticky top-8 border border-slate-800 h-[calc(100vh-64px)] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  Live Pulse
                </h3>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black">{alerts.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <AnimatePresence>
                  {alerts.map((activity, idx) => {
                    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                    const userId = userStr ? JSON.parse(userStr).id : '';
                    const message = renderActivityMessage(activity, userId, dashboardResponse.role || '');
                    
                    return (
                      <motion.div
                        key={activity.id || idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-5 rounded-3xl border border-slate-800/50 bg-slate-800/20 hover:bg-slate-800/40 transition-all group/item cursor-pointer"
                        onClick={() => activity.link && router.push(activity.link)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-slate-700 font-bold text-[10px] flex items-center justify-center text-white shrink-0">
                            {activity.user?.firstName?.[0] || 'A'}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-200 leading-snug">{message}</p>
                            <div className="flex items-center justify-between mt-3">
                               <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                 <Clock className="w-3 h-3" />
                                 {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </p>
                               {activity.link && (
                                 <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    <ChevronRight className="w-3 h-3 text-white" />
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-800">
                <button className="w-full py-4 bg-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-2">
                  View Full Audit Log
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
