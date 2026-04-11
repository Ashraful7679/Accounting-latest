'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import UserDropdown from '@/components/UserDropdown';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  Calendar, DollarSign, CheckCircle2, AlertCircle,
  Layers, Send, CheckCheck, X as CloseIcon, ArrowLeft,
  Lock, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AttachmentManager } from '@/components/AttachmentManager';
import { cn } from '@/lib/utils';


interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; code: string } | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  description?: string;
  lines?: any[];
}

export default function SalesInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerId: '',
    currency: 'BDT',
    exchangeRate: 1,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    status: '',
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [userRole, setUserRole] = useState('User');

  const searchParams = useSearchParams();
  const action = searchParams.get('action');

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['sales-invoices', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/invoices?type=sales`);
      return response.data.data as Invoice[];
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

  const productsData = allProductsData?.filter((p: any) => p.type === 'Sales') || [];

  const { data: customersData } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setUserRole(roles[0] || 'User');
    if (!token) router.push('/login');

    if (action === 'create' && !isLoading) {
      openModal();
      window.history.replaceState({}, '', `/company/${companyId}/sales/invoices`);
    }
  }, [router, action, isLoading, companyId]);

  const editId = searchParams.get('edit');
  useEffect(() => {
    if (editId && !isLoading && mounted) {
      const existingInvoice = invoicesData?.find((i: Invoice) => i.id === editId);
      if (existingInvoice) {
        openModal(existingInvoice);
      } else {
        api.get(`/company/${companyId}/invoices/${editId}`)
          .then(res => {
            openModal(res.data.data);
          })
          .catch(err => toast.error('Failed to load invoice details'));
      }
      window.history.replaceState({}, '', `/company/${companyId}/sales/invoices`);
    }
  }, [editId, isLoading, mounted, companyId, invoicesData]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = selectedInvoice ? `/company/${companyId}/invoices/${selectedInvoice.id}` : `/company/${companyId}/invoices`;
      const method = selectedInvoice ? 'patch' : 'post';
      const response = await api[method](endpoint, { ...data, type: 'SALES' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success(selectedInvoice ? 'Invoice updated' : 'Invoice created');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to save invoice');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/company/${companyId}/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to delete invoice'),
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/company/${companyId}/invoices/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice verified');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to verify invoice'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/company/${companyId}/invoices/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice approved');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to approve invoice'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => api.post(`/company/${companyId}/invoices/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice rejected');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to reject invoice'),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/company/${companyId}/invoices/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice submitted');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to submit invoice'),
  });

  const openModal = (invoice?: any) => {
    if (invoice) {
      setSelectedInvoice(invoice);
      setFormData({
        invoiceNumber: invoice.invoiceNumber || '',
        customerId: invoice.customer?.id || '',
        currency: invoice.currency || 'BDT',
        exchangeRate: invoice.exchangeRate || 1,
        invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.split('T')[0] : '',
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
        description: invoice.description || '',
        status: invoice.status || 'DRAFT',
        lines: invoice.lines?.length ? invoice.lines.map((l: any) => ({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate
        })) : [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]
      });
    } else {
      setSelectedInvoice(null);
      setFormData({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        customerId: '',
        currency: 'BDT',
        exchangeRate: 1,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        description: '',
        status: 'DRAFT',
        lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedInvoice(null);
  };


  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };
    const exchangeRate = Number(formData.exchangeRate) || 1;
    if (field === 'productId' && value) {
      const product = productsData?.find((p: any) => p.id === value);
      if (product) {
        line.unitPrice = product.unitPrice;
        line.description = product.name;
        // Optionally sync invoice currency with product currency if it's a single item invoice,
        // but for now we just use the price as is.
      }
    }
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  };

  const calculateTax = () => {
    return formData.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice * line.taxRate / 100), 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const tax = calculateTax();
    return (sub + tax) * formData.exchangeRate;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      VERIFIED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-green-100 text-green-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      OVERDUE: 'bg-red-100 text-red-800',
      REJECTED: 'bg-rose-100 text-rose-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredInvoices = invoicesData?.filter((inv: Invoice) => {
    const matchesSearch = !searchTerm || 
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sales Invoices</h2>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Sales Invoice
          </button>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Invoice # or Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">All Status</option>
            {['DRAFT', 'PENDING', 'VERIFIED', 'APPROVED', 'PAID', 'PARTIAL', 'OVERDUE', 'REJECTED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-right font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">Loading invoices...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">No Sales Invoices found</td></tr>
              ) : (
                filteredInvoices.map((inv: Invoice) => (
                  <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{inv.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{inv.currency} {inv.total?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[10px] font-black rounded-full uppercase tracking-tighter ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openModal(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        {(inv.status === 'DRAFT' || inv.status === 'REJECTED') && (
                          <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* STICKY HEADER WITH ACTIONS */}
            <div className="px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-6 h-6 text-indigo-600" />
                  {selectedInvoice ? `Edit Invoice: ${selectedInvoice.invoiceNumber}` : 'Create New Invoice'}
                </h3>
                <div className="flex items-center gap-3 mt-1 px-1">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                    formData.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {formData.status}
                  </span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest tracking-[0.1em]">Commercial Billing Hub</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  form="invoice-form"
                  disabled={createMutation.isPending}
                  className="px-6 py-3 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 disabled:bg-slate-300 active:scale-95"
                >
                  <RefreshCw className={cn("w-4 h-4", createMutation.isPending && "animate-spin")} />
                  {selectedInvoice ? (createMutation.isPending ? 'Syncing...' : 'Update Record') : (createMutation.isPending ? 'Saving...' : 'Create Record')}
                </button>

                <div className="h-10 w-px bg-slate-200 mx-2 hidden sm:block" />

                {selectedInvoice && (
                  <div className="flex gap-2">
                    {(selectedInvoice.status === 'DRAFT' || selectedInvoice.status === 'REJECTED') && (
                      <button
                        type="button"
                        onClick={() => submitMutation.mutate(selectedInvoice.id)}
                        className="px-6 py-3 bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-600 shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                      >
                        Submit For Verification
                      </button>
                    )}

                    {selectedInvoice.status === 'PENDING' && ['Manager', 'Owner', 'Admin'].includes(userRole) && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => verifyMutation.mutate(selectedInvoice.id)}
                          className="px-6 py-3 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt('Provide rejection reason:') ?? '';
                            rejectMutation.mutate({ id: selectedInvoice.id, reason });
                          }}
                          className="px-6 py-3 bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {(['VERIFIED', 'PENDING_APPROVAL'].includes(selectedInvoice.status)) && ['Owner', 'Admin'].includes(userRole) && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate(selectedInvoice.id)}
                          className="px-6 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                        >
                          Final Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt('Provide rejection reason:') ?? '';
                            rejectMutation.mutate({ id: selectedInvoice.id, reason });
                          }}
                          className="px-6 py-3 bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all active:scale-90"
                  title="Close Model"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white custom-scrollbar">
              <form onSubmit={handleSubmit} id="invoice-form" className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-medium">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Customer Selection *</label>
                    <select 
                      value={formData.customerId} 
                      onChange={(e) => setFormData({...formData, customerId: e.target.value})} 
                      className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 border transition-all text-sm font-black shadow-sm" 
                      required
                    >
                      <option value="">Choose a customer...</option>
                      {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Issuance Date</label>
                      <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 border transition-all text-sm font-black shadow-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Maturity Date</label>
                      <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 border transition-all text-sm font-black shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-indigo-50/30 p-6 rounded-[2.5rem] border border-indigo-100/50 shadow-sm shadow-indigo-500/5">
                   <div>
                      <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5 px-1">Currency</label>
                      <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full px-3 py-2.5 bg-white border-indigo-100/50 rounded-xl border text-sm font-black focus:ring-2 focus:ring-indigo-500 shadow-sm">
                        <option value="BDT">BDT (Local)</option>
                        <option value="USD">USD (Dollar)</option>
                        <option value="EUR">EUR (Euro)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5 px-1">FX Rate (BDT)</label>
                      <input type="number" step="0.01" value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})} className="w-full px-3 py-2.5 bg-white border-indigo-100/50 rounded-xl border text-sm font-black focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5 px-1">Invoice Memo / Notes</label>
                      <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Internal notes or overall description..." className="w-full px-3 py-2.5 bg-white border-indigo-100/50 rounded-xl border text-sm font-black focus:ring-2 focus:ring-indigo-500 shadow-sm" />
                    </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-900 px-6 py-4 rounded-[2rem] shadow-xl shadow-slate-900/10">
                    <h4 className="font-black text-white uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                       <Layers className="w-4 h-4 text-indigo-400" />
                       Transaction Components
                    </h4>
                    <button type="button" onClick={addLine} className="text-indigo-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 group">
                      <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform bg-indigo-500/20 rounded-lg p-0.5" /> Add New Row
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {formData.lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-12 gap-4 items-center p-6 border border-slate-100 rounded-[2rem] bg-slate-50/30 hover:border-indigo-200 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all group/row relative">
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Product Model</label>
                          <select 
                            value={line.productId} 
                            onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border-slate-200 rounded-xl border text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                          >
                            <option value="">Custom Line Item</option>
                            {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="col-span-12 md:col-span-3">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Bill Description</label>
                          <input 
                            type="text" 
                            value={line.description} 
                            onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border-slate-200 rounded-xl border text-sm font-black focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 text-center">Qty</label>
                          <input 
                            type="number" step="any"
                            value={line.quantity} 
                            onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2.5 bg-white border-slate-200 rounded-xl border text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-1.5 md:col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 text-right">Unit Price ({formData.currency})</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">{formData.currency}</span>
                            <input 
                              type="number" step="any"
                              value={line.unitPrice} 
                              onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full pl-12 pr-3 py-2.5 bg-white border-slate-200 rounded-xl border text-sm font-black text-right focus:ring-2 focus:ring-indigo-500 shadow-sm"
                            />
                          </div>
                        </div>
                        <div className="col-span-4 md:col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 text-center">Tax %</label>
                          <input 
                            type="number" 
                            value={line.taxRate} 
                            onChange={(e) => handleLineChange(index, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2.5 bg-white border-slate-200 rounded-xl border text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 shadow-sm"
                          />
                        </div>
                        <div className="col-span-10 md:col-span-1 text-right border-l border-slate-100 pl-4">
                          <div className="text-[10px] font-black text-slate-300 uppercase mb-1.5">Row Value</div>
                          <div className="text-sm font-black text-indigo-600 tabular-nums">{(line.quantity * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="col-span-2 md:col-span-1 flex justify-end">
                          <button type="button" onClick={() => removeLine(index)} className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                  <div className="w-80 space-y-4">
                    <div className="flex justify-between items-center text-slate-500 font-bold">
                      <span className="text-[10px] uppercase tracking-widest">Subtotal</span>
                      <span className="font-black text-slate-900">{formData.currency} {calculateSubtotal().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 font-bold">
                      <span className="text-[10px] uppercase tracking-widest">Calculated Tax</span>
                      <span className="font-black text-slate-900">{formData.currency} {calculateTax().toLocaleString()}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em]">Grand Total</span>
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-900 leading-none">{formatCurrency(calculateTotal())}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Excl. FX Diff: @{formData.exchangeRate}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedInvoice && (
                  <div className="mt-8 pt-8 border-t border-slate-100">
                    <AttachmentManager 
                      entityType="INVOICE" 
                      entityId={selectedInvoice.id}
                      canEdit={['DRAFT', 'REJECTED'].includes(selectedInvoice.status)}
                    />
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function formatCurrency(val: any) {
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(val);
  }
}
