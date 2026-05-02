'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2,
  Calendar, Building2, Eye, X, Send, CheckCircle,
  Link as LinkIcon
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { useCompany } from '@/lib/CompanyContext';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatCurrency } from '@/lib/decimalUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PI {
  id: string;
  piNumber: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  totalBDT?: number;
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
  const { exchangeRate: globalRate } = useCompany();
  
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
      const response = await api.post(`/company/${companyId}/pis`, { 
        ...data, 
        type: 'IMPORT',
        exchangeRate: globalRate,
        totalBDT: data.amount * globalRate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('Import PI registered');
      setShowModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to register PI');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/pis/${id}`, {
        ...data,
        exchangeRate: globalRate,
        totalBDT: data.amount * globalRate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI details updated');
      setShowModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update PI');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/pis/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-pis', companyId] });
      toast.success('PI deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete PI');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPI) {
      updateMutation.mutate({ id: selectedPI.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-sm flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Proforma Invoices (Import)</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Procurement & LC Tracking</p>
          </div>
        </div>
        <button 
          onClick={() => openModal()}
          className="btn btn-primary bg-gray-900 hover:bg-black flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Import PI
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex gap-4 bg-gray-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PI # or Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-sm outline-none focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">PI Number</th>
                <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 font-medium">Loading records...</td></tr>
              ) : pisData?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 font-medium">No records found</td></tr>
              ) : (
                pisData?.filter(pi => !searchTerm || pi.piNumber.toLowerCase().includes(searchTerm.toLowerCase()) || pi.vendor?.name.toLowerCase().includes(searchTerm.toLowerCase())).map((pi) => (
                  <tr key={pi.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 font-black text-gray-900">{pi.piNumber}</td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{new Date(pi.piDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-800">{pi.vendor?.name}</div>
                      <div className="text-[10px] text-gray-400 font-black">{pi.vendor?.code}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-black text-gray-900">{pi.currency} {formatCurrency(pi.amount)}</div>
                      <div className="text-[10px] text-gray-400 font-bold">{formatCurrency(pi.amount * (pi.exchangeRate || globalRate))} BDT</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-1.5 py-0.5 text-[9px] font-black rounded border",
                        pi.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600 border-gray-200"
                      )}>
                        {pi.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(pi)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('Delete this PI?')) deleteMutation.mutate(pi.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PI Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 shadow-2xl w-full max-w-2xl rounded-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  {selectedPI ? 'Edit Import PI' : 'Register Import PI'}
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Procurement Module • System Spot Rate Tracking</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-200 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">PI Number *</label>
                  <input
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-bold"
                    value={formData.piNumber}
                    onChange={(e) => setFormData({ ...formData, piNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">PI Date *</label>
                  <input
                    required type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    value={formData.piDate}
                    onChange={(e) => setFormData({ ...formData, piDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Supplier / Vendor *</label>
                <select
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-bold"
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                >
                  <option value="">Select Supplier</option>
                  {vendorsData?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">PI Total Amount *</label>
                  <div className="flex">
                    <select
                      className="px-3 bg-gray-100 border border-gray-200 border-r-0 rounded-l-sm text-xs font-black"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="BDT">BDT</option>
                    </select>
                    <input
                      required type="number" step="0.01"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-r-sm focus:border-blue-500 outline-none text-sm font-black"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Current Spot Rate</label>
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-black rounded-sm text-center">
                    {globalRate} <span className="text-[9px] opacity-60">BDT</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Submission Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    value={formData.submissionDate}
                    onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    value={formData.paymentDueDate}
                    onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-xs font-medium resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {selectedPI && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm">
                   <AttachmentManager 
                    entityType="PI" 
                    entityId={selectedPI.id} 
                    canEdit={selectedPI.status === 'DRAFT'} 
                  />
                </div>
              )}

              <div className="bg-gray-900 p-4 rounded-sm flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Estimated Value</p>
                  <p className="text-xl font-black text-white">{formatCurrency(formData.amount * globalRate)} <span className="text-xs opacity-40">BDT</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Base Amount</p>
                  <p className="text-lg font-bold text-gray-300">{formData.currency} {formatCurrency(formData.amount)}</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-600 text-sm font-bold rounded-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-8 py-2 bg-gray-900 text-white text-sm font-black rounded-sm hover:bg-black disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-gray-200"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Processing...' : (selectedPI ? 'Update PI' : 'Register PI')}
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


