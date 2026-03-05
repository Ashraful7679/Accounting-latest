'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import UserDropdown from '@/components/UserDropdown';
import { 
  Briefcase, Plus, Search, Edit2, Trash2,
  Calendar, DollarSign
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName="LC Loans" />
      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <h1 className="text-xl font-bold text-slate-900">LC Loans</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown />
          </div>
        </header>
        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">LC Loans</h2>
            <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add LC Loan
            </button>
          </div>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-lg">
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Loan Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Bank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">LC</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Principal</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center">Loading...</td></tr>
                ) : filteredLoans.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center">No LC Loans found</td></tr>
                ) : (
                  filteredLoans.map((loan: LCLoan) => (
                    <tr key={loan.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{loan.loanNumber}</td>
                      <td className="px-4 py-3">{loan.bankName}</td>
                      <td className="px-4 py-3">{loan.lc?.lcNumber || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{loan.principalAmount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{loan.outstandingBalance?.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(loan.status)}`}>{loan.status}</span></td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => deleteMutation.mutate(loan.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
            <h3 className="text-xl font-semibold mb-4">Create LC Loan</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Loan Number *</label>
                  <input type="text" value={formData.loanNumber} onChange={(e) => setFormData({...formData, loanNumber: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bank Name *</label>
                  <input type="text" value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} className="input" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Principal Amount *</label>
                  <input type="number" step="0.01" value={formData.principalAmount} onChange={(e) => setFormData({...formData, principalAmount: parseFloat(e.target.value)})} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                  <input type="number" step="0.01" value={formData.interestRate} onChange={(e) => setFormData({...formData, interestRate: parseFloat(e.target.value)})} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Linked LC</label>
                <select value={formData.lcId} onChange={(e) => setFormData({...formData, lcId: e.target.value})} className="input">
                  <option value="">Select LC (Optional)</option>
                  {lcsData?.map((lc: any) => <option key={lc.id} value={lc.id}>{lc.lcNumber}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
