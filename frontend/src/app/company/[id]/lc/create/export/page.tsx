'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Landmark, Calendar, FileText, CheckCircle2, Globe } from 'lucide-react';
import Link from 'next/link';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function CreateExportLCPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('lc', companyId);

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  const queryClient = useQueryClient();
  const { exchangeRate } = useCompany();

  const [formData, setFormData] = useState({
    lcNumber: '',
    bankName: '',
    bankBranch: '',
    amount: '',
    currency: 'USD',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    receivedDate: '',
    type: 'EXPORT',
    status: 'OPEN',
    loanType: 'NONE',
    loanValue: '0',
    customerId: '',
    shipmentDate: '',
    portOfLoading: '',
    portOfDestination: '',
    vesselName: '',
    description: '',
  });

  const [selectedPIs, setSelectedPIs] = useState<string[]>([]);

  const { data: customers } = useQuery({
    queryKey: ['company-customers', companyId],
    queryFn: () => api.get(`/company/${companyId}/customers`).then(res => res.data.data),
    enabled: !!companyId,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts', companyId],
    queryFn: () => api.get(`/company/${companyId}/accounts`, { params: { category: 'BANK' } }).then(res => res.data.data),
    enabled: !!companyId,
  });

  const { data: openPIs, isLoading: isLoadingPIs } = useQuery({
    queryKey: ['open-pis', companyId, formData.customerId],
    queryFn: () => api.get(`/company/${companyId}/pis`, { 
      params: { customerId: formData.customerId, isUnlinked: 'true' } 
    }).then(res => res.data.data),
    enabled: !!companyId && !!formData.customerId,
  });

  useEffect(() => {
    if (openPIs && openPIs.length > 0) {
      const piIds = openPIs.map((pi: any) => pi.id);
      setSelectedPIs(piIds);
      const totalAmount = openPIs.reduce((sum: number, pi: any) => sum + pi.amount, 0);
      setFormData(prev => ({ ...prev, amount: totalAmount.toString() }));
    } else {
      setSelectedPIs([]);
    }
  }, [openPIs]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/lcs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-lcs', companyId] });
      toast.success('Export LC created successfully!');
      router.push(`/company/${companyId}/lc`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create LC'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lcNumber || !formData.bankName || !formData.amount || !formData.expiryDate) {
      toast.error('Please fill in all required fields.');
      return;
    }
    createMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
      conversionRate: exchangeRate,
      loanValue: parseFloat(formData.loanValue),
      piIds: selectedPIs,
    });
  };

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const totalBDT = (parseFloat(formData.amount) || 0) * exchangeRate;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href={`/company/${companyId}/lc`} className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-gray-400" />
              New Export LC
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium tracking-tight">Register incoming LC from foreign buyer</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Spot Rate</div>
          <div className="text-sm font-bold text-gray-900">1 {formData.currency} = <span className="text-emerald-600 font-mono">{exchangeRate}</span> BDT</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm space-y-6">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 flex items-center gap-2">
              <Landmark className="w-4 h-4" /> LC Instrument Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Buyer / Customer *</label>
                <select
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                  value={formData.customerId}
                  onChange={e => set('customerId', e.target.value)}
                >
                  <option value="">Select Buyer</option>
                  {(customers || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">LC Number *</label>
                <input
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                  placeholder="EXP-LC-XXXX"
                  value={formData.lcNumber}
                  onChange={e => set('lcNumber', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Amount *</label>
                  <input
                    required type="number" step="0.01"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-black text-gray-900 font-mono transition-colors"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => set('amount', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Currency</label>
                  <select
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                    value={formData.currency}
                    onChange={e => set('currency', e.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="BDT">BDT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Issuing Bank *</label>
                <select
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                  value={formData.bankName}
                  onChange={e => set('bankName', e.target.value)}
                >
                  <option value="">Select Issuing Bank</option>
                  {(bankAccounts || []).map((b: any) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Branch</label>
                <input
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 transition-colors"
                  placeholder="Main Branch"
                  value={formData.bankBranch}
                  onChange={e => set('bankBranch', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm space-y-4">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Additional Notes
            </label>
            <textarea 
              rows={3} 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-medium text-gray-900 transition-colors resize-none"
              placeholder="Shipping instructions, partial shipment terms, etc..." 
              value={formData.description} 
              onChange={e => set('description', e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm space-y-6">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Timeline
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Issue Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 font-mono transition-colors"
                  value={formData.issueDate} 
                  onChange={e => set('issueDate', e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Expiry Date *</label>
                <input 
                  required type="date" 
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-sm font-bold text-gray-900 font-mono transition-colors"
                  value={formData.expiryDate} 
                  onChange={e => set('expiryDate', e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm space-y-6">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Linked Proforma Invoices
            </h2>
            {formData.customerId ? (
              isLoadingPIs ? (
                <div className="text-[10px] text-gray-400 font-bold uppercase animate-pulse">Scanning open PIs...</div>
              ) : openPIs && openPIs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {openPIs.map((pi: any) => (
                    <div key={pi.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-sm group hover:border-gray-300 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-900 uppercase">{pi.piNumber}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(pi.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600 font-mono">{pi.currency} {pi.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-400">
                      <span>Auto-Linked Total</span>
                      <span className="text-gray-900">{formData.currency} {parseFloat(formData.amount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-3 rounded-sm border border-amber-100 uppercase tracking-wider">
                  No unlinked PIs found for this customer.
                </div>
              )
            ) : (
              <div className="text-[10px] font-bold text-gray-400 italic uppercase tracking-wider text-center py-4 bg-gray-50 rounded-sm border border-dashed border-gray-200">
                Select a customer to view available PIs.
              </div>
            )}
          </div>

          {formData.currency !== 'BDT' && formData.amount && (
            <div className="bg-gray-900 rounded-sm p-6 shadow-xl space-y-2 border border-gray-800">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Estimated Local Value</div>
              <div className="text-2xl font-black text-white font-mono flex items-baseline gap-2">
                {totalBDT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-xs font-bold text-gray-500">BDT</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full px-6 py-3 bg-gray-900 text-white text-xs font-bold uppercase tracking-[0.2em] rounded-sm hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
            >
              {createMutation.isPending ? 'Processing...' : 'Register Export LC'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <Link
              href={`/company/${companyId}/lc`}
              className="w-full px-6 py-3 bg-white border border-gray-200 text-gray-500 text-xs font-bold uppercase tracking-[0.2em] rounded-sm hover:bg-gray-50 hover:text-gray-900 transition-all text-center"
            >
              Cancel Entry
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}



