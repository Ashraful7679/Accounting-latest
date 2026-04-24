'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import UserDropdown from '@/components/UserDropdown';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  Calendar, DollarSign, CheckCircle2, AlertCircle
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { toast } from 'react-hot-toast';


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
}

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    vendorId: '',
    currency: 'USD',
    exchangeRate: 120,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    description: '',
    poIds: [] as string[],
    lines: [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0, poId: '', receivedQuantity: 0, taxAmount: 0 }]
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [userRole, setUserRole] = useState('User');

  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['purchase-invoices', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/invoices?type=purchase`);
      return response.data.data as Invoice[];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setUserRole(roles[0] || 'User');
    if (!token) router.push('/login');
  }, [router]);

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
      window.history.replaceState({}, '', `/company/${companyId}/purchase/invoices`);
    }
  }, [editId, isLoading, mounted, companyId, invoicesData]);

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendors`);
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

  const { data: posData } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase/orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const vendorPOs = posData?.filter((po: any) => po.vendorId === formData.vendorId && (po.status === 'SENT' || po.status === 'PARTIAL' || po.status === 'APPROVED')) || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/invoices`, { ...data, type: 'PURCHASE' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Purchase invoice created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create invoice');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/company/${companyId}/invoices/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Invoice submitted');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to submit invoice'),
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/company/${companyId}/invoices/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Invoice verified');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to verify invoice'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/company/${companyId}/invoices/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Invoice approved');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to approve invoice'),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => api.post(`/company/${companyId}/invoices/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Invoice rejected');
      closeModal();
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed to reject invoice'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/invoices/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete invoice');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/invoices/${id}`, { ...data, type: 'PURCHASE' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      toast.success('Purchase invoice updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update invoice');
    },
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
        poIds: invoice.poIds || [],
        lines: invoice.lines?.length ? invoice.lines.map((l: any) => ({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          receivedQuantity: l.quantity, // Pre-fill with original quantity for invoices
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          poId: l.poId || '',
          taxAmount: (l.quantity * l.unitPrice) * (l.taxRate / 100)
        })) : [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, poId: '', taxAmount: 0 }]
      });
    } else {
      setSelectedInvoice(null);
      setFormData({
        invoiceNumber: '',
        vendorId: '',
        currency: 'USD',
        exchangeRate: 120,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        description: '',
        poIds: [],
        lines: [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, poId: '', taxAmount: 0 }]
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
    
    // Auto-fill price if product changes
    if (field === 'productId' && value) {
      const product = productsData?.find((p: any) => p.id === value);
      if (product) {
        // Convert BDT price to selected currency
        line.unitPrice = Number((product.unitPrice / exchangeRate).toFixed(2));
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
      lines: [...formData.lines, { productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, poId: '', taxAmount: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const calculateSubtotal = () => {
    return formData.lines.reduce((sum, line) => sum + (line.receivedQuantity * line.unitPrice), 0);
  };

  const calculateTax = () => {
    return formData.lines.reduce((sum, line) => sum + ((line.receivedQuantity * line.unitPrice) * (line.taxRate / 100)), 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const tax = calculateTax();
    return (sub + tax) * (formData.exchangeRate || 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInvoice) {
      updateMutation.mutate({ id: selectedInvoice.id, data: formData });
    } else {
      const { invoiceNumber, ...rest } = formData;
      createMutation.mutate(rest);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
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
      inv.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen">
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Invoices</h2>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Purchase Invoice
            </button>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Invoice Number or Supplier..."
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
              <option value="PENDING_VERIFICATION">Pending Verification</option>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Foreign Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Total (৳)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No Purchase Invoices found</td></tr>
                ) : (
                  filteredInvoices.map((inv: Invoice) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">{inv.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {inv.currency !== 'BDT' ? `${inv.currency} ${inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ৳{(inv.totalBDT || (inv.total * (inv.exchangeRate || 1)))?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(inv.status === 'DRAFT' || inv.status === 'REJECTED') && (
                          <>
                            <button onClick={() => openModal(inv)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        <button onClick={() => openModal(inv)} className="p-1 text-slate-600 hover:bg-slate-50 rounded ml-1" title="View"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6">{selectedInvoice ? 'Edit Purchase Invoice' : 'Create Purchase Invoice'}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Invoice Number</label>
                    <input 
                      type="text" 
                      value={selectedInvoice ? formData.invoiceNumber : '[Auto-Generated]'} 
                      className="w-full px-4 py-2 border rounded-lg bg-slate-50 font-bold text-slate-500" 
                      readOnly 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Supplier *</label>
                    <select value={formData.vendorId} onChange={(e) => setFormData({...formData, vendorId: e.target.value})} className="w-full px-4 py-2 border rounded-lg" required>
                      <option value="">Select Supplier</option>
                      {vendorsData?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Invoice Date *</label>
                    <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="w-full px-4 py-2 border rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Due Date</label>
                    <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                </div>
              </div>

              {formData.vendorId && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2">Link Purchase Orders</label>
                  <div className="flex flex-wrap gap-2">
                    {vendorPOs.length === 0 ? (
                      <span className="text-sm text-blue-600">No active POs for this supplier.</span>
                    ) : (
                      vendorPOs.map((po: any) => (
                        <label key={po.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors">
                          <input 
                            type="checkbox" 
                            className="rounded text-blue-600 focus:ring-blue-500"
                            checked={formData.poIds.includes(po.id)}
                            onChange={(e) => {
                              const newPoIds = e.target.checked 
                                ? [...formData.poIds, po.id] 
                                : formData.poIds.filter(id => id !== po.id);
                              setFormData({...formData, poIds: newPoIds});
                              
                              // Auto-import lines if checked
                              if (e.target.checked) {
                                const poLines = po.lines.map((l: any) => ({
                                  productId: l.productId,
                                  description: l.description || '',
                                  quantity: l.quantity,
                                  unitPrice: l.unitPrice,
                                  taxRate: l.taxRate || 0,
                                  poId: po.id,
                                  receivedQuantity: l.quantity, // Default to receiving all
                                  taxAmount: (l.quantity * l.unitPrice) * ((l.taxRate || 0) / 100)
                                }));
                                setFormData(prev => ({
                                  ...prev, 
                                  poIds: newPoIds,
                                  lines: prev.lines[0].productId === '' && prev.lines.length === 1 ? poLines : [...prev.lines, ...poLines]
                                }));
                              }
                            }}
                          />
                          <span className="text-sm font-medium text-blue-900">{po.poNumber}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Currency</label>
                    <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="w-full px-4 py-2 border rounded-lg bg-white">
                      <option value="USD">USD</option>
                      <option value="BDT">BDT</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Exchange Rate</label>
                    <input type="number" step="0.01" value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})} className="w-full px-4 py-2 border rounded-lg bg-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Overall Description</label>
                    <input type="text" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="e.g. Purchase for Feb" className="w-full px-4 py-2 border rounded-lg bg-white" />
                  </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Line Items</h4>
                  <button type="button" onClick={addLine} className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline">
                    <Plus className="w-4 h-4" /> Add Line
                  </button>
                </div>

                <div className="space-y-6">
                  {Object.entries(
                    formData.lines.reduce((acc: any, line: any, index: number) => {
                      const group = line.poId ? (posData?.find((po:any)=>po.id === line.poId)?.poNumber || 'PO Not Found') : 'Direct Items';
                      if (!acc[group]) acc[group] = [];
                      acc[group].push({ ...line, originalIndex: index });
                      return acc;
                    }, {})
                  ).map(([groupName, lines]: [string, any]) => (
                    <div key={groupName} className="space-y-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                        <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">{groupName}</h5>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-white text-slate-500 text-[10px] uppercase font-bold border-b">
                            <tr>
                              <th className="px-4 py-2">Product & Description</th>
                              <th className="px-2 py-2">Ordered</th>
                              <th className="px-2 py-2 bg-blue-50/50">Received</th>
                              <th className="px-2 py-2 text-slate-400">Remaining</th>
                              <th className="px-2 py-2">Unit Price</th>
                              <th className="px-2 py-2">Tax %</th>
                              <th className="px-2 py-2">Tax Amt</th>
                              <th className="px-4 py-2 text-right">Line Total</th>
                              <th className="px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lines.map((line: any) => {
                              const idx = line.originalIndex;
                              const remaining = line.quantity - line.receivedQuantity;
                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-4 py-2 w-64">
                                    <select 
                                      value={line.productId} 
                                      onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs font-medium border rounded-lg bg-white mb-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                      <option value="">Custom Item</option>
                                      {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <input 
                                      type="text" placeholder="Description"
                                      value={line.description} 
                                      onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                                      className="w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-2 align-top pt-3">
                                    <input type="number" step="any" value={line.quantity} onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1.5 text-xs border rounded-lg font-mono text-center bg-slate-50 text-slate-500" readOnly={!!line.poId} />
                                  </td>
                                  <td className="px-2 py-2 align-top pt-3 bg-blue-50/20">
                                    <input type="number" step="any" value={line.receivedQuantity} onChange={(e) => handleLineChange(idx, 'receivedQuantity', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1.5 text-xs border-blue-200 border rounded-lg font-mono text-center font-bold text-blue-700 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                  </td>
                                  <td className="px-2 py-2 align-top pt-4 text-center">
                                    <span className={`font-mono text-xs font-bold ${remaining < 0 ? 'text-red-500' : remaining === 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                      {remaining}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 align-top pt-3">
                                    <input type="number" step="any" value={line.unitPrice} onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1.5 text-xs border rounded-lg font-mono text-right focus:ring-2 focus:ring-blue-500 outline-none" />
                                  </td>
                                  <td className="px-2 py-2 align-top pt-3">
                                    <input type="number" step="any" value={line.taxRate} onChange={(e) => {
                                      const taxRate = parseFloat(e.target.value) || 0;
                                      const taxAmount = (line.receivedQuantity * line.unitPrice) * (taxRate / 100);
                                      handleLineChange(idx, 'taxRate', taxRate);
                                      handleLineChange(idx, 'taxAmount', taxAmount);
                                    }} className="w-16 px-2 py-1.5 text-xs border rounded-lg font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                                  </td>
                                  <td className="px-2 py-2 align-top pt-4 font-mono text-slate-500 text-xs text-right">
                                    {((line.receivedQuantity || 0) * (line.unitPrice || 0) * ((line.taxRate || 0) / 100)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </td>
                                  <td className="px-4 py-2 align-top pt-4 text-right">
                                    <div className="font-black text-slate-900 tabular-nums">
                                      {((line.receivedQuantity || 0) * (line.unitPrice || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 align-top pt-3 text-right">
                                    <button type="button" onClick={() => removeLine(idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end pt-4 border-t">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formData.currency} {calculateSubtotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax:</span>
                    <span className="font-mono">{formData.currency} {calculateTax().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-blue-600 pt-2 border-t">
                    <span>Total (BDT):</span>
                    <span>৳{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              {selectedInvoice && (
                <div className="pt-6 border-t">
                  <AttachmentManager 
                    entityType="INVOICE" 
                    entityId={selectedInvoice.id} 
                    canEdit={selectedInvoice.status === 'DRAFT'} 
                  />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                {(selectedInvoice ? (selectedInvoice.status === 'DRAFT' || selectedInvoice.status === 'REJECTED') : true) && (
                  <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50">
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : selectedInvoice ? 'Update Invoice' : 'Save Invoice'}
                  </button>
                )}
              </div>

              {/* Status Actions */}
              {selectedInvoice && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-bold text-sm text-slate-700 mb-3">Workflow Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInvoice.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => submitMutation.mutate(selectedInvoice.id)}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                      >
                        Submit for Verification
                      </button>
                    )}
                    {selectedInvoice.status === 'PENDING_VERIFICATION' && ['Manager', 'Owner', 'Admin'].includes(userRole || '') && (
                      <>
                        <button
                          type="button"
                          onClick={() => verifyMutation.mutate(selectedInvoice.id)}
                          className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt('Provide rejection reason:') ?? '';
                            if (reason) rejectMutation.mutate({ id: selectedInvoice.id, reason });
                          }}
                          className="px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(['VERIFIED', 'PENDING_APPROVAL'].includes(selectedInvoice.status)) && ['Owner', 'Admin', 'Manager'].includes(userRole || '') && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate(selectedInvoice.id)}
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt('Provide rejection reason:') ?? '';
                            if (reason) rejectMutation.mutate({ id: selectedInvoice.id, reason });
                          }}
                          className="px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


