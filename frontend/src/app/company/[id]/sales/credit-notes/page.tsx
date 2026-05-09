'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  RotateCw, Plus, Search, Eye, Trash2, 
  CheckCircle2, XCircle, Package,
  Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  companyId: string;
  customerId: string;
  customer?: { name: string } | null;
  invoiceId: string | null;
  salesOrderId: string | null;
  creditNoteDate: string;
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

export default function CreditNotesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedCN, setSelectedCN] = useState<CreditNote | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');

  const [formData, setFormData] = useState({
    customerId: '',
    invoiceId: '',
    salesOrderId: '',
    creditNoteDate: new Date().toISOString().split('T')[0],
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

  const { data: creditNotes, isLoading } = useQuery({
    queryKey: ['credit-notes', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/credit-notes`);
      return response.data.data as CreditNote[];
    },
    enabled: !!companyId,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/invoices?type=SALES`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders`);
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
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/credit-notes`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes', companyId] });
      toast.success('Credit Note created');
      setShowDetailPanel(false);
      setFormData({
        customerId: '', invoiceId: '', salesOrderId: '',
        creditNoteDate: new Date().toISOString().split('T')[0],
        dueDate: '', currency: 'BDT', exchangeRate: 1,
        reason: '', notes: '', returnToStock: true,
        lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0, productId: '' }]
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (cnId: string) => {
      const response = await api.post(`/company/${companyId}/credit-notes/${cnId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes', companyId] });
      toast.success('Credit Note approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (cnId: string) => {
      const response = await api.delete(`/company/${companyId}/credit-notes/${cnId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes', companyId] });
      toast.success('Credit Note deleted');
      setShowDetailPanel(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const filteredCNs = (Array.isArray(creditNotes) ? creditNotes : []).filter(cn =>
    !searchTerm || 
    cn.creditNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cn.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleRowClick = (cn: CreditNote) => {
    setSelectedCN(cn);
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      DRAFT: { bg: 'bg-slate-50', text: 'text-slate-600', icon: Loader2 },
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

  const getDetailFields = (): DetailField[] => {
    if (!selectedCN) return [];
    const currencySymbol = getCurrencySymbol(selectedCN.currency);
    return [
      { label: 'Credit Note #', value: selectedCN.creditNoteNumber },
      { label: 'Customer', value: selectedCN.customer?.name || '-' },
      { label: 'Date', value: new Date(selectedCN.creditNoteDate).toLocaleDateString(), type: 'date' },
      { label: 'Due Date', value: selectedCN.dueDate ? new Date(selectedCN.dueDate).toLocaleDateString() : '-', type: 'date' },
      { label: 'Subtotal', value: `${currencySymbol}${formatCurrency(selectedCN.subtotal)}`, type: 'currency' },
      { label: 'Tax', value: `${currencySymbol}${formatCurrency(selectedCN.taxAmount)}`, type: 'currency' },
      { label: 'Total', value: `${currencySymbol}${formatCurrency(selectedCN.totalBDT)}`, type: 'currency' },
      { label: 'Return to Stock', value: selectedCN.returnToStock ? 'Yes' : 'No' },
      { label: 'Reason', value: selectedCN.reason || '-' },
      { label: 'Status', value: getStatusBadge(selectedCN.status) },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedCN) return [];
    const actions: DetailAction[] = [];

    if (selectedCN.status === 'DRAFT') {
      actions.push({ label: 'Approve', icon: CheckCircle2, onClick: () => approveMutation.mutate(selectedCN.id), variant: 'success' });
      actions.push({ label: 'Delete', icon: Trash2, onClick: () => {
        if (confirm('Delete this Credit Note?')) deleteMutation.mutate(selectedCN.id);
      }, variant: 'danger' });
    }

    return actions;
  };

  const getLinesTab = (): DetailTab => {
    return {
      id: 'lines',
      label: `Lines (${selectedCN?.lines?.length || 0})`,
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
              {selectedCN?.lines?.map((line: any, idx: number) => (
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
      label: 'New Credit Note',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Customer *</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              >
                <option value="">Select Customer</option>
                {(Array.isArray(customers) ? customers : []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Related Invoice</label>
              <select
                value={formData.invoiceId}
                onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">None</option>
                {(Array.isArray(invoices) ? invoices : []).filter((i: any) => i.status === 'APPROVED').map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Related SO</label>
              <select
                value={formData.salesOrderId}
                onChange={(e) => setFormData({ ...formData, salesOrderId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">None</option>
                {(Array.isArray(salesOrders) ? salesOrders : []).map((so: any) => <option key={so.id} value={so.id}>{so.soNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
              <input
                type="date"
                value={formData.creditNoteDate}
                onChange={(e) => setFormData({ ...formData, creditNoteDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={formData.returnToStock}
                  onChange={(e) => setFormData({ ...formData, returnToStock: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Return goods to stock</span>
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
            disabled={createMutation.isPending || !formData.customerId || formData.lines.some(l => !l.itemDescription || l.quantity <= 0)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Credit Note'}
          </button>
        </div>
      ),
    };
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <RotateCw className="w-8 h-8 text-blue-600" />
            Credit Notes
          </h1>
          <button
            onClick={() => {
              setSelectedCN(null);
              setShowDetailPanel(true);
              setViewMode('create');
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" /> New Credit Note
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search credit notes..."
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
          ) : filteredCNs.length === 0 ? (
            <div className="p-20 text-center">
              <RotateCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-900 font-bold">No credit notes found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCNs.map((cn) => (
                <div
                  key={cn.id}
                  onClick={() => handleRowClick(cn)}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{cn.creditNoteNumber}</div>
                      <div className="text-sm text-slate-500">{cn.customer?.name || 'No customer'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{new Date(cn.creditNoteDate).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900">{getCurrencySymbol(cn.currency)}{cn.totalBDT.toFixed(2)}</span>
                    {getStatusBadge(cn.status)}
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
        onClose={() => { setShowDetailPanel(false); setSelectedCN(null); }}
        title={selectedCN?.creditNoteNumber || 'New Credit Note'}
        subtitle={selectedCN?.customer?.name}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedCN ? [getLinesTab()] : (showDetailPanel && !selectedCN) ? [getCreateTab()] : []}
        status={selectedCN ? { value: selectedCN.status.toLowerCase() as any, type: selectedCN.status.toLowerCase() as any } : undefined}
        size="lg"
      />
    </div>
  );
}