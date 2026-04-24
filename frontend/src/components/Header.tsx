'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Plus, FileText, Receipt, Clock, Save, RefreshCw } from 'lucide-react';
import UserDropdown from './UserDropdown';
import NotificationPanel from './NotificationPanel';
import CompanySwitcher from './CompanySwitcher';

interface HeaderProps {
  companyId: string;
  breadcrumbs: string;
  role?: string;
  unreadCount?: number;
}

export default function Header({ companyId, breadcrumbs, role: propRole, unreadCount = 0 }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [role, setRole] = useState(propRole || 'User');
  const [permissions, setPermissions] = useState<any[]>([]);
  const [time, setTime] = useState(new Date());
  const [exchangeRate, setExchangeRate] = useState(1);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/company/${companyId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success && json.data) {
          setBaseCurrency(json.data.baseCurrency || 'USD');
          setExchangeRate(json.data.settings?.lastUsedRate || 1);
        }
      } catch (err) {
        console.error('Failed to fetch settings', err);
      }
    };
    if (companyId) fetchSettings();
  }, [companyId]);

  const saveSettings = async (rate: number, currency: string) => {
    setIsSavingRate(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/company/${companyId}/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ lastUsedRate: rate, baseCurrency: currency })
      });
    } catch (err) {
      console.error('Failed to update settings', err);
    } finally {
      setIsSavingRate(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base Currency</span>
            <select 
              value={baseCurrency}
              onChange={(e) => {
                const val = e.target.value;
                setBaseCurrency(val);
                saveSettings(exchangeRate, val);
              }}
              className="text-xs font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-500"
            >
              <option value="USD">USD</option>
              <option value="BDT">BDT</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          
          <span className="text-slate-300">=</span>
          
          <div className="flex flex-col relative group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Spot Rate</span>
            <div className="relative">
              <input 
                type="number" 
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value))}
                onBlur={() => saveSettings(exchangeRate, baseCurrency)}
                className="w-20 text-xs font-bold bg-white border border-slate-200 rounded px-2 py-0.5 outline-none focus:border-blue-500 text-right pr-6"
              />
              {isSavingRate ? (
                <RefreshCw className="w-3 h-3 text-slate-400 animate-spin absolute right-1.5 top-1" />
              ) : (
                <Save className="w-3 h-3 text-emerald-500 absolute right-1.5 top-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Global Shortcuts */}
        <div className="hidden md:flex items-center gap-2">
          {canCreateInvoice && (
            <Link
              href={`/company/${companyId}/sales/invoices/create`}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Invoice</span>
            </Link>
          )}
          {canCreateVoucher && (
            <Link
              href={`/company/${companyId}/journals/create`}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Voucher</span>
            </Link>
          )}
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
