'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Landmark, Calendar, FileText, CheckCircle2, Globe } from 'lucide-react';
import Link from 'next/link';
import { useCompany } from '@/lib/CompanyContext';

export default function CreateExportLCPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
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
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/company/${companyId}/lc`} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-gray-700" />
              New Export Letter of Credit
            </h1>
            <p className="text-xs text-gray-500 font-medium tracking-tight">Register incoming LC from foreign buyer</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Spot Rate</div>
          <div className="text-sm font-bold text-emerald-600">1 {formData.currency} = {exchangeRate} BDT</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-sm p-4 space-y-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5" /> LC Details
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Buyer / Customer *</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-medium"
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
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">LC Number *</label>
                <input
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-medium"
                  placeholder="e.g. EXP-LC-2025-001"
                  value={formData.lcNumber}
                  onChange={e => set('lcNumber', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount *</label>
                  <input
                    required type="number" step="0.01"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-bold"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => set('amount', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Currency</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-bold"
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

              {formData.currency !== 'BDT' && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-sm flex justify-between items-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Estimated Value (BDT)</span>
                  <span className="text-sm font-black text-emerald-700">{totalBDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Issuing Bank *</label>
                <select
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-medium"
                  value={formData.bankName}
                  onChange={e => set('bankName', e.target.value)}
                >
                  <option value="">Select Issuing Bank</option>
                  {(bankAccounts || []).map((b: any) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-4 space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Dates & Validity
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Issue Date</label>
                  <input type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-medium"
                    value={formData.issueDate} onChange={e => set('issueDate', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Expiry Date *</label>
                  <input required type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-medium"
                    value={formData.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-4 space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Linked Proforma Invoices
              </h2>
              {formData.customerId ? (
                isLoadingPIs ? (
                  <div className="text-xs text-gray-400 italic">Scanning open PIs...</div>
                ) : openPIs && openPIs.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {openPIs.map((pi: any) => (
                      <div key={pi.id} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-100 rounded-sm">
                        <span className="text-[10px] font-bold text-gray-700">{pi.piNumber}</span>
                        <span className="text-[10px] font-black text-emerald-600">{pi.currency} {pi.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-sm border border-amber-100">
                    No unlinked PIs found for this customer.
                  </div>
                )
              ) : (
                <div className="text-[10px] font-bold text-gray-400 italic">Select a customer to see available PIs.</div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description / Notes</label>
          <textarea rows={2} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-emerald-500 outline-none text-sm font-medium resize-none"
            placeholder="Additional notes..." value={formData.description} onChange={e => set('description', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/company/${companyId}/lc`}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-600 text-sm font-bold rounded-sm hover:bg-gray-50 transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-emerald-900 text-white text-sm font-bold rounded-sm hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Export LC'}
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}



