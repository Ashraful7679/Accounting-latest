'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Eye, Trash2,
  Building2, X, CheckCircle, ArrowUpRight
} from 'lucide-react';
import { useCompany } from '@/lib/CompanyContext';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PI {
  id: string;
  piNumber: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  totalBDT?: number;
  piDate: string;
  invoiceNumber?: string;
  status: string;
  vendor?: { id: string; name: string; code: string };
  lc?: { id: string; lcNumber: string };
}

export default function ImportPIsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('purchase.pis', companyId);
  const queryClient = useQueryClient();
  const { exchangeRate: globalRate } = useCompany();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const { data: pis, isLoading } = useQuery({
    queryKey: ['import-pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=import`);
      return response.data.data as PI[];
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/company/${companyId}/pis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('Record removed');
    },
  });

  const filteredPIs = (Array.isArray(pis) ? pis : [])?.filter((pi: PI) => {
    return !searchTerm || 
      pi.piNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pi.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  if (!mounted) return null;

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header Area */}
      <div className="flex justify-between items-end bg-white p-6 rounded-sm border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            <FileText className="w-6 h-6 text-indigo-600" />
            Import Proformas
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Incoming Foreign Supplier Documentation</p>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm text-gray-400">
          <Search className="absolute left-3 top-3 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by PI # or Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-xs focus:border-gray-900 outline-none transition-colors shadow-sm bg-white"
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <th className="px-6 py-4">PI Details</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4 text-right">Value (USD/BDT)</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-mono">SYNCING IMPORT RECORDS...</td></tr>
            ) : filteredPIs.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No documentation found</td></tr>
            ) : (
              filteredPIs.map((pi) => (
                <tr key={pi.id} className="hover:bg-gray-50/50 group transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-gray-900">{pi.piNumber}</span>
                      <span className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">Date: {new Date(pi.piDate).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700 uppercase tracking-tight">{pi.vendor?.name || '---'}</span>
                      {pi.lc && (
                        <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-sm font-black uppercase border border-indigo-100">LC: {pi.lc.lcNumber}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col font-mono">
                      <span className="font-bold text-gray-900">
                        {pi.currency} {formatCurrency(pi.amount)}
                      </span>
                      <span className="text-[10px] text-gray-400 italic">
                        ৳ {formatCurrency(pi.totalBDT || (pi.amount * pi.exchangeRate))}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm border",
                      pi.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-gray-50 text-gray-400 border-gray-100"
                    )}>
                      {pi.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {pi.lc && (
                         <button 
                           onClick={() => router.push(`/company/${companyId}/finance/lc/${pi.lc?.id}`)}
                           className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-sm transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                         >
                            <ArrowUpRight className="w-3.5 h-3.5" /> View LC
                         </button>
                      )}
                      <button className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"><Eye className="w-4 h-4" /></button>
                      <button 
                        onClick={() => deleteMutation.mutate(pi.id)}
                        className="p-2 text-gray-300 hover:text-red-600 rounded-sm transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
