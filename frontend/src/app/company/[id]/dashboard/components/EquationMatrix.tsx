'use client';

import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EquationMatrixProps {
  data: {
    assets: number;
    liabilities: number;
    ap: number;
    equity: number;
    revenue: number;
    expenses: number;
    netIncome: number;
    isBalanced: boolean;
  };
  formatCurrency: (val: any) => string;
}

export function EquationMatrix({ data, formatCurrency }: EquationMatrixProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F172A] rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden border border-slate-800"
    >
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px] -ml-24 -mb-24" />

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              Accounting Ledger Formula
            </h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">REAL-TIME EQUATION VERIFICATION</p>
          </div>
          
          <div className={cn(
            "px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 self-start",
            data.isBalanced 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
              : "bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
          )}>
            <div className={cn(
              "w-2.5 h-2.5 rounded-full", 
              data.isBalanced ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-rose-400 animate-pulse"
            )} />
            {data.isBalanced ? "Ledger Verified & Balanced" : "Imbalance Detected"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Side: Assets (Independent) */}
          <div className="lg:col-span-5">
            <div className="p-8 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 hover:border-blue-500/50 transition-all group relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
               <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-3 relative z-10">Global Assets</p>
               <h2 className="text-5xl font-black text-white relative z-10 tabular-nums">{formatCurrency(data.assets)}</h2>
               <div className="mt-6 flex items-center gap-2 relative z-10">
                  <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-full" />
                  </div>
               </div>
            </div>
          </div>

          {/* Operator */}
          <div className="lg:col-span-1 flex items-center justify-center">
            <div className="text-6xl font-black text-slate-800 hidden lg:block">=</div>
            <div className="text-4xl font-black text-slate-800 lg:hidden">EQUALS</div>
          </div>

          {/* Right Side: Equation Sub-Components */}
          <div className="lg:col-span-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
               <div className="p-6 bg-white/5 rounded-[1.5rem] border border-white/5 hover:bg-white/[0.07] transition-all">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Liabilities (AP)</p>
                  <p className="text-xl font-black text-rose-400 tabular-nums">{formatCurrency(data.ap)}</p>
               </div>
               <div className="p-6 bg-white/5 rounded-[1.5rem] border border-white/5 hover:bg-white/[0.07] transition-all">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Equity</p>
                  <p className="text-xl font-black text-emerald-400 tabular-nums">{formatCurrency(data.equity)}</p>
               </div>
            </div>

            <div className="p-8 bg-white/5 rounded-[1.5rem] border border-white/5 group">
              <div className="flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Net Operating Income</p>
                    <div className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black rounded uppercase">Calculated</div>
                  </div>
                  <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(data.netIncome)}</p>
                </div>
                <div className="text-right space-y-2">
                   <div className="flex items-center justify-end gap-3">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">Revenue</span>
                     <span className="text-sm font-black text-slate-300 tabular-nums">{formatCurrency(data.revenue)}</span>
                   </div>
                   <div className="flex items-center justify-end gap-3">
                     <span className="text-[10px] font-bold text-slate-500 uppercase">Expenses</span>
                     <span className="text-sm font-black text-slate-300 tabular-nums">({formatCurrency(data.expenses)})</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
