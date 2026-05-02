'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Briefcase, Plus, Search, Edit2, Trash2,
  Calendar, DollarSign, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';


interface LCLoan {
  id: string;
  loanNumber: string;
  bankName: string;
  principalAmount: number;
  outstandingBalance: number;
  interestRate: number;
  startDate: string;
  endDate?: string;
  status: string;
  lc?: { id: string; lcNumber: string };
}

export default function LCLoansPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LCLoan | null>(null);
  const [formData, setFormData] = useState({
    loanNumber: '',
    bankName: '',
    principalAmount: 0,
    interestRate: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    lcId: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: loansData, isLoading } = useQuery({
    queryKey: ['lc-loans', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/loans`);
      return response.data.data as LCLoan[];
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
      const response = await api.post(`/company/${companyId}/loans`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-loans', companyId] });
      toast.success('LC Loan created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create loan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/loans/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-loans', companyId] });
      toast.success('Loan deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete loan');
    },
  });

  const openModal = (loan?: LCLoan) => {
    if (loan) {
      setSelectedLoan(loan);
      setFormData({
        loanNumber: loan.loanNumber || '',
        bankName: loan.bankName || '',
        principalAmount: loan.principalAmount || 0,
        interestRate: loan.interestRate || 0,
        startDate: loan.startDate ? loan.startDate.split('T')[0] : '',
        endDate: loan.endDate ? loan.endDate.split('T')[0] : '',
        lcId: loan.lc?.id || '',
      });
    } else {
      setSelectedLoan(null);
      setFormData({
        loanNumber: '',
        bankName: '',
        principalAmount: 0,
        interestRate: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        lcId: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLoan(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredLoans = loansData?.filter((loan: LCLoan) => {
    const matchesSearch = !searchTerm || 
      loan.loanNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.bankName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || loan.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

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
              <Briefcase className="w-6 h-6 text-gray-400" />
              Bank Financing (LIM/LTR)
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium tracking-tight">Active LC Loan Portfolio & Repayment Status</p>
          </div>
        </div>
        <button 
          onClick={() => openModal()} 
          className="bg-gray-900 text-white px-6 py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-gray-200"
        >
          <Plus className="w-4 h-4" /> Add Financing
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="FILTER BY LOAN OR BANK..." 
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
          <option value="ACTIVE">ACTIVE</option>
          <option value="PAID">PAID</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Loan Identity</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bank / Institution</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Linked LC</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Principal</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">Balance</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Syncing Portfolio...</td></tr>
            ) : filteredLoans.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">No active loans discovered</td></tr>
            ) : (
              filteredLoans.map((loan: LCLoan) => (
                <tr key={loan.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="text-xs font-black text-gray-900 uppercase tracking-tight">{loan.loanNumber}</div>
                    <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{new Date(loan.startDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-4 text-[10px] font-bold text-gray-700 uppercase">{loan.bankName}</td>
                  <td className="px-4 py-4 text-[10px] font-black text-blue-600 uppercase tracking-tighter">{loan.lc?.lcNumber || '-'}</td>
                  <td className="px-4 py-4 text-right font-mono text-xs font-black text-gray-900">{loan.principalAmount?.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-mono text-xs font-black text-rose-600">{loan.outstandingBalance?.toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${
                      loan.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      loan.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => deleteMutation.mutate(loan.id)} 
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
                <Plus className="w-3.5 h-3.5" /> Initialize Loan
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Loan Reference *</label>
                  <input 
                    type="text" 
                    value={formData.loanNumber} 
                    onChange={(e) => setFormData({...formData, loanNumber: e.target.value})} 
                    placeholder="LIM-XXXX"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Bank / Institution *</label>
                  <input 
                    type="text" 
                    value={formData.bankName} 
                    onChange={(e) => setFormData({...formData, bankName: e.target.value})} 
                    placeholder="INSTITUTION NAME"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors" 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Principal Amount *</label>
                  <input 
                    type="number" step="0.01" 
                    value={formData.principalAmount} 
                    onChange={(e) => setFormData({...formData, principalAmount: parseFloat(e.target.value)})} 
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-black text-gray-900 font-mono transition-colors" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Interest Rate (%)</label>
                  <input 
                    type="number" step="0.01" 
                    value={formData.interestRate} 
                    onChange={(e) => setFormData({...formData, interestRate: parseFloat(e.target.value)})} 
                    placeholder="0.00%"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-black text-gray-900 font-mono transition-colors" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Start Date *</label>
                  <input 
                    type="date" 
                    value={formData.startDate} 
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 font-mono transition-colors" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">End Date</label>
                  <input 
                    type="date" 
                    value={formData.endDate} 
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 font-mono transition-colors" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Linked LC Instrument</label>
                <select 
                  value={formData.lcId} 
                  onChange={(e) => setFormData({...formData, lcId: e.target.value})} 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                >
                  <option value="">SELECT INSTRUMENT (OPTIONAL)</option>
                  {lcsData?.map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNumber}</option>)}
                </select>
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


