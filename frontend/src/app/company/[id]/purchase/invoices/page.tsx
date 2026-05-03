'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  CheckCircle2, Send, X, ShoppingBag, Loader2,
  Paperclip, ChevronRight
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/CompanyContext';
import { formatCurrency, getCurrencySymbol, convertCurrency } from '@/lib/decimalUtils';
import React from 'react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: { id: string; name: string; code: string } | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  totalAmount?: number;
  totalBDT?: number;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  description?: string;
  lines?: any[];
}

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { exchangeRate: globalExchangeRate, companyName } = useCompany();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    vendorId: '',
    currency: 'USD',
    exchangeRate: globalExchangeRate || 1,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    status: '',
    poIds: [] as string[],
    lines: [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, poId: '' }]
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [userRole, setUserRole] = useState('User');

  const searchParams = useSearchParams();
  const action = searchParams.get('action');

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['purchase-invoices', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/invoices?type=purchase`);
      return response.data.data as Invoice[];
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

  const { data: allProductsData } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const productsData = allProductsData?.filter((p: any) => p.type === 'Purchase' || !p.type) || [];

  const { data: posData } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const vendorPOs = posData?.filter((po: any) => po.supplierId === formData.vendorId && (po.status === 'SENT' || po.status === 'PARTIAL' || po.status === 'APPROVED')) || [];

  useEffect(() => {
    setMounted(true);
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setUserRole(roles[0] || 'User');
    
    if (action === 'create' && !isLoading) {
      openModal();
      window.history.replaceState({}, '', `/company/${companyId}/purchase/invoices`);
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
          .catch(() => toast.error('Failed to load invoice details'));
      }
      window.history.replaceState({}, '', `/company/${companyId}/purchase/invoices`);
    }
  }, [editId, isLoading, mounted, companyId, invoicesData]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = selectedInvoice ? `/company/${companyId}/invoices/${selectedInvoice.id}` : `/company/${companyId}/invoices`;
      const method = selectedInvoice ? 'patch' : 'post';
      const response = await api[method](endpoint, { ...data, type: 'PURCHASE' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Invoice deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to delete invoice'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string, action: string, reason?: string }) => 
      api.post(`/company/${companyId}/invoices/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success(`Invoice ${variables.action}ed`);
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Status update failed'),
  });

  const openModal = (invoice?: any) => {
    if (invoice) {
      setSelectedInvoice(invoice);
      setFormData({
        invoiceNumber: invoice.invoiceNumber || '',
        vendorId: invoice.vendor?.id || '',
        currency: invoice.currency || 'USD',
        exchangeRate: invoice.exchangeRate || 1,
        invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.split('T')[0] : '',
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
        description: invoice.description || '',
        status: invoice.status || 'DRAFT',
        poIds: invoice.poIds || [],
        lines: invoice.lines?.length ? invoice.lines.map((l: any) => ({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          receivedQuantity: l.receivedQuantity || l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate || 0,
          taxAmount: (l.receivedQuantity || l.quantity) * l.unitPrice * ((l.taxRate || 0) / 100),
          poId: l.poId || ''
        })) : [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, poId: '' }]
      });
    } else {
      setSelectedInvoice(null);
      setFormData({
        invoiceNumber: `PINV-${Date.now().toString().slice(-6)}`,
        vendorId: '',
        currency: 'USD',
        exchangeRate: globalExchangeRate || 1,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        description: '',
        status: 'DRAFT',
        poIds: [],
        lines: [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, poId: '' }]
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
    
    if (field === 'productId' && value) {
      const product = productsData?.find((p: any) => p.id === value);
      if (product) {
        const rawUnitPrice = product.unitPrice || 0;
        const productCurrency = product.currency || 'BDT';
        
        // Convert product price to form currency
        line.unitPrice = convertCurrency(rawUnitPrice, productCurrency, formData.currency, formData.exchangeRate);
        line.description = product.name;
      }
    }
    
    if (['receivedQuantity', 'unitPrice', 'taxRate'].includes(field)) {
      line.taxAmount = (line.receivedQuantity || 0) * (line.unitPrice || 0) * ((line.taxRate || 0) / 100);
    }
    
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, poId: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => sum + ((line.receivedQuantity || line.quantity) * line.unitPrice), 0);
  };

  const calculateTax = () => {
    return formData.lines.reduce((sum, line) => sum + (line.taxAmount || 0), 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const tax = calculateTax();
    return (sub + tax) * (formData.exchangeRate || globalExchangeRate || 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'PAID':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'VERIFIED':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'PENDING_VERIFICATION':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'DRAFT':
        return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const filteredInvoices = invoicesData?.filter((inv: Invoice) => {
    const matchesSearch = !searchTerm || 
      (inv.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (inv.vendor?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  const stats = {
    totalPurchases: filteredInvoices.reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
    paidTotal: filteredInvoices.filter(inv => inv.status === 'PAID').reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
    outstandingAP: filteredInvoices.filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED').reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
    overdue: filteredInvoices.filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.dueDate && new Date(inv.dueDate) < new Date()).reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Purchase Liability</p>
          <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">৳{stats.totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Paid</p>
          <p className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">৳{stats.paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm border-l-4 border-l-rose-500">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Outstanding AP</p>
          <p className="text-2xl font-bold text-rose-600 font-mono tracking-tight">৳{stats.outstandingAP.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm border-l-4 border-l-amber-500">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Overdue</p>
          <p className="text-2xl font-bold text-amber-600 font-mono tracking-tight">৳{stats.overdue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">
        <Link href={`/company/${companyId}`} className="hover:text-gray-900 transition-colors">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-400">Purchase</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900">Invoices</span>
      </div>

      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-gray-400" />
            Purchase Invoices
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Accounts Payable & Supplier Billing</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Create Invoice
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH INVOICES..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-gray-900 transition-colors bg-white shadow-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest text-gray-600 outline-none hover:border-gray-900 transition-colors shadow-sm"
        >
          <option value="all">ALL STATUSES</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="PAID">PAID</option>
          <option value="PARTIAL">PARTIAL</option>
          <option value="OVERDUE">OVERDUE</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-[11px] text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest">Invoice #</th>
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest">Date</th>
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest">Supplier</th>
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest text-right">Foreign Value</th>
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest text-right">Total (BDT)</th>
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-mono">LOADING DATA...</td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No Purchase Invoices found</td></tr>
            ) : (
              filteredInvoices.map((inv: Invoice) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4 font-mono font-bold text-gray-900 uppercase">{inv.invoiceNumber}</td>
                  <td className="px-4 py-4 font-mono text-gray-500">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-4 font-bold text-gray-700 uppercase tracking-tight">{inv.vendor?.name || '-'}</td>
                  <td className="px-4 py-4 text-right font-mono text-gray-500">
                    {inv.currency !== 'BDT' ? `${inv.currency} ${formatCurrency(inv.total)}` : '-'}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-gray-900">
                    ৳{formatCurrency(inv.totalBDT || (inv.total * (inv.exchangeRate || 1)))}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[9px] font-bold rounded-sm uppercase tracking-widest border",
                      getStatusStyle(inv.status)
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      {(inv.status === 'DRAFT' || inv.status === 'REJECTED') && (
                        <>
                          <button onClick={() => openModal(inv)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1.5 text-gray-300 hover:text-red-600 rounded-sm transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button onClick={() => openModal(inv)} className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
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
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Sticky Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">
                  {selectedInvoice ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}
                </h3>
                {selectedInvoice && (
                   <span className={cn(
                    "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm border",
                    getStatusStyle(selectedInvoice.status)
                   )}>
                      {selectedInvoice.status}
                   </span>
                )}
              </div>

              <div className="flex gap-2">
                {(!selectedInvoice || selectedInvoice.status === 'DRAFT') && (
                  <button 
                    type="submit" 
                    form="purchase-invoice-form"
                    disabled={createMutation.isPending}
                    className="px-6 py-1.5 bg-gray-900 text-white font-bold text-[9px] uppercase tracking-widest rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-all flex items-center gap-2 shadow-sm"
                  >
                    {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    {selectedInvoice ? 'Update Records' : 'Register Invoice'}
                  </button>
                )}

                {selectedInvoice?.status === 'DRAFT' && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: selectedInvoice.id, action: 'submit' })}
                    className="px-6 py-1.5 bg-blue-600 text-white font-bold text-[9px] uppercase tracking-widest rounded-sm hover:bg-blue-700 transition-all shadow-sm"
                  >
                    Submit for Verification
                  </button>
                )}

                {selectedInvoice?.status === 'PENDING_VERIFICATION' && ['Manager', 'Owner', 'Admin'].includes(userRole || '') && (
                  <>
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: selectedInvoice.id, action: 'verify' })}
                      className="px-6 py-1.5 bg-emerald-600 text-white font-bold text-[9px] uppercase tracking-widest rounded-sm hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('REASON FOR REJECTION:');
                        if (reason) updateStatusMutation.mutate({ id: selectedInvoice.id, action: 'reject', reason });
                      }}
                      className="px-6 py-1.5 bg-rose-600 text-white font-bold text-[9px] uppercase tracking-widest rounded-sm hover:bg-rose-700 transition-all shadow-sm"
                    >
                      Reject
                    </button>
                  </>
                )}

                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="p-1 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              <form onSubmit={handleSubmit} id="purchase-invoice-form" className="space-y-10">
                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-12">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supplier & Base</h4>
                    <div className="space-y-4 bg-gray-50/50 p-5 border border-gray-100 rounded-sm">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Invoice Number</label>
                        <input 
                          type="text" 
                          value={formData.invoiceNumber} 
                          className="w-full px-3 py-2 border border-gray-200 rounded-sm text-[11px] font-mono bg-white text-gray-400" 
                          disabled 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Supplier Selection *</label>
                        <select 
                          value={formData.vendorId} 
                          onChange={(e) => setFormData({...formData, vendorId: e.target.value, poIds: [], lines: [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, poId: '' }]})} 
                          className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-bold uppercase tracking-tight bg-white" 
                          required
                        >
                          <option value="">SELECT SUPPLIER</option>
                          {vendorsData?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timeline & Maturity</h4>
                    <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-5 border border-gray-100 rounded-sm">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Invoice Date *</label>
                        <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-mono bg-white" required />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
                        <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-mono bg-white" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Financial Context</h4>
                    <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-5 border border-gray-100 rounded-sm">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Currency</label>
                        <select 
                          value={formData.currency} 
                          onChange={(e) => {
                            const newCurr = e.target.value;
                            setFormData({
                              ...formData, 
                              currency: newCurr,
                              exchangeRate: newCurr === 'BDT' ? 1 : (globalExchangeRate || 1)
                            });
                          }} 
                          className="w-full px-3 py-2 border border-gray-200 rounded-sm bg-white text-[11px] font-bold uppercase focus:outline-none focus:border-gray-900"
                        >
                           {['USD','BDT'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Exchange Rate</label>
                        <input 
                          type="number" step="any"
                          value={formData.exchangeRate} 
                          onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-[11px] font-mono font-bold focus:outline-none focus:border-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-gray-50/50 p-6 border border-gray-100 rounded-sm">
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Linked Purchase Orders (POs)</h4>
                   <div className="flex flex-wrap gap-2">
                      {vendorPOs.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic uppercase font-bold tracking-widest">No active purchase orders found for this supplier</p>
                      ) : (
                        vendorPOs.map((po: any) => (
                          <label key={po.id} className={cn(
                            "px-4 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all",
                            formData.poIds.includes(po.id) 
                              ? "bg-gray-900 border-gray-900 text-white shadow-sm" 
                              : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                          )}>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={formData.poIds.includes(po.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const id = po.id;
                                setFormData(prev => {
                                  let newLines = [...prev.lines];
                                  const poIds = checked ? [...prev.poIds, id] : prev.poIds.filter(pid => pid !== id);
                                  
                                  if (checked) {
                                    const poLines = po.lines?.map((l: any) => ({
                                      productId: l.productId,
                                      description: l.description,
                                      quantity: l.quantity,
                                      receivedQuantity: l.quantity,
                                      unitPrice: l.unitPrice,
                                      taxRate: l.taxRate || 0,
                                      taxAmount: l.quantity * l.unitPrice * ((l.taxRate || 0) / 100),
                                      poId: id
                                    })) || [];
                                    
                                    if (newLines.length === 1 && newLines[0].productId === '') {
                                      newLines = poLines;
                                    } else {
                                      newLines = [...newLines, ...poLines];
                                    }
                                  } else {
                                    newLines = newLines.filter(line => line.poId !== id);
                                    if (newLines.length === 0) {
                                      newLines = [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, poId: '' }];
                                    }
                                  }
                                  return { ...prev, poIds, lines: newLines };
                                });
                              }}
                            />
                            {po.poNumber} - {po.currency} {formatCurrency(po.total)}
                          </label>
                        ))
                      )}
                   </div>
                </div>

                {/* Items Section */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                       <ShoppingBag className="w-4 h-4 text-gray-400" />
                       Invoice Breakdown
                    </h4>
                    <button type="button" onClick={addLine} className="text-gray-900 hover:underline transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add row
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-sm overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                        <tr>
                          <th className="px-4 py-3">Product & Details</th>
                          <th className="px-4 py-3 text-center w-24">Ordered</th>
                          <th className="px-4 py-3 text-center w-28">Received Qty</th>
                          <th className="px-4 py-3 text-right w-32">Unit Cost</th>
                          <th className="px-4 py-3 text-right w-24">Tax %</th>
                          <th className="px-4 py-3 text-right w-32">Line Total</th>
                          <th className="px-4 py-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.lines.map((line, index) => (
                          <tr key={index} className="hover:bg-gray-50/30 group transition-colors">
                            <td className="px-4 py-4 min-w-[300px] space-y-2">
                              <select 
                                value={line.productId} 
                                onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[11px] font-bold uppercase tracking-tight focus:outline-none focus:border-gray-900"
                                disabled={!!line.poId}
                              >
                                <option value="">SELECT PRODUCT</option>
                                {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <input 
                                type="text" 
                                value={line.description} 
                                onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[11px] focus:outline-none focus:border-gray-900"
                                placeholder="LINE DESCRIPTION..."
                                disabled={!!line.poId}
                              />
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-sm text-[11px] text-center text-gray-400 font-mono">
                                {line.quantity}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <input 
                                type="number" step="any"
                                value={line.receivedQuantity} 
                                onChange={(e) => handleLineChange(index, 'receivedQuantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[11px] text-center font-mono font-bold text-gray-900 focus:outline-none focus:border-gray-900 shadow-inner"
                              />
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 border border-gray-200 rounded-sm px-2 py-1.5 bg-white">
                                  <span className="text-[10px] font-bold text-gray-400">{getCurrencySymbol(formData.currency)}</span>
                                  <input 
                                    type="number" step="any"
                                    value={line.unitPrice} 
                                    onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full text-[11px] text-right font-mono focus:outline-none border-none p-0"
                                    readOnly={!!line.poId}
                                  />
                                </div>
                                {formData.currency !== 'BDT' && (
                                  <div className="text-[9px] text-gray-400 mt-1 px-1 font-mono text-right">
                                    ৳ {formatCurrency(line.unitPrice * formData.exchangeRate)}
                                  </div>
                                )}
                                {formData.currency === 'BDT' && (
                                   <div className="text-[9px] text-gray-400 mt-1 px-1 font-mono text-right">
                                    ৳ {formatCurrency(line.unitPrice)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                               <input 
                                type="number" step="any"
                                value={line.taxRate} 
                                onChange={(e) => handleLineChange(index, 'taxRate', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[11px] text-center font-mono focus:outline-none focus:border-gray-900"
                              />
                            </td>
                            <td className="px-4 py-4 text-right align-top pt-5 font-mono font-bold text-gray-900">
                              <div className="flex flex-col text-right">
                                <span>{getCurrencySymbol(formData.currency)} {formatCurrency((line.receivedQuantity || 0) * (line.unitPrice || 0))}</span>
                                {formData.currency !== 'BDT' && (
                                  <span className="text-[9px] text-gray-400">৳ {formatCurrency((line.receivedQuantity || 0) * (line.unitPrice || 0) * formData.exchangeRate)}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center align-top pt-5">
                              {!line.poId && (
                                <button type="button" onClick={() => removeLine(index)} className="text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Summary */}
                <div className="flex justify-between items-start gap-12 pt-10 border-t border-gray-100">
                   <div className="flex-1 space-y-6 max-w-xl">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Additional Information</h4>
                        <textarea 
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          className="w-full h-24 px-4 py-3 border border-gray-200 rounded-sm text-[11px] focus:outline-none focus:border-gray-900 placeholder:text-gray-300"
                          placeholder="ENTER INVOICE NOTES, PAYMENT TERMS OR SHIPMENT DETAILS..."
                        />
                      </div>
                      
                      {selectedInvoice && (
                        <div className="space-y-4 pt-6 border-t border-gray-100">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             <Paperclip className="w-3.5 h-3.5" /> Supporting Documents
                          </h4>
                          <AttachmentManager 
                            entityType="INVOICE" 
                            entityId={selectedInvoice.id} 
                            canEdit={selectedInvoice.status === 'DRAFT'} 
                          />
                        </div>
                      )}
                   </div>

                   <div className="w-96 bg-gray-50/50 p-8 rounded-sm border border-gray-100 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subtotal ({formData.currency})</span>
                        <span className="font-mono text-[13px] font-bold text-gray-900">{formatCurrency(calculateSubtotal())}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Taxes</span>
                        <span className="font-mono text-[13px] font-bold text-gray-900">{formatCurrency(calculateTax())}</span>
                      </div>
                      
                      <div className="pt-6 border-t border-gray-200 flex justify-between items-end">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Grand Total</span>
                          <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest italic leading-none">Net Payable</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-2xl font-black text-gray-900 leading-none tracking-tighter">
                             {getCurrencySymbol(formData.currency)} {formatCurrency(calculateSubtotal() + calculateTax())}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-900/5 p-4 rounded-sm border border-gray-900/10 mt-6 space-y-1">
                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Local Valuation (BDT)</p>
                        <p className="font-mono text-[15px] text-gray-900 font-bold leading-none">
                          ৳{formatCurrency(calculateTotal())}
                        </p>
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
