'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Check } from 'lucide-react';
import api from '@/lib/api';
import { useCompany } from '@/lib/CompanyContext';

export default function CompanySwitcher() {
  const { companyId, companyName } = useCompany();
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch all companies the user has access to
    api.get('/company/user-companies')
      .then((res: any) => {
        setCompanies(res.data.data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch companies', err);
      });
  }, []);

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

  const handleSelect = (id: string, name: string) => {
    localStorage.setItem('active_company_id', id);
    localStorage.setItem(`company_name_${id}`, name);
    setOpen(false);
    // Hard navigate to dashboard of new company
    window.location.href = `/company/${id}/dashboard`;
  };

  if (companies.length <= 1) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
      >
        <Building2 className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-bold text-slate-800 max-w-[120px] truncate">{companyName || 'Projects'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[200]">
          <div className="px-4 py-2 border-b border-slate-50 mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Switch Company</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id, c.name)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left transition-colors group"
              >
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${c.id === companyId ? 'text-blue-600' : 'text-slate-700'}`}>
                    {c.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{c.code}</span>
                </div>
                {c.id === companyId && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
