'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  CreditCard, Plus, Search, Eye, Trash2,
  CheckCircle2, XCircle, Loader2, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface VendorCredit {
  id: string;
  vendorCreditNumber: string;
  companyId: string;
  vendorId: string;
  vendor?: { name: string } | null;
  creditDate: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalBDT: number;
  status: string;
  referenceNumber: string | null;
  notes: string | null;
  lines: VendorCreditLine[];
  createdAt: string;
}

interface VendorCreditLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export default function VendorCreditsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedVC, setSelectedVC] = useState<VendorCredit | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');

  const [formData, setFormData] = useState({
    vendorId: '',
    creditDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    currency: 'BDT',
    notes: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as VendorCreditLine[]
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: vendorCredits, isLoading } = useQuery({
    queryKey: ['vendor-credits', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendor-credits`);
      return response.data.data as VendorCredit[];
    },
    enabled: !!companyId,
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendors`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post(`/company/${companyId}/vendor-credits`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-credits', companyId] });
      toast.success('Vendor Credit created');
      setShowDetailPanel(false);
      setFormData({
        vendorId: '',
        creditDate: new Date().toISOString().split('T')[0],
        referenceNumber: '',
        currency: 'BDT',
        notes: '',
        lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }]
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (vcId: string) => {
      const response = await api.post(`/company/${companyId}/vendor-credits/${vcId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-credits', companyId] });
      toast.success('Vendor Credit approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (vcId: string) => {
      const response = await api.delete(`/company/${companyId}/vendor-credits/${vcId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-credits', companyId] });
      toast.success('Vendor Credit deleted');
      setShowDetailPanel(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const filteredVCs = (Array.isArray(vendorCredits) ? vendorCredits : []).filter((vc: VendorCredit) =>
    !searchTerm ||
    vc.vendorCreditNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vc.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vc.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleLineChange = (index: number, field: keyof VendorCreditLine, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'description') {
      const product = products?.find((p: any) => p.name === value);
      if (product) {
        newLines[index].unitPrice = product.unitPrice || 0;
      }
    }

    const qty = field === 'quantity' ? parseFloat(value) || 0 : newLines[index].quantity;
    const price = field === 'unitPrice' ? parseFloat(value) || 0 : newLines[index].unitPrice;
    const taxRate = field === 'taxRate' ? parseFloat(value) || 0 : newLines[index].taxRate;

    newLines[index].amount = qty * price * (1 + taxRate / 100);
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_: any, i: number) => i !== index)
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      APPROVED: 'bg-emerald-100 text-emerald-800',
      PAID: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const handleRowClick = (vc: VendorCredit) => {
    setSelectedVC(vc);
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const getDetailFields = (): DetailField[] => {
    if (!selectedVC) return [];
    return [
      { label: 'Vendor', value: selectedVC.vendor?.name || '-' },
      { label: 'Reference', value: selectedVC.referenceNumber || '-' },
      { label: 'Date', value: new Date(selectedVC.creditDate).toLocaleDateString() },
      { label: 'Currency', value: selectedVC.currency },
      { label: 'Subtotal', value: `${getCurrencySymbol(selectedVC.currency)}${selectedVC.subtotal.toFixed(2)}`, type: 'currency' },
      { label: 'Tax', value: `${getCurrencySymbol(selectedVC.currency)}${selectedVC.taxAmount.toFixed(2)}`, type: 'currency' },
      { label: 'Total', value: `${getCurrencySymbol(selectedVC.currency)}${selectedVC.totalBDT.toFixed(2)}`, type: 'currency' },
      { label: 'Notes', value: selectedVC.notes || '-' },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedVC) return [];
    if (selectedVC.status === 'DRAFT') {
      return [
        { label: 'Approve', icon: CheckCircle2, onClick: () => approveMutation.mutate(selectedVC.id), variant: 'success' },
        { label: 'Delete', icon: Trash2, onClick: () => deleteMutation.mutate(selectedVC.id), variant: 'danger' }
      ];
    }
    return [];
  };

  const getLinesTab = (): DetailTab => ({
    id: 'lines',
    label: `Lines (${selectedVC?.lines?.length || 0})`,
    content: (
      <div className="p-4">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Description</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Unit Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Tax %</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selectedVC?.lines?.map((line: VendorCreditLine, idx: number) => (
              <tr key={idx}>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right">{line.quantity}</td>
                <td className="px-3 py-2 text-right">{line.unitPrice.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{line.taxRate}%</td>
                <td className="px-3 py-2 text-right font-medium">{line.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  });

  const getCreateTab = (): DetailTab => ({
    id: 'create',
    label: 'New Vendor Credit',
    content: (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor *</label>
            <select
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">Select vendor</option>
              {(Array.isArray(vendors) ? vendors : []).map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Credit Date</label>
            <input
              type="date"
              value={formData.creditDate}
              onChange={(e) => setFormData({ ...formData, creditDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Reference</label>
            <input
              type="text"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="BDT">BDT</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Line Items</label>
            <button type="button" onClick={addLine} className="text-blue-600 text-xs font-bold hover:underline">
              + Add Line
            </button>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-slate-500">Description</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 w-20">Qty</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 w-24">Price</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 w-20">Tax %</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-slate-500 w-24">Amount</th>
                  <th className="px-1 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.lines.map((line: VendorCreditLine, idx: number) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        list="products-list"
                        value={line.description}
                        onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                      />
                      <datalist id="products-list">
                        {(Array.isArray(products) ? products : []).map((p: any) => (
                          <option key={p.id} value={p.name} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={line.taxRate}
                        onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-sm">
                      {line.amount.toFixed(2)}
                    </td>
                    <td className="px-1 py-2">
                      {formData.lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 p-1">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]"
          />
        </div>

        <button
          onClick={() => createMutation.mutate(formData)}
          disabled={createMutation.isPending || !formData.vendorId}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Vendor Credit'}
        </button>
      </div>
    ),
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            Vendor Credits
          </h1>
          <button
            onClick={() => {
              setSelectedVC(null);
              setShowDetailPanel(true);
              setViewMode('create');
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" /> New Vendor Credit
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendor credits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-20 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredVCs.length === 0 ? (
            <div className="p-20 text-center">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-900 font-bold">No vendor credits found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredVCs.map((vc: VendorCredit) => (
                <div
                  key={vc.id}
                  onClick={() => handleRowClick(vc)}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{vc.vendorCreditNumber}</div>
                      <div className="text-sm text-slate-500">{vc.vendor?.name || 'No vendor'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {vc.referenceNumber && <span className="text-sm text-slate-500">{vc.referenceNumber}</span>}
                    <span className="text-sm text-slate-500">{new Date(vc.creditDate).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900">{getCurrencySymbol(vc.currency)}{vc.totalBDT.toFixed(2)}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(vc.status)}`}>{vc.status}</span>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DetailPanel
        isOpen={showDetailPanel}
        onClose={() => { setShowDetailPanel(false); setSelectedVC(null); }}
        title={viewMode === 'create' ? 'New Vendor Credit' : (selectedVC?.vendorCreditNumber || '')}
        subtitle={selectedVC?.vendor?.name}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedVC ? [getLinesTab()] : (showDetailPanel && !selectedVC) ? [getCreateTab()] : []}
        size="lg"
      />
    </div>
  );
}