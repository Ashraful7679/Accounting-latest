'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  Calendar, DollarSign, CheckCircle2, Building2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LCPI {
  id: string;
  piNumber: string;
  amount: number;
  currency: string;
  piDate: string;
  status: string;
  lc?: { id: string; lcNumber: string };
  customer?: { id: string; name: string };
  description?: string;
}

export default function LCPIsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPI, setSelectedPI] = useState<LCPI | null>(null);
  const [formData, setFormData] = useState({
    piNumber: '',
    amount: 0,
    currency: 'USD',
    piDate: new Date().toISOString().split('T')[0],
    lcId: '',
    customerId: '',
    description: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: pisData, isLoading } = useQuery({
    queryKey: ['lc-pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=lc`);
      return response.data.data as LCPI[];
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
      const response = await api.post(`/company/${companyId}/pis`, { ...data, type: 'LC' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-pis', companyId] });
      toast.success('LC PI created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create PI');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/pis/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-pis', companyId] });
      toast.success('PI deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete PI');
    },
  });

  const openModal = (pi?: LCPI) => {
    if (pi) {
      setSelectedPI(pi);
      setFormData({
        piNumber: pi.piNumber || '',
        amount: pi.amount || 0,
        currency: pi.currency || 'USD',
        piDate: pi.piDate ? pi.piDate.split('T')[0] : '',
        lcId: pi.lc?.id || '',
        customerId: pi.customer?.id || '',
        description: pi.description || '',
      });
    } else {
      setSelectedPI(null);
      setFormData({
        piNumber: '',
        amount: 0,
        currency: 'USD',
        piDate: new Date().toISOString().split('T')[0],
        lcId: '',
        customerId: '',
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
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SUBMITTED: 'bg-blue-100 text-blue-800',
      ACCEPTED: 'bg-purple-100 text-purple-800',
      PAID: 'bg-green-100 text-green-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredPIs = pisData?.filter((pi: LCPI) => {
    const matchesSearch = !searchTerm || 
      pi.piNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pi.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen">



        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">LC PIs</h2>
            <button
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add LC PI
            </button>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by PI Number..."
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
              <option value="ACCEPTED">Accepted</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">PI Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">LC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredPIs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No LC PIs found</td></tr>
                ) : (
                  filteredPIs.map((pi: LCPI) => (
                    <tr key={pi.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{pi.piNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{pi.piDate ? new Date(pi.piDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">{pi.lc?.lcNumber || '-'}</td>
                      <td className="px-4 py-3">{pi.customer?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{pi.currency} {pi.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(pi.status)}`}>{pi.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openModal(pi)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteMutation.mutate(pi.id)} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
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
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-4">{selectedPI ? 'Edit LC PI' : 'Create LC PI'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">PI Number *</label>
                <input type="text" value={formData.piNumber} onChange={(e) => setFormData({...formData, piNumber: e.target.value})} className="input" required />
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
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">LC *</label>
                <select value={formData.lcId} onChange={(e) => setFormData({...formData, lcId: e.target.value})} className="input" required>
                  <option value="">Select LC</option>
                  {lcsData?.map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Customer *</label>
                <select value={formData.customerId} onChange={(e) => setFormData({...formData, customerId: e.target.value})} className="input" required>
                  <option value="">Select Customer</option>
                  {customersData?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input" rows={2} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
