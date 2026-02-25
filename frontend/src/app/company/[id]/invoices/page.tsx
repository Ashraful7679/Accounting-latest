'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, FileText, Trash2, Check, X, ArrowLeft, LogOut, Eye, Edit } from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';

interface Customer {
  id: string;
  code: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: { name: string } | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  createdBy: { firstName: string; lastName: string };
  verifiedBy: { firstName: string; lastName: string } | null;
  approvedBy: { firstName: string; lastName: string } | null;
}

interface Line {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR'];

export default function CompanyInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    currency: 'BDT',
    exchangeRate: '1',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }] as Line[],
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['company-invoices', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/invoices`);
      return response.data.data as Invoice[];
    },
    enabled: !!companyId,
  });

  const { data: customersData } = useQuery({
    queryKey: ['company-customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data as Customer[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        exchangeRate: parseFloat(data.exchangeRate),
        dueDate: data.dueDate || null,
      };
      const response = await api.post(`/company/${companyId}/invoices`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
      toast.success('Invoice created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create invoice');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await api.delete(`/company/${companyId}/invoices/${invoiceId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete invoice');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await api.post(`/company/${companyId}/invoices/${invoiceId}/verify`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
      toast.success('Invoice verified');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to verify invoice');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: string; reason: string }) => {
      const response = await api.post(`/company/${companyId}/invoices/${invoiceId}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
      toast.success('Invoice rejected');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reject invoice');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await api.post(`/company/${companyId}/invoices/${invoiceId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
      toast.success('Invoice approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve invoice');
    },
  });

  const retrieveMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await api.post(`/company/${companyId}/invoices/${invoiceId}/retrieve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invoices', companyId] });
      toast.success('Invoice retrieved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to retrieve invoice');
    },
  });

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const openModal = () => {
    setFormData({
      customerId: '',
      currency: 'BDT',
      exchangeRate: '1',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const openViewModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedInvoice(null);
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { description: '', quantity: 1, unitPrice: 0, taxRate: 0 }],
    });
  };

  const updateLine = (index: number, field: keyof Line, value: any) => {
    const lines = [...formData.lines];
    lines[index] = { ...lines[index], [field]: value };
    setFormData({ ...formData, lines });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 1) {
      const lines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines });
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxAmount = formData.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (line.taxRate / 100), 0);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
      VERIFIED: 'bg-blue-100 text-blue-800',
      PENDING_APPROVAL: 'bg-purple-100 text-purple-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const canVerify = (status: string) => status === 'PENDING_VERIFICATION';
  const canApprove = (status: string) => status === 'VERIFIED' || status === 'PENDING_APPROVAL';
  const canEdit = (status: string) => status === 'DRAFT' || status === 'REJECTED';
  const canDelete = (status: string) => status === 'DRAFT';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/company/${companyId}/dashboard`} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-600 hover:text-red-600">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">All Invoices</h2>
          <button onClick={openModal} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Invoice
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Invoice #</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Customer</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Currency</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500">Total</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoicesData?.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{invoice.customer?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{invoice.currency}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {invoice.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openViewModal(invoice)} className="p-1 text-gray-600 hover:text-gray-800" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        {canVerify(invoice.status) && (
                          <button onClick={() => verifyMutation.mutate(invoice.id)} className="p-1 text-green-600 hover:text-green-800" title="Verify">
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {canApprove(invoice.status) && (
                          <button onClick={() => approveMutation.mutate(invoice.id)} className="p-1 text-blue-600 hover:text-blue-800" title="Approve">
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'REJECTED' && (
                          <button onClick={() => retrieveMutation.mutate(invoice.id)} className="p-1 text-yellow-600 hover:text-yellow-800" title="Retrieve">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete(invoice.status) && (
                          <button onClick={() => deleteMutation.mutate(invoice.id)} className="p-1 text-red-600 hover:text-red-800" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoicesData?.length === 0 && (
              <div className="text-center py-8 text-gray-500">No invoices found</div>
            )}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Create Invoice</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Select Customer</option>
                    {customersData?.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="input"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.exchangeRate}
                    onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Invoice Lines</label>
                  <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800">
                    + Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.lines.map((line, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="text"
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        className="input flex-1"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value))}
                        className="input w-20"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value))}
                        className="input w-24"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Tax %"
                        value={line.taxRate}
                        onChange={(e) => updateLine(index, 'taxRate', parseFloat(e.target.value))}
                        className="input w-20"
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-end gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Subtotal: {calculateTotals().subtotal.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Tax: {calculateTotals().taxAmount.toFixed(2)}</p>
                    <p className="text-lg font-semibold">Total (BDT): {calculateTotals().total.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Invoice Details
              </h3>
              <button onClick={closeViewModal} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            
            <div className="grid grid-cols-3 gap-8 mb-8">
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Invoice Number</div>
                  <div className="text-lg font-bold text-slate-800">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Customer</div>
                  <div className="text-slate-700 font-medium">{selectedInvoice.customer?.name || '-'}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Transaction Status</div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusBadge(selectedInvoice.status)}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Currency & Rate</div>
                  <div className="text-slate-700">{selectedInvoice.currency} @ {selectedInvoice.exchangeRate}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Invoice Date</div>
                  <div className="text-slate-700">{new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Approval Tracking</div>
                  <div className="text-xs text-slate-500">
                    Created: {selectedInvoice.createdBy.firstName} {selectedInvoice.createdBy.lastName}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-hidden mb-8 shadow-sm">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Financial Breakdown</span>
                <span>(In BDT Equivalent)</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900 font-medium">{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax Amount</span>
                  <span className="text-slate-900 font-medium">{selectedInvoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-900 font-bold">Total Payable</span>
                  <span className="text-lg font-black text-blue-600">{selectedInvoice.total.toFixed(2)} BDT</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <AttachmentManager 
                entityType="BILL" 
                entityId={selectedInvoice.id} 
                canEdit={selectedInvoice.status === 'DRAFT' || selectedInvoice.status === 'REJECTED'} 
              />
            </div>

            <div className="flex gap-4 pt-8 mt-6 border-t border-slate-100">
              <button onClick={closeViewModal} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-black/10">
                Close Invoice View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
