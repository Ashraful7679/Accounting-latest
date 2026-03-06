'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Plus, FileText, Receipt } from 'lucide-react';
import UserDropdown from './UserDropdown';
import NotificationPanel from './NotificationPanel';

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

  useEffect(() => {
    if (!propRole) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      setRole(roles[0] || 'User');
    }
    // In a real app, we'd fetch permissions from an API or context
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
