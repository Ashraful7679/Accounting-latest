'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Eye, Trash2, 
  CheckCircle2, AlertCircle, XCircle, Package,
  RotateCw, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface DebitNote {
  id: string;
  debitNoteNumber: string;
  companyId: string;
  vendorId: string;
  vendor?: { name: string } | null;
  billId: string | null;
  purchaseOrderId: string | null;
  debitNoteDate: string;
  dueDate: string | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  totalForeign: number;
  totalBDT: number;
  status: string;
  reason: string | null;
  notes: string | null;
  returnToStock: boolean;
  lines: any[];
  createdAt: string;
}

const REASONS = [
  'Damaged Goods',
  'Wrong Item Delivered',
  'Price Dispute',
  'Quality Issues',
  'Short Delivery',
  'Other'
];

export default function DebitNotesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedDN, setSelectedDN] = useState<DebitNote | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');

  // Create form
  const [formData, setFormData] = useState({
    vendorId: '',
    billId: '',
    purchaseOrderId: '',
    debitNoteDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: 'BDT',
    exchangeRate: 1,
    reason: '',
    notes: '',
    returnToStock: true,
    lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0, productId: '' }]
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: debitNotes, isLoading } = useQuery({
    queryKey: ['debit-notes', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/debit-notes`);
      return response.data.data as DebitNote[];
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

  const { data: bills } = useQuery({
    queryKey: ['bills', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/bills`);
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

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/debit-notes`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes', companyId] });
      toast.success('Debit Note created');
      setShowDetailPanel(false);
      setFormData({
        vendorId: '',
        billId: '',
        purchaseOrderId: '',
        debitNoteDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        currency: 'BDT',
        exchangeRate: 1,
        reason: '',
        notes: '',
        returnToStock: true,
        lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0, productId: '' }]
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create Debit Note');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (dnId: string) => {
      const response = await api.post(`/company/${companyId}/debit-notes/${dnId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes', companyId] });
      toast.success('Debit Note approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (dnId: string) => {
      const response = await api.delete(`/company/${companyId}/debit-notes/${dnId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes', companyId] });
      toast.success('Debit Note deleted');
      setShowDetailPanel(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const filteredDNs = (Array.isArray(debitNotes) ? debitNotes : []).filter(dn =>
    !searchTerm || 
    dn.debitNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dn.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'itemDescription') {
      const product = products?.find((p: any) => p.name === value);
      if (product) {
        newLines[index].unitPrice = product.unitPrice || 0;
        newLines[index].productId = product.id;
      }
    }

    const qty = field === 'quantity' ? parseFloat(value) || 0 : newLines[index].quantity;
    const price = field === 'unitPrice' ? parseFloat(value) || 0 : newLines[index].unitPrice;
    const taxRate = field === 'taxRate' ? parseFloat(value) || 0 : newLines[index].taxRate;
    
    const subtotal = qty * price;
    const taxAmt = subtotal * (taxRate / 100);
    newLines[index].total = subtotal + taxAmt;

    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0, productId: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index)
    });
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => sum + (line.total || 0), 0);
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      DRAFT: { bg: 'bg-slate-50', text: 'text-slate-600', icon: FileText },
      APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
      PAID: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Loader2 },
      CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
    };
    const s = styles[status] || styles.DRAFT;
    const Icon = s.icon;
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', s.bg, s.text, s.border)}>
        <Icon className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  };

  const handleRowClick = (dn: DebitNote) => {
    setSelectedDN(dn);
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const getDetailFields = (): DetailField[] => {
    if (!selectedDN) return [];
    const currencySymbol = getCurrencySymbol(selectedDN.currency);
    return [
      { label: 'Debit Note #', value: selectedDN.debitNoteNumber },
      { label: 'Vendor', value: selectedDN.vendor?.name || '-' },
      { label: 'Date', value: new Date(selectedDN.debitNoteDate).toLocaleDateString(), type: 'date' },
      { label: 'Due Date', value: selectedDN.dueDate ? new Date(selectedDN.dueDate).toLocaleDateString() : '-', type: 'date' },
      { label: 'Subtotal', value: `${currencySymbol}${formatCurrency(selectedDN.subtotal)}`, type: 'currency' },
      { label: 'Tax', value: `${currencySymbol}${formatCurrency(selectedDN.taxAmount)}`, type: 'currency' },
      { label: 'Total', value: `${currencySymbol}${formatCurrency(selectedDN.totalBDT)}`, type: 'currency' },
      { label: 'Return to Stock', value: selectedDN.returnToStock ? 'Yes' : 'No' },
      { label: 'Reason', value: selectedDN.reason || '-' },
      { label: 'Status', value: getStatusBadge(selectedDN.status) },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedDN || viewMode === 'create') return [];

    const actions: DetailAction[] = [];

    if (selectedDN.status === 'DRAFT') {
      actions.push({ label: 'Approve', icon: CheckCircle2, onClick: () => approveMutation.mutate(selectedDN.id), variant: 'success' });
      actions.push({ label: 'Delete', icon: Trash2, onClick: () => {
        if (confirm('Delete this Debit Note?')) deleteMutation.mutate(selectedDN.id);
      }, variant: 'danger' });
    }

    return actions;
  };

  const getLinesTab = (): DetailTab => {
    return {
      id: 'lines',
      label: `Lines (${selectedDN?.lines?.length || 0})`,
      icon: Package,
      content: (
        <div className="p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Item</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Price</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Tax %</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedDN?.lines?.map((line: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{line.unitPrice}</td>
                  <td className="px-3 py-2 text-right">{line.taxRate}%</td>
                  <td className="px-3 py-2 text-right font-medium">{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    };
  };

  const getCreateTab = (): DetailTab => {
    return {
      id: 'create',
      label: 'New Debit Note',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor *</label>
              <select
                value={formData.vendorId}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              >
                <option value="">Select Vendor</option>
                {(Array.isArray(vendors) ? vendors : []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Related Bill</label>
              <select
                value={formData.billId}
                onChange={(e) => setFormData({ ...formData, billId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">None</option>
                {(Array.isArray(bills) ? bills : []).filter((b: any) => b.status === 'APPROVED').map((b: any) => (
                  <option key={b.id} value={b.id}>{b.billNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Related PO</label>
              <select
                value={formData.purchaseOrderId}
                onChange={(e) => setFormData({ ...formData, purchaseOrderId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">None</option>
                {(Array.isArray(purchaseOrders) ? purchaseOrders : []).map((po: any) => (
                  <option key={po.id} value={po.id}>{po.poNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
              <input
                type="date"
                value={formData.debitNoteDate}
                onChange={(e) => setFormData({ ...formData, debitNoteDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Return to Stock</label>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={formData.returnToStock}
                  onChange={(e) => setFormData({ ...formData, returnToStock: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Yes - Add goods back to inventory</span>
              </label>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Reason</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">Select Reason</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
              Line Items
              <button type="button" onClick={addLine} className="text-blue-600 text-xs font-bold">+ Add Line</button>
            </label>
            <div className="space-y-2 mt-2">
              {formData.lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      type="text"
                      list="products-list"
                      value={line.itemDescription}
                      onChange={(e) => handleLineChange(idx, 'itemDescription', e.target.value)}
                      placeholder="Select product or enter description"
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                    <datalist id="products-list">
                      {(Array.isArray(products) ? products : []).map((p: any) => <option key={p.id} value={p.name} />)}
                    </datalist>
                  </div>
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right"
                  />
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)}
                    placeholder="Price"
                    className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right"
                  />
                  <input
                    type="number"
                    value={line.taxRate}
                    onChange={(e) => handleLineChange(idx, 'taxRate', e.target.value)}
                    placeholder="Tax %"
                    className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right"
                  />
                  <span className="w-20 text-right font-medium text-sm">{line.total.toFixed(2)}</span>
                  {formData.lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(idx)} className="text-red-500 p-1">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <span className="font-bold">Total</span>
            <span className="font-bold text-lg">{getCurrencySymbol(formData.currency)}{calculateTotal().toFixed(2)}</span>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]"
            />
          </div>

          <button
            onClick={() => createMutation.mutate(formData)}
            disabled={createMutation.isPending || !formData.vendorId || formData.lines.some(l => !l.itemDescription || l.quantity <= 0)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Debit Note'}
          </button>
        </div>
      ),
    };
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <RotateCw className="w-8 h-8 text-blue-600" />
              Debit Notes
            </h1>
            <p className="text-slate-500 mt-1">Vendor returns / credit memos</p>
          </div>
          <button
            onClick={() => {
              setSelectedDN(null);
              setShowDetailPanel(true);
              setViewMode('create');
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Debit Note
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search debit notes..."
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
          ) : filteredDNs.length === 0 ? (
            <div className="p-20 text-center">
              <RotateCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-900 font-bold">No debit notes found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDNs.map((dn) => (
                <div
                  key={dn.id}
                  onClick={() => handleRowClick(dn)}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{dn.debitNoteNumber}</div>
                      <div className="text-sm text-slate-500">{dn.vendor?.name || 'No vendor'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{new Date(dn.debitNoteDate).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900">{getCurrencySymbol(dn.currency)}{dn.totalBDT.toFixed(2)}</span>
                    {getStatusBadge(dn.status)}
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
        onClose={() => { setShowDetailPanel(false); setSelectedDN(null); }}
        title={viewMode === 'create' ? 'New Debit Note' : (selectedDN?.debitNoteNumber || '')}
        subtitle={selectedDN?.vendor?.name}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedDN ? [getLinesTab()] : (showDetailPanel && !selectedDN) ? [getCreateTab()] : []}
        status={selectedDN ? { value: selectedDN.status.toLowerCase() as any, type: selectedDN.status.toLowerCase() as any } : undefined}
        size="lg"
      />
    </div>
  );
}