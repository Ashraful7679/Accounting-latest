'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, Edit2, Trash2,
  CheckCircle2, X, ArrowUpRight, Eye, Globe, ChevronDown, Loader2, ShoppingBag, DollarSign
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency, getCurrencySymbol, convertCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import { cn } from '@/lib/utils';
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PILine {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PI {
  id: string;
  piNumber: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  totalBDT: number;
  piDate: string;
  invoiceNumber?: string;
  submissionToBuyerDate?: string;
  submissionToBankDate?: string;
  bankAcceptanceDate?: string;
  maturityDate?: string;
  status: string;
  customer?: { id: string; name: string; code: string };
  lc?: { id: string; lcNumber: string };
  description?: string;
  lines: PILine[];
}

export default function ExportPIsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('sales.pis', companyId);
  const queryClient = useQueryClient();
  const { exchangeRate } = useCompany();
  const [activeTab, setActiveTab] = useState<'local' | 'foreign'>('local');
  const [showModal, setShowModal] = useState(false);
  const [selectedPI, setSelectedPI] = useState<PI | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isAutoPI, setIsAutoPI] = useState(false);
  
  const [formData, setFormData] = useState({
    piNumber: '',
    currency: 'USD',
    piDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    submissionToBuyerDate: '',
    submissionToBankDate: '',
    bankAcceptanceDate: '',
    maturityDate: '',
    customerId: '',
    lcId: '',
    description: '',
    status: 'DRAFT',
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }] as PILine[]
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: pisData, isLoading } = useQuery({
    queryKey: ['export-pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=export`);
      return response.data.data as PI[];
    },
    enabled: !!companyId,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: allProductsData } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: lcsData } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const totalForeign = data.lines.reduce((acc: number, line: PILine) => acc + (line.quantity * line.unitPrice), 0);
      const endpoint = selectedPI ? `/company/${companyId}/pis/${selectedPI.id}` : `/company/${companyId}/pis`;
      const method = selectedPI ? 'put' : 'post';
      const effectiveRate = data.currency === 'BDT' ? 1 : (exchangeRate || 1);
      const response = await api[method](endpoint, { 
        ...data, 
        amount: totalForeign, 
        exchangeRate: effectiveRate,
        totalBDT: totalForeign * effectiveRate, 
        type: 'EXPORT' 
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-pis', companyId] });
      toast.success(selectedPI ? 'PI updated' : 'Export PI registered');
      setShowModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Action failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/company/${companyId}/pis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-pis', companyId] });
      toast.success('PI deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Delete failed'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.put(`/company/${companyId}/pis/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-pis', companyId] });
      toast.success('Status updated');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Update failed'),
  });

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };
    
    if (field === 'productId' && value) {
      const product = (Array.isArray(allProductsData) ? allProductsData : []).find((p: any) => p.id === value);
      if (product) {
        const rawUnitPrice = product.unitPrice || 0;
        const productCurrency = product.currency || 'BDT';
        
        line.description = product.name;
        // Convert product price to form currency
        line.unitPrice = convertCurrency(rawUnitPrice, productCurrency, formData.currency, exchangeRate || 1);
      }
    }
    
    if (field === 'quantity' || field === 'unitPrice' || field === 'productId') {
      line.total = Number(((line.quantity || 0) * (line.unitPrice || 0)).toFixed(2));
    }
    
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => sum + line.total, 0);
  };

  const openModal = (pi?: PI) => {
    if (pi) {
      setSelectedPI(pi);
      setFormData({
        piNumber: pi.piNumber || '',
        currency: pi.currency || 'USD',
        piDate: pi.piDate ? pi.piDate.split('T')[0] : '',
        invoiceNumber: pi.invoiceNumber || '',
        submissionToBuyerDate: pi.submissionToBuyerDate ? pi.submissionToBuyerDate.split('T')[0] : '',
        submissionToBankDate: pi.submissionToBankDate ? pi.submissionToBankDate.split('T')[0] : '',
        bankAcceptanceDate: pi.bankAcceptanceDate ? pi.bankAcceptanceDate.split('T')[0] : '',
        maturityDate: pi.maturityDate ? pi.maturityDate.split('T')[0] : '',
        customerId: pi.customer?.id || '',
        lcId: pi.lc?.id || '',
        description: pi.description || '',
        status: pi.status || 'DRAFT',
        lines: pi.lines?.length ? pi.lines.map((l: any) => ({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: Number((l.quantity * l.unitPrice).toFixed(2))
        })) : [{ productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]
      });
    } else {
      setSelectedPI(null);
      setFormData({
        piNumber: '',
        currency: 'USD',
        piDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        submissionToBuyerDate: '',
        submissionToBankDate: '',
        bankAcceptanceDate: '',
        maturityDate: '',
        customerId: '',
        lcId: '',
        description: '',
        status: 'DRAFT',
        lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPI(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'VERIFIED':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'SENT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'DRAFT':
        return 'bg-gray-50 text-gray-600 border-gray-100';
      case 'COMPLETED':
        return 'bg-gray-900 text-white border-gray-900';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const filteredPIs = (Array.isArray(pisData) ? pisData : []).filter((pi: PI) => {
    const matchesSearch = !searchTerm ||
      (pi.piNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (pi.customer?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pi.status === filterStatus;
    const matchesTab = (activeTab === 'local' && pi.currency === 'BDT') || (activeTab === 'foreign' && pi.currency !== 'BDT');
    return matchesSearch && matchesStatus && matchesTab;
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

  const stats = {
    totalValue: filteredPIs.reduce((acc, pi) => acc + (pi.totalBDT || 0), 0),
    activeValue: filteredPIs.filter(pi => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(pi.status)).reduce((acc, pi) => acc + (pi.totalBDT || 0), 0),
    completedValue: filteredPIs.filter(pi => pi.status === 'COMPLETED').reduce((acc, pi) => acc + (pi.totalBDT || 0), 0),
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Portfolio</p>
          <p className="text-xl font-bold text-gray-900 font-mono">৳{stats.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active PIs</p>
          <p className="text-xl font-bold text-blue-600 font-mono">৳{stats.activeValue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Settled Value</p>
          <p className="text-xl font-bold text-emerald-600 font-mono">৳{stats.completedValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex justify-between items-center pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            Export Proforma Invoices
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">International sales and banking documentation</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> New PI
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab('local')}
          className={cn(
            "px-4 py-2 rounded",
            activeTab === 'local' ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-800"
          )}
        >Local</button>
        <button
          onClick={() => setActiveTab('foreign')}
          className={cn(
            "px-4 py-2 rounded",
            activeTab === 'foreign' ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-800"
          )}
        >Foreign</button>
      </div>
      {/* Search and Filter Area */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH BY PI # OR CUSTOMER..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-gray-900 transition-colors bg-white shadow-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-wider text-gray-500 outline-none hover:border-gray-900 transition-colors shadow-sm"
        >
          <option value="all">All Statuses</option>
          {['DRAFT', 'VERIFIED', 'APPROVED', 'SENT', 'PARTIAL', 'COMPLETED', 'CANCELLED', 'REJECTED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-[11px] text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">PI Details</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer / LC</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Foreign Value</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Total (৳)</th>
              <th className="py-3 px-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="py-3 px-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-mono uppercase">Loading portfolio...</td></tr>
            ) : filteredPIs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No Proforma Invoices found</td></tr>
            ) : (
              filteredPIs.map((pi) => (
                <tr key={pi.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-gray-900 uppercase">{pi.piNumber}</span>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">{new Date(pi.piDate).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700 uppercase tracking-tight">{pi.customer?.name || '-'}</span>
                      <span className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-1">
                        {pi.lc?.lcNumber ? `LC: ${pi.lc.lcNumber}` : 'DIRECT EXPORT'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-gray-500">
                    {getCurrencySymbol(pi.currency)}{pi.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-gray-900">
                    ৳{pi.totalBDT?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-bold rounded-sm uppercase tracking-widest border",
                      getStatusStyle(pi.status)
                    )}>
                      {pi.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right opacity-40 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-end gap-1">
                      {(pi.status === 'DRAFT' || pi.status === 'REJECTED') && (
                        <>
                          <button onClick={() => openModal(pi)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMutation.mutate(pi.id)} className="p-1.5 text-gray-300 hover:text-red-600 rounded-sm transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      {pi.status === 'DRAFT' && <button onClick={() => updateStatusMutation.mutate({ id: pi.id, status: 'VERIFIED' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors" title="Verify"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                      {pi.status === 'VERIFIED' && <button onClick={() => updateStatusMutation.mutate({ id: pi.id, status: 'APPROVED' })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                      {pi.status === 'APPROVED' && <button onClick={() => updateStatusMutation.mutate({ id: pi.id, status: 'SENT' })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-sm transition-colors" title="Mark as Sent"><ArrowUpRight className="w-3.5 h-3.5" /></button>}
                      <button onClick={() => openModal(pi)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
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
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
            {/* Sticky Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-gray-400" />
                <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">
                  {selectedPI ? `Edit PI: ${selectedPI.piNumber}` : 'New Export Proforma Invoice'}
                </h3>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  form="pi-form"
                  disabled={createMutation.isPending}
                  className="px-6 py-2 bg-gray-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-all flex items-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {selectedPI ? 'Update PI' : 'Register PI'}
                </button>

                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <form onSubmit={handleSubmit} id="pi-form" className="space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  {/* Left Column: Contract */}
                  <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em] border-b border-gray-100 pb-3">Contract Data</h4>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">PI Number *</label>
                          <input 
                            type="text" 
                            value={isAutoPI && !selectedPI ? 'AUTO-GENERATED' : formData.piNumber} 
                            onChange={(e) => setFormData({...formData, piNumber: e.target.value})} 
                            disabled={isAutoPI && !selectedPI}
                            className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-mono font-bold uppercase tracking-tight bg-white shadow-sm"
                            required={!isAutoPI} 
                          />
                          {!selectedPI && (
                            <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                              <input type="checkbox" checked={isAutoPI} onChange={(e) => setIsAutoPI(e.target.checked)} className="w-3 h-3 rounded-sm border-gray-300 text-gray-900 focus:ring-0" />
                              <span className="text-[9px] text-gray-400 group-hover:text-gray-900 font-bold uppercase tracking-widest transition-colors">Auto-generate</span>
                            </label>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">PI Date</label>
                          <input type="date" value={formData.piDate} onChange={(e) => setFormData({...formData, piDate: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-mono bg-white shadow-sm" required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Buyer Selection *</label>
                        <select 
                          value={formData.customerId} 
                          onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-bold uppercase tracking-tight bg-white shadow-sm"
                          required
                        >
                          <option value="">SELECT BUYER</option>
                          {customersData?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">LC Reference</label>
                        <select 
                          value={formData.lcId} 
                          onChange={(e) => setFormData({...formData, lcId: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-bold uppercase tracking-tight bg-white shadow-sm"
                        >
                          <option value="">DIRECT EXPORT (NO LC)</option>
                          {lcsData?.filter((l: any) => l.type === 'EXPORT').map((l: any) => <option key={l.id} value={l.id}>{l.lcNumber}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Center Column: Financials */}
                  <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em] border-b border-gray-100 pb-3">Value & Currency</h4>
                    
                    <div className="bg-gray-50/50 p-6 border border-gray-100 rounded-sm space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <DollarSign className="w-24 h-24" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Currency</label>
                          <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[11px] bg-white focus:outline-none focus:border-gray-900 font-bold uppercase tracking-widest">
                            <option value="USD">USD</option>
                            <option value="BDT">BDT</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Spot Rate</label>
                          <div className="w-full px-2 py-1.5 bg-white border border-gray-100 rounded-sm text-[11px] text-gray-900 font-mono font-bold">
                            {formData.currency === 'BDT' ? 1 : (exchangeRate || 1)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-gray-200 relative z-10">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Foreign Val.</span>
                          <span className="text-2xl font-mono font-black text-gray-900">
                             {getCurrencySymbol(formData.currency)}{calculateSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.2em]">Equiv. BDT</span>
                          <span className="text-2xl font-mono font-black text-blue-600">
                             ৳{(calculateSubtotal() * (formData.currency === 'BDT' ? 1 : (exchangeRate || 1))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Banking */}
                  <div className="space-y-8">
                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em] border-b border-gray-100 pb-3">Banking Compliance</h4>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Commercial Invoice Ref</label>
                        <input type="text" value={formData.invoiceNumber} onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-mono font-bold uppercase tracking-tight bg-white shadow-sm" placeholder="INV/XXX/24" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Buyer Submission</label>
                          <input type="date" value={formData.submissionToBuyerDate} onChange={(e) => setFormData({...formData, submissionToBuyerDate: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[10px] font-mono bg-white shadow-sm" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Bank Submission</label>
                          <input type="date" value={formData.submissionToBankDate} onChange={(e) => setFormData({...formData, submissionToBankDate: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[10px] font-mono bg-white shadow-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Acceptance Date</label>
                          <input type="date" value={formData.bankAcceptanceDate} onChange={(e) => setFormData({...formData, bankAcceptanceDate: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[10px] font-mono bg-white shadow-sm" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Maturity Date</label>
                          <input type="date" value={formData.maturityDate} onChange={(e) => setFormData({...formData, maturityDate: e.target.value})} className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[10px] font-mono bg-white shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Schedule Table */}
                <div className="space-y-6 pt-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em] flex items-center gap-2">
                       <ShoppingBag className="w-4 h-4 text-gray-400" />
                       PI Schedule Breakdown
                    </h4>
                    <button type="button" onClick={addLine} className="text-gray-900 hover:text-blue-600 transition-colors text-[9px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add New Row
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-sm overflow-hidden shadow-sm">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 border-b border-gray-200 text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                        <tr>
                          <th className="px-4 py-3 text-left">Category</th>
                          <th className="px-4 py-3 text-left">Line Description</th>
                          <th className="px-4 py-3 text-center w-24">Qty</th>
                          <th className="px-4 py-3 text-right w-32">Unit Price</th>
                          <th className="px-4 py-3 text-right w-40">Foreign Total</th>
                          <th className="px-4 py-3 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 group transition-colors">
                            <td className="px-4 py-3">
                              <select 
                                value={line.productId} 
                                onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-bold text-gray-900 p-0 uppercase tracking-tight"
                              >
                                <option value="">SELECT PRODUCT</option>
                                {allProductsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" value={line.description}
                                onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-gray-600 p-0 uppercase tracking-tight"
                                placeholder="ENTER SPECIFICATIONS..."
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" step="any" value={line.quantity}
                                onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-center font-mono font-bold text-gray-900 p-0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1 border border-gray-50 rounded px-2 py-1">
                                  <span className="text-[9px] font-bold text-gray-400">{formData.currency === 'USD' ? '$' : '৳'}</span>
                                  <input 
                                    type="number" step="any" value={line.unitPrice}
                                    onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-right font-mono font-bold text-gray-600 p-0"
                                  />
                                </div>
                                <div className="text-[9px] text-gray-400 mt-1 px-1 font-mono text-right">
                                   ৳ {formatCurrency(line.unitPrice * (formData.currency === 'BDT' ? 1 : (exchangeRate || 1)))}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                               <div className="flex flex-col">
                                 <span className="font-mono font-black text-gray-900 text-[12px]">{getCurrencySymbol(formData.currency)} {line.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                 <span className="text-[9px] text-gray-400 font-mono">৳{(line.total * (formData.currency === 'BDT' ? 1 : (exchangeRate || 1))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                               </div>
                             </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                type="button" onClick={() => removeLine(idx)}
                                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-start gap-12 pt-6">
                   <div className="flex-1">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Internal Procurement Notes</label>
                      <textarea 
                        value={formData.description} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        rows={4}
                        className="w-full border border-gray-200 rounded-sm p-4 text-[11px] font-medium focus:outline-none focus:border-gray-900 bg-white resize-none shadow-sm placeholder:text-gray-300"
                        placeholder="SPECIFY LC CLAUSES, SHIPPING TERMS, OR BANKING REQUIREMENTS..."
                      />
                   </div>
                   <div className="w-96 space-y-6 bg-gray-50 p-6 rounded-sm border border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Foreign Subtotal</span>
                        <span className="font-mono text-[13px] font-bold text-gray-900">{formData.currency} {calculateSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="pt-6 border-t border-gray-200 flex justify-between items-end">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.3em]">Total BDT</span>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic opacity-60">Spot Rate {exchangeRate || 1}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-2xl font-black text-blue-600 leading-none">
                            ৳{(calculateSubtotal() * (exchangeRate || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                   </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

