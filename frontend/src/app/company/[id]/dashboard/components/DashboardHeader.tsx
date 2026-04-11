'use client';

import { LayoutDashboard, RefreshCw, FileBarChart } from 'lucide-react';
import Link from 'next/link';

interface DashboardHeaderProps {
  companyName: string;
  companyId: string;
}

export function DashboardHeader({ companyName, companyId }: DashboardHeaderProps) {
  const today = new Date().toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-3 group-hover:rotate-0 transition-transform">
          <LayoutDashboard className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Pulse Dashboard
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{companyName}</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Global Control Center</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 w-full lg:w-auto">
         <div className="hidden lg:flex flex-col items-end px-6 border-r border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Observation Date</p>
            <p className="text-sm font-black text-slate-700">{today}</p>
         </div>
         
         <div className="flex items-center gap-3 flex-1 lg:flex-initial">
           <button 
             onClick={() => window.location.reload()} 
             className="p-4 bg-white border border-slate-200 rounded-[1.25rem] hover:bg-slate-50 transition-all shadow-sm group active:scale-95"
           >
              <RefreshCw className="w-5 h-5 text-slate-600 group-hover:rotate-180 transition-transform duration-500" />
           </button>
           
           <Link 
             href={`/company/${companyId}/reports`} 
             className="px-8 py-4 bg-slate-900 text-white rounded-[1.25rem] font-black text-sm flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex-1 lg:flex-initial justify-center"
           >
              <FileBarChart className="w-4 h-4 text-blue-400" />
              Financial Reports
           </Link>
         </div>
      </div>
    </div>
  );
}
