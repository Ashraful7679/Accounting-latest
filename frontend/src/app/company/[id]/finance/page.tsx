'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import { 
  Building2, Briefcase, CreditCard, Plus, Trash2, Edit2, 
  Search, Filter, ChevronDown, CheckCircle2, AlertCircle,
  FileText, Calendar, DollarSign, ArrowLeft, ArrowUpRight,
  ShieldCheck, Globe, Landmark, Bell, Eye
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import UserDropdown from '@/components/UserDropdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LC {
  id: string;
  lcNumber: string;
  bankName: string;
  amount: number;
  currency: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  type: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  bankName: string;
  principalAmount: number;
  outstandingBalance: number;
  interestRate: number;
  startDate: string;
  endDate?: string;
  status: string;
  loanType: string;
}

export default function FinancePage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<'lcs' | 'loans'>('lcs');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // Queries
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => api.get(`/company/${companyId}`).then(res => res.data.data)
  });

  const { data: lcs, isLoading: loadingLCs } = useQuery({
    queryKey: ['company-lcs', companyId],
    queryFn: () => api.get(`/company/${companyId}/lcs`).then(res => res.data.data),
    enabled: activeTab === 'lcs'
  });

  const { data: loans, isLoading: loadingLoans } = useQuery({
    queryKey: ['company-loans', companyId],
    queryFn: () => api.get(`/company/${companyId}/loans`).then(res => res.data.data),
    enabled: activeTab === 'loans'
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = activeTab === 'lcs' ? 'lcs' : 'loans';
      if (editingItem) {
        return api.put(`/company/${endpoint}/${editingItem.id}`, data);
      }
      return api.post(`/company/${companyId}/${endpoint}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeTab === 'lcs' ? ['company-lcs'] : ['company-loans'] });
      toast.success(`${activeTab === 'lcs' ? 'LC' : 'Loan'} saved successfully`);
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Operation failed')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      const endpoint = activeTab === 'lcs' ? 'lcs' : 'loans';
      return api.delete(`/company/${endpoint}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeTab === 'lcs' ? ['company-lcs'] : ['company-loans'] });
      toast.success('Deleted successfully');
    }
  });

  const handleOpenModal = (item: any = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({
        ...item,
        issueDate: item.issueDate?.split('T')[0],
        expiryDate: item.expiryDate?.split('T')[0],
        startDate: item.startDate?.split('T')[0],
        endDate: item.endDate?.split('T')[0]
      });
    } else {
      setFormData(activeTab === 'lcs' ? {
        lcNumber: '',
        bankName: '',
        amount: 0,
        currency: 'USD',
        issueDate: new Date().toISOString().split('T')[0],
        expiryDate: '',
        type: 'IMPORT',
        status: 'OPEN'
      } : {
        loanNumber: '',
        bankName: '',
        principalAmount: 0,
        outstandingBalance: 0,
        interestRate: 0,
        startDate: new Date().toISOString().split('T')[0],
        loanType: 'TERM_LOAN',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const formatCurrency = (val: number, cur: string = 'BDT') => {
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName={company?.name || 'LC & Banking'} />

      <main className="lg:pl-64 min-h-screen">
        {/* Header Section */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4 pl-10 lg:pl-0">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors group">
              <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-blue-600" />
                Financial Instruments
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 lg:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">New {activeTab === 'lcs' ? 'LC' : 'Loan'}</span>
            </button>
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown />
          </div>
        </header>

        {/* Tabs Bar */}
        <div className="bg-white border-b border-slate-200 sticky top-[73px] z-20 px-6">
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('lcs')}
              className={cn(
                "py-4 font-bold text-sm border-b-2 transition-all",
                activeTab === 'lcs' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Letters of Credit (LC)
            </button>
            <button 
              onClick={() => setActiveTab('loans')}
              className={cn(
                "py-4 font-bold text-sm border-b-2 transition-all",
                activeTab === 'loans' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Loans & Credit Lines
            </button>
          </div>
        </div>

        <div className="p-6 max-w-[1600px] mx-auto">

        {/* Table/Card Layout */}
        <div className="grid grid-cols-1 gap-6">
          {(activeTab === 'lcs' ? (lcs || []) : (loans || [])).map((item: any) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg hover:border-blue-100 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner",
                  activeTab === 'lcs' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {activeTab === 'lcs' ? <FileText className="w-7 h-7" /> : <Landmark className="w-7 h-7" />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    {activeTab === 'lcs' ? item.lcNumber : item.loanNumber}
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black",
                      item.status === 'OPEN' || item.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {item.status}
                    </span>
                  </h3>
                  <p className="text-slate-500 text-sm font-semibold">{item.bankName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-8 flex-1 max-w-2xl">
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                    {activeTab === 'lcs' ? 'LC Amount' : 'Principal'}
                  </p>
                  <p className="font-bold text-slate-900">
                    {formatCurrency(activeTab === 'lcs' ? item.amount : item.principalAmount, activeTab === 'lcs' ? item.currency : 'BDT')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                    {activeTab === 'lcs' ? 'Expiry Date' : 'Outstanding'}
                  </p>
                  <p className={cn(
                    "font-bold",
                    activeTab === 'lcs' ? "text-amber-600" : "text-emerald-700"
                  )}>
                    {activeTab === 'lcs' ? new Date(item.expiryDate).toLocaleDateString() : formatCurrency(item.outstandingBalance)}
                  </p>
                </div>
                <div className="hidden lg:block">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                    {activeTab === 'lcs' ? 'Type' : 'Rate'}
                  </p>
                  <p className="font-bold text-slate-700">
                    {activeTab === 'lcs' ? item.type : `${item.interestRate}%`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setSelectedItem(item);
                    setShowDetailModal(true);
                  }} 
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => confirm('Delete this item?') && deleteMutation.mutate(item.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}

          {((activeTab === 'lcs' ? lcs : loans) || []).length === 0 && (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                {activeTab === 'lcs' ? <FileText className="w-8 h-8" /> : <Landmark className="w-8 h-8" />}
              </div>
              <h3 className="text-slate-900 font-black">No {activeTab === 'lcs' ? 'LCs' : 'Loans'} Found</h3>
              <p className="text-slate-500 font-medium">Get started by creating your first entry</p>
            </div>
          )}
        </div>
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden overflow-y-auto max-h-[90vh]"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-slate-900">
                    {editingItem ? `Edit ${activeTab === 'lcs' ? 'LC' : 'Loan'}` : `New ${activeTab === 'lcs' ? 'LC' : 'Loan'}`}
                  </h3>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                    <Trash2 className="w-6 h-6" /> {/* Replace with X */}
                  </button>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Bank Name</label>
                      <input 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={formData.bankName}
                        onChange={e => setFormData({...formData, bankName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                        {activeTab === 'lcs' ? 'LC Number' : 'Loan Number'}
                      </label>
                      <input 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={activeTab === 'lcs' ? formData.lcNumber : formData.loanNumber}
                        onChange={e => setFormData({...formData, [activeTab === 'lcs' ? 'lcNumber' : 'loanNumber']: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Amount</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={activeTab === 'lcs' ? formData.amount : formData.principalAmount}
                        onChange={e => setFormData({...formData, [activeTab === 'lcs' ? 'amount' : 'principalAmount']: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                        {activeTab === 'lcs' ? 'Currency' : 'Interest Rate %'}
                      </label>
                      <input 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={activeTab === 'lcs' ? formData.currency : formData.interestRate}
                        onChange={e => setFormData({...formData, [activeTab === 'lcs' ? 'currency' : 'interestRate']: e.target.value})}
                      />
                    </div>
                    {activeTab === 'lcs' && (
                      <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Conv. Rate (1 USD = X BDT)</label>
                        <input 
                          type="number"
                          step="0.01"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          value={formData.conversionRate || 1}
                          onChange={e => setFormData({...formData, conversionRate: e.target.value})}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                        {activeTab === 'lcs' ? 'Issue Date' : 'Start Date'}
                      </label>
                      <input 
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={activeTab === 'lcs' ? formData.issueDate : formData.startDate}
                        onChange={e => setFormData({...formData, [activeTab === 'lcs' ? 'issueDate' : 'startDate']: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                        {activeTab === 'lcs' ? 'Expiry Date' : 'End Date (Optional)'}
                      </label>
                      <input 
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                        value={activeTab === 'lcs' ? formData.expiryDate : formData.endDate}
                        onChange={e => setFormData({...formData, [activeTab === 'lcs' ? 'expiryDate' : 'endDate']: e.target.value})}
                      />
                    </div>
                    {activeTab === 'loans' && (
                       <div className="col-span-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Outstanding Balance</label>
                        <input 
                          type="number"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          value={formData.outstandingBalance}
                          onChange={e => setFormData({...formData, outstandingBalance: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-10">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => saveMutation.mutate(formData)}
                    disabled={saveMutation.isPending}
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  {activeTab === 'lcs' ? <FileText className="w-6 h-6" /> : <Landmark className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {activeTab === 'lcs' ? selectedItem.lcNumber : selectedItem.loanNumber}
                  </h3>
                  <p className="text-slate-500 font-bold">{selectedItem.bankName}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Limit</p>
                  <p className="text-xl font-black text-slate-900">
                    {formatCurrency(activeTab === 'lcs' ? selectedItem.amount : selectedItem.principalAmount, activeTab === 'lcs' ? selectedItem.currency : 'BDT')}
                  </p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <span className={cn(
                    "inline-block mt-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter",
                    selectedItem.status === 'OPEN' || selectedItem.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                  )}>
                    {selectedItem.status}
                  </span>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {activeTab === 'lcs' ? 'Expiry Date' : 'Interest Rate'}
                  </p>
                  <p className="text-xl font-black text-slate-900">
                    {activeTab === 'lcs' ? new Date(selectedItem.expiryDate).toLocaleDateString() : `${selectedItem.interestRate}%`}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <AttachmentManager 
                  entityType={activeTab === 'lcs' ? 'LC' : 'VOUCHER'} 
                  entityId={selectedItem.id} 
                  canEdit={true}
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-100 transition-all"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
