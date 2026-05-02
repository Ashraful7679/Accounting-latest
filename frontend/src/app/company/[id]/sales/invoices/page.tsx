'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  CheckCircle2, AlertCircle, Send,
  X, ArrowLeft, Printer, Truck, ShoppingBag, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/CompanyContext';
import { buildPrintDocument, openPrintWindow } from '@/lib/printUtils';
import React from 'react';

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
          .catch(() => toast.error('Failed to load invoice details'));
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
      toast.success('Invoice deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to delete invoice'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string, action: string }) => api.post(`/company/${companyId}/invoices/${id}/${action}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
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
          taxRate: l.taxRate || 0,
          taxAmount: (l.shippedQuantity || l.quantity) * l.unitPrice * ((l.taxRate || 0) / 100),
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
    
    if (field === 'productId' && value) {
      const product = productsData?.find((p: any) => p.id === value);
      if (product) {
        line.unitPrice = product.unitPrice || 0;
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'VERIFIED':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'SENT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">৳{stats.totalSales.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Paid Amount</p>
          <p className="text-2xl font-bold text-emerald-600 font-mono">৳{stats.paidTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Due Amount</p>
          <p className="text-2xl font-bold text-red-600 font-mono">৳{stats.dueTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex justify-between items-center pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-gray-400" />
            Sales Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage billing and accounts receivable</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Invoice # or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-gray-400 transition-colors bg-white shadow-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-xs font-bold uppercase tracking-wider text-gray-600 outline-none hover:border-gray-400 transition-colors shadow-sm"
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

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Foreign</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Total (৳)</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">Loading invoices...</td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">No Sales Invoices found</td></tr>
            ) : (
              filteredInvoices.map((inv: Invoice) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-3 font-bold text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{inv.customer?.name || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">
                    {inv.currency !== 'BDT' ? `${inv.currency} ${inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                    ৳{inv.totalBDT?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-wider border",
                      getStatusStyle(inv.status)
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(inv.status === 'DRAFT' || inv.status === 'REJECTED') && (
                        <>
                          <button onClick={() => openModal(inv)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-sm border border-transparent hover:border-gray-200 transition-all" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                      {inv.status === 'DRAFT' && <button onClick={() => updateStatusMutation.mutate({ id: inv.id, action: 'verify' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors" title="Verify"><CheckCircle2 className="w-4 h-4" /></button>}
                      {inv.status === 'VERIFIED' && <button onClick={() => updateStatusMutation.mutate({ id: inv.id, action: 'approve' })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>}
                      {inv.status === 'APPROVED' && <button onClick={() => updateStatusMutation.mutate({ id: inv.id, action: 'submit' })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-sm transition-colors" title="Mark as Sent"><Send className="w-4 h-4" /></button>}
                      <button onClick={() => handlePrintChallan(inv)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors" title="Print Delivery Challan"><Truck className="w-4 h-4" /></button>
                      <button onClick={() => openModal(inv)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-sm border border-transparent hover:border-gray-200 transition-all" title="View"><Eye className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
            {/* Sticky Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">
                  {selectedInvoice ? `Edit Invoice: ${selectedInvoice.invoiceNumber}` : 'Create New Sales Invoice'}
                </h3>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  form="invoice-form"
                  disabled={createMutation.isPending}
                  className="px-6 py-2 bg-gray-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-all shadow-sm flex items-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {selectedInvoice ? 'Update Invoice' : 'Save Invoice'}
                </button>

                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-sm transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <form onSubmit={handleSubmit} id="invoice-form" className="space-y-10">
                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Customer Selection *</label>
                    <select 
                      value={formData.customerId} 
                      onChange={(e) => setFormData({...formData, customerId: e.target.value, piIds: [], lines: [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]})} 
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white transition-colors" 
                      required
                    >
                      <option value="">Choose Customer</option>
                      {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Invoice Date</label>
                    <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white font-mono" required />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Due Date</label>
                    <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white font-mono" />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Status</label>
                    <select 
                      value={formData.status} 
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white"
                    >
                      {['DRAFT', 'VERIFIED', 'APPROVED', 'SENT', 'PARTIAL', 'COMPLETED', 'CANCELLED', 'REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 bg-gray-50 border border-gray-100 rounded-sm">
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Linked Sales Orders (PIs)</label>
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
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-gray-900 min-h-[80px]"
                      >
                        {customerPIs.map((pi: any) => (
                          <option key={pi.id} value={pi.id}>{pi.piNumber} - ৳{pi.totalBDT.toLocaleString()}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-400 mt-1 italic">Hold Ctrl to select multiple orders</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Currency</label>
                        <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-gray-900">
                          <option value="BDT">BDT (Local)</option>
                          <option value="USD">USD (Dollar)</option>
                          <option value="EUR">EUR (Euro)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Exchange Rate</label>
                        <input 
                          type="number" step="any"
                          value={formData.exchangeRate} 
                          onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-sm text-sm font-mono focus:outline-none focus:border-gray-900"
                        />
                      </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                       <ShoppingBag className="w-4 h-4 text-gray-400" />
                       Invoice Schedule
                    </h4>
                    <button type="button" onClick={addLine} className="text-gray-900 hover:text-blue-600 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Row
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-sm overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-center w-24">Ordered</th>
                          <th className="px-4 py-3 text-center w-24">Billing</th>
                          <th className="px-4 py-3 text-right w-28">Unit Price</th>
                          <th className="px-4 py-3 text-right w-24">Tax Amt</th>
                          <th className="px-4 py-3 text-right w-32">Total</th>
                          <th className="px-4 py-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.lines.map((line, index) => (
                          <tr key={index} className="hover:bg-gray-50/50 group transition-colors">
                            <td className="px-4 py-2">
                              <select 
                                value={line.productId} 
                                onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-900 p-0"
                                disabled={!!line.piId}
                              >
                                <option value="">Select Product</option>
                                {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="text" 
                                value={line.description} 
                                onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-gray-600 p-0"
                                placeholder="Details..."
                                disabled={!!line.piId}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" step="any"
                                value={line.quantity} 
                                readOnly
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-center text-gray-400 font-mono p-0"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" step="any"
                                value={line.shippedQuantity} 
                                onChange={(e) => handleLineChange(index, 'shippedQuantity', parseFloat(e.target.value) || 0)}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-center font-mono font-bold text-gray-900 p-0 focus:bg-blue-50"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" step="any"
                                value={line.unitPrice} 
                                onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-right font-mono p-0"
                                readOnly={!!line.piId}
                              />
                            </td>
                            <td className="px-4 py-2 text-right text-gray-400 font-mono">
                              {formatCurrency(line.taxAmount)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">
                              {formatCurrency(line.shippedQuantity * line.unitPrice)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {!line.piId && (
                                <button type="button" onClick={() => removeLine(index)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Totals */}
                <div className="flex justify-end pt-10">
                  <div className="w-80 space-y-4">
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                      <span className="font-mono text-sm font-bold text-gray-900">{formData.currency} {formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Tax Amount</span>
                      <span className="font-mono text-sm font-bold text-gray-900">{formData.currency} {formatCurrency(calculateTax())}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Payable Total</span>
                        <p className="text-[10px] text-gray-400 italic">Incl. all taxes & duties</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xl font-black text-gray-900 leading-none">
                          {formatCurrency(calculateSubtotal() + calculateTax())}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{formData.currency}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-sm border border-gray-100 mt-6">
                      <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Local Currency (BDT)</p>
                      <p className="font-mono text-sm text-gray-900 font-bold">
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
