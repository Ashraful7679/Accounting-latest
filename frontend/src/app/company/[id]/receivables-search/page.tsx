'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Filter, ArrowLeft, Download, Printer, 
  Calendar, Building2, DollarSign, FileText, ChevronRight,
  ArrowUpRight, Clock, AlertCircle, X
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0
  }).format(amount);
};

export default function ReceivablesSearchPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;

  const [filters, setFilters] = useState({
    customerName: '',
    reference: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    branchId: '',
    status: 'APPROVED'
  });

  const [activeFilters, setActiveFilters] = useState(filters);

  const { data: searchResults, isFetching: loading } = useQuery({
    queryKey: ['receivables-search', companyId, activeFilters],
    queryFn: () => {
      const q = new URLSearchParams(activeFilters).toString();
      return api.get(`/company/${companyId}/reports/receivables-search?${q}`).then(res => res.data.data);
    }
  });

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => api.get(`/company/${companyId}`).then(res => res.data.data)
  });

  const { data: branches } = useQuery({ 
    queryKey: ['branches', companyId], 
    queryFn: () => api.get(`/company/${companyId}/branches`).then(res => res.data.data) 
  });

  const handleApply = () => setActiveFilters({...filters});
  const handleReset = () => {
    const defaultFilters = {
      customerName: '',
      reference: '',
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
      branchId: '',
      status: 'APPROVED'
    };
    setFilters(defaultFilters);
    setActiveFilters(defaultFilters);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName={company?.name || 'Loading...'} />

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
            </button>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Advanced Receivables Search
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
              <Printer className="w-5 h-5" />
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all text-sm">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
          {/* Filters Section */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-20 -mt-20 z-0 pointer-events-none" />
             
             <div className="relative z-10">
               <div className="flex items-center gap-2 mb-6">
                 <Filter className="w-4 h-4 text-blue-600" />
                 <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Search Parameters</h2>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5 focus-within:ring-2 focus-within:ring-blue-100 rounded-xl transition-all">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white outline-none transition-all"
                        placeholder="Search customer..."
                        value={filters.customerName}
                        onChange={e => setFilters({...filters, customerName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Voucher / Ref #</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white outline-none transition-all"
                        placeholder="REF-XXXXX"
                        value={filters.reference}
                        onChange={e => setFilters({...filters, reference: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount Range</label>
                    <div className="flex items-center gap-2">
                       <input 
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white outline-none transition-all"
                        placeholder="Min"
                        value={filters.minAmount}
                        onChange={e => setFilters({...filters, minAmount: e.target.value})}
                      />
                      <span className="text-slate-300">-</span>
                      <input 
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:bg-white outline-none transition-all"
                        placeholder="Max"
                        value={filters.maxAmount}
                        onChange={e => setFilters({...filters, maxAmount: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</label>
                    <div className="flex items-center gap-2">
                       <input 
                        type="date"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                        value={filters.startDate}
                        onChange={e => setFilters({...filters, startDate: e.target.value})}
                      />
                      <input 
                        type="date"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                        value={filters.endDate}
                        onChange={e => setFilters({...filters, endDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                      value={filters.branchId}
                      onChange={e => setFilters({...filters, branchId: e.target.value})}
                    >
                      <option value="">All Branches</option>
                      {branches?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5 flex items-end">
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={handleApply}
                        className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:bg-blue-600 transition-all active:scale-95"
                      >
                        Find Items
                      </button>
                      <button 
                        onClick={handleReset}
                        className="p-2.5 aspect-square bg-slate-100 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Clear Filters"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
               </div>
             </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                 <h2 className="text-xl font-black text-slate-900 tracking-tight">Search Results</h2>
                 <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                   {searchResults?.length || 0} Records Found
                 </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Currency: BDT</p>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-slate-100 bg-slate-50/50">
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Voucher / Ref</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Entity</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit (Receivable)</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit (Collected)</th>
                       <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     <AnimatePresence mode="popLayout">
                       {searchResults?.map((line: any, idx: number) => (
                         <motion.tr 
                           key={line.id}
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: idx * 0.03 }}
                           className="group hover:bg-slate-50 transition-colors"
                         >
                           <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-sm text-slate-500">
                                  {new Date(line.journalEntry.date).toLocaleDateString()}
                                </span>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                             <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md font-black text-[10px] group-hover:bg-slate-900 group-hover:text-white transition-all uppercase tracking-tight">
                               {line.journalEntry.entryNumber}
                             </span>
                           </td>
                           <td className="px-6 py-5">
                             <div className="flex flex-col">
                               <span className="font-black text-slate-900 text-sm">{line.customer?.name || 'Walk-in Customer'}</span>
                               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{line.customer?.code || 'GEN-001'}</span>
                             </div>
                           </td>
                           <td className="px-6 py-5">
                             <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{line.branch?.name || 'Main Branch'}</span>
                           </td>
                           <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                             {line.debitBase > 0 ? formatCurrency(line.debitBase) : '-'}
                           </td>
                           <td className="px-6 py-5 text-right font-black text-rose-600 text-sm">
                             {line.creditBase > 0 ? formatCurrency(line.creditBase) : '-'}
                           </td>
                           <td className="px-6 py-5 text-center">
                              <button 
                                onClick={() => router.push(`/company/${companyId}/journals?id=${line.journalEntryId}`)}
                                className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all active:scale-90"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                           </td>
                         </motion.tr>
                       ))}
                     </AnimatePresence>
                     
                     {loading && (
                        <tr>
                          <td colSpan={7} className="py-20 text-center">
                             <div className="flex flex-col items-center gap-4">
                               <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                               <p className="text-sm font-black text-slate-400 animate-pulse uppercase tracking-widest">Scanning Databases...</p>
                             </div>
                          </td>
                        </tr>
                     )}

                     {!loading && searchResults?.length === 0 && (
                       <tr>
                         <td colSpan={7} className="py-32 text-center">
                           <div className="flex flex-col items-center gap-6 max-w-xs mx-auto">
                              <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200">
                                <Search className="w-10 h-10" />
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-black text-slate-900">No matching receivables found</h3>
                                <p className="text-sm text-slate-400 font-medium">Try adjusting your filters or search by simple keyword.</p>
                              </div>
                              <button 
                                onClick={handleReset}
                                className="px-6 py-2 bg-slate-100 text-slate-600 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors"
                              >
                                Clear All Filters
                              </button>
                           </div>
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </div>
  );
}
