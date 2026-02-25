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
  Calendar, Layers, Search, ArrowUp, ArrowDown, RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Sidebar from '@/components/Sidebar';
import NotificationPanel from '@/components/NotificationPanel';
import UserDropdown from '@/components/UserDropdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardData {
  role: string;
  companyName: string;
  kpis: Record<string, any>; // Relaxed for complex objects
  charts: any[];
  alerts: { type: 'warning' | 'danger' | 'info'; title?: string; message: string; id?: string; createdAt?: string }[];
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
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: dashboardResponse, isLoading, isError, error } = useQuery({
    queryKey: ['company-dashboard-stats', companyId],
    queryFn: async () => {
      try {
        console.log('Fetching dashboard stats for:', companyId);
        const response = await api.get(`/company/${companyId}/dashboard-stats`);
        return response.data.data as DashboardData;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: !!companyId,
    refetchInterval: 30000,
    retry: 1
  });

  if (!mounted) return null;

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-red-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Dashboard Error</h2>
          <p className="text-slate-500 font-medium mb-6">
            {(error as any)?.response?.data?.message || 'Failed to load dashboard statistics.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all"
          >
            Retry Loading
          </button>
          <Link href="/owner/dashboard" className="block mt-4 text-sm font-bold text-blue-600 hover:underline">
            Back to Companies
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !dashboardResponse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium tracking-tight">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const { role, companyName, kpis, alerts, actions } = dashboardResponse;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  // menuItems moved to Sidebar component

  const formatCurrency = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return 'BDT 0';
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(num);
  };

  // KPI Label Formatter
  const getKpiLabel = (key: string) => {
    const labels: Record<string, string> = {
      revenue: 'Total Revenue',
      growth: 'Growth %',
      cash: 'Cash & BankBalance',
      receivables: 'Receivables',
      payables: 'Payables',
      loans: 'Loan Outstanding',
      netCash: 'Net Liquidity',
      currentRatio: 'Current Ratio',
      monthlyCashFlow: 'Monthly Cash Flow',
      dailyCollection: 'Daily Collection',
      todayPayments: 'Today Payments',
      pendingBills: 'Pending Bills',
      pendingVouchers: 'Pending Vouchers',
      unpostedEntries: 'Unposted Entries',
      unreconciledBank: 'Unreconciled Bank'
    };
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const getKpiIcon = (key: string) => {
    if (key === 'revenue' || key === 'dailyCollection') return <TrendingUp className="w-5 h-5 text-emerald-600" />;
    if (key === 'growth') return <TrendingUp className="w-5 h-5 text-blue-600" />;
    if (key === 'cash' || key === 'cashPosition' || key === 'netCash') return <DollarSign className="w-5 h-5 text-emerald-600" />;
    if (key === 'receivables') return <ArrowUpRight className="w-5 h-5 text-blue-600" />;
    if (key === 'payables') return <ArrowDownRight className="w-5 h-5 text-red-600" />;
    if (key === 'loans') return <CreditCard className="w-5 h-5 text-orange-600" />;
    if (key === 'currentRatio') return <FileBarChart className="w-5 h-5 text-purple-600" />;
    return <ClipboardList className="w-5 h-5 text-gray-600" />;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName={companyName} />

      {/* Main Content */}
        <main className="lg:pl-64 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
          {/* Left: breadcrumb (desktop) or spacer for mobile hamburger */}
          <div className="pl-10 lg:pl-0">
            <h2 className="text-slate-500 text-sm font-medium">Dashboard / <span className="text-slate-900">{role} Perspective</span></h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {(dashboardResponse.unreadCount || 0) > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
                )}
              </button>
              <NotificationPanel
                companyId={companyId}
                isOpen={notifOpen}
                onClose={() => setNotifOpen(false)}
              />
            </div>
            <div className="h-6 w-px bg-slate-200" />
            {/* Profile Dropdown */}
            <UserDropdown role={role} />
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Financial Command Center</h1>
                <p className="text-slate-500 font-medium mt-1">Real-time pulse of your company's fiscal health</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                {/* Backup Status Widget */}
                {dashboardResponse.lastBackup && (
                  <Link 
                    href={`/company/${companyId}/settings/backup`}
                    className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 hover:border-blue-200 transition-colors group"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      dashboardResponse.lastBackup.status === 'SUCCESS' ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1 group-hover:text-blue-500">Last Backup</p>
                      <p className="text-[11px] font-bold text-slate-700">
                        {new Date(dashboardResponse.lastBackup.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })} – {new Date(dashboardResponse.lastBackup.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </Link>
                )}
                <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 h-[46px]">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            </div>

          {/* Tier 1: Cash Flow Summary (RMG Priority) */}
          {kpis.monthlyCashFlow && (
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-[#0F172A] rounded-[32px] p-8 shadow-xl border border-slate-800 relative overflow-hidden group"
             >
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                 <RefreshCw className="w-32 h-32 text-blue-500" />
               </div>
               
               <div className="relative z-10 grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                 <div className="md:col-span-1 border-r border-slate-700/50 pr-8">
                   <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Opening Cash</p>
                   <h4 className="text-2xl font-black text-white">{formatCurrency(kpis.monthlyCashFlow.openingCash)}</h4>
                   <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs font-medium">
                     <Calendar className="w-3 h-3" />
                     {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                   </div>
                 </div>

                 <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
                   {['operating', 'investing', 'financing'].map((cf) => (
                      <div key={cf} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            cf === 'operating' ? "bg-blue-500" : cf === 'investing' ? "bg-indigo-400" : "bg-purple-300"
                          )} />
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{cf}</p>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className={cn(
                            "text-lg font-black",
                            kpis.monthlyCashFlow[cf].net >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {kpis.monthlyCashFlow[cf].net >= 0 ? '+' : ''}{formatCurrency(kpis.monthlyCashFlow[cf].net)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-500">In:</span>
                            <span className="text-emerald-500/80">+{formatCurrency(kpis.monthlyCashFlow[cf].inflows)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-500">Out:</span>
                            <span className="text-red-500/80">-{formatCurrency(kpis.monthlyCashFlow[cf].outflows)}</span>
                          </div>
                        </div>
                      </div>
                   ))}
                 </div>

                 <div className="md:col-span-1 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 text-center">
                   <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Closing Cash</p>
                   <h4 className="text-2xl font-black text-white">{formatCurrency(kpis.monthlyCashFlow.closingCash)}</h4>
                   <div className={cn(
                     "mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                     kpis.monthlyCashFlow.netCashFlow >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                   )}>
                     {kpis.monthlyCashFlow.netCashFlow >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                     {formatCurrency(Math.abs(kpis.monthlyCashFlow.netCashFlow))} Net
                   </div>
                 </div>
               </div>
             </motion.div>
          )}

          {/* Tier 2: Core Metrics Grid (4 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {Object.entries(kpis).filter(([key]) => key !== 'monthlyCashFlow').map(([key, data], idx) => {
              const label = getKpiLabel(key);
              const icon = getKpiIcon(key);
              
              // Handle both new object structure and legacy numbers
              const value = typeof data === 'object' ? data.value : data;
              const hasBreakdown = typeof data === 'object' && (data.breakdown || data.movement);
              
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => key === 'receivables' && router.push(`/company/${companyId}/receivables-search`)}
                  className={cn(
                    "bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 group relative transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50",
                    key === 'receivables' && "cursor-pointer hover:border-blue-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      {icon}
                    </div>
                    {key === 'revenue' && data.growth > 0 && (
                      <div className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {Number(data.growth).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
                    <div className="flex items-end gap-1">
                      <h3 className="text-2xl font-black text-slate-900 leading-none">
                        {key === 'growth' ? `${Number(value).toFixed(1)}%` : 
                         key === 'currentRatio' ? Number(typeof data === 'object' ? data.value : data).toFixed(2) :
                         !['pendingVouchers', 'pendingTasks', 'unreadCount'].includes(key) ? formatCurrency(value) : value}
                      </h3>
                    </div>
                  </div>

                  {/* PRO POPUP breakdown */}
                  {hasBreakdown && (
                    <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 z-[100] hidden group-hover:block animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                      
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{label} Breakdown</h4>
                        <span className="text-[10px] font-bold text-slate-400">Current Period</span>
                      </div>

                      <div className="space-y-3">
                        {data.breakdown && data.breakdown.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {data.breakdown.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500 font-medium">✔ {item.label}</span>
                                  <span className="text-slate-900 font-bold">{key === 'currentRatio' && i === 0 ? formatCurrency(item.amount) : (key === 'currentRatio' ? formatCurrency(item.amount) : formatCurrency(item.amount || item.outstanding || item.principal))}</span>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-dashed border-slate-100 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-900 uppercase">Total {label}</span>
                              <span className="text-sm font-black text-blue-600">{formatCurrency(value)}</span>
                            </div>
                          </>
                        ) : data.movement ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-xl">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase">Received</span>
                              <span className="text-xs font-black text-emerald-700">+{formatCurrency(data.movement.received)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-red-50 rounded-xl">
                              <span className="text-[10px] font-bold text-red-600 uppercase">Paid</span>
                              <span className="text-xs font-black text-red-700">-{formatCurrency(data.movement.paid)}</span>
                            </div>
                            <div className="pt-1 flex justify-between items-center text-[10px]">
                              <span className="font-bold text-slate-400">NET CHANGE</span>
                              <span className={cn("font-black", (data.movement.received - data.movement.paid) >= 0 ? "text-emerald-600" : "text-red-600")}>
                                {formatCurrency(data.movement.received - data.movement.paid)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-center py-4 text-xs italic text-slate-400">No detailed breakdown available</p>
                        )}

                        {key === 'revenue' && (
                          <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                             <div className="flex justify-between items-center text-[10px]">
                               <span className="font-bold text-slate-400 uppercase">Last Month</span>
                               <span className="font-bold text-slate-600">{formatCurrency(data.lastMonth)}</span>
                             </div>
                             <div className="flex justify-between items-center text-[10px]">
                               <span className="font-bold text-slate-400 uppercase">Growth</span>
                               <span className={cn("font-black", data.growth >= 0 ? "text-emerald-600" : "text-red-500")}>
                                 {data.growth >= 0 ? '+' : ''}{Number(data.growth).toFixed(1)}%
                               </span>
                             </div>
                          </div>
                        )}

                        {key === 'loans' && data.breakdown?.[0]?.nextEMI && (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <h5 className="text-[10px] font-black text-slate-900 uppercase mb-2">Next Installment</h5>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Due Date</p>
                                <p className="text-xs font-black text-slate-700">{new Date(data.breakdown[0].nextEMI.dueDate).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Amount</p>
                                <p className="text-sm font-black text-slate-900">{formatCurrency(data.breakdown[0].nextEMI.amount)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 flex justify-center border-t border-slate-50">
                        <Link 
                          href={key === 'receivables' ? `/company/${companyId}/receivables-search` : (key === 'netCash' || key === 'currentRatio' ? `/company/${companyId}/reports` : `/company/${companyId}/reports`)} 
                          className="text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest flex items-center gap-1 group/link"
                        >
                          View Detailed {key === 'receivables' ? 'Search' : 'Report'}
                          <ChevronRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Tier 2: Visualization & Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            {/* Cash Flow Overhaul Column (Breakdowns) */}
            <div className="xl:col-span-3 space-y-6">
              {/* Cash Flow Breakdown (Stacked Bar) */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 relative overflow-hidden h-[450px]">
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Financial Activity Breakdown</h3>
                    <p className="text-slate-500 text-sm font-medium">Operating vs Investing vs Financing</p>
                  </div>
                </div>

                <div className="h-64 mt-10 flex items-end justify-between gap-4 px-4">
                  {dashboardResponse.charts?.[1]?.data?.map((item: any, i: number) => {
                    const totalAbs = Math.abs(item.operating) + Math.abs(item.investing) + Math.abs(item.financing) || 1;
                    const opH = (Math.abs(item.operating) / totalAbs) * 100;
                    const invH = (Math.abs(item.investing) / totalAbs) * 100;
                    const finH = (Math.abs(item.financing) / totalAbs) * 100;

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="w-full relative flex flex-col items-center h-full justify-end">
                           <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-30 whitespace-nowrap hidden sm:block">
                              <p>Op: {formatCurrency(item.operating)}</p>
                              <p>Inv: {formatCurrency(item.investing)}</p>
                              <p>Fin: {formatCurrency(item.financing)}</p>
                           </div>
                           <div className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${opH}%` }} />
                           <div className="w-full bg-indigo-400" style={{ height: `${invH}%` }} />
                           <div className="w-full bg-purple-300" style={{ height: `${finH}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 mt-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operating</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-400 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Investing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-300 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Financing</span>
                  </div>
                </div>
              </div>

              {/* Cumulative Liquidity Position */}
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 relative overflow-hidden h-[450px]">
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Cumulative Cash Position</h3>
                    <p className="text-slate-500 text-sm font-medium">Liquidity trend over time</p>
                  </div>
                </div>
                
                <div className="h-64 mt-10 relative px-4">
                  <div className="absolute inset-x-0 bottom-0 h-px bg-slate-100" />
                  <div className="flex items-end justify-between h-full relative">
                    {dashboardResponse.charts?.[2]?.data?.map((item: any, i: number) => {
                       const max = Math.max(...dashboardResponse.charts[2].data.map((d:any) => d.value), 1);
                       const bottom = (item.value / max) * 100;
                       return (
                         <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div 
                              className="absolute w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-lg transition-transform hover:scale-150 z-10" 
                              style={{ bottom: `${bottom}%` }}
                            >
                               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                                 {formatCurrency(item.value)}
                               </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase absolute -bottom-8">{item.name}</span>
                         </div>
                       );
                    })}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
                       <path 
                         d={(() => {
                            const data = dashboardResponse.charts?.[2]?.data || [];
                            if (data.length < 2) return "";
                            const max = Math.max(...data.map((d:any) => d.value), 1);
                            return data.map((d: any, i: number) => {
                               const x = (i / (data.length - 1)) * 100;
                               const y = 100 - (d.value / max) * 100;
                               return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                            }).join(" ");
                         })()}
                         fill="none" 
                         stroke="#2563EB" 
                         strokeWidth="3"
                         vectorEffect="non-scaling-stroke"
                        />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts & Context Column (Now on Right, 2 cols wide in 5-grid) */}
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-[#0F172A] rounded-[32px] p-8 shadow-xl border border-slate-800 h-full">
                <Link 
                  href={`/company/${companyId}/notifications`}
                  className="flex items-center justify-between mb-8 group hover:opacity-80 transition-opacity"
                >
                  <h3 className="text-xl font-bold text-white flex items-center gap-3">
                    <Bell className="w-6 h-6 text-blue-500 group-hover:text-blue-400 transition-colors" />
                    Priority Alerts
                  </h3>
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full">{alerts.length}</span>
                </Link>

                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {alerts.map((alert, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "p-4 rounded-2xl border flex gap-4 transition-all hover:translate-x-1",
                          alert.type === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                          alert.type === 'danger' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                          "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        )}
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold leading-tight">{alert.message}</p>
                          <p className="text-[10px] font-medium opacity-60 mt-1">
                            {alert.createdAt ? new Date(alert.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Recently'}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {alerts.length === 0 && (
                    <div className="text-center py-20 text-slate-500">
                      <p className="font-bold">No critical alerts for today.</p>
                    </div>
                  )}
                </div>

                <Link 
                  href={`/company/${companyId}/notifications`}
                  className="w-full mt-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group decoration-none"
                >
                  Manage All Notifications
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>

          {/* Tier 3: Operations & Actions */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Operational Pulse</h3>
                <p className="text-slate-500 font-medium">Quick access to vital modules</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {actions.map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className="group bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
                      {action.label.includes('Reports') ? <FileBarChart className="w-5 h-5 text-blue-600 group-hover:text-white" /> :
                       action.label.includes('Voucher') ? <Plus className="w-5 h-5 text-blue-600 group-hover:text-white" /> :
                       action.label.includes('Profile') ? <User className="w-5 h-5 text-blue-600 group-hover:text-white" /> :
                       action.label.includes('Finance') ? <Briefcase className="w-5 h-5 text-blue-600 group-hover:text-white" /> :
                       <ArrowUpRight className="w-5 h-5 text-blue-600 group-hover:text-white" />}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{action.label}</h4>
                      <p className="text-xs text-slate-500 font-medium">Quick Navigation</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-50/50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0" />
                </Link>
              ))}
              
              {/* Contextual Action */}
              {role === 'Owner' && (
                <Link
                  href={`/company/${companyId}/accounts`}
                  className="group bg-blue-600 p-6 rounded-[24px] shadow-lg shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-600/40 transition-all duration-300 text-white"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-black">Configure Ledger</h4>
                      <p className="text-xs opacity-80 font-medium">Chart of Accounts</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
