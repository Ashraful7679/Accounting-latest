'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import UserDropdown from '@/components/UserDropdown';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  Calendar, DollarSign, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    customerId: '',
    currency: 'BDT',
    exchangeRate: 1,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: 0,
    subtotal: 0,
    taxAmount: 0,
    description: '',
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

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');

    if (action === 'create' && !isLoading) {
      openModal();
      // Remove query param without reload
      window.history.replaceState({}, '', `/company/${companyId}/sales/invoices`);
    }
  }, [router, action, isLoading, companyId]);

  const { data: customersData } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/invoices`, { ...data, type: 'SALES' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Sales invoice created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create invoice');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/invoices/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete invoice');
    },
  });

  const openModal = (invoice?: Invoice) => {
    if (invoice) {
      setSelectedInvoice(invoice);
      setFormData({
        invoiceNumber: invoice.invoiceNumber || '',
        customerId: invoice.customer?.id || '',
        currency: invoice.currency || 'BDT',
        exchangeRate: invoice.exchangeRate || 1,
        invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.split('T')[0] : '',
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
        amount: invoice.subtotal || 0,
        subtotal: (invoice.subtotal || 0) * (invoice.exchangeRate || 1),
        taxAmount: invoice.taxAmount || 0,
        description: invoice.description || '',
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
        amount: 0,
        subtotal: 0,
        taxAmount: 0,
        description: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedInvoice(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      lines: [
        {
          description: formData.description || 'Sales',
          quantity: 1,
          unitPrice: formData.subtotal,
          taxRate: formData.subtotal > 0 ? (formData.taxAmount / formData.subtotal) * 100 : 0
        }
      ]
    };
    createMutation.mutate(submitData);
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName="Sales Invoices" />

      <main className="lg:pl-64 min-h-screen">
        <Header 
          companyId={companyId} 
          breadcrumbs="Sales / Invoices" 
          unreadCount={0} // Can be fetched if needed, but keeping simple for now
        />

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
                placeholder="Search by Invoice Number or Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No Sales Invoices found</td></tr>
                ) : (
                  filteredInvoices.map((inv: Invoice) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">{inv.customer?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{inv.currency} {inv.total?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openModal(inv)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Create Sales Invoice</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" value={formData.invoiceNumber} />
              <div>
                <label className="block text-sm font-medium mb-1">Customer *</label>
                <select value={formData.customerId} onChange={(e) => setFormData({...formData, customerId: e.target.value})} className="input" required>
                  <option value="">Select Customer</option>
                  {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice Date *</label>
                  <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="input">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="BDT">BDT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Exchange Rate</label>
                  <input type="number" step="0.01" value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value)})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => {
                    const amt = parseFloat(e.target.value) || 0;
                    setFormData({...formData, amount: amt, subtotal: amt * formData.exchangeRate});
                  }} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subtotal (Auto-calculated)</label>
                  <input type="number" step="0.01" value={formData.subtotal} readOnly className="input bg-gray-50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tax Amount</label>
                <input type="number" step="0.01" value={formData.taxAmount} onChange={(e) => setFormData({...formData, taxAmount: parseFloat(e.target.value)})} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input" rows={2} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending ? 'Saving...' : 'Save Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
