'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Filter, Edit2, Trash2, Eye,
  ChevronDown, CheckCircle2, AlertCircle, DollarSign, Calendar,
  ArrowUpRight, ArrowDownRight, Building2, Globe, ArrowRightLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPI, setSelectedPI] = useState<PI | null>(null);
  const [formData, setFormData] = useState({
    piNumber: '',
    currency: 'USD',
    exchangeRate: 110,
    piDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    submissionToBuyerDate: '',
    submissionToBankDate: '',
    bankAcceptanceDate: '',
    maturityDate: '',
    customerId: '',
    lcId: '',
    description: '',
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }] as PILine[]
  });
  const [isAutoPI, setIsAutoPI] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

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

  const { data: lcsData } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const totalForeign = data.lines.reduce((acc: number, line: PILine) => acc + (line.quantity * line.unitPrice), 0);
      const response = await api.post(`/company/${companyId}/pis`, { ...data, amount: totalForeign, totalBDT: totalForeign * data.exchangeRate, type: 'EXPORT' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-pis', companyId] });
      toast.success('Export PI registered successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create PI');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const totalForeign = data.lines.reduce((acc: number, line: PILine) => acc + (line.quantity * line.unitPrice), 0);
      const response = await api.put(`/company/${companyId}/pis/${id}`, { ...data, amount: totalForeign, totalBDT: totalForeign * data.exchangeRate });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-pis', companyId] });
      toast.success('PI details updated');
      closeModal();
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error?.message || 'Failed to update PI';
      toast.error(msg);
      if (msg.toLowerCase().includes('already exists')) {
        // Highlight PI number field error if needed
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/pis/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-pis', companyId] });
      toast.success('PI deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete PI');
    },
  });

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };
    const exchangeRate = Number(formData.exchangeRate) || 1;
    
    // Auto-fill from product
    if (field === 'productId' && value) {
      const product = productsData?.find((p: any) => p.id === value);
      if (product) {
        line.description = product.name;
        // Convert BDT price to selected currency
        line.unitPrice = Number((product.unitPrice / exchangeRate).toFixed(2));
      }
    }
    
    if (field === 'quantity' || field === 'unitPrice' || field === 'productId') {
      line.total = Number((line.quantity * (line.unitPrice || 0)).toFixed(2));
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
        exchangeRate: pi.exchangeRate || 110,
        piDate: pi.piDate ? pi.piDate.split('T')[0] : '',
        invoiceNumber: pi.invoiceNumber || '',
        submissionToBuyerDate: pi.submissionToBuyerDate ? pi.submissionToBuyerDate.split('T')[0] : '',
        submissionToBankDate: pi.submissionToBankDate ? pi.submissionToBankDate.split('T')[0] : '',
        bankAcceptanceDate: pi.bankAcceptanceDate ? pi.bankAcceptanceDate.split('T')[0] : '',
        maturityDate: pi.maturityDate ? pi.maturityDate.split('T')[0] : '',
        customerId: pi.customer?.id || '',
        lcId: pi.lc?.id || '',
        description: pi.description || '',
        lines: pi.lines?.length ? pi.lines.map((l: any) => ({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.quantity * l.unitPrice
        })) : [{ productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]
      });
    } else {
      setSelectedPI(null);
      setFormData({
        piNumber: '', currency: 'USD', exchangeRate: 110,
        piDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '', submissionToBuyerDate: '', submissionToBankDate: '',
        bankAcceptanceDate: '', maturityDate: '', customerId: '', lcId: '', description: '',
        lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]
      });
      setIsAutoPI(true);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPI(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPI) {
      updateMutation.mutate({ id: selectedPI.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: 'bg-blue-100 text-blue-700 font-bold',
      PAID: 'bg-emerald-100 text-emerald-700 font-bold',
      PARTIALLY_PAID: 'bg-amber-100 text-amber-700 font-bold',
      CLOSED: 'bg-slate-100 text-slate-600 font-bold',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const filteredPIs = pisData?.filter(pi => {
    const matchesSearch = !searchTerm || 
      pi.piNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pi.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pi.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen">


        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                Export PIs
              </h2>
              <p className="text-slate-500 font-medium">Manage Proforma Invoices and export documentation</p>
            </div>
            <button 
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Create Export PI
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by PI # or Customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-600 outline-none"
              >
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partial</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">PI Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Client / Export LC</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount (USD)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Total (BDT)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 animate-pulse font-bold text-slate-400">Loading export data...</td></tr>
                  ) : filteredPIs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400">No Proforma Invoices found</td></tr>
                  ) : (
                    filteredPIs.map((pi) => (
                      <tr key={pi.id} className="group hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{pi.piNumber}</span>
                            <span className="text-[10px] text-slate-400 font-black">{new Date(pi.piDate).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{pi.customer?.name || '-'}</span>
                            <span className="text-[10px] text-blue-500 font-black uppercase">{pi.lc?.lcNumber ? `LC: ${pi.lc.lcNumber}` : 'DIRECT EXPORT'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-bold text-slate-900">{pi.amount?.toLocaleString()} {pi.currency}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-black text-slate-900">৳ {pi.totalBDT?.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] uppercase tracking-tighter rounded-full ${getStatusBadge(pi.status)}`}>
                            {pi.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => openModal(pi)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate(pi.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

      {/* PI MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Globe className="w-6 h-6 text-blue-600" />
                  {selectedPI ? 'Update Proforma Invoice' : 'New Export PI Generation'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">Configure export value and banking timelines</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100">
                <ChevronDown className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Core Details */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Document Header</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 ml-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">PI Number *</label>
                        {!selectedPI && (
                          <label className="flex items-center gap-1 cursor-pointer group">
                            <input type="checkbox" checked={isAutoPI} onChange={(e) => setIsAutoPI(e.target.checked)} className="w-3 h-3 rounded" />
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter opacity-70 group-hover:opacity-100">Auto</span>
                          </label>
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={isAutoPI && !selectedPI ? 'AUTO-GENERATED' : formData.piNumber} 
                        onChange={(e) => setFormData({...formData, piNumber: e.target.value})} 
                        disabled={isAutoPI && !selectedPI}
                        placeholder={isAutoPI ? 'Auto-generated' : 'Enter PI Number'}
                        className={cn(
                          "w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold",
                          isAutoPI && !selectedPI && "opacity-50 cursor-not-allowed bg-slate-100"
                        )} 
                        required={!isAutoPI || !!selectedPI} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">PI Date *</label>
                      <input type="date" value={formData.piDate} onChange={(e) => setFormData({...formData, piDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Client / Buyer *</label>
                    <select value={formData.customerId} onChange={(e) => setFormData({...formData, customerId: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" required>
                      <option value="">Select Buyer</option>
                      {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Link to Export LC</label>
                    <select value={formData.lcId} onChange={(e) => setFormData({...formData, lcId: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold">
                      <option value="">Direct Export (No LC)</option>
                      {lcsData?.filter((l: any) => l.type === 'EXPORT').map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNumber} - {lc.bankName}</option>)}
                    </select>
                  </div>
                </div>

                {/* Middle: Financials & Conversion */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Pricing & Total</span>
                  </div>

                  <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5 ml-1">Currency</label>
                        <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full bg-white border-2 border-transparent focus:border-emerald-600 rounded-2xl px-4 py-3 outline-none transition-all font-bold">
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="BDT">BDT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5 ml-1">Exchange Rate</label>
                        <input type="number" step="0.01" value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value)})} className="w-full bg-white border-2 border-transparent focus:border-emerald-600 rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-emerald-100 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Total Foreign</p>
                        <p className="text-2xl font-black text-slate-900 font-mono">{calculateSubtotal().toLocaleString()} {formData.currency}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Total BDT</p>
                        <p className="text-2xl font-black text-emerald-800 font-mono">৳ {(calculateSubtotal() * formData.exchangeRate).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Timeline */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Banking Timeline</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Invoice Reference</label>
                      <input type="text" value={formData.invoiceNumber} onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subm. Buyer</label>
                        <input type="date" value={formData.submissionToBuyerDate} onChange={(e) => setFormData({...formData, submissionToBuyerDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:bg-white rounded-2xl px-2 py-3 outline-none transition-all font-bold text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subm. Bank</label>
                        <input type="date" value={formData.submissionToBankDate} onChange={(e) => setFormData({...formData, submissionToBankDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:bg-white rounded-2xl px-2 py-3 outline-none transition-all font-bold text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Acceptance</label>
                        <input type="date" value={formData.bankAcceptanceDate} onChange={(e) => setFormData({...formData, bankAcceptanceDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:bg-white rounded-2xl px-2 py-3 outline-none transition-all font-bold text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Maturity</label>
                        <input type="date" value={formData.maturityDate} onChange={(e) => setFormData({...formData, maturityDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:bg-white rounded-2xl px-2 py-3 outline-none transition-all font-bold text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Itemized Breakdown</h4>
                  </div>
                  <button type="button" onClick={addLine} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-100 transition-all active:scale-95">
                    <Plus className="w-4 h-4" /> Add Line Item
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-3 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-3">Product</div>
                    <div className="col-span-3">Description</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {formData.lines.map((line, idx) => (
                      <div key={idx} className="group grid grid-cols-12 gap-3 bg-slate-50/50 p-3 rounded-[1.5rem] border-2 border-transparent hover:border-blue-100 hover:bg-white transition-all">
                        <div className="col-span-3">
                          <select 
                            value={line.productId} 
                            onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                            className="w-full bg-transparent border-none outline-none font-bold text-slate-700 px-2 text-sm"
                          >
                            <option value="">Custom Product</option>
                            {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input 
                            type="text" value={line.description} placeholder="Item description"
                            onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                            className="w-full bg-transparent border-none outline-none font-bold text-slate-700 px-2 text-sm" required
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="number" value={line.quantity}
                            onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value))}
                            className="w-full bg-transparent border-none outline-none font-bold text-center text-slate-700 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <input 
                            type="number" step="0.01" value={line.unitPrice}
                            onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value))}
                            className="w-full bg-transparent border-none outline-none font-bold text-right text-slate-700 text-sm"
                          />
                        </div>
                        <div className="col-span-2 relative pr-10">
                          <div className="w-full text-right font-black text-slate-900 mt-1 text-sm font-mono">
                            {line.total.toLocaleString()}
                          </div>
                          <button 
                            type="button" onClick={() => removeLine(idx)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-lg shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-8 border-t border-slate-50">
                <button type="button" onClick={closeModal} className="px-8 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all active:scale-95">
                  Discard Draft
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:bg-slate-200"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving PI...' : (selectedPI ? 'Confirm PI Update' : 'Initialize Proforma Invoice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
