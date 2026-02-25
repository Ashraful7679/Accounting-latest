'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { 
  Building2, Users, FileText, Receipt, TrendingUp, LogOut, 
  CreditCard, Package, FileBarChart, Settings, DollarSign,
  LayoutDashboard, BookOpen, ClipboardList, Bell, ChevronRight,
  Plus, AlertCircle, ArrowUpRight, ArrowDownRight, Briefcase, User,
  Calendar, ShieldCheck, History, CheckCircle2, Database
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  companyName: string;
  role?: string;
}

export default function Sidebar({ companyName, role: propRole }: SidebarProps) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const companyId = params.id as string;

  const [role, setRole] = React.useState(propRole || 'User');
  const [displayName, setDisplayName] = React.useState('User');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (!propRole) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      setRole(roles[0] || 'User');
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setDisplayName(user.firstName || 'User');
      } catch (e) {
        console.error('Failed to parse user from localStorage');
      }
    }
  }, [propRole]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const menuItems = [
    { name: 'Dashboard', href: `/company/${companyId}/dashboard`, icon: LayoutDashboard },
    { name: 'Chart of Accounts', href: `/company/${companyId}/accounts`, icon: ClipboardList },
    { name: 'Vouchers', href: `/company/${companyId}/journals`, icon: BookOpen },
    { name: 'Bank Recon.', href: `/company/${companyId}/bank/reconcile`, icon: CheckCircle2 },
    { name: 'LC & Banking', href: `/company/${companyId}/finance`, icon: Briefcase },
    { name: 'Receivable', href: `/company/${companyId}/customers`, icon: Users },
    { name: 'Payable', href: `/company/${companyId}/vendors`, icon: CreditCard },
    { name: 'Reports', href: `/company/${companyId}/reports`, icon: FileBarChart },
    // { name: 'Period Closing', href: `/company/${companyId}/closing`, icon: Calendar },
    // { name: 'Settings', href: `/company/${companyId}/settings`, icon: Settings },
    { name: 'Backup', href: `/company/${companyId}/settings/backup`, icon: Database },
    { name: 'Profile', href: `/owner/profile`, icon: User },
    // { name: 'Audit Trail', href: `/company/${companyId}/audit`, icon: History },
  ];

  const isActive = (itemHref: string) => {
    return pathname === itemHref;
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0F172A] border-r border-[#1E293B] z-40 hidden lg:block shadow-2xl print-hide">
      <div className="p-6">
        <Link href="/owner/dashboard" className="flex items-center gap-3 mb-10 transition-transform active:scale-95 group">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:rotate-6 transition-transform">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-white font-bold text-lg leading-tight truncate">{companyName}</h1>
            <p className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">Accounting Pro</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive(item.href) 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-400 hover:text-white hover:bg-[#1E293B]"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform group-hover:scale-110", 
                isActive(item.href) ? "text-white" : "text-slate-400 group-hover:text-blue-400"
              )} />
              <span className="font-medium text-sm">{item.name}</span>
              {isActive(item.href) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </Link>
          ))}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6">
        <div className="bg-[#1E293B] rounded-2xl p-4 mb-4 border border-[#334155] shadow-inner">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter mb-1 opacity-60">Session</p>
          <p className="text-white font-bold truncate text-sm">{displayName}</p>
          <div className="mt-2 text-[10px] bg-blue-600/20 text-blue-400 font-extrabold px-2 py-0.5 rounded inline-block uppercase tracking-wider border border-blue-500/30">
            {role}
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-black text-xs uppercase tracking-widest">Logout System</span>
        </button>
      </div>
    </aside>
  );
}
