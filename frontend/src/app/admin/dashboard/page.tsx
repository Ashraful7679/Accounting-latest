'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Users, 
  Building2, 
  ShieldCheck, 
  Activity, 
  Database, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Lock,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface SystemActivity {
  totalCompanies: number;
  totalOwners: number;
  totalUsers: number;
  activeCompanies: number;
  systemUsers: number;
  blockedUsers: number;
  totalTransactions?: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const { data: activity, isLoading } = useQuery({
    queryKey: ['admin-system-activity'],
    queryFn: async () => {
      const response = await api.get('/admin/activity');
      return response.data.data as SystemActivity;
    },
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = user.roles || [];

    if (!token || !roles.includes('Admin')) {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const statCards = [
    { label: 'Total Companies', value: activity?.totalCompanies || 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Platform Owners', value: activity?.totalOwners || 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'System Users', value: activity?.systemUsers || 0, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Blocked Accounts', value: activity?.blockedUsers || 0, icon: Lock, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white z-40 hidden lg:block border-r border-slate-800 shadow-2xl">
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 bg-blue-600 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-blue-900/50">A</div>
            <span className="text-xl font-black tracking-tighter">AccaBiz <span className="text-blue-400">Admin</span></span>
          </div>
          
          <nav className="space-y-2 flex-1">
            <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3.5 bg-blue-600/10 text-blue-400 rounded-2xl font-black transition-all border border-blue-600/20">
              <LayoutDashboard className="w-5 h-5" />
              Overview
            </Link>
            <Link href="/admin/owners" className="flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl font-black transition-all group">
              <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Owners
            </Link>
            <Link href="/admin/companies" className="flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl font-black transition-all group">
              <Building2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Companies
            </Link>
            <Link href="/admin/audit-logs" className="flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl font-black transition-all group">
              <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Audit Logs
            </Link>
            <Link href="/admin/settings" className="flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl font-black transition-all group">
              <Settings className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Settings
            </Link>
          </nav>

          <div className="pt-8 border-t border-slate-800">
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3.5 w-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-2xl font-black transition-all">
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:ml-64 p-10 max-w-[1600px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Infrastructure Hub</h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Global System Control Center</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Mainframe Operational</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white p-7 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group cursor-default">
              <div className="flex items-center justify-between mb-6">
                <div className={`h-14 w-14 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-black bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100">
                  <TrendingUp className="w-3 h-3" />
                  +12.5%
                </div>
              </div>
              <p className="text-4xl font-black text-slate-900 mb-1 leading-none">{isLoading ? '...' : stat.value}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm p-10">
               <div className="flex items-center justify-between mb-10">
                 <div>
                   <h2 className="text-2xl font-black text-slate-900">Platform Backbone</h2>
                   <p className="text-slate-500 font-medium text-sm">Real-time infrastructure health and service status</p>
                 </div>
                 <Link href="/admin/settings" className="px-5 py-2 bg-slate-50 text-[10px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-all">Config</Link>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 flex items-center gap-5 hover:border-blue-200 transition-colors group">
                    <div className="h-14 w-14 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                      <Database className="w-7 h-7 group-hover:rotate-12 transition-transform" />
                    </div>
                    <div>
                       <p className="text-lg font-black text-slate-900">Neon Postgres</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Main Node Connected</p>
                    </div>
                  </div>
                  <div className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 flex items-center gap-5 hover:border-emerald-200 transition-colors group">
                    <div className="h-14 w-14 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                      <ShieldCheck className="w-7 h-7 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                       <p className="text-lg font-black text-slate-900">RBAC Secure</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Isolated</p>
                    </div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                 <div>
                   <h2 className="text-2xl font-black text-slate-900">Traffic Analysis</h2>
                   <p className="text-slate-500 font-medium text-sm">System-wide transaction and load monitoring</p>
                 </div>
                 <Activity className="w-6 h-6 text-slate-300" />
               </div>
               <div className="p-10 text-center">
                 <div className="h-56 w-full rounded-[40px] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center group hover:bg-slate-100/50 transition-colors">
                    <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Real-time Telemetry Data Loading...</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="space-y-10">
             <div className="bg-slate-900 rounded-[48px] p-10 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20 group">
               <div className="relative z-10">
                 <div className="h-14 w-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
                    <Database className="w-7 h-7" />
                 </div>
                 <h3 className="text-2xl font-black mb-3">Backup Engine</h3>
                 <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">Execute full system snapshots or targeted company data extraction with military-grade encryption.</p>
                 <Link href="/admin/backups" className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-[20px] font-black text-sm hover:bg-blue-50 transition-all w-full justify-center shadow-lg group-hover:scale-105 transition-all">
                   Manage Backups
                   <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                 </Link>
               </div>
               <Database className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 rotate-12" />
             </div>

             <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm p-10">
               <div className="flex items-center gap-3 mb-8">
                 <div className="h-10 w-10 bg-red-50 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900">Security Pulse</h3>
               </div>
               <div className="space-y-6">
                 {activity?.blockedUsers && activity.blockedUsers > 0 ? (
                    <div className="p-6 rounded-[32px] bg-red-50 border border-red-100 flex items-start gap-4">
                      <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 animate-ping"></div>
                      <div>
                        <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1">Suspended Nodes</p>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">{activity.blockedUsers} accounts have active restriction orders.</p>
                      </div>
                    </div>
                 ) : (
                    <div className="p-6 rounded-[32px] bg-emerald-50 border border-emerald-100 flex items-start gap-4">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Security Status</p>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">No intrusion attempts or security breaches detected.</p>
                      </div>
                    </div>
                 )}
                 <Link href="/admin/owners?filter=blocked" className="block text-center text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">View Security Log</Link>
               </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}