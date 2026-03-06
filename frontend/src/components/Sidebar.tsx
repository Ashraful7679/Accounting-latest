'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { 
  Building2, Users, FileText, Receipt, TrendingUp,
  CreditCard, Package, FileBarChart, Settings, DollarSign,
  LayoutDashboard, BookOpen, ClipboardList, Bell, ChevronRight,
  Plus, AlertCircle, ArrowUpRight, ArrowDownRight, Briefcase, User,
  Calendar, ShieldCheck, History, CheckCircle2, Database, Menu, X,
  ArrowLeftRight, Send, Wallet, FileStack
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

interface MenuItem {
  name: string;
  href?: string;
  icon?: React.ElementType;
  children?: MenuItem[];
}

export default function Sidebar({ companyName, role: propRole }: SidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const companyId = params.id as string;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Derive role from prop or localStorage (client-side only)
  const [role, setRole] = React.useState(propRole || 'User');
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    if (!propRole) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      setRole(roles[0] || 'User');
    }
  }, [propRole]);

  const isOwner = role === 'Owner' || role === 'Admin';

  // Auto-expand menus when a submenu is active
  React.useEffect(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3) {
      const activeParent = menuItems.find(item => 
        item.children?.some(child => 
          child.href && pathname.startsWith(child.href.split('/').slice(0, 4).join('/'))
        )
      );
      if (activeParent && !expandedMenus.has(activeParent.name)) {
        setExpandedMenus(prev => new Set([...prev, activeParent.name]));
      }
    }
  }, [pathname]);

  const toggleMenu = (menuName: string) => {
    if (expandedMenus.has(menuName)) {
      setExpandedMenus(new Set()); // collapse if already open
    } else {
      setExpandedMenus(new Set([menuName])); // open only this one, close all others
    }
  };

  const menuItems: MenuItem[] = [
    { name: 'Dashboard', href: `/company/${companyId}/dashboard`, icon: LayoutDashboard },
    { name: 'Products', href: `/company/${companyId}/products`, icon: Package },
    { 
      name: 'Purchase', 
      icon: CreditCard,
      children: [
        { name: 'Suppliers', href: `/company/${companyId}/vendors` },
        { name: 'Purchase Order', href: `/company/${companyId}/purchase/orders` },
        { name: 'Import LC', href: `/company/${companyId}/lc/create/import` },
        { name: 'Loan Management', href: `/company/${companyId}/lc/loans` },
        { name: 'Purchase Invoices', href: `/company/${companyId}/purchase/invoices` },
      ]
    },
    { 
      name: 'Sales', 
      icon: TrendingUp,
      children: [
        { name: 'Customers', href: `/company/${companyId}/sales/customers` },
        { name: 'Proforma Invoice', href: `/company/${companyId}/sales/pis` },
        { name: 'Export LC', href: `/company/${companyId}/lc/create/export` },
        { name: 'Sales Invoices', href: `/company/${companyId}/sales/invoices` },
      ]
    },
    { 
      name: 'Trade & Finance Hub', 
      icon: FileStack,
      children: [
        { name: 'LC All List', href: `/company/${companyId}/lc` },
        { name: 'LC PIs', href: `/company/${companyId}/lc/pis` },
        { name: 'LC Settlement', href: `/company/${companyId}/lc/settlement` },
      ]
    },
    { 
      name: 'Payments', 
      icon: DollarSign,
      children: [
        { name: 'Receive Payment', href: `/company/${companyId}/payments/receive` },
        { name: 'Make Payment', href: `/company/${companyId}/payments/make` },
        { name: 'Transfer', href: `/company/${companyId}/payments/transfer` },
        { name: 'Payment History', href: `/company/${companyId}/invoices` },
        { name: 'Payment Allocation', href: `/company/${companyId}/payments/allocate` },
      ]
    },
    { name: 'Chart of Accounts', href: `/company/${companyId}/accounts`, icon: ClipboardList },
    { name: 'Journal Entries', href: `/company/${companyId}/journals`, icon: History },
    { name: 'Employees', href: `/company/${companyId}/employees`, icon: User },
    { name: 'Bank Reconciliation', href: `/company/${companyId}/bank/reconcile`, icon: CheckCircle2 },
    { name: 'Reports', href: `/company/${companyId}/reports`, icon: FileBarChart },
    { name: 'Backup', href: `/company/${companyId}/settings/backup`, icon: Database },
  ];

  const isActive = (href: string) => pathname === href;

  const isParentActive = (item: MenuItem) => {
    if (!item.children) return false;
    return item.children.some(child => child.href && pathname.startsWith(child.href.split('/').slice(0, 4).join('/')));
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Company Name */}
      <div className="p-6 pb-4">
        {isOwner ? (
          <Link
            href="/owner/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 mb-8 transition-transform active:scale-95 group"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:rotate-6 transition-transform flex-shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-white font-bold text-lg leading-tight truncate">{companyName}</h1>
              <p className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">Accounting Pro</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-white font-bold text-lg leading-tight truncate">{companyName}</h1>
              <p className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">Accounting Pro</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                      isParentActive(item) || expandedMenus.has(item.name)
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-[#1E293B]"
                    )}
                  >
                    {item.icon && (
                      <item.icon className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isParentActive(item) || expandedMenus.has(item.name) ? "text-white" : "text-slate-400"
                      )} />
                    )}
                    <span className="font-medium text-sm flex-1 text-left">{item.name}</span>
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform",
                      expandedMenus.has(item.name) && "rotate-90"
                    )} />
                  </button>
                  {expandedMenus.has(item.name) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.name}
                          href={child.href || '#'}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200",
                            isActive(child.href || '')
                              ? "bg-blue-500/20 text-white text-sm"
                              : "text-slate-400 hover:text-white hover:bg-[#1E293B] text-sm"
                          )}
                        >
                          <span>{child.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href || '#'}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive(item.href || '')
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:text-white hover:bg-[#1E293B]"
                  )}
                >
                  {item.icon && (
                    <item.icon className={cn(
                      "w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110",
                      isActive(item.href || '') ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                    )} />
                  )}
                  <span className="font-medium text-sm">{item.name}</span>
                  {isActive(item.href || '') && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0F172A] border-r border-[#1E293B] z-40 hidden lg:block shadow-2xl print-hide overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#0F172A] text-white rounded-xl shadow-lg print-hide"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm print-hide"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={cn(
        "lg:hidden fixed left-0 top-0 h-full w-72 bg-[#0F172A] border-r border-[#1E293B] z-50 shadow-2xl print-hide overflow-y-auto transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#1E293B] transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>
    </>
  );
}
