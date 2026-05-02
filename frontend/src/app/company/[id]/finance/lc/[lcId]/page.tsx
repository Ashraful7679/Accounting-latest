'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Calendar, DollarSign, ArrowLeft, Plus, 
  CheckCircle2, AlertCircle, Clock, CreditCard, 
  Trash2, Landmark, Building2, User, HelpCircle, X,
  ShoppingBag, TrendingUp, Eye, ChevronRight, ChevronDown
} from 'lucide-react';
import { AttachmentManager } from '@/components/AttachmentManager';
import PermissionGate from '@/components/PermissionGate';
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
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementAccountId, setSettlementAccountId] = useState('');
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

  const [role, setRole] = useState('User');
  const isOwner = role === 'Owner' || role === 'Admin';

  useEffect(() => {
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setRole(roles[0] || 'User');
  }, []);

  // Queries
  const { data: lc, isLoading: loadingLC } = useQuery({
    queryKey: ['lc-detail', lcId],
    queryFn: () => api.get(`/company/lcs/${lcId}/detail`).then(res => res.data.data)
  });

  const { data: accounts } = useQuery({
    queryKey: ['company-accounts', companyId],
    queryFn: () => api.get(`/company/${companyId}/accounts`).then(res => res.data.data)
  });

  const { data: activities } = useQuery({
    queryKey: ['lc-activities', lcId],
    queryFn: () => api.get(`/company/${companyId}/audit`, { params: { entityType: 'lc', entityId: lcId } }).then(res => res.data.data)
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

  const settleLCMutation = useMutation({
    mutationFn: (data: { bankLoanAccountId: string }) => api.post(`/company/lcs/${lcId}/settle`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lc-detail', lcId] });
      toast.success('LC settled successfully');
      setShowSettleModal(false);
      setSettlementAccountId('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to settle LC')
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
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  if (loadingLC) return <div className="flex items-center justify-center min-h-screen bg-gray-50 font-mono text-[10px] uppercase font-bold tracking-widest animate-pulse">Syncing Instrument Details...</div>;
  if (!lc) return <div className="flex items-center justify-center min-h-screen bg-gray-50 font-mono text-[10px] uppercase font-bold text-rose-500">Instrument Not Found</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-sm transition-colors text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter">{lc.lcNumber}</h1>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                lc.status === 'OPEN' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                lc.status === 'PARTIALLY_PAID' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-gray-50 text-gray-400 border-gray-200"
              )}>
                {lc.status}
              </span>
            </div>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
              {lc.bankName} • {lc.customer?.name || 'No Buyer Assigned'} 
              {lc.receivedDate && <span className="ml-2 text-gray-400">| RECV: {new Date(lc.receivedDate).toLocaleDateString()}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lc.status === 'APPROVED' && (
            <PermissionGate module="FINANCE" action="canUpdate">
              <button 
                onClick={() => setShowSettleModal(true)}
                className="bg-gray-900 text-white px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-gray-200 hover:bg-black transition-all"
              >
                Settle LC
              </button>
            </PermissionGate>
          )}
        </div>
      </header>

      <div className="p-8 max-w-[1600px] mx-auto space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Instrument Value', value: lc.amount, color: 'text-gray-900', icon: Landmark, secondary: lc.currency },
            { label: 'Total PI Issued', value: stats.piTotal, color: 'text-gray-900', icon: FileText, sub: `Remaining: ${formatCurrency(lc.amount - stats.piTotal)}` },
            { label: 'Total Received', value: stats.received, color: 'text-emerald-600', icon: CheckCircle2, mono: true },
            { label: 'Current Outstanding', value: stats.outstanding, color: 'text-rose-600', icon: Clock, mono: true }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-sm border border-gray-200 shadow-sm relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-gray-50 rounded-sm border border-gray-100 group-hover:bg-gray-900 group-hover:text-white transition-all">
                  <stat.icon className="w-4 h-4" />
                </div>
                {stat.secondary && <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{stat.secondary}</span>}
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={cn("text-2xl font-black tracking-tighter", stat.color, stat.mono && "font-mono")}>
                {formatCurrency(stat.value)}
              </p>
              {stat.sub && <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{stat.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content (PIs & Payments) */}
          <div className="lg:col-span-8 space-y-8">
            {/* PI Section */}
            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Proforma Invoices (PI)
                </h3>
                {isOwner && (
                  <button 
                    onClick={() => setShowPIModal(true)}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add PI
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Schedule</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Value</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">IDBP / Finance</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lc.pis?.map((pi: any) => {
                      const paid = pi.paymentAllocations?.reduce((s: number, a: any) => s + a.allocatedAmount, 0) || 0;
                      return (
                        <tr key={pi.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="text-xs font-black text-gray-900 uppercase">{pi.piNumber}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">{pi.invoiceNumber || 'NO COMMERCIAL INV'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[10px] font-bold text-gray-600 uppercase">{new Date(pi.piDate).toLocaleDateString()}</p>
                            {pi.maturityDate && <p className="text-[9px] font-black text-rose-400 uppercase mt-0.5">DUE: {new Date(pi.maturityDate).toLocaleDateString()}</p>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="font-mono text-xs font-black text-gray-900">{formatCurrency(pi.amount)}</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{lc.currency}</div>
                          </td>
                          <td className="px-6 py-4">
                            {pi.idbpNumber ? (
                              <div className="space-y-0.5">
                                <p className="text-[10px] font-black text-gray-700 uppercase tracking-tighter">{pi.idbpNumber}</p>
                                <p className="text-[9px] font-bold text-emerald-600 font-mono">{formatCurrency(pi.purchaseAmount || 0)}</p>
                              </div>
                            ) : (
                              <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Not Financed</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                pi.status === 'PAID' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                                pi.status === 'PARTIALLY_PAID' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-gray-50 text-gray-400 border-gray-200"
                              )}>
                                {pi.status}
                              </span>
                              {pi.amount - paid > 0 && (
                                <span className="text-[9px] font-mono font-bold text-rose-500">-{formatCurrency(pi.amount - paid)}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments Section */}
            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  Realized Payments
                </h3>
                {isOwner && (
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
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Receipt
                  </button>
                )}
              </div>
              <div className="p-0">
                <div className="divide-y divide-gray-100">
                  {lc.payments?.length === 0 ? (
                    <div className="px-6 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">No payments recorded yet</div>
                  ) : (
                    lc.payments?.map((pmt: any) => (
                      <div key={pmt.id} className="p-6 hover:bg-gray-50 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-50 rounded-sm border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all shadow-sm">
                             <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-black text-gray-900 tracking-tighter">{formatCurrency(pmt.amount)} <span className="text-[10px] text-gray-400 font-bold ml-1">{lc.currency}</span></p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                              {new Date(pmt.date).toLocaleDateString()} • {pmt.reference || 'SYSTEM GEN RECP'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {pmt.piAllocations?.map((a: any) => (
                             <span key={a.id} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-sm text-[8px] font-black uppercase tracking-tighter border border-gray-200">
                               {a.pi?.piNumber}: {formatCurrency(a.allocatedAmount)}
                             </span>
                           ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Financing Context */}
            <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-sm space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Landmark className="w-4 h-4" /> Financing Facilities
                </h4>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-sm border border-gray-100">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Assigned Loan Limit</label>
                    <p className="text-xl font-black text-gray-900 font-mono tracking-tighter">{formatCurrency(stats.loanAmount)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[8px] font-black uppercase tracking-tighter rounded-sm">{lc.loanType}</span>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                        {lc.loanType === 'PERCENTAGE' ? `${lc.loanValue}% OF LC VALUE` : 'FIXED ALLOCATION'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-gray-400">Issue Date</span>
                  <span className="text-gray-900">{new Date(lc.issueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-gray-400">Expiry Threshold</span>
                  <span className="text-rose-600">{new Date(lc.expiryDate).toLocaleDateString()}</span>
                </div>
                <div className="p-4 bg-rose-50 rounded-sm border border-rose-100">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Days Remaining</span>
                    <span className="text-xl font-black text-rose-700 font-mono">
                      {Math.max(0, Math.ceil((new Date(lc.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Drive */}
            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                 <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                   <ShoppingBag className="w-4 h-4 text-gray-400" /> Digital Repository
                 </h4>
              </div>
              <div className="p-4">
                 <AttachmentManager 
                   entityType="LC" 
                   entityId={lcId} 
                   canEdit={lc.status === 'DRAFT' || isOwner} 
                 />
              </div>
            </div>

            {/* Event Log */}
            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Audit Trail</h4>
              </div>
              <div className="p-6">
                {!activities || activities.length === 0 ? (
                  <p className="text-[10px] font-bold text-gray-400 uppercase text-center py-4 tracking-widest italic">No historical events recorded</p>
                ) : (
                  <div className="space-y-6 relative before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100">
                    {activities.map((act: any) => (
                      <div key={act.id} className="relative pl-6">
                         <div className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2 border-white bg-gray-200 shadow-sm" />
                         <div>
                           <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">
                             {act.action.replace(/_/g, ' ')}
                             {act.metadata?.action ? ` : ${act.metadata.action}` : ''}
                           </p>
                           <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5 tracking-tighter">
                             {new Date(act.createdAt).toLocaleString()} • {act.performedBy?.firstName}
                           </p>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PI Modal */}
      {showPIModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-2xl border border-gray-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Instrument Realization</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Capture PI & Export Documentation Details</p>
              </div>
              <button onClick={() => setShowPIModal(false)} className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">PI Reference Number</label>
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold uppercase focus:border-gray-400 outline-none" value={piFormData.piNumber} onChange={e => setPIFormData({...piFormData, piNumber: e.target.value})} placeholder="e.g. PI-2024-001" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Commercial Invoice No</label>
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold uppercase focus:border-gray-400 outline-none" value={piFormData.invoiceNumber} onChange={e => setPIFormData({...piFormData, invoiceNumber: e.target.value})} placeholder="OPTIONAL" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Realization Amount</label>
                  <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none" value={piFormData.amount} onChange={e => setPIFormData({...piFormData, amount: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Issue Date</label>
                  <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none uppercase" value={piFormData.piDate} onChange={e => setPIFormData({...piFormData, piDate: e.target.value})} />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Workflow Milestones</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission to Buyer</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none uppercase" value={piFormData.submissionToBuyerDate} onChange={e => setPIFormData({...piFormData, submissionToBuyerDate: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission to Bank</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none uppercase" value={piFormData.submissionToBankDate} onChange={e => setPIFormData({...piFormData, submissionToBankDate: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Acceptance Date</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none uppercase" value={piFormData.bankAcceptanceDate} onChange={e => setPIFormData({...piFormData, bankAcceptanceDate: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financial Maturity</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none uppercase" value={piFormData.maturityDate} onChange={e => setPIFormData({...piFormData, maturityDate: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 bg-gray-50/50 -mx-8 px-8 pb-8">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-6">Financing (IDBP / Purchase)</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">IDBP Reference</label>
                    <input placeholder="e.g. IDBP/REF/..." className="w-full px-4 py-3 bg-white border border-gray-200 rounded-sm font-mono text-xs font-bold uppercase focus:border-gray-400 outline-none" value={piFormData.idbpNumber} onChange={e => setPIFormData({...piFormData, idbpNumber: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Application Date</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none uppercase" value={piFormData.purchaseApplicationDate} onChange={e => setPIFormData({...piFormData, purchaseApplicationDate: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Purchase / Funded Amount</label>
                    <input type="number" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-sm font-mono text-xs font-bold focus:border-gray-400 outline-none" value={piFormData.purchaseAmount} onChange={e => setPIFormData({...piFormData, purchaseAmount: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 flex gap-3">
               <button onClick={() => setShowPIModal(false)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-gray-100 transition-all">Cancel Operation</button>
               <button onClick={() => addPIMutation.mutate(piFormData)} className="flex-1 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl shadow-gray-200 hover:bg-black transition-all">Persist PI Data</button>
            </div>
          </div>
        </div>
      )}


      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-2xl border border-gray-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Realize Proceeds</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Record incoming receipt & allocate to PIs</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Settlement Destination (Account)</label>
                  <select 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-bold text-[10px] uppercase tracking-widest appearance-none outline-none focus:border-gray-400"
                    value={paymentFormData.accountId}
                    onChange={e => setPaymentFormData({...paymentFormData, accountId: e.target.value})}
                  >
                    <option value="">-- SELECT RECEIVING ACCOUNT --</option>
                    {accounts?.filter((a: any) => a.category === 'CASH' || a.category === 'BANK').map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name.toUpperCase()} ({a.category})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Realized Amount</label>
                  <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold outline-none focus:border-gray-400" value={paymentFormData.amount} onChange={e => setPaymentFormData({...paymentFormData, amount: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Value Date</label>
                  <input type="date" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold uppercase outline-none focus:border-gray-400" value={paymentFormData.date} onChange={e => setPaymentFormData({...paymentFormData, date: e.target.value})} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Reference / Credit Memo</label>
                  <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-mono text-xs font-bold uppercase outline-none focus:border-gray-400" value={paymentFormData.reference} onChange={e => setPaymentFormData({...paymentFormData, reference: e.target.value})} placeholder="BANK ADVICE / TT REF" />
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                 <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Allocation Workbench</h4>
                 <div className="space-y-3">
                    {paymentFormData.allocations.map((alloc, idx) => (
                      <div key={alloc.piId} className="flex items-center justify-between p-4 bg-gray-50 rounded-sm border border-gray-100 group">
                         <div>
                            <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{alloc.piNumber}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">PENDING REALIZATION: {formatCurrency(alloc.pending)}</p>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">ALLOCATE:</span>
                            <input 
                              type="number" 
                              className="w-32 px-3 py-2 bg-white border border-gray-200 rounded-sm font-mono text-xs font-black text-right outline-none focus:border-gray-400 transition-all" 
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
                      <p className="text-center py-12 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] border border-dashed border-gray-200 rounded-sm italic">No pending invoices available for allocation</p>
                    )}
                 </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 flex gap-3">
               <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-gray-100 transition-all">Abort</button>
               <button 
                 onClick={handleCreatePayment}
                 disabled={createPaymentMutation.isPending}
                 className="flex-1 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl shadow-emerald-50 hover:bg-emerald-700 disabled:opacity-50 transition-all"
               >
                 {createPaymentMutation.isPending ? 'PROCESSING...' : 'CONFIRM PROCEEDS'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle LC Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-md border border-gray-200 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Settle Liability</h3>
              <button onClick={() => setShowSettleModal(false)} className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase leading-relaxed tracking-widest">
                Transfer vendor liability to bank financing facility (PAD/LTR). This operation will close the AP and initialize bank debt.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Financing Account</label>
                <select 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm font-black text-[10px] uppercase tracking-widest appearance-none outline-none focus:border-gray-400"
                  value={settlementAccountId}
                  onChange={e => setSettlementAccountId(e.target.value)}
                >
                  <option value="">-- SELECT LOAN ACCOUNT --</option>
                  {accounts?.filter((a: any) => a.category === 'BANK_LOAN' || a.category === 'PAD' || a.category === 'LTR' || a.category === 'LIABILITY').map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name.toUpperCase()} ({a.category})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowSettleModal(false)} 
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => settleLCMutation.mutate({ bankLoanAccountId: settlementAccountId })}
                  disabled={!settlementAccountId || settleLCMutation.isPending}
                  className="flex-1 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl shadow-gray-200 hover:bg-black transition-all disabled:opacity-50"
                >
                  {settleLCMutation.isPending ? 'SETTLING...' : 'CONFIRM SETTLEMENT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
