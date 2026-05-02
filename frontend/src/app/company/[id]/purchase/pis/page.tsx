'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2,
  Building2, X, CheckCircle
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { useCompany } from '@/lib/CompanyContext';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import React from 'react';

interface PI {
  id: string;
  piNumber: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  totalBDT?: number;
  piDate: string;
  invoiceNumber?: string;
  submissionDate?: string;
  paymentDueDate?: string;
  status: string;
  vendor?: { id: string; name: string; code: string };
  lc?: { id: string; lcNumber: string };
  description?: string;
}

export default function ImportPIsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPI, setSelectedPI] = useState<PI | null>(null);
  const { exchangeRate: globalRate } = useCompany();
  
  const [formData, setFormData] = useState({
    piNumber: '',
    amount: 0,
    currency: 'USD',
    piDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    submissionDate: '',
    paymentDueDate: '',
    vendorId: '',
    lcId: '',
    description: '',
  });
  
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: pisData, isLoading } = useQuery({
    queryKey: ['import-pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=import`);
      return response.data.data as PI[];
    },
    enabled: !!companyId,
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendors`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/pis`, { 
        ...data, 
        type: 'IMPORT',
        exchangeRate: globalRate,
        totalBDT: data.amount * globalRate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('Import PI registered');
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/pis/${id}`, {
        ...data,
        exchangeRate: globalRate,
        totalBDT: data.amount * globalRate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI details updated');
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/pis/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI deleted');
    },
  });

  const openModal = (pi?: PI) => {
    if (pi) {
      setSelectedPI(pi);
      setFormData({
        piNumber: pi.piNumber || '',
        amount: pi.amount || 0,
        currency: pi.currency || 'USD',
        piDate: pi.piDate ? pi.piDate.split('T')[0] : '',
        invoiceNumber: pi.invoiceNumber || '',
        submissionDate: pi.submissionDate ? pi.submissionDate.split('T')[0] : '',
        paymentDueDate: pi.paymentDueDate ? pi.paymentDueDate.split('T')[0] : '',
        vendorId: pi.vendor?.id || '',
        lcId: pi.lc?.id || '',
        description: pi.description || '',
      });
    } else {
      setSelectedPI(null);
      setFormData({
        piNumber: '',
        amount: 0,
        currency: 'USD',
        piDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        submissionDate: '',
        paymentDueDate: '',
        vendorId: '',
        lcId: '',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPI) {
      updateMutation.mutate({ id: selectedPI.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header section */}
      <div className="flex justify-between items-center pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            Proforma Invoices (Import)
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Procurement and LC tracking module</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Register PI
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH PI OR SUPPLIER..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-gray-900 transition-colors bg-white shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">PI Number</th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Date</th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Supplier</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="py-3 px-4 text-center font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-mono">LOADING DATA...</td></tr>
            ) : pisData?.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No records found</td></tr>
            ) : (
              pisData?.filter(pi => !searchTerm || pi.piNumber.toLowerCase().includes(searchTerm.toLowerCase()) || pi.vendor?.name.toLowerCase().includes(searchTerm.toLowerCase())).map((pi) => (
                <tr key={pi.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4 font-mono font-bold text-gray-900 uppercase">{pi.piNumber}</td>
                  <td className="px-4 py-4 font-mono text-gray-500">{new Date(pi.piDate).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-gray-700 uppercase tracking-tight">{pi.vendor?.name}</div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{pi.vendor?.code}</div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-mono font-bold text-gray-900">{pi.currency} {formatCurrency(pi.amount)}</div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">৳{formatCurrency(pi.amount * (pi.exchangeRate || globalRate))}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-bold rounded-sm uppercase tracking-widest border",
                      pi.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-50 text-gray-600 border-gray-100"
                    )}>
                      {pi.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right opacity-40 group-hover:opacity-100 transition-opacity">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openModal(pi)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('Delete this PI?')) deleteMutation.mutate(pi.id);
                        }}
                        className="p-1.5 text-gray-300 hover:text-red-600 rounded-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 animate-in fade-in zoom-in duration-150">
            {/* Sticky Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">
                  {selectedPI ? 'Edit Import PI' : 'Register Import PI'}
                </h3>
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  form="pi-form"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-gray-900 text-white px-6 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (selectedPI ? 'Update PI' : 'Save PI')}
                  <CheckCircle className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setShowModal(false)} 
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} id="pi-form" className="flex-1 overflow-y-auto p-8 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">PI Number *</label>
                  <input
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm font-bold bg-white transition-colors"
                    value={formData.piNumber}
                    onChange={(e) => setFormData({ ...formData, piNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">PI Date *</label>
                  <input
                    required type="date"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm font-mono bg-white transition-colors"
                    value={formData.piDate}
                    onChange={(e) => setFormData({ ...formData, piDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Supplier / Vendor *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm font-bold bg-white transition-colors"
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                >
                  <option value="">Select Supplier</option>
                  {vendorsData?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-8 p-6 bg-gray-50 border border-gray-100 rounded-sm">
                <div className="col-span-2 space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">PI Total Amount *</label>
                  <div className="flex">
                    <select
                      className="px-4 bg-white border border-gray-200 border-r-0 rounded-l-sm text-[10px] font-bold uppercase tracking-widest outline-none"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="BDT">BDT</option>
                    </select>
                    <input
                      required type="number" step="0.01"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-r-sm focus:outline-none focus:border-gray-900 text-sm font-mono font-bold bg-white transition-colors"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 text-center">Exchange Rate</label>
                  <div className="px-4 py-2.5 bg-white border border-gray-200 text-gray-900 text-sm font-mono font-bold rounded-sm text-center shadow-sm">
                    {globalRate} <span className="text-[10px] text-gray-400">BDT</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Submission Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm font-mono bg-white"
                    value={formData.submissionDate}
                    onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Payment Due Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm font-mono bg-white"
                    value={formData.paymentDueDate}
                    onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Description / Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {selectedPI && (
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-sm">
                   <AttachmentManager 
                    entityType="PI" 
                    entityId={selectedPI.id} 
                    canEdit={selectedPI.status === 'DRAFT'} 
                  />
                </div>
              )}

              <div className="flex justify-end pt-6 border-t border-gray-100">
                <div className="w-64 space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Local Total</span>
                      <p className="text-[10px] text-gray-400 italic font-bold">Spot Rate Conversion</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xl font-black text-gray-900 leading-none">
                        ৳{formatCurrency(formData.amount * globalRate)}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">BDT</p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}




