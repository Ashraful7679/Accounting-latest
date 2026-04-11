'use client';

import { Landmark, Plus, Package, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ActionShortcutsProps {
  companyId: string;
}

export function ActionShortcuts({ companyId }: ActionShortcutsProps) {
  const actions = [
    { label: 'Reconcile Bank', href: `/company/${companyId}/bank/reconcile`, icon: <Landmark />, color: 'bg-indigo-600', shadow: 'shadow-indigo-500/20' },
    { label: 'New Journal', href: `/company/${companyId}/journals`, icon: <Plus />, color: 'bg-slate-900', shadow: 'shadow-slate-900/20' },
    { label: 'Procurement', href: `/company/${companyId}/purchase/orders`, icon: <Package />, color: 'bg-blue-600', shadow: 'shadow-blue-500/20' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
       {actions.map((action, i) => (
         <Link key={i} href={action.href} className={cn(
           "p-8 rounded-[2rem] text-white flex items-center justify-between group hover:scale-[1.03] transition-all shadow-2xl relative overflow-hidden", 
           action.color,
           action.shadow
         )}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner">
                {action.icon}
              </div>
              <div>
                <h4 className="font-black text-xl leading-tight">{action.label}</h4>
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">Operational Flow</p>
              </div>
            </div>
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center opacity-40 group-hover:opacity-100 group-hover:bg-white/20 transition-all relative z-10">
              <ChevronRight className="w-6 h-6" />
            </div>
         </Link>
       ))}
    </div>
  );
}
