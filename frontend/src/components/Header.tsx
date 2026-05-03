'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Plus, FileText, Receipt, Clock, Save, RefreshCw, ChevronDown, ShoppingCart, Briefcase } from 'lucide-react';
import UserDropdown from './UserDropdown';
import NotificationPanel from './NotificationPanel';
import CompanySwitcher from './CompanySwitcher';
import { useCompany } from '@/lib/CompanyContext';

interface HeaderProps {
  companyId: string;
  breadcrumbs: string;
  role?: string;
  unreadCount?: number;
}

export default function Header({ companyId, breadcrumbs, role: propRole, unreadCount = 0 }: HeaderProps) {
  const { 
    exchangeRate, baseCurrency, setExchangeRate, setBaseCurrency 
  } = useCompany();
  const [notifOpen, setNotifOpen] = useState(false);
  const [role, setRole] = useState(propRole || 'User');
  const [permissions, setPermissions] = useState<any[]>([]);
  const [time, setTime] = useState(new Date());
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  useEffect(() => {
    if (!propRole) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      setRole(roles[0] || 'User');
    }
    const storedPerms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    setPermissions(storedPerms);
  }, [propRole]);

  const canCreateInvoice = role === 'Owner' || role === 'Admin' || permissions.some(p => p.module === 'invoices' && p.canCreate);
  const canCreateVoucher = role === 'Owner' || role === 'Admin' || permissions.some(p => p.module === 'journals' && p.canCreate);

  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
      {/* Left: Breadcrumbs */}
      <div className="pl-10 lg:pl-0">
        <h2 className="text-slate-500 text-sm font-medium tracking-tight">
          {breadcrumbs.split('/').map((part, i, arr) => (
            <React.Fragment key={i}>
              <span className={i === arr.length - 1 ? "text-slate-900 font-bold" : ""}>{part.trim()}</span>
              {i < arr.length - 1 && <span className="mx-2 text-slate-300">/</span>}
            </React.Fragment>
          ))}
        </h2>
      </div>

      {/* Center: Clock & Currency */}
      <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
        {/* Clock */}
        <div className="flex items-center gap-2 text-slate-600 border-r border-slate-200 pr-4">
          <Clock className="w-4 h-4 text-blue-500" />
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-none">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[10px] text-slate-400 font-medium leading-none mt-1">
              {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Currency & Rate */}
        <div className="flex items-center gap-2 pl-4">
          <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-md shadow-sm">
            USD/BDT: <span className="text-blue-600">{exchangeRate || 'N/A'}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Global Shortcuts */}
        <div className="hidden md:flex items-center gap-3">
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Sales</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <Link href={`/company/${companyId}/sales/orders/create?type=local`} className="block px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">Local Sales</Link>
              <Link href={`/company/${companyId}/sales/orders/create?type=foreign`} className="block px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">Foreign Sales</Link>
            </div>
          </div>

          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Purchase</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <Link href={`/company/${companyId}/purchase/orders/create?type=local`} className="block px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">Local Purchase</Link>
              <Link href={`/company/${companyId}/purchase/orders/create?type=foreign`} className="block px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">Foreign Purchase</Link>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />
        
        {/* Company Switcher */}
        <CompanySwitcher />

        <div className="h-6 w-px bg-slate-200" />

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
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
  );
}
