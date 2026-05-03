'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, ShoppingCart, Briefcase, Clock, FileText } from 'lucide-react';
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
  const { exchangeRate } = useCompany();
  const [notifOpen, setNotifOpen] = useState(false);
  const [role, setRole] = useState(propRole || 'User');
  const [time, setTime] = useState(new Date());

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
  }, [propRole]);

  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
      {/* Left: Breadcrumbs */}
      <div className="pl-10 lg:pl-0">
        <h2 className="text-slate-500 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
          {breadcrumbs.split('/').map((part, i, arr) => (
            <React.Fragment key={i}>
              <span className={i === arr.length - 1 ? "text-slate-900" : ""}>{part.trim()}</span>
              {i < arr.length - 1 && <span className="text-slate-300">/</span>}
            </React.Fragment>
          ))}
        </h2>
      </div>

      {/* Center: Clock & Global Exchange Rate */}
      <div className="hidden lg:flex items-center gap-6 px-5 py-2 bg-slate-50 border border-slate-200 rounded-sm">
        <div className="flex items-center gap-2 text-slate-600 border-r border-slate-200 pr-6">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-black font-mono text-slate-900">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">USD/BDT:</span>
          <span className="text-xs font-black font-mono text-emerald-600">
            {exchangeRate || '---'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Global Action Menus */}
        <div className="hidden md:flex items-center gap-3">
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">
              <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              <span>Sales</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <Link href={`/company/${companyId}/sales/orders/create?type=local`} className="block px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-blue-50 hover:text-blue-700">New Local Order</Link>
              <Link href={`/company/${companyId}/sales/orders/create?type=foreign`} className="block px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-blue-50 hover:text-blue-700">New Foreign Order</Link>
              <div className="border-t border-slate-100" />
              <Link href={`/company/${companyId}/sales/invoices/create`} className="block px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-blue-50 hover:text-blue-700">Quick Invoice</Link>
            </div>
          </div>

          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors">
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
              <span>Purchase</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-sm shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <Link href={`/company/${companyId}/purchase/orders/create?type=local`} className="block px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-700">New Local PO</Link>
              <Link href={`/company/${companyId}/purchase/orders/create?type=foreign`} className="block px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-700">New Foreign PO</Link>
              <div className="border-t border-slate-100" />
              <Link href={`/company/${companyId}/purchase/invoices/create`} className="block px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-700">Quick Bill</Link>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />
        <CompanySwitcher />
        <div className="h-6 w-px bg-slate-200" />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
            )}
          </button>
          <NotificationPanel
            companyId={companyId}
            isOpen={notifOpen}
            onClose={() => setNotifOpen(false)}
          />
        </div>

        <div className="h-6 w-px bg-slate-200" />
        <UserDropdown role={role} />
      </div>
    </header>
  );
}
