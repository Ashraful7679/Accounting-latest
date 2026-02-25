'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User, ChevronDown, Building2, Shield } from 'lucide-react';

interface UserDropdownProps {
  role?: string;
}

export default function UserDropdown({ role: propRole }: UserDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(propRole || 'User');
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setDisplayName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User');
        setEmail(user.email || '');
      } catch {}
    }
    if (!propRole) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      setRole(roles[0] || 'User');
    }
  }, [propRole]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const isOwner = role === 'Owner' || role === 'Admin';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  if (!mounted) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm flex-shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-bold text-slate-800 leading-none">{displayName}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{role}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-lg">
                {initials}
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight truncate max-w-[160px]">{displayName}</p>
                <p className="text-slate-400 text-[11px] truncate max-w-[160px]">{email}</p>
                <span className="mt-1 inline-block text-[9px] font-black uppercase tracking-widest bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  {role}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <Link
              href="/owner/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors group"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <User className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold leading-none">My Profile</p>
                <p className="text-[10px] text-slate-400 mt-0.5">View and edit profile</p>
              </div>
            </Link>

            {isOwner && (
              <Link
                href="/owner/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors group"
              >
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  <Building2 className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">Owner Dashboard</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manage all companies</p>
                </div>
              </Link>
            )}
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors group"
            >
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors">
                <LogOut className="w-4 h-4 text-red-500 group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <div>
                <p className="text-sm font-bold leading-none">Sign Out</p>
                <p className="text-[10px] text-red-400 mt-0.5">End your session</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
