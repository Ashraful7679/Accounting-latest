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
  Lock, RefreshCw, ArrowUpRight, Printer, Truck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AttachmentManager } from '@/components/AttachmentManager';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/CompanyContext';
import { buildPrintDocument, openPrintWindow } from '@/lib/printUtils';


interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; code: string } | null;
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

export default function SalesInvoicesPage() {
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
    customerId: '',
    currency: 'BDT',
    exchangeRate: 1,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    status: '',
    piIds: [] as string[],
    lines: [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]
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

  const productsData = allProductsData?.filter((p: any) => p.type === 'Sales' || !p.type) || [];

  const { data: pisData } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=export`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const customerPIs = pisData?.filter((pi: any) => pi.customerId === formData.customerId && (pi.status === 'SENT' || pi.status === 'PARTIAL' || pi.status === 'APPROVED')) || [];

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
        piIds: invoice.piIds || [],
        lines: invoice.lines?.length ? invoice.lines.map((l: any) => ({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          shippedQuantity: l.shippedQuantity || l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          taxAmount: (l.shippedQuantity || l.quantity) * l.unitPrice * (l.taxRate / 100),
          piId: l.piId || ''
        })) : [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]
      });
    } else {
      setSelectedInvoice(null);
      setFormData({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        customerId: '',
        currency: 'USD',
        exchangeRate: globalExchangeRate || 1,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        description: '',
        status: 'DRAFT',
        piIds: [],
        lines: [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]
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
      }
    }
    
    if (['shippedQuantity', 'unitPrice', 'taxRate'].includes(field)) {
      line.taxAmount = (line.shippedQuantity || 0) * (line.unitPrice || 0) * ((line.taxRate || 0) / 100);
    }
    
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => sum + ((line.shippedQuantity || line.quantity) * line.unitPrice), 0);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-600',
      VERIFIED: 'bg-blue-100 text-blue-700',
      APPROVED: 'bg-emerald-100 text-emerald-700',
      SENT: 'bg-indigo-100 text-indigo-700',
      PARTIAL: 'bg-amber-100 text-amber-700',
      COMPLETED: 'bg-blue-600 text-white',
      CANCELLED: 'bg-rose-100 text-rose-700',
      REJECTED: 'bg-rose-100 text-rose-800',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const filteredInvoices = invoicesData?.filter((inv: Invoice) => {
    const matchesSearch = !searchTerm || 
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const handlePrintChallan = (inv: Invoice) => {
    const linesHtml = inv.lines?.map((line: any, index: number) => `
      <tr>
        <td>${index + 1}</td>
        <td>${line.product?.name || line.description || 'N/A'}</td>
        <td style="text-align: right;">${line.quantity}</td>
        <td style="text-align: right;">${line.shippedQuantity || line.quantity}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align: center;">No items found</td></tr>';

    const html = `
      <div style="margin-bottom: 30px;">
        <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0; color: #0f172a; text-transform: uppercase;">Delivery Challan</h1>
        <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>Invoice #:</strong> ${inv.invoiceNumber}</p>
        <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>Date:</strong> ${inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</p>
      </div>

      <div style="margin-bottom: 30px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h3 style="font-size: 14px; font-weight: bold; margin: 0 0 8px 0; color: #0f172a; text-transform: uppercase;">Delivery To:</h3>
        <p style="margin: 0; color: #334155; font-weight: 600; font-size: 16px;">${inv.customer?.name || '-'}</p>
        ${inv.customer?.code ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Code: ${inv.customer.code}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; color: #475569; width: 50px;">Sl</th>
            <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; color: #475569;">Item Description</th>
            <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #475569; width: 120px;">Ordered Qty</th>
            <th style="padding: 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #475569; width: 120px;">Delivered Qty</th>
          </tr>
        </thead>
        <tbody style="border: 1px solid #cbd5e1;">
          ${linesHtml.replace(/<td/g, '<td style="padding: 12px; border: 1px solid #cbd5e1;"')}
        </tbody>
      </table>

      <div style="display: flex; justify-content: space-between; margin-top: 80px;">
        <div style="text-align: center;">
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px; width: 200px;">
            <p style="margin: 0; font-weight: bold; color: #475569;">Received By</p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">Signature & Date</p>
          </div>
        </div>
        <div style="text-align: center;">
          <div style="border-top: 1px solid #94a3b8; padding-top: 8px; width: 200px;">
            <p style="margin: 0; font-weight: bold; color: #475569;">Authorized Signature</p>
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">For ${companyName || 'AccaBiz'}</p>
          </div>
        </div>
      </div>
    `;
    
    openPrintWindow(buildPrintDocument({
      title: `Delivery_Challan_${inv.invoiceNumber}`,
      company: { name: companyName || 'AccaBiz' },
      body: html
    }));
  };

  if (!mounted) return null;

  const stats = {
    totalSales: filteredInvoices.reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
    paidTotal: filteredInvoices.filter(inv => inv.status === 'PAID').reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
    dueTotal: filteredInvoices.filter(inv => inv.status !== 'PAID').reduce((acc, inv) => acc + (inv.totalBDT || 0), 0),
  };

  return (
    <div className="min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Sales</p>
            <p className="text-xl font-black text-slate-900">৳{stats.totalSales.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Paid Amount</p>
            <p className="text-xl font-black text-slate-900">৳{stats.paidTotal.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Due Amount</p>
            <p className="text-xl font-black text-slate-900">৳{stats.dueTotal.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sales Invoices</h2>
          <button
            onClick={() => openModal()}
            className="bg-slate-900 text-white px-4 py-2 rounded-md font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
          >
            <Plus className="w-3 h-3" />
            Create Invoice
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
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-600 outline-none hover:bg-slate-100 transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="VERIFIED">Verified</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent</option>
            <option value="PARTIAL">Partial</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Foreign Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Total (৳)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
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
                    <td className="px-4 py-3">{inv.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {inv.currency !== 'BDT' ? `${inv.currency} ${inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ৳{inv.totalBDT?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[10px] font-black rounded-full uppercase tracking-tighter ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(inv.status === 'DRAFT' || inv.status === 'REJECTED') && (
                          <>
                            <button onClick={() => openModal(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {inv.status === 'DRAFT' && <button onClick={() => verifyMutation.mutate(inv.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Verify"><CheckCircle2 className="w-4 h-4" /></button>}
                        {inv.status === 'VERIFIED' && <button onClick={() => approveMutation.mutate(inv.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>}
                        {inv.status === 'APPROVED' && <button onClick={() => submitMutation.mutate(inv.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Mark as Sent"><ArrowUpRight className="w-4 h-4" /></button>}
                        <button onClick={() => handlePrintChallan(inv)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Print Delivery Challan"><Truck className="w-4 h-4" /></button>
                        <button onClick={() => openModal(inv)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            {/* STICKY HEADER WITH ACTIONS */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  {selectedInvoice ? `Edit Invoice: ${selectedInvoice.invoiceNumber}` : 'New Invoice'}
                </h3>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  form="invoice-form"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-slate-900 text-white font-bold text-[10px] uppercase tracking-widest rounded hover:bg-slate-800 disabled:bg-slate-300 transition-all active:scale-95"
                >
                  {selectedInvoice ? (createMutation.isPending ? 'Saving...' : 'Update') : (createMutation.isPending ? 'Saving...' : 'Create')}
                </button>

                {selectedInvoice && (
                  <div className="flex gap-2">
                    {(selectedInvoice.status === 'DRAFT' || selectedInvoice.status === 'REJECTED') && (
                      <button
                        type="button"
                        onClick={() => submitMutation.mutate(selectedInvoice.id)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-widest border border-slate-200 rounded hover:bg-slate-200"
                      >
                        Submit
                      </button>
                    )}

                    {selectedInvoice.status === 'PENDING' && ['Manager', 'Owner', 'Admin'].includes(userRole) && (
                      <button
                        type="button"
                        onClick={() => verifyMutation.mutate(selectedInvoice.id)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 font-bold text-[10px] uppercase tracking-widest border border-blue-100 rounded hover:bg-blue-100"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                )}

                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="p-2 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <Plus className="w-5 h-5 rotate-45" />
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
                      onChange={(e) => setFormData({...formData, customerId: e.target.value, piIds: [], lines: [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]})} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 text-sm bg-white" 
                      required
                    >
                      <option value="">Choose a customer...</option>
                      {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Status</label>
                    <select 
                      value={formData.status} 
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 text-sm bg-white"
                    >
                      {['DRAFT', 'VERIFIED', 'APPROVED', 'SENT', 'PARTIAL', 'COMPLETED', 'CANCELLED', 'REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Issuance Date</label>
                      <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 text-sm bg-white" required />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Maturity Date</label>
                      <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-slate-500 text-sm bg-white" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-4 rounded-md border border-slate-300">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">Select Sales Orders (PIs)</label>
                      <select 
                        multiple
                        value={formData.piIds}
                        onChange={(e) => {
                          const selectedOptions = Array.from(e.target.selectedOptions).map(opt => opt.value);
                          setFormData(prev => {
                            let newLines = [...prev.lines];
                            newLines = newLines.filter(line => !line.piId || selectedOptions.includes(line.piId));
                            const newlySelected = selectedOptions.filter(id => !prev.piIds.includes(id));
                            newlySelected.forEach(piId => {
                              const pi = customerPIs.find((p: any) => p.id === piId);
                              if (pi && pi.lines) {
                                pi.lines.forEach((l: any) => {
                                  newLines.push({
                                    productId: l.productId,
                                    description: l.description,
                                    quantity: l.quantity,
                                    shippedQuantity: l.quantity,
                                    unitPrice: l.unitPrice,
                                    taxRate: l.taxRate || 0,
                                    taxAmount: l.quantity * l.unitPrice * ((l.taxRate || 0) / 100),
                                    piId: piId
                                  });
                                });
                              }
                            });
                            if (newLines.length > 1 && newLines[0].productId === '' && newLines[0].piId === '') {
                              newLines.shift();
                            }
                            return { ...prev, piIds: selectedOptions, lines: newLines };
                          });
                        }}
                        className="w-full px-3 py-2 bg-white border-slate-200 rounded-md border text-sm font-bold focus:ring-1 focus:ring-slate-400 min-h-[100px]"
                      >
                        {customerPIs.map((pi: any) => (
                          <option key={pi.id} value={pi.id}>{pi.piNumber} (৳{pi.totalBDT})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">Currency</label>
                        <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full px-3 py-2 bg-white border-slate-300 rounded-md border text-sm focus:outline-none focus:border-slate-500">
                          <option value="BDT">BDT (Local)</option>
                          <option value="USD">USD (Dollar)</option>
                          <option value="EUR">EUR (Euro)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">System Spot Rate</label>
                        <div className="w-full px-3 py-2 bg-slate-50 border-slate-300 rounded-md border text-sm text-slate-700">
                          {formData.exchangeRate || globalExchangeRate || 1} BDT
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">Memo / Description</label>
                      <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Notes for this invoice..." className="w-full px-3 py-2 bg-white border-slate-300 rounded-md border text-sm focus:outline-none focus:border-slate-500" />
                    </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-100 border border-slate-300 px-4 py-3 rounded-md">
                    <h4 className="font-semibold text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2">
                       <Layers className="w-4 h-4 text-slate-500" />
                       Transaction Components
                    </h4>
                    <button type="button" onClick={addLine} className="text-slate-600 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-wider flex items-center gap-2 group">
                      <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform bg-indigo-500/20 rounded-lg p-0.5" /> Add New Row
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Render grouped by Sales Order */}
                    {[...new Set(['', ...formData.lines.map(l => l.piId || '')])].map(piId => {
                      const groupLines = formData.lines.map((l, i) => ({...l, originalIndex: i})).filter(l => (l.piId || '') === piId);
                      if (groupLines.length === 0) return null;
                      
                      const pi = customerPIs?.find((p: any) => p.id === piId);
                      
                      return (
                        <div key={piId || 'custom'} className="mb-6 border border-slate-300 rounded-md overflow-hidden bg-white">
                          <div className="bg-slate-50 px-4 py-2 border-b border-slate-300 flex justify-between items-center">
                            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                              {piId ? `Sales Order: ${pi?.piNumber || 'Unknown'}` : 'Custom Invoice Lines'}
                            </span>
                            {piId && (
                              <span className="text-[10px] font-bold text-slate-500">
                                Order Date: {pi?.piDate ? new Date(pi.piDate).toLocaleDateString() : '-'}
                              </span>
                            )}
                          </div>
                          
                          <div className="p-4 space-y-4">
                            {/* Table Header */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                              <div className="col-span-2">Product</div>
                              <div className="col-span-2">Description</div>
                              <div className="col-span-1 text-center">Ordered Qty</div>
                              <div className="col-span-1 text-center">Shipped Qty</div>
                              <div className="col-span-1 text-center text-amber-500">Remaining</div>
                              <div className="col-span-2 text-right">Unit Price</div>
                              <div className="col-span-1 text-right">Tax Amt</div>
                              <div className="col-span-2 text-right text-indigo-600">Shipped Total</div>
                            </div>
                            
                            {groupLines.map((line) => {
                              const originalIndex = line.originalIndex;
                              const remaining = Number(line.quantity) - Number(line.shippedQuantity);
                              return (
                                <div key={originalIndex} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-all group/row relative">
                                  <div className="col-span-12 md:col-span-2">
                                    <select 
                                      value={line.productId} 
                                      onChange={(e) => handleLineChange(originalIndex, 'productId', e.target.value)}
                                      className="w-full px-3 py-2 bg-white border-slate-200 rounded-lg text-sm font-black focus:ring-2 focus:ring-indigo-500"
                                      disabled={!!piId}
                                    >
                                      <option value="">Custom Line</option>
                                      {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                  </div>
                                  <div className="col-span-12 md:col-span-2">
                                    <input 
                                      type="text" 
                                      value={line.description} 
                                      onChange={(e) => handleLineChange(originalIndex, 'description', e.target.value)}
                                      className="w-full px-3 py-2 bg-white border-slate-200 rounded-lg text-sm font-black focus:ring-2 focus:ring-indigo-500"
                                      disabled={!!piId}
                                    />
                                  </div>
                                  <div className="col-span-4 md:col-span-1">
                                    <input 
                                      type="number" step="any"
                                      value={line.quantity} 
                                      onChange={(e) => handleLineChange(originalIndex, 'quantity', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-2 bg-slate-100 border-transparent rounded-lg text-sm font-black text-center text-slate-500"
                                      readOnly={!!piId}
                                    />
                                  </div>
                                  <div className="col-span-4 md:col-span-1">
                                    <input 
                                      type="number" step="any"
                                      value={line.shippedQuantity} 
                                      onChange={(e) => handleLineChange(originalIndex, 'shippedQuantity', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-2 bg-white border-indigo-200 rounded-lg text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 text-indigo-700"
                                      max={piId ? line.quantity : undefined}
                                    />
                                  </div>
                                  <div className="col-span-4 md:col-span-1 text-center font-mono text-xs font-bold text-amber-500 pt-2">
                                    {remaining > 0 ? remaining : 0}
                                  </div>
                                  <div className="col-span-6 md:col-span-2">
                                    <input 
                                      type="number" step="any"
                                      value={line.unitPrice} 
                                      onChange={(e) => handleLineChange(originalIndex, 'unitPrice', parseFloat(e.target.value) || 0)}
                                      className="w-full px-3 py-2 bg-slate-100 border-transparent rounded-lg text-sm font-black text-right"
                                      readOnly={!!piId}
                                    />
                                  </div>
                                  <div className="col-span-6 md:col-span-1">
                                    <input 
                                      type="number" step="any"
                                      value={line.taxAmount} 
                                      readOnly
                                      className="w-full px-2 py-2 bg-slate-100 border-transparent rounded-lg text-xs font-black text-right text-slate-500"
                                    />
                                  </div>
                                  <div className="col-span-10 md:col-span-2 text-right border-l border-slate-200 pl-4 flex flex-col justify-center">
                                    <div className="text-sm font-black text-indigo-600 tabular-nums">{(line.shippedQuantity * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                  </div>
                                  {!piId && (
                                    <button type="button" onClick={() => removeLine(originalIndex)} className="absolute -right-2 -top-2 bg-white shadow-sm border border-slate-200 p-1.5 text-slate-400 hover:text-rose-500 rounded-full transition-all opacity-0 group-hover/row:opacity-100">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
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
