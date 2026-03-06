'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Ship, Landmark, Calendar, CheckCircle2, Package } from 'lucide-react';
import Link from 'next/link';

export default function CreateImportLCPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    lcNumber: '',
    bankName: '',
    bankBranch: '',
    amount: '',
    currency: 'USD',
    conversionRate: '110',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    receivedDate: '',
    type: 'IMPORT',
    status: 'OPEN',
    loanType: 'NONE',
    loanValue: '0',
    vendorId: '',
    // Shipment Info
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

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/lcs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-lcs', companyId] });
      toast.success('Import LC created successfully!');
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
      conversionRate: parseFloat(formData.conversionRate),
      loanValue: parseFloat(formData.loanValue),
    });
  };

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/company/${companyId}/lc`} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Import LC</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Create Import Letter of Credit</h1>
          <p className="text-slate-500 text-sm font-medium">For import purchases — pay overseas supplier via bank guarantee</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supplier & Bank Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-500" /> LC Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Supplier / Vendor</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.vendorId}
                onChange={e => set('vendorId', e.target.value)}
              >
                <option value="">Select Supplier</option>
                {(vendors || []).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.code || v.country})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">LC Number *</label>
              <input
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="e.g. IMP-LC-2025-001"
                value={formData.lcNumber}
                onChange={e => set('lcNumber', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Amount *</label>
              <input
                required type="number" step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => set('amount', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Currency</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.currency}
                onChange={e => set('currency', e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="BDT">BDT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Conv. Rate (1 {formData.currency} = ? BDT)</label>
              <input
                type="number" step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.conversionRate}
                onChange={e => set('conversionRate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Issuing Bank *</label>
              <input
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="e.g. Dutch-Bangla Bank"
                value={formData.bankName}
                onChange={e => set('bankName', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Bank Branch</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="e.g. Motijheel"
                value={formData.bankBranch}
                onChange={e => set('bankBranch', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Loan Coverage Type</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.loanType}
                onChange={e => set('loanType', e.target.value)}
              >
                <option value="NONE">None</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>

            {formData.loanType !== 'NONE' && (
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                  Loan Value {formData.loanType === 'PERCENTAGE' ? '(%)' : '(Amount)'}
                </label>
                <input
                  type="number" step="0.01"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  value={formData.loanValue}
                  onChange={e => set('loanValue', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Dates Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Key Dates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Issue Date</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.issueDate} onChange={e => set('issueDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Expiry Date *</label>
              <input required type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Received Date</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.receivedDate} onChange={e => set('receivedDate', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Shipment Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
            <Ship className="w-4 h-4 text-blue-500" /> Shipment Info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Shipment Date</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                value={formData.shipmentDate} onChange={e => set('shipmentDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Vessel Name</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="e.g. MV Pacific Star" value={formData.vesselName} onChange={e => set('vesselName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Port of Loading</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="e.g. Shanghai" value={formData.portOfLoading} onChange={e => set('portOfLoading', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Port of Destination</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                placeholder="e.g. Chittagong" value={formData.portOfDestination} onChange={e => set('portOfDestination', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Description / Notes</label>
              <textarea rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 resize-none"
                placeholder="Any additional notes about this import LC..." value={formData.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <Link
            href={`/company/${companyId}/lc`}
            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {createMutation.isPending ? 'Creating...' : 'Create Import LC'}
          </button>
        </div>
      </form>
    </div>
  );
}
