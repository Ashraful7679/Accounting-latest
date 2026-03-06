'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, DollarSign, ArrowLeft, Plus, 
  CheckCircle2, AlertCircle, Clock, CreditCard, 
  Trash2, Landmark, Building2, User, HelpCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function LCDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const lcId = params.lcId as string;
  const queryClient = useQueryClient();

  const [showPIModal, setShowPIModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
    idbpNumber: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({ 
    amount: 0, 
    date: new Date().toISOString().split('T')[0], 
    method: 'BANK', 
    reference: '', 
    description: '',
    accountId: '',
    allocations: [] as any[]
  });


  // Queries
  const { data: lc, isLoading: loadingLC } = useQuery({
    queryKey: ['lc-detail', lcId],
    queryFn: () => api.get(`/company/lcs/${lcId}/detail`).then(res => res.data.data)
  });

  const { data: accounts } = useQuery({
    queryKey: ['company-accounts', companyId],
    queryFn: () => api.get(`/company/${companyId}/accounts`).then(res => res.data.data)
  });

  // Mutations
  const addPIMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/lcs/${lcId}/pis`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-detail', lcId] });
      toast.success('PI added successfully');
      setShowPIModal(false);
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
        idbpNumber: ''
      });
    },

    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add PI')
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-detail', lcId] });
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      setPaymentFormData({ 
        amount: 0, 
        date: new Date().toISOString().split('T')[0], 
        method: 'BANK', 
        reference: '', 
        description: '',
        accountId: '',
        allocations: []
      });

    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to record payment')
  });

  const calculateOutstanding = () => {
    if (!lc) return { piTotal: 0, received: 0, outstanding: 0, loanAmount: 0 };
    const piTotal = lc.pis?.reduce((sum: number, pi: any) => sum + pi.amount, 0) || 0;
    const received = lc.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
    
    let loanAmount = 0;
    if (lc.loanType === 'PERCENTAGE') {
      loanAmount = (lc.amount * lc.loanValue) / 100;
    } else if (lc.loanType === 'FIXED') {
      loanAmount = lc.loanValue;
    }

    return {
      piTotal,
      received,
      outstanding: lc.amount - received,
      loanAmount
    };
  };

  const stats = calculateOutstanding();

  const handleCreatePayment = () => {
    const totalAllocated = paymentFormData.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    if (totalAllocated > paymentFormData.amount) {
      toast.error('Allocation cannot exceed payment amount');
      return;
    }
    createPaymentMutation.mutate({
      ...paymentFormData,
      lcId,
      piAllocations: paymentFormData.allocations.filter(a => a.allocatedAmount > 0)
    });
  };

  const formatCurrency = (val: number, cur: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(val);
  };

  if (loadingLC) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!lc) return <div className="flex items-center justify-center min-h-screen">LC Not Found</div>;

  return (
    <div className="min-h-screen">

        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900">{lc.lcNumber}</h1>
              <p className="text-slate-500 text-sm font-bold">
                {lc.bankName} • {lc.customer?.name || 'No Buyer'} 
                {lc.receivedDate && <span className="ml-2 text-slate-400">| Received: {new Date(lc.receivedDate).toLocaleDateString()}</span>}
              </p>
            </div>

          </div>
          <div className="flex items-center gap-3">
             <span className={cn(
                "px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter",
                lc.status === 'OPEN' ? "bg-emerald-100 text-emerald-700" : 
                lc.status === 'PARTIALLY_PAID' ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
              )}>
                {lc.status}
              </span>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
               <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                <Landmark className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total LC Amount</p>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(lc.amount, lc.currency)}</p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
               <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total PI Issued</p>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.piTotal, lc.currency)}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">Remaining: {formatCurrency(lc.amount - stats.piTotal, lc.currency)}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-emerald-600">
               <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Received</p>
              <p className="text-2xl font-black font-mono">{formatCurrency(stats.received, lc.currency)}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-rose-600">
               <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outstanding</p>
              <p className="text-2xl font-black font-mono">{formatCurrency(stats.outstanding, lc.currency)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* PI List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Proforma Invoices (PI)
                  </h3>
                  <button 
                    onClick={() => setShowPIModal(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add PI
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">PI / INV No</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dates (Issue/Maturity)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase / IDBP</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status / Bal</th>
                      </tr>

                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {lc.pis?.map((pi: any) => {
                        const paid = pi.paymentAllocations?.reduce((s: number, a: any) => s + a.allocatedAmount, 0) || 0;
                        return (
                          <tr key={pi.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{pi.piNumber}</p>
                              <p className="text-[10px] font-bold text-slate-400">{pi.invoiceNumber || 'No INV'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-500">{new Date(pi.piDate).toLocaleDateString()}</p>
                              {pi.maturityDate && <p className="text-[10px] font-black text-rose-400 uppercase">Due: {new Date(pi.maturityDate).toLocaleDateString()}</p>}
                            </td>
                            <td className="px-6 py-4 font-black">{formatCurrency(pi.amount, pi.currency)}</td>
                            <td className="px-6 py-4">
                              {pi.idbpNumber ? (
                                <>
                                  <p className="text-xs font-black text-slate-700">{pi.idbpNumber}</p>
                                  <p className="text-[10px] font-bold text-emerald-600">{formatCurrency(pi.purchaseAmount || 0, pi.currency)}</p>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-bold uppercase italic">No Purchase</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase w-fit",
                                  pi.status === 'PAID' ? "bg-emerald-100 text-emerald-700" : 
                                  pi.status === 'PARTIALLY_PAID' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                                )}>
                                  {pi.status}
                                </span>
                                <span className="text-[10px] font-black text-rose-500">{formatCurrency(pi.amount - paid, pi.currency)}</span>
                              </div>
                            </td>
                          </tr>

                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments List */}
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    Payments Received
                  </h3>
                  <button 
                    onClick={() => {
                        setPaymentFormData({
                          ...paymentFormData,
                          allocations: lc.pis.filter((p: any) => p.status !== 'PAID').map((p: any) => ({
                            piId: p.id,
                            piNumber: p.piNumber,
                            total: p.amount,
                            pending: p.amount - (p.paymentAllocations?.reduce((s: number, a: any) => s + a.allocatedAmount, 0) || 0),
                            allocatedAmount: 0
                          }))
                        });
                        setShowPaymentModal(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Record Payment
                  </button>
                </div>
                <div className="p-6">
                   <div className="space-y-4">
                      {lc.payments?.map((pmt: any) => (
                        <div key={pmt.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-transparent hover:border-slate-200 hover:bg-white transition-all cursor-default">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 shadow-sm border border-slate-100">
                               <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-black text-slate-900">{formatCurrency(pmt.amount, pmt.currency)}</p>
                              <p className="text-xs font-bold text-slate-400">{new Date(pmt.date).toLocaleDateString()} • {pmt.reference || 'No Reference'}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                             <div className="flex gap-1">
                                {pmt.piAllocations?.map((a: any) => (
                                  <span key={a.id} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black">
                                    {a.pi?.piNumber}: {formatCurrency(a.allocatedAmount, lc.currency)}
                                  </span>
                                ))}
                             </div>
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </div>

            {/* Sidebar Details */}
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Loan Against LC</h4>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Loan Type</label>
                    <p className="text-lg font-black text-slate-900 uppercase">{lc.loanType}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Loan Limit</label>
                    <p className="text-2xl font-black text-blue-600">{formatCurrency(stats.loanAmount, lc.currency)}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      {lc.loanType === 'PERCENTAGE' ? `${lc.loanValue}% of total amount` : 'Fixed Amount'}
                    </p>
                  </div>
                  <div className="pt-6 border-t border-slate-100">
                     <p className="text-xs font-medium text-slate-500 leading-relaxed">
                       This loan limit represents the maximum amount that can be drawn from the bank against this LC's value.
                     </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-xl shadow-slate-900/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-widest">LC Validity</h4>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <span className="text-slate-400 text-sm font-bold">Issued on</span>
                     <span className="font-black text-sm">{new Date(lc.issueDate).toLocaleDateString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-slate-400 text-sm font-bold">Expires on</span>
                     <span className="font-black text-sm text-amber-400">{new Date(lc.expiryDate).toLocaleDateString()}</span>
                   </div>
                   <div className="pt-4 border-t border-white/10">
                     <div className="bg-white/5 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Days Remaining</p>
                        <p className="text-xl font-black">
                           {Math.max(0, Math.ceil((new Date(lc.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} Days
                        </p>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* PI Modal */}
      <AnimatePresence>
        {showPIModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-black text-slate-900 mb-6">Generate PI & Export Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
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
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Bank Acceptance</label>
                        <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.bankAcceptanceDate} onChange={e => setPIFormData({...piFormData, bankAcceptanceDate: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Maturity Date</label>
                        <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.maturityDate} onChange={e => setPIFormData({...piFormData, maturityDate: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">Financing (Purchase)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">IDBP Number</label>
                        <input placeholder="e.g. IDBP/2024/..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.idbpNumber} onChange={e => setPIFormData({...piFormData, idbpNumber: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Purchase Application Date</label>
                        <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.purchaseApplicationDate} onChange={e => setPIFormData({...piFormData, purchaseApplicationDate: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Purchase Amount</label>
                        <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={piFormData.purchaseAmount} onChange={e => setPIFormData({...piFormData, purchaseAmount: Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                   <button onClick={() => setShowPIModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">Cancel</button>
                   <button onClick={() => addPIMutation.mutate(piFormData)} className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20">Save Details</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                  <span className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 text-base">💰</span>
                  Record Payment & Allocate
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Settlement Account</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold appearance-none"
                      value={paymentFormData.accountId}
                      onChange={e => setPaymentFormData({...paymentFormData, accountId: e.target.value})}
                    >
                      <option value="">Select Account</option>
                      {accounts?.filter((a: any) => a.category === 'CASH' || a.category === 'BANK').map((a: any) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Payment Amount</label>
                    <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={paymentFormData.amount} onChange={e => setPaymentFormData({...paymentFormData, amount: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Date</label>
                    <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={paymentFormData.date} onChange={e => setPaymentFormData({...paymentFormData, date: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Reference / Remarks</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={paymentFormData.reference} onChange={e => setPaymentFormData({...paymentFormData, reference: e.target.value})} placeholder="e.g. Bank Transfer Ref, TT Number" />
                  </div>
                </div>

                <div className="mb-8">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">PI Allocation</h4>
                   <div className="space-y-3">
                      {paymentFormData.allocations.map((alloc, idx) => (
                        <div key={alloc.piId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div>
                              <p className="font-black text-slate-900">{alloc.piNumber}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Pending: {formatCurrency(alloc.pending, lc.currency)}</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-400">Allocate:</span>
                              <input 
                                type="number" 
                                className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-lg font-black text-right" 
                                value={alloc.allocatedAmount}
                                onChange={e => {
                                  const newAllocs = [...paymentFormData.allocations];
                                  newAllocs[idx].allocatedAmount = Number(e.target.value);
                                  setPaymentFormData({...paymentFormData, allocations: newAllocs});
                                }}
                              />
                           </div>
                        </div>
                      ))}
                      {paymentFormData.allocations.length === 0 && (
                        <p className="text-center py-4 text-slate-400 font-bold italic">No pending PIs to allocate</p>
                      )}
                   </div>
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl transition-all hover:bg-slate-200">Cancel</button>
                   <button 
                     onClick={handleCreatePayment}
                     disabled={createPaymentMutation.isPending}
                     className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50"
                   >
                     {createPaymentMutation.isPending ? 'Processing...' : 'Complete Payment'}
                   </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
