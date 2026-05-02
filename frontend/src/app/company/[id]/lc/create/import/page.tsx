'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { handleError } from '@/lib/error-handler';
import { ArrowLeft, Landmark, Calendar, CheckCircle2, Package } from 'lucide-react';
import Link from 'next/link';
import { useCompany } from '@/lib/CompanyContext';

export default function CreateImportLCPage() {
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
    type: 'IMPORT',
    status: 'OPEN',
    loanType: 'NONE',
    loanValue: '0',
    vendorId: '',
    shipmentDate: '',
    portOfLoading: '',
    portOfDestination: '',
    vesselName: '',
    description: '',
  });

  const { data: vendors } = useQuery({
    queryKey: ['company-vendors', companyId],
    queryFn: () => api.get(`/company/${companyId}/vendors`).then(res => res.data.data),
    enabled: !!companyId,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts', companyId],
    queryFn: () => api.get(`/company/${companyId}/accounts`, { params: { category: 'BANK' } }).then(res => res.data.data),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/lcs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-lcs', companyId] });
      toast.success('Import LC created successfully!');
      router.push(`/company/${companyId}/lc`);
    },
    onError: (err: any) => handleError(err, 'Failed to create LC'),
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
              <Package className="w-5 h-5 text-gray-700" />
              New Import Letter of Credit
            </h1>
            <p className="text-xs text-gray-500 font-medium tracking-tight">Standard Letter of Credit for Foreign Purchases</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Spot Rate</div>
          <div className="text-sm font-bold text-blue-600">1 {formData.currency} = {exchangeRate} BDT</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Basic Info */}
          <div className="bg-white border border-gray-200 rounded-sm p-4 space-y-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5" /> General Information
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Supplier / Vendor</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                  value={formData.vendorId}
                  onChange={e => set('vendorId', e.target.value)}
                >
                  <option value="">Select Supplier</option>
                  {(vendors || []).map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">LC Number *</label>
                <input
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                  placeholder="e.g. IMP-LC-2025-001"
                  value={formData.lcNumber}
                  onChange={e => set('lcNumber', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount *</label>
                  <input
                    required type="number" step="0.01"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-bold"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => set('amount', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Currency</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-bold"
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
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-sm flex justify-between items-center">
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Estimated Value (BDT)</span>
                  <span className="text-sm font-black text-blue-700">{totalBDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Issuing Bank *</label>
                  <select
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    value={formData.bankName}
                    onChange={e => set('bankName', e.target.value)}
                  >
                    <option value="">Select Bank</option>
                    {(bankAccounts || []).map((b: any) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bank Branch</label>
                  <input
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    placeholder="e.g. Main Branch"
                    value={formData.bankBranch}
                    onChange={e => set('bankBranch', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dates & Logistics */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-sm p-4 space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Schedule & Logistics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Issue Date</label>
                  <input type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    value={formData.issueDate} onChange={e => set('issueDate', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Expiry Date *</label>
                  <input required type="date" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    value={formData.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Port of Loading</label>
                  <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    placeholder="e.g. Shanghai" value={formData.portOfLoading} onChange={e => set('portOfLoading', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Port of Destination</label>
                  <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium"
                    placeholder="e.g. Chittagong" value={formData.portOfDestination} onChange={e => set('portOfDestination', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm p-4">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loan Coverage Type</label>
              <div className="flex gap-4">
                {['NONE', 'PERCENTAGE', 'FIXED'].map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="loanType" 
                      value={type} 
                      checked={formData.loanType === type}
                      onChange={e => set('loanType', e.target.value)}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-gray-600 uppercase">{type}</span>
                  </label>
                ))}
              </div>
              {formData.loanType !== 'NONE' && (
                <div className="mt-3">
                  <input
                    type="number" step="0.01"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-bold"
                    placeholder={formData.loanType === 'PERCENTAGE' ? 'Percentage %' : 'Amount'}
                    value={formData.loanValue}
                    onChange={e => set('loanValue', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description / Notes</label>
          <textarea rows={2} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:border-blue-500 outline-none text-sm font-medium resize-none"
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
            className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-sm hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {createMutation.isPending ? 'Creating...' : 'Save Import LC'}
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}



