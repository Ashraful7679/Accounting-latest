'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Ship, Globe, Landmark, Calendar, DollarSign, FileText, CheckCircle2, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';

export default function CreateExportLCPage() {
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
    type: 'EXPORT',
    status: 'OPEN',
    loanType: 'NONE',
    loanValue: '0',
    customerId: '',
    // Shipment Info
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
      conversionRate: parseFloat(formData.conversionRate),
      loanValue: parseFloat(formData.loanValue),
      piIds: selectedPIs,
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
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Export LC</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Create Export Letter of Credit</h1>
          <p className="text-slate-500 text-sm font-medium">For export sales — receive payment from overseas buyer via bank</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Buyer & Bank Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-500" /> LC Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Buyer / Customer *</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                value={formData.customerId}
                onChange={e => set('customerId', e.target.value)}
              >
                <option value="">Select Buyer</option>
                {(customers || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">LC Number *</label>
              <input
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                placeholder="e.g. EXP-LC-2025-001"
                value={formData.lcNumber}
                onChange={e => set('lcNumber', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Amount *</label>
              <input
                required type="number" step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => set('amount', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Currency</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
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
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                value={formData.conversionRate}
                onChange={e => set('conversionRate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Issuing Bank *</label>
              <input
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                placeholder="e.g. HSBC Bangladesh"
                value={formData.bankName}
                onChange={e => set('bankName', e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* Linked PIs Section */}
        {formData.customerId && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <h2 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> Linked Proforma Invoices (PIs)
            </h2>
            {isLoadingPIs ? (
              <div className="text-slate-400 text-sm animate-pulse italic">Scanning for open PIs...</div>
            ) : openPIs && openPIs.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  The following open PIs were found for this buyer and will be linked:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {openPIs.map((pi: any) => (
                    <div key={pi.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{pi.piNumber}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(pi.piDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="font-black text-slate-900">{pi.currency} {pi.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-500 uppercase">Total Linked Value:</span>
                  <span className="font-black text-emerald-600">
                    {openPIs[0]?.currency} {openPIs.reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-xs font-bold text-amber-700">No open PIs found for this buyer. You can still create the LC manually.</p>
              </div>
            )}
          </div>
        )}

        {/* Dates Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="font-black text-slate-700 text-sm uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-500" /> Key Dates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Issue Date</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                value={formData.issueDate} onChange={e => set('issueDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Expiry Date *</label>
              <input required type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                value={formData.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Received Date</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
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
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                value={formData.shipmentDate} onChange={e => set('shipmentDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Vessel Name</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                placeholder="e.g. MV Ocean Star" value={formData.vesselName} onChange={e => set('vesselName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Port of Loading</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                placeholder="e.g. Chittagong" value={formData.portOfLoading} onChange={e => set('portOfLoading', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Port of Destination</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800"
                placeholder="e.g. Rotterdam" value={formData.portOfDestination} onChange={e => set('portOfDestination', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Description / Notes</label>
              <textarea rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 resize-none"
                placeholder="Any additional notes about this LC..." value={formData.description} onChange={e => set('description', e.target.value)} />
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
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {createMutation.isPending ? 'Creating...' : 'Create Export LC'}
          </button>
        </div>
      </form>
    </div>
  );
}
