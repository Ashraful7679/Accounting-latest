'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { 
  Building2, Users, FileText, Receipt, TrendingUp,
  CreditCard, Package, FileBarChart, Settings, DollarSign,
  LayoutDashboard, BookOpen, ClipboardList, Bell, ChevronRight,
  Plus, AlertCircle, ArrowUpRight, ArrowDownRight, Briefcase, User,
  Calendar, ShieldCheck, History, CheckCircle2, Database, Menu, X,
  ArrowLeftRight, Send, Wallet, FileStack, Activity
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Derive role from prop or localStorage (client-side only)
  const [role, setRole] = React.useState(propRole || 'User');
  const [mounted, setMounted] = React.useState(false);
  const [realCompanyId, setRealCompanyId] = useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!propRole) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      setRole(roles[0] || 'User');
    }

    // Extract real company UUID from the actual browser URL (bypassing .htaccess rewrite)
    const match = window.location.pathname.match(/\/company\/([^/]+)/);
    let idStr = params.id as string;
    
    if (match && match[1] && !['placeholder', '[id]', '%5Bid%5D'].includes(match[1])) {
      idStr = match[1];
      localStorage.setItem('active_company_id', idStr);
    } else {
      const active = localStorage.getItem('active_company_id');
      if (active) idStr = active;
    }
    
    if (!['placeholder', '[id]', '%5Bid%5D'].includes(idStr)) {
      setRealCompanyId(idStr);
    }
  }, [propRole, params.id]);

  const companyId = realCompanyId || params.id;
  const isOwner = role === 'Owner' || role === 'Admin';

  // Auto-expand menus when a submenu is active
  React.useEffect(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length >= 3) {
      const activeParent = menuItems.find(item => 
        item.children?.some(child => 
          child.href && pathname.startsWith(child.href)
        )
      );
      if (activeParent) {
        if (!expandedMenus.has(activeParent.name)) {
          setExpandedMenus(new Set([activeParent.name])); 
        }
      } else {
        // If we are on a top-level page that's not a child, collapse all
        setExpandedMenus(new Set());
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
    { name: 'Chart of Accounts', href: `/company/${companyId}/accounts`, icon: ClipboardList },
    { 
      name: 'Sales', 
      icon: TrendingUp,
      children: [
        { name: 'Customers', href: `/company/${companyId}/sales/customers` },
        { name: 'Sales Orders', href: `/company/${companyId}/sales/orders` },
        { name: 'Proforma Invoice', href: `/company/${companyId}/sales/pis` },
        { name: 'Delivery Notes', href: `/company/${companyId}/sales/deliveries` },
        { name: 'Sales Invoices', href: `/company/${companyId}/sales/invoices` },
        { name: 'Collections', href: `/company/${companyId}/payments/receive` },
      ]
    },
    { 
      name: 'Purchase', 
      icon: CreditCard,
      children: [
        { name: 'Suppliers', href: `/company/${companyId}/vendors` },
        { name: 'Purchase Orders', href: `/company/${companyId}/purchase/orders` },
        { name: 'Purchase Invoices', href: `/company/${companyId}/purchase/invoices` },
      ]
    },
    { 
      name: 'LC Management', 
      icon: FileStack,
      children: [
        { name: 'LC Overview', href: `/company/${companyId}/lc` },
        { name: 'Import LC', href: `/company/${companyId}/lc/create/import` },
        { name: 'Export LC', href: `/company/${companyId}/lc/create/export` },
        { name: 'Loan Management', href: `/company/${companyId}/lc/loans` },
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
    { name: 'Journal Entries', href: `/company/${companyId}/journals`, icon: History },
    { name: 'Products', href: `/company/${companyId}/products`, icon: Package },
    { name: 'Employees', href: `/company/${companyId}/employees`, icon: User },
    { name: 'Bank Reconciliation', href: `/company/${companyId}/bank/reconcile`, icon: CheckCircle2 },
    { name: 'Reports', href: `/company/${companyId}/reports`, icon: FileBarChart },
    { name: 'Roles', href: `/company/${companyId}/settings/roles`, icon: ShieldCheck },
    { name: 'Backup', href: `/company/${companyId}/settings/backup`, icon: Database },
  ];

  const isActive = (href: string) => {
    if (!href) return false;
    // For specific pages, match exactly or match as a parent
    return pathname === href || (pathname.startsWith(href) && (pathname[href.length] === '/' || pathname[href.length] === undefined));
  };

  const isParentActive = (item: MenuItem) => {
    if (!item.children) return false;
    return item.children.some(child => child.href && isActive(child.href));
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Logo / Company Name */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        {isOwner ? (
          <Link
            href="/owner/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 transition-transform active:scale-95 group"
          >
            <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-gray-900 font-bold text-sm leading-tight truncate">{companyName}</h1>
              <p className="text-gray-500 text-[9px] font-bold tracking-tight uppercase">Accounting</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-gray-900 font-bold text-sm leading-tight truncate">{companyName}</h1>
              <p className="text-gray-500 text-[9px] font-bold tracking-tight uppercase">Accounting</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {(!mounted || !realCompanyId) ? (
          <div className="flex justify-center p-4">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-[1px]">
            {menuItems.map((item) => (
              <div key={item.name} className="px-2">
                {item.children ? (
                  <div>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left",
                        isParentActive(item) || expandedMenus.has(item.name)
                          ? "bg-gray-100 text-gray-900 font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      {item.icon && (
                        <item.icon className={cn(
                          "w-4 h-4 flex-shrink-0",
                          isParentActive(item) || expandedMenus.has(item.name) ? "text-gray-900" : "text-gray-400"
                        )} />
                      )}
                      <span className="text-[13px] flex-1">{item.name}</span>
                      <ChevronRight className={cn(
                        "w-3 h-3 transition-transform",
                        expandedMenus.has(item.name) && "rotate-90 text-gray-900"
                      )} />
                    </button>
                    {expandedMenus.has(item.name) && (
                      <div className="ml-5 border-l border-gray-200 mt-0.5 space-y-[1px]">
                        {item.children.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href || '#'}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1 hover:bg-gray-50 transition-colors block",
                              isActive(child.href || '')
                                ? "text-blue-600 font-bold bg-blue-50/50"
                                : "text-gray-500 hover:text-gray-800"
                            )}
                          >
                            <span className="text-[12px]">{child.name}</span>
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
                      "flex items-center gap-2 px-2 py-1.5 rounded transition-colors group",
                      isActive(item.href || '')
                        ? "bg-gray-100 text-gray-900 font-bold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {item.icon && (
                      <item.icon className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isActive(item.href || '') ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600"
                      )} />
                    )}
                    <span className="text-[13px]">{item.name}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-300 z-40 hidden lg:block print-hide overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white text-gray-800 border border-gray-300 rounded shadow-sm print-hide"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px] print-hide"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={cn(
        "lg:hidden fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-300 z-50 print-hide overflow-y-auto transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>
    </>
  );
}
