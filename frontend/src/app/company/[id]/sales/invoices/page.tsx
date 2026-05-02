'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  CheckCircle2, Send, X, Truck, ShoppingBag, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useCompany } from '@/lib/CompanyContext';
import { buildPrintDocument, openPrintWindow } from '@/lib/printUtils';
import { formatCurrency, getCurrencySymbol } from '@/lib/decimalUtils';
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
      (inv.invoiceNumber?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (inv.customer?.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase());
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
      {/* Stat Cards - Refined */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Sales Revenue</p>
          <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">৳{stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Collected</p>
          <p className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">৳{stats.paidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm border-l-4 border-l-rose-500">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Outstanding AR</p>
          <p className="text-2xl font-bold text-rose-600 font-mono tracking-tight">৳{stats.dueTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Sales Invoices
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Accounts Receivable & Billing</p>
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
          <option value="VERIFIED">VERIFIED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="SENT">SENT</option>
          <option value="PARTIAL">PARTIAL</option>
          <option value="COMPLETED">COMPLETED</option>
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
              <th className="py-3 px-4 font-bold text-gray-400 uppercase tracking-widest">Customer</th>
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
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No Sales Invoices found</td></tr>
            ) : (
              filteredInvoices.map((inv: Invoice) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4 font-mono font-bold text-gray-900 uppercase">{inv.invoiceNumber}</td>
                  <td className="px-4 py-4 font-mono text-gray-500">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-4 font-bold text-gray-700 uppercase tracking-tight">{inv.customer?.name || '-'}</td>
                  <td className="px-4 py-4 text-right font-mono text-gray-500">
                    {inv.currency !== 'BDT' ? `${inv.currency} ${formatCurrency(inv.total)}` : '-'}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-gray-900">
                    ৳{formatCurrency(inv.totalBDT || 0)}
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
                      {inv.status === 'DRAFT' && <button onClick={() => updateStatusMutation.mutate({ id: inv.id, action: 'verify' })} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors" title="Verify"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                      {inv.status === 'VERIFIED' && <button onClick={() => updateStatusMutation.mutate({ id: inv.id, action: 'approve' })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                      {inv.status === 'APPROVED' && <button onClick={() => updateStatusMutation.mutate({ id: inv.id, action: 'submit' })} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-sm transition-colors" title="Mark as Sent"><Send className="w-3.5 h-3.5" /></button>}
                      <button onClick={() => handlePrintChallan(inv)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors" title="Print Delivery Challan"><Truck className="w-3.5 h-3.5" /></button>
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
                  {selectedInvoice ? 'Edit Sales Invoice' : 'New Sales Invoice'}
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
                    form="invoice-form"
                    disabled={createMutation.isPending}
                    className="px-6 py-1.5 bg-gray-900 text-white font-bold text-[9px] uppercase tracking-widest rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-all flex items-center gap-2"
                  >
                    {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    {selectedInvoice ? 'Register Update' : 'Create Invoice'}
                  </button>
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
              <form onSubmit={handleSubmit} id="invoice-form" className="space-y-10">
                {/* Info Grid */}
                <div className="grid grid-cols-3 gap-12">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entity & Base</h4>
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
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Customer Selection *</label>
                        <select 
                          value={formData.customerId} 
                          onChange={(e) => setFormData({...formData, customerId: e.target.value, piIds: [], lines: [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }]})} 
                          className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-bold uppercase tracking-tight bg-white" 
                          required
                        >
                          <option value="">SELECT CUSTOMER</option>
                          {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dates & Schedule</h4>
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
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Financial context</h4>
                    <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-5 border border-gray-100 rounded-sm">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Currency Selection</label>
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
                          <option value="USD">USD (Foreign)</option>
                          <option value="BDT">BDT (Local)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Exchange Rate</label>
                        <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-sm text-[11px] font-mono font-bold text-gray-600">
                           {formData.currency === 'BDT' ? 1 : (globalExchangeRate || 1)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-gray-50/50 p-6 border border-gray-100 rounded-sm">
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Linked Sales Orders (PIs)</h4>
                   <div className="flex flex-wrap gap-2">
                      {customerPIs.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic uppercase font-bold tracking-widest">No active proforma invoices found for this customer</p>
                      ) : (
                        customerPIs.map((pi: any) => (
                          <label key={pi.id} className={cn(
                            "px-4 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all",
                            formData.piIds.includes(pi.id) 
                              ? "bg-gray-900 border-gray-900 text-white shadow-sm" 
                              : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                          )}>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={formData.piIds.includes(pi.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const id = pi.id;
                                setFormData(prev => {
                                  let newLines = [...prev.lines];
                                  const piIds = checked ? [...prev.piIds, id] : prev.piIds.filter(pid => pid !== id);
                                  
                                  if (checked) {
                                    const piLines = pi.lines?.map((l: any) => ({
                                      productId: l.productId,
                                      description: l.description,
                                      quantity: l.quantity,
                                      shippedQuantity: l.quantity,
                                      unitPrice: l.unitPrice,
                                      taxRate: l.taxRate || 0,
                                      taxAmount: l.quantity * l.unitPrice * ((l.taxRate || 0) / 100),
                                      piId: id
                                    })) || [];
                                    
                                    if (newLines.length === 1 && newLines[0].productId === '') {
                                      newLines = piLines;
                                    } else {
                                      newLines = [...newLines, ...piLines];
                                    }
                                  } else {
                                    newLines = newLines.filter(line => line.piId !== id);
                                    if (newLines.length === 0) {
                                      newLines = [{ productId: '', description: '', quantity: 1, shippedQuantity: 1, unitPrice: 0, taxRate: 0, taxAmount: 0, piId: '' }];
                                    }
                                  }
                                  return { ...prev, piIds, lines: newLines };
                                });
                              }}
                            />
                            {pi.piNumber} - {pi.currency} {formatCurrency(pi.total)}
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
                       Invoice Schedule
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
                          <th className="px-4 py-3 text-center w-28">Billing Qty</th>
                          <th className="px-4 py-3 text-right w-32">Unit Price</th>
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
                                disabled={!!line.piId}
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
                                disabled={!!line.piId}
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
                                value={line.shippedQuantity} 
                                onChange={(e) => handleLineChange(index, 'shippedQuantity', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-sm text-[11px] text-center font-mono font-bold text-gray-900 focus:outline-none focus:border-gray-900 shadow-inner"
                              />
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex items-center gap-1 border border-gray-200 rounded-sm px-2 py-1 bg-white">
                                <span className="text-[9px] font-bold text-gray-400">{formData.currency === 'USD' ? '$' : '৳'}</span>
                                <input 
                                  type="number" step="any"
                                  value={line.unitPrice} 
                                  onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-right font-mono focus:outline-none"
                                  readOnly={!!line.piId}
                                />
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
                            <td className="px-4 py-4 text-right align-top pt-5">
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-gray-900">{formatCurrency((line.shippedQuantity || 0) * (line.unitPrice || 0))}</span>
                                {formData.currency !== 'BDT' && (
                                  <span className="text-[9px] text-gray-400 font-mono">৳{formatCurrency((line.shippedQuantity || 0) * (line.unitPrice || 0) * (globalExchangeRate || 1))}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center align-top pt-5">
                              {!line.piId && (
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
                   <div className="flex-1 space-y-4 max-w-xl">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Additional Information</h4>
                      <textarea 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full h-24 px-4 py-3 border border-gray-200 rounded-sm text-[11px] focus:outline-none focus:border-gray-900 placeholder:text-gray-300"
                        placeholder="ENTER INVOICE NOTES, PAYMENT TERMS OR SHIPMENT DETAILS..."
                      />
                   </div>

                   <div className="w-96 bg-gray-50/50 p-8 rounded-sm border border-gray-100 space-y-4">
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
                          <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest italic leading-none">Net Receivable</p>
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
