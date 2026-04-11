'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Landmark, CheckCircle2, RefreshCw, CheckCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function BankReconcilePage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: accounts } = useQuery({
    queryKey: ['bank-accounts', companyId],
    queryFn: () => api.get(`/company/${companyId}/accounts`).then(res => 
      res.data.data.filter((acc: any) => 
        acc.accountType?.name === 'ASSET' && 
        (acc.name.toLowerCase().includes('bank') || acc.name.toLowerCase().includes('cash'))
      )
    )
  });

  const { data: lines, isFetching: loadingLines } = useQuery({
    queryKey: ['reconcile-lines', companyId, selectedAccountId, filters],
    queryFn: () => {
      const queryParams = new URLSearchParams({ 
        accountId: selectedAccountId,
        ...filters 
      }).toString();
      return api.get(`/company/${companyId}/bank/reconcile-lines?${queryParams}`).then(res => res.data.data.lines);
    },
    enabled: !!selectedAccountId
  });

  const reconcileMutation = useMutation({
    mutationFn: (lineIds: string[]) => 
      api.post(`/company/${companyId}/bank/mark-reconciled`, { lineIds }),
    onSuccess: () => {
      toast.success('Transactions reconciled successfully');
      setSelectedLines([]);
      queryClient.invalidateQueries({ queryKey: ['reconcile-lines'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reconcile');
    }
  });

  const toggleLine = (id: string) => {
    setSelectedLines(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedLines.length === lines?.length) {
      setSelectedLines([]);
    } else {
      setSelectedLines(lines?.map((l: any) => l.id) || []);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Bank Account</label>
            <select 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
            >
              <option value="">Choose an account...</option>
              {accounts?.map((acc: any) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date Range</label>
              <div className="flex items-center gap-2">
                <input 
                  type="date"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                  value={filters.startDate}
                  onChange={e => setFilters({...filters, startDate: e.target.value})}
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="date"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none"
                  value={filters.endDate}
                  onChange={e => setFilters({...filters, endDate: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        {!selectedAccountId ? (
          <div className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <Landmark className="w-10 h-10 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">Select an Account</h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto"> Choose a bank or cash account from the dropdown above to start the reconciliation process.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden mb-24">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                        checked={lines?.length > 0 && selectedLines.length === lines?.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLines ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="font-black text-slate-500">Loading transactions...</p>
                      </td>
                    </tr>
                  ) : lines?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                        <p className="text-xl font-black text-slate-900">All Reconciled!</p>
                        <p className="text-slate-500 font-medium mt-1">There are no unreconciled transactions for this period.</p>
                      </td>
                    </tr>
                  ) : (
                    lines?.map((line: any) => (
                      <tr 
                        key={line.id} 
                        className={cn(
                          "hover:bg-slate-50 transition-colors cursor-pointer",
                          selectedLines.includes(line.id) && "bg-blue-50/50"
                        )}
                        onClick={() => toggleLine(line.id)}
                      >
                        <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                            checked={selectedLines.includes(line.id)}
                            onChange={() => toggleLine(line.id)}
                          />
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900 whitespace-nowrap">
                          {new Date(line.journalEntry.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-500">{line.journalEntry.entryNumber}</td>
                        <td className="px-6 py-4 font-medium text-slate-600">{line.description || line.journalEntry.description}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-emerald-600">
                            {line.debit > 0 ? line.debit.toLocaleString() : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-rose-600">
                            {line.credit > 0 ? line.credit.toLocaleString() : '-'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {selectedLines.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-[32px] shadow-2xl flex items-center gap-8 border border-slate-800 backdrop-blur-xl">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5 whitespace-nowrap">Actions Required</span>
              <p className="text-sm font-black flex items-center gap-2 whitespace-nowrap">
                <CheckCheck className="w-4 h-4 text-blue-400" />
                {selectedLines.length} {selectedLines.length === 1 ? 'Line' : 'Lines'} Selected
              </p>
            </div>
            
            <div className="w-[1px] h-8 bg-slate-800" />
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => reconcileMutation.mutate(selectedLines)}
                disabled={reconcileMutation.isPending}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20 whitespace-nowrap"
              >
                {reconcileMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Mark as Reconciled
              </button>

              <button 
                onClick={() => setSelectedLines([])}
                className="text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors px-2"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


