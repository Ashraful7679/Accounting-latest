'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { InfinitePagination, LoadingSkeleton, EmptyState } from '@/components/Pagination';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Eye, Trash2, 
  CreditCard, Loader2, ArrowUpRight,
  Filter, TrendingUp, Undo2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/CompanyContext';
import { formatCurrency } from '@/lib/decimalUtils';
import { PaymentModal } from '@/components/PaymentModal';
import React from 'react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; code: string } | null;
  currency: string;
  exchangeRate: number;
  total: number;
  totalAmount?: number;
  totalBDT?: number;
  status: string;
  invoiceDate: string;
  lcId?: string;
}

export default function SalesInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { exchangeRate: companyExchangeRate } = useCompany();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const { data: invoices, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteList<Invoice>({
    companyId,
    endpoint: 'invoices',
    queryKey: ['sales-invoices'],
    search: searchTerm,
    filter: { type: 'sales', status: filterStatus === 'all' ? undefined : filterStatus },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/company/${companyId}/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice deleted');
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/company/${companyId}/invoices/${id}/revert-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice reverted to Draft');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to revert invoice');
    }
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'PARTIALLY_PAID': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'DRAFT': return 'bg-gray-50 text-gray-600 border-gray-100';
      case 'VERIFIED': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-gray-50 text-gray-500 border-gray-100';
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header Area */}
      <div className="flex justify-between items-end bg-white p-6 rounded-sm border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            Sales Invoices
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Revenue Tracking & Receivables Management</p>
        </div>
        <Link 
          href={`/company/${companyId}/sales/invoices/create`}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </Link>
      </div>

      {/* Filters Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Search by Invoice # or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-xs focus:border-gray-900 outline-none transition-colors shadow-sm bg-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-xs font-bold uppercase tracking-tight focus:border-gray-900 outline-none transition-colors shadow-sm bg-white appearance-none"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="VERIFIED">Verified</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
          </select>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-2 flex items-center justify-center shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Total Records: <span className="text-gray-900">{invoices?.length || 0}</span>
          </p>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <th className="px-6 py-4">Invoice #</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4 text-right">Value (Original/BDT)</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-mono">SYNCING SALES DATA...</td></tr>
            ) : invoices?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No matching invoices</td></tr>
            ) : (
              (Array.isArray(invoices) ? invoices : []).map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 group transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-gray-900">{inv.invoiceNumber}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700 uppercase tracking-tight">{inv.customer?.name || '-'}</span>
                      {inv.lcId && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter">LC Linked</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-gray-900">
                        {inv.currency} {formatCurrency(inv.total)}
                      </span>
                      {inv.currency !== 'BDT' && (
                        <span className="text-[10px] text-gray-400 font-mono italic">
                          ৳ {formatCurrency(inv.totalBDT || (inv.total * inv.exchangeRate))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 text-[9px] font-black rounded-sm uppercase tracking-widest border",
                      getStatusStyle(inv.status)
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Record Receipt for Local/Non-LC Invoices */}
                      {(inv.currency === 'BDT' || !inv.lcId) && inv.status !== 'PAID' && inv.status !== 'DRAFT' && (
                        <button 
                          onClick={() => setPaymentTarget(inv)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Record Receipt
                        </button>
                      )}

                      {inv.lcId && (
                        <Link 
                          href={`/company/${companyId}/finance/lc/${inv.lcId}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> View LC
                        </Link>
                      )}

                      <button className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"><Eye className="w-4 h-4" /></button>
                      {(inv.status === 'VERIFIED' || inv.status === 'APPROVED') && (
                        <button 
                          onClick={() => {
                            if (confirm('Reverting will delete associated journal entries and reset stock movements. Continue?')) {
                              revertMutation.mutate(inv.id);
                            }
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
                          title="Revert to Draft"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Revert
                        </button>
                      )}
                      {inv.status === 'DRAFT' && (
                        <button 
                          onClick={() => deleteMutation.mutate(inv.id)}
                          className="p-2 text-gray-300 hover:text-red-600 rounded-sm transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paymentTarget && (
        <PaymentModal 
          isOpen={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          invoiceId={paymentTarget.id}
          companyId={companyId}
          currency={paymentTarget.currency}
          defaultAmount={paymentTarget.total}
        />
      )}
    </div>
  );
}
