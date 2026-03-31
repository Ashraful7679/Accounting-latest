'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2,
  Calendar, Building2, Eye, X, Send, CheckCircle
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PI {
  id: string;
  piNumber: string;
  amount: number;
  currency: string;
  piDate: string;
  invoiceNumber?: string;
  submissionDate?: string;
  paymentDueDate?: string;
  status: string;
  vendor?: { id: string; name: string; code: string };
  lc?: { id: string; lcNumber: string };
  description?: string;
}

export default function ImportPIsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPI, setSelectedPI] = useState<PI | null>(null);
  const [formData, setFormData] = useState({
    piNumber: '',
    amount: 0,
    currency: 'USD',
    piDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    submissionDate: '',
    paymentDueDate: '',
    vendorId: '',
    lcId: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [role, setRole] = useState('User');

  const statusOrder: Record<string, number> = {
    'DRAFT': 0,
    'SUBMITTED': 1,
    'VERIFIED': 2,
    'APPROVED': 3,
    'PAID': 4,
    'CLOSED': 5
  };

  const isOwner = role === 'Owner' || role === 'Admin';

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setRole(roles[0] || 'User');
  }, [router]);

  const { data: pisData, isLoading } = useQuery({
    queryKey: ['import-pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=import`);
      return response.data.data as PI[];
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

  const { data: lcsData } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/pis`, { ...data, type: 'IMPORT' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('Import PI created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create PI');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/pis/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update PI');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      let endpoint = '';
      if (status === 'VERIFIED') endpoint = 'verify';
      else if (status === 'APPROVED') endpoint = 'approve';
      else if (status === 'REJECTED') endpoint = 'reject';
      
      if (endpoint) {
        return await api.patch(`/company/${companyId}/pis/${id}/${endpoint}`);
      }
      return await api.put(`/company/${companyId}/pis/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/pis/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete PI');
    },
  });

  const openModal = (pi?: PI) => {
    if (pi) {
      setSelectedPI(pi);
      setFormData({
        piNumber: pi.piNumber || '',
        amount: pi.amount || 0,
        currency: pi.currency || 'USD',
        piDate: pi.piDate ? pi.piDate.split('T')[0] : '',
        invoiceNumber: pi.invoiceNumber || '',
        submissionDate: pi.submissionDate ? pi.submissionDate.split('T')[0] : '',
        paymentDueDate: pi.paymentDueDate ? pi.paymentDueDate.split('T')[0] : '',
        vendorId: pi.vendor?.id || '',
        lcId: pi.lc?.id || '',
        description: pi.description || '',
      });
    } else {
      setSelectedPI(null);
      setFormData({
        piNumber: '',
        amount: 0,
        currency: 'USD',
        piDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        submissionDate: '',
        paymentDueDate: '',
        vendorId: '',
        lcId: '',
        description: '',
      });
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
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-purple-100 text-purple-800',
      PAID: 'bg-green-100 text-green-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      OVERDUE: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredPIs = pisData?.filter(pi => {
    const matchesSearch = !searchTerm || 
      pi.piNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pi.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pi.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen">



        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Import Proforma Invoices</h2>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Import PI
            </button>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by PI Number or Supplier..."
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
              <option value="SUBMITTED">Submitted</option>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">PI Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">LC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredPIs.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No Import PIs found</td></tr>
                ) : (
                  filteredPIs.map((pi) => (
                    <tr key={pi.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{pi.piNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{pi.piDate ? new Date(pi.piDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">{pi.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{pi.currency} {pi.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{pi.lc?.lcNumber || '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{pi.paymentDueDate ? new Date(pi.paymentDueDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(pi.status)}`}>{pi.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <select 
                             value={pi.status}
                             onChange={(e) => {
                               const nextStatus = e.target.value;
                               if (statusOrder[nextStatus] < statusOrder[pi.status] && !isOwner) {
                                 toast.error(`Cannot change status backward to ${nextStatus}`);
                                 return;
                               }
                               statusMutation.mutate({ id: pi.id, status: nextStatus });
                             }}
                             className="px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                           >
                              <option value="DRAFT">DRAFT</option>
                              <option value="SUBMITTED">SUBMITTED</option>
                              <option value="VERIFIED">VERIFIED</option>
                              <option value="APPROVED">APPROVED</option>
                              <option value="PAID">PAID</option>
                           </select>
                          {(pi.status === 'DRAFT' || isOwner) && (
                            <>
                              <button onClick={() => openModal(pi)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => {
                                  if (window.confirm("Are you sure?")) deleteMutation.mutate(pi.id);
                              }} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                            </>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{selectedPI ? 'Edit Import PI' : 'Create Import PI'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">PI Number *</label>
                  <input type="text" value={formData.piNumber} onChange={(e) => setFormData({...formData, piNumber: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PI Date *</label>
                  <input type="date" value={formData.piDate} onChange={(e) => setFormData({...formData, piDate: e.target.value})} className="input" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="input">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="BDT">BDT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier *</label>
                <select value={formData.vendorId} onChange={(e) => setFormData({...formData, vendorId: e.target.value})} className="input" required>
                  <option value="">Select Supplier</option>
                  {vendorsData?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Linked LC</label>
                <select value={formData.lcId} onChange={(e) => setFormData({...formData, lcId: e.target.value})} className="input">
                  <option value="">Select LC (Optional)</option>
                  {lcsData?.map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNumber} - {lc.bankName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Number</label>
                <input type="text" value={formData.invoiceNumber} onChange={(e) => setFormData({...formData, invoiceNumber: e.target.value})} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Submission Date</label>
                  <input type="date" value={formData.submissionDate} onChange={(e) => setFormData({...formData, submissionDate: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Due Date</label>
                  <input type="date" value={formData.paymentDueDate} onChange={(e) => setFormData({...formData, paymentDueDate: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input" rows={3} />
              </div>
              {/* Attachments Section */}
              {selectedPI && (
                <div className="pt-6 border-t mt-4">
                  <AttachmentManager 
                    entityType="PI" 
                    entityId={selectedPI.id} 
                    canEdit={selectedPI.status === 'DRAFT'} 
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
