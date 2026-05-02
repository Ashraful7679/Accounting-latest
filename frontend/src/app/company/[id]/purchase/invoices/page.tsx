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
import { useCompany } from '@/lib/CompanyContext';
import { cn } from '@/lib/utils';


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
  const { exchangeRate: globalExchangeRate } = useCompany();
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
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const vendorPOs = posData?.filter((po: any) => po.supplierId === formData.vendorId && (po.status === 'SENT' || po.status === 'PARTIAL' || po.status === 'APPROVED')) || [];

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
        exchangeRate: globalExchangeRate || 1,
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

  // Removed fetchSpotRate as it's now global

  // Handle vendor change: auto-set currency, fetch spot rate, auto-load SENT POs
  const handleVendorChange = async (vendorId: string) => {
    if (!vendorId) {
      setFormData(prev => ({ ...prev, vendorId: '', currency: 'USD', exchangeRate: 110, poIds: [], lines: [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, poId: '', taxAmount: 0 }] }));
      return;
    }
    const vendor = vendorsData?.find((v: any) => v.id === vendorId);
    const currency = vendor?.preferredCurrency || 'USD';
    
    // Use global spot rate
    const rate = globalExchangeRate || 1;
    
    // Auto-load all SENT/APPROVED POs for this vendor
    const sentPOs = posData?.filter((po: any) => po.supplierId === vendorId && (po.status === 'SENT' || po.status === 'PARTIAL' || po.status === 'APPROVED')) || [];
    const autoPoIds = sentPOs.map((po: any) => po.id);
    let autoLines: any[] = [];
    sentPOs.forEach((po: any) => {
      (po.lines || []).forEach((l: any) => {
        autoLines.push({
          productId: l.productId || '',
          description: l.description || '',
          quantity: l.quantity,
          receivedQuantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate || 0,
          poId: po.id,
          taxAmount: (l.quantity * l.unitPrice) * ((l.taxRate || 0) / 100)
        });
      });
    });
    if (autoLines.length === 0) {
      autoLines = [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, poId: '', taxAmount: 0 }];
    }
    setFormData(prev => ({ ...prev, vendorId, currency, exchangeRate: rate, poIds: autoPoIds, lines: autoLines }));
  };

  // Handle currency change
  const handleCurrencyChange = async (currency: string) => {
    setFormData(prev => ({ ...prev, currency, exchangeRate: currency === 'BDT' ? 1 : (globalExchangeRate || 1) }));
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
    return (sub + tax) * (formData.exchangeRate || globalExchangeRate || 1);
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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-gray-600" />
            Purchase Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendor billing and settlements</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-gray-900 transition-colors bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-gray-900 bg-white"
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

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Invoice #</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Supplier</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Foreign Amount</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Total (BDT)</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Due Date</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Loading invoices...</td></tr>
            ) : filteredInvoices.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No purchase invoices found</td></tr>
            ) : (
              filteredInvoices.map((inv: Invoice) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.vendor?.name || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">
                    {inv.currency !== 'BDT' ? `${inv.currency} ${inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                    ৳{(inv.totalBDT || (inv.total * (inv.exchangeRate || 1)))?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                      inv.status === 'APPROVED' || inv.status === 'PAID' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      inv.status === 'DRAFT' ? "bg-gray-50 text-gray-600 border-gray-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {(inv.status === 'DRAFT' || inv.status === 'REJECTED') && (
                        <>
                          <button onClick={() => openModal(inv)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteMutation.mutate(inv.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => openModal(inv)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {selectedInvoice ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={closeModal} 
                  className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-sm transition-colors"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <form onSubmit={handleSubmit} id="purchase-invoice-form">
                <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Base Information</h4>
                    <div className="space-y-4 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Invoice Number</label>
                        <input 
                          type="text" 
                          value={selectedInvoice ? formData.invoiceNumber : '[Auto-Generated]'} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white font-medium text-gray-400" 
                          disabled 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Supplier *</label>
                        <select 
                          value={formData.vendorId} 
                          onChange={(e) => handleVendorChange(e.target.value)} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white" 
                          required
                        >
                          <option value="">Select Supplier</option>
                          {vendorsData?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dates & Timeline</h4>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Invoice Date *</label>
                        <input type="date" value={formData.invoiceDate} onChange={(e) => setFormData({...formData, invoiceDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white" required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Due Date</label>
                        <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Financial Context</h4>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-sm">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Currency</label>
                        <select 
                          value={formData.currency} 
                          onChange={(e) => handleCurrencyChange(e.target.value)} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-sm bg-white text-sm focus:outline-none focus:border-gray-900"
                        >
                          {['USD','EUR','GBP','CNY','INR','SGD','JPY','AED','BDT'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Exchange Rate</label>
                        <div className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm text-gray-900 font-medium">
                          {formData.exchangeRate || globalExchangeRate || 1}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Line Items</h4>
                    <button type="button" onClick={addLine} className="text-xs font-bold text-gray-900 hover:underline flex items-center gap-1 uppercase">
                      <Plus className="w-3 h-3" /> Add Item
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
                      <div key={groupName} className="border border-gray-200 rounded-sm overflow-hidden bg-white">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                          <h5 className="font-bold text-gray-700 text-[10px] uppercase tracking-wider">{groupName}</h5>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50/50 text-gray-500 uppercase font-bold border-b border-gray-100">
                              <tr>
                                <th className="px-4 py-2">Product & Description</th>
                                <th className="px-2 py-2 text-center">Ordered</th>
                                <th className="px-2 py-2 text-center">Received</th>
                                <th className="px-2 py-2 text-center">Unit Price</th>
                                <th className="px-2 py-2 text-center">Tax %</th>
                                <th className="px-4 py-2 text-right">Line Total</th>
                                <th className="px-2 py-2 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {lines.map((line: any) => {
                                const idx = line.originalIndex;
                                return (
                                  <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 min-w-[300px]">
                                      <select 
                                        value={line.productId} 
                                        onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-sm bg-white mb-1.5 focus:outline-none focus:border-gray-900"
                                      >
                                        <option value="">Custom Item</option>
                                        {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>
                                      <input 
                                        type="text" placeholder="Description"
                                        value={line.description} 
                                        onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-gray-900 bg-white"
                                      />
                                    </td>
                                    <td className="px-2 py-3 text-center align-top">
                                      <input type="number" step="any" value={line.quantity} onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1.5 border border-gray-200 rounded-sm font-mono text-center bg-gray-50 text-gray-400" disabled={!!line.poId} />
                                    </td>
                                    <td className="px-2 py-3 text-center align-top">
                                      <input type="number" step="any" value={line.receivedQuantity} onChange={(e) => handleLineChange(idx, 'receivedQuantity', parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1.5 border border-gray-300 rounded-sm font-mono text-center font-bold focus:outline-none focus:border-gray-900 bg-white" />
                                    </td>
                                    <td className="px-2 py-3 text-center align-top">
                                      <input type="number" step="any" value={line.unitPrice} onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-24 px-2 py-1.5 border border-gray-300 rounded-sm font-mono text-right focus:outline-none focus:border-gray-900 bg-white" />
                                    </td>
                                    <td className="px-2 py-3 text-center align-top">
                                      <input type="number" step="any" value={line.taxRate} onChange={(e) => handleLineChange(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-16 px-2 py-1.5 border border-gray-300 rounded-sm font-mono text-center focus:outline-none focus:border-gray-900 bg-white" />
                                    </td>
                                    <td className="px-4 py-3 text-right align-top font-mono font-medium text-gray-900 pt-5">
                                      {((line.receivedQuantity || 0) * (line.unitPrice || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="px-2 py-3 text-right align-top pt-4">
                                      <button type="button" onClick={() => removeLine(idx)} className="p-1 text-gray-400 hover:text-red-600 rounded-sm transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
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

                <div className="mt-8 flex justify-between gap-8 border-t border-gray-200 pt-8">
                  <div className="flex-1 max-w-md space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Linked Purchase Orders</h4>
                    <div className="flex flex-wrap gap-2">
                      {vendorPOs.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">No available purchase orders found for this supplier.</span>
                      ) : (
                        vendorPOs.map((po: any) => (
                          <label key={po.id} className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-sm border cursor-pointer transition-colors text-xs font-medium",
                            formData.poIds.includes(po.id) 
                              ? 'bg-gray-900 border-gray-900 text-white' 
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          )}>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={formData.poIds.includes(po.id)}
                              onChange={(e) => {
                                const newPoIds = e.target.checked 
                                  ? [...formData.poIds, po.id] 
                                  : formData.poIds.filter(id => id !== po.id);
                                
                                if (e.target.checked) {
                                  const poLines = po.lines.map((l: any) => ({
                                    productId: l.productId,
                                    description: l.description || '',
                                    quantity: l.quantity,
                                    unitPrice: l.unitPrice,
                                    taxRate: l.taxRate || 0,
                                    poId: po.id,
                                    receivedQuantity: l.quantity,
                                    taxAmount: (l.quantity * l.unitPrice) * ((l.taxRate || 0) / 100)
                                  }));
                                  setFormData(prev => ({
                                    ...prev, 
                                    poIds: newPoIds,
                                    lines: prev.lines[0].productId === '' && prev.lines.length === 1 ? poLines : [...prev.lines.filter(ln => ln.poId !== po.id), ...poLines]
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    poIds: newPoIds,
                                    lines: prev.lines.filter(ln => ln.poId !== po.id).length > 0
                                      ? prev.lines.filter(ln => ln.poId !== po.id)
                                      : [{ productId: '', description: '', quantity: 1, receivedQuantity: 1, unitPrice: 0, taxRate: 0, poId: '', taxAmount: 0 }]
                                  }));
                                }
                              }}
                            />
                            {po.poNumber}
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="w-80 bg-gray-50 p-6 rounded-sm border border-gray-200 space-y-4">
                    <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>Subtotal ({formData.currency})</span>
                      <span className="font-mono">{calculateSubtotal().toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 font-medium">
                      <span>Tax ({formData.currency})</span>
                      <span className="font-mono">{calculateTax().toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between items-end border-t border-gray-200 pt-4">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Value</div>
                      <div className="text-xl font-bold text-gray-900 font-mono">
                        ৳{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              {selectedInvoice && (
                <div className="pt-8 border-t border-gray-200">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Attachments</h4>
                  <AttachmentManager 
                    entityType="INVOICE" 
                    entityId={selectedInvoice.id} 
                    canEdit={selectedInvoice.status === 'DRAFT'} 
                  />
                </div>
              )}

              {selectedInvoice && (
                <div className="pt-8 border-t border-gray-200">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Workflow Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInvoice.status === 'DRAFT' && (
                      <button
                        onClick={() => submitMutation.mutate(selectedInvoice.id)}
                        className="px-4 py-2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-gray-800 transition-colors"
                      >
                        Submit for Verification
                      </button>
                    )}
                    {selectedInvoice.status === 'PENDING_VERIFICATION' && ['Manager', 'Owner', 'Admin'].includes(userRole || '') && (
                      <>
                        <button
                          onClick={() => verifyMutation.mutate(selectedInvoice.id)}
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
        </div>
      )}
    </div>
  );
}


