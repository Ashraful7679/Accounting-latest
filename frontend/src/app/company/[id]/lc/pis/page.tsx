'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Edit2, Trash2, Eye,
  Calendar, DollarSign, CheckCircle2, Building2, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
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

  const filteredPIs = Array.isArray(pisData) ? pisData.filter((pi: LCPI) => {
    const matchesSearch = !searchTerm || 
      pi.piNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pi.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) : [];

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href={`/company/${companyId}/lc`} className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-gray-400" />
              Proforma Invoices (LC)
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium tracking-tight">Manage and track PIs associated with Letters of Credit</p>
          </div>
        </div>
        <button 
          onClick={() => openModal()} 
          className="bg-gray-900 text-white px-6 py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-gray-200"
        >
          <Plus className="w-4 h-4" /> Create PI
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="FILTER BY PI NUMBER..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-[10px] font-bold uppercase tracking-widest transition-colors" 
          />
        </div>
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)} 
          className="px-4 py-2 bg-white border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-[10px] font-bold uppercase tracking-widest transition-colors"
        >
          <option value="all">ALL STATUS</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="PAID">PAID</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">PI Reference</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Instrument (LC)</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer / Client</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Valuation</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Syncing Invoices...</td></tr>
            ) : filteredPIs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">No proforma invoices found</td></tr>
            ) : (
              filteredPIs.map((pi: LCPI) => (
                <tr key={pi.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-4 text-xs font-black text-gray-900 uppercase tracking-tight">{pi.piNumber}</td>
                  <td className="px-4 py-4 text-[10px] font-bold text-gray-500 uppercase">{pi.piDate ? new Date(pi.piDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-4 text-[10px] font-black text-blue-600 uppercase tracking-tighter">{pi.lc?.lcNumber || '-'}</td>
                  <td className="px-4 py-4 text-[10px] font-bold text-gray-700 uppercase">{pi.customer?.name || '-'}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-mono text-xs font-black text-gray-900">{pi.currency} {pi.amount?.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                      pi.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      pi.status === 'ACCEPTED' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                      'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                      {pi.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openModal(pi)} 
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => deleteMutation.mutate(pi.id)} 
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-sm border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                {selectedPI ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} 
                {selectedPI ? 'Modify Proforma' : 'Initialize Proforma'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">PI Reference Number *</label>
                <input 
                  type="text" 
                  value={formData.piNumber} 
                  onChange={(e) => setFormData({...formData, piNumber: e.target.value})} 
                  placeholder="PI-XXXX-XXXX"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Valuation Amount *</label>
                  <input 
                    type="number" step="0.01" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})} 
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-black text-gray-900 font-mono transition-colors" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Currency</label>
                  <select 
                    value={formData.currency} 
                    onChange={(e) => setFormData({...formData, currency: e.target.value})} 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                  >
                    <option value="USD">USD - US DOLLAR</option>
                    <option value="EUR">EUR - EURO</option>
                    <option value="GBP">GBP - BRITISH POUND</option>
                    <option value="BDT">BDT - TAKA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Linked LC Instrument *</label>
                <select 
                  value={formData.lcId} 
                  onChange={(e) => setFormData({...formData, lcId: e.target.value})} 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors" 
                  required
                >
                  <option value="">SELECT INSTRUMENT</option>
                  {Array.isArray(lcsData) && lcsData.map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNumber}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Target Customer *</label>
                <select 
                  value={formData.customerId} 
                  onChange={(e) => setFormData({...formData, customerId: e.target.value})} 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors" 
                  required
                >
                  <option value="">SELECT CUSTOMER</option>
                  {Array.isArray(customersData) && customersData.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Memo / Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                  placeholder="ADDITIONAL NOTES..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-xs font-medium text-gray-900 transition-colors resize-none" 
                  rows={2} 
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="flex-1 px-6 py-2.5 bg-white border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-gray-50 transition-colors"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending} 
                  className="flex-1 px-6 py-2.5 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-black transition-colors shadow-lg shadow-gray-200"
                >
                  {createMutation.isPending ? 'PROCESSING...' : 'INITIALIZE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
