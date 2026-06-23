'use client';

import { useRouter } from 'next/navigation';
import { Bell, Settings, LogOut } from 'lucide-react';

interface StickyTopBarProps {
  companyId: string;
  unreadCount: number;
}

export function StickyTopBar({ companyId, unreadCount }: StickyTopBarProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <button
        onClick={() => router.push(`/company/${companyId}/audit`)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors touch-target"
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => router.push(`/company/${companyId}/settings`)}
        className="p-2 rounded-xl hover:bg-slate-100 transition-colors touch-target"
      >
        <Settings className="w-5 h-5 text-slate-500" />
      </button>
      <button
        onClick={() => { localStorage.clear(); router.push('/login'); }}
        className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors touch-target"
      >
        <LogOut className="w-5 h-5 text-slate-500" />
      </button>
    </div>
  );
}
