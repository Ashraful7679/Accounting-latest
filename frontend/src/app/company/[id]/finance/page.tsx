'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Briefcase, CreditCard, Plus, Trash2, Edit2, 
  Search, Filter, ChevronDown, CheckCircle2, AlertCircle,
  FileText, Calendar, DollarSign, ArrowLeft, ArrowUpRight,
  ShieldCheck, Globe, Landmark, Bell, Eye
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import { handleError } from '@/lib/error-handler';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  customer?: { name: string; code: string };
  loanType: string;
  loanValue: number;
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
  
  const [activeTab, setActiveTab] = useState<'lcs' | 'loans' | 'pis'>('lcs');

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingPI, setEditingPI] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});


  
  const [showPIModal, setShowPIModal] = useState(false);
  const [piFormData, setPIFormData] = useState({ 
    piNumber: '', 
    amount: 0, 
    piDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    submissionToBuyerDate: '',
    submissionToBankDate: '',
    bankAcceptanceDate: '',
    maturityDate: '',
    purchaseApplicationDate: '',
    purchaseAmount: 0,
    idbpNumber: '',
    customerId: '',
    currency: 'USD'
  });


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // Queries
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => api.get(`/company/${companyId}`).then(res => res.data.data)
  });

  const { data: customers } = useQuery({
    queryKey: ['company-customers', companyId],
    queryFn: () => api.get(`/company/${companyId}/customers`).then(res => res.data.data)
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

  const { data: allPis, isLoading: loadingAllPis } = useQuery({
    queryKey: ['company-pis', companyId],
    queryFn: () => api.get(`/company/${companyId}/all-pis`).then(res => res.data.data),
    enabled: activeTab === 'pis' || (showModal && activeTab === 'lcs' && !editingItem)
  });



  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = activeTab === 'lcs' ? 'lcs' : 'loans';
      // Strip UI-only fields that don't exist in Prisma schema.
      // piIds is handled separately on the backend for new LC creation.
      const { piIds, ...cleanData } = data;
      if (editingItem) {
        return api.put(`/company/${endpoint}/${editingItem.id}`, cleanData);
      }
      // For new LCs, include piIds in the body (backend extracts and handles it)
      return api.post(`/company/${companyId}/${endpoint}`, activeTab === 'lcs' ? { ...cleanData, piIds } : cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeTab === 'lcs' ? ['company-lcs'] : ['company-loans'] });
      toast.success(`${activeTab === 'lcs' ? 'LC' : 'Loan'} saved successfully`);
      setShowModal(false);
    },
    onError: (err: any) => handleError(err, 'Operation failed')
  });


  const savePIMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingPI) {
        return api.put(`/company/pis/${editingPI.id}`, data);
      }
      return api.post(`/company/${companyId}/pis`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-pis'] });
      toast.success(editingPI ? 'PI updated successfully' : 'PI saved successfully');
      setShowPIModal(false);
      setEditingPI(null);
      setPIFormData({ 
        piNumber: '', 
        amount: 0, 
        piDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        submissionToBuyerDate: '',
        submissionToBankDate: '',
        bankAcceptanceDate: '',
        maturityDate: '',
        purchaseApplicationDate: '',
        purchaseAmount: 0,
        idbpNumber: '',
        customerId: '',
        currency: 'USD'
      });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save PI')
  });

  const handleEditPI = (pi: any) => {
    setEditingPI(pi);
    setPIFormData({
      piNumber: pi.piNumber || '',
      amount: pi.amount || 0,
      piDate: pi.piDate ? new Date(pi.piDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      invoiceNumber: pi.invoiceNumber || '',
      submissionToBuyerDate: pi.submissionToBuyerDate ? new Date(pi.submissionToBuyerDate).toISOString().split('T')[0] : '',
      submissionToBankDate: pi.submissionToBankDate ? new Date(pi.submissionToBankDate).toISOString().split('T')[0] : '',
      bankAcceptanceDate: pi.bankAcceptanceDate ? new Date(pi.bankAcceptanceDate).toISOString().split('T')[0] : '',
      maturityDate: pi.maturityDate ? new Date(pi.maturityDate).toISOString().split('T')[0] : '',
      purchaseApplicationDate: pi.purchaseApplicationDate ? new Date(pi.purchaseApplicationDate).toISOString().split('T')[0] : '',
      purchaseAmount: pi.purchaseAmount || 0,
      idbpNumber: pi.idbpNumber || '',
      customerId: pi.customerId || pi.lc?.customerId || '',
      currency: pi.currency || 'USD'
    });
    setShowPIModal(true);
  };


  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      const endpoint = activeTab === 'lcs' ? 'lcs' : activeTab === 'loans' ? 'loans' : 'pis';
      return api.delete(`/company/${endpoint}/${id}`);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: activeTab === 'lcs' ? ['company-lcs'] : activeTab === 'loans' ? ['company-loans'] : ['company-pis'] 
      });
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
        status: 'OPEN',
        loanType: 'NONE',
        loanValue: 0,
        customerId: '',
        piIds: []
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
    <div className="min-h-screen">

        {/* Header Section */}


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
            <button 
              onClick={() => setActiveTab('pis')}
              className={cn(
                "py-4 font-bold text-sm border-b-2 transition-all",
                activeTab === 'pis' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Export Documents (PI/INV)
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
                  <p className="text-slate-500 text-sm font-semibold">

                    {item.bankName} {item.customer && <span className="text-slate-400 ml-1">| {item.customer.name}</span>}
                  </p>
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
                  onClick={() => router.push(`/company/${companyId}/finance/lc/${item.id}`)} 
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

          {activeTab === 'pis' && (allPis || []).map((pi: any) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={pi.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col hover:shadow-lg transition-all group gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-black text-slate-900">{pi.piNumber} {pi.invoiceNumber && <span className="text-slate-400 text-sm">/ {pi.invoiceNumber}</span>}</h3>
                      <p className="text-xs font-bold text-slate-500">
                        {pi.lc?.lcNumber || 'Standalone PI'} • {pi.customer?.name || pi.lc?.customer?.name || 'No Buyer'}
                      </p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="font-black text-slate-900">{formatCurrency(pi.amount, pi.currency)}</p>
                   <span className={cn(
                      "text-[10px] uppercase font-black px-2 py-0.5 rounded-full",
                      pi.status === 'PAID' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                   )}>
                      {pi.status}
                   </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-50">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submission</p>
                    <p className="text-xs font-bold text-slate-700">{pi.submissionToBankDate ? new Date(pi.submissionToBankDate).toLocaleDateString() : '-'}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Accept.</p>
                    <p className="text-xs font-bold text-slate-700">{pi.bankAcceptanceDate ? new Date(pi.bankAcceptanceDate).toLocaleDateString() : '-'}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maturity</p>
                    <p className="text-xs font-black text-rose-500">{pi.maturityDate ? new Date(pi.maturityDate).toLocaleDateString() : '-'}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IDBP No</p>
                    <p className="text-xs font-bold text-slate-700">{pi.idbpNumber || '-'}</p>
                 </div>
                 <div className="col-span-2 flex justify-end gap-2 items-center">
                    <button 
                      onClick={() => handleEditPI(pi)}
                      className="text-xs font-black text-slate-500 hover:text-blue-600 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg transition-colors border border-slate-100"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit PI
                    </button>
                    {pi.lcId ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/company/${companyId}/finance/lc/${pi.lcId}`);
                        }}
                        className="text-xs font-black text-blue-600 hover:underline px-2"
                      >
                        View LC
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 italic uppercase bg-slate-50 px-2 py-1 rounded-lg">Standalone PI</span>
                    )}

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this PI?')) {
                          deleteMutation.mutate(pi.id);
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-2"
                      title="Delete PI"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                 </div>
              </div>
            </motion.div>
          ))}

          {((activeTab === 'lcs' ? lcs : activeTab === 'loans' ? loans : allPis) || []).length === 0 && (

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
                    {activeTab === 'lcs' && (
                      <div className="col-span-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Buyer / Customer</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          value={formData.customerId}
                          onChange={e => {
                            setFormData({
                              ...formData, 
                              customerId: e.target.value,
                              piIds: [] // Reset PI selection when customer changes
                            });
                          }}
                        >
                          <option value="">Select Buyer</option>
                          {customers?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                      </div>
                    )}

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

                    {activeTab === 'lcs' && !editingItem && (
                      <div className="col-span-2 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                        <label className="block text-xs font-black text-blue-600 uppercase tracking-widest mb-3">Link Existing Standalone PIs</label>
                        {!formData.customerId ? (
                          <p className="text-xs font-bold text-amber-600 italic bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Please select a Buyer first to see their available PIs
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2">
                            {(allPis || [])
                              .filter((pi: any) => !pi.lcId && (pi.customerId === formData.customerId || pi.lc?.customerId === formData.customerId))
                              .map((pi: any) => (
                              <label key={pi.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer hover:border-blue-300 transition-all">
                                <input 
                                  type="checkbox"
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                  checked={formData.piIds?.includes(pi.id)}
                                  onChange={e => {
                                    const ids = formData.piIds || [];
                                    if (e.target.checked) {
                                      setFormData({...formData, piIds: [...ids, pi.id]});
                                    } else {
                                      setFormData({...formData, piIds: ids.filter((id: string) => id !== pi.id)});
                                    }
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex justify-between">
                                    <p className="text-sm font-black text-slate-900">{pi.piNumber}</p>
                                    <p className="text-sm font-black text-blue-600">{formatCurrency(pi.amount, pi.currency)}</p>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-500">Date: {new Date(pi.piDate).toLocaleDateString()}</p>
                                </div>
                              </label>
                            ))}
                            {(allPis || []).filter((pi: any) => !pi.lcId && (pi.customerId === formData.customerId || pi.lc?.customerId === formData.customerId)).length === 0 && (
                              <p className="text-xs font-bold text-slate-400 italic">No incomplete/standalone PIs found for this client</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}



                    {activeTab === 'lcs' && (
                      <>
                        <div>
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Loan Type</label>
                          <select 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            value={formData.loanType}
                            onChange={e => setFormData({...formData, loanType: e.target.value})}
                          >
                            <option value="NONE">None</option>
                            <option value="PERCENTAGE">Percentage (%)</option>
                            <option value="FIXED">Fixed Amount</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Loan Value</label>
                          <input 
                            type="number"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            value={formData.loanValue}
                            onChange={e => setFormData({...formData, loanValue: e.target.value})}
                          />
                        </div>
                      </>
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
                    {activeTab === 'lcs' && (
                       <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Received Date</label>
                        <input 
                          type="date"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          value={formData.receivedDate}
                          onChange={e => setFormData({...formData, receivedDate: e.target.value})}
                        />
                      </div>
                    )}

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
      {/* Standalone PI Modal */}
      <AnimatePresence>
        {showPIModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black text-slate-900">
                    {editingPI ? 'Edit PI / INV' : 'Create Standalone PI / INV'}
                  </h3>
                  <button onClick={() => { setShowPIModal(false); setEditingPI(null); }} className="text-slate-400 hover:text-slate-600">
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>

                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Buyer / Customer</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                      value={piFormData.customerId}
                      onChange={e => setPIFormData({...piFormData, customerId: e.target.value})}
                    >
                      <option value="">Select Buyer (Inherit from LC later)</option>
                      {customers?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PI Number</label>
                      <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={piFormData.piNumber} onChange={e => setPIFormData({...piFormData, piNumber: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Commercial INV No</label>
                      <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={piFormData.invoiceNumber} onChange={e => setPIFormData({...piFormData, invoiceNumber: e.target.value})} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PI Amount</label>
                    <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={piFormData.amount} onChange={e => setPIFormData({...piFormData, amount: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PI Date</label>
                    <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={piFormData.piDate} onChange={e => setPIFormData({...piFormData, piDate: e.target.value})} />
                  </div>

                  <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Submission & Workflow</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sub. to Buyer</label>
                        <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.submissionToBuyerDate} onChange={e => setPIFormData({...piFormData, submissionToBuyerDate: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sub. to Bank</label>
                        <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.submissionToBankDate} onChange={e => setPIFormData({...piFormData, submissionToBankDate: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                   <button onClick={() => setShowPIModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">Cancel</button>
                   <button 
                     onClick={() => savePIMutation.mutate(piFormData)} 
                     disabled={savePIMutation.isPending}
                     className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 disabled:opacity-50"
                   >
                     {savePIMutation.isPending ? 'Generating...' : 'Create PI'}
                   </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

