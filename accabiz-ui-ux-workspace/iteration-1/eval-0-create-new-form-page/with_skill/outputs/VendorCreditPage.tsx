'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  CreditCard, Plus, Search, Eye, Trash2,
  CheckCircle2, AlertCircle, XCircle, Package,
  RotateCw, Loader2, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface VendorCredit {
  id: string;
  vendorCreditNumber: string;
  companyId: string;
  vendorId: string;
  vendor?: { name: string; code: string } | null;
  billId: string | null;
  purchaseOrderId: string | null;
  creditDate: string;
  dueDate: string | null;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  totalForeign: number;
  totalBDT: number;
  status: string;
  referenceNumber: string | null;
  reason: string | null;
  notes: string | null;
  returnToStock: boolean;
  lines: VendorCreditLine[];
  createdAt: string;
}

interface VendorCreditLine {
  id?: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  productId?: string;
}

const REASONS = [
  'Damaged Goods',
  'Wrong Item Delivered',
  'Price Dispute',
  'Quality Issues',
  'Short Delivery',
  'Other'
];

export default function VendorCreditsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedVC, setSelectedVC] = useState<VendorCredit | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  const [formData, setFormData] = useState({
    vendorId: '',
    billId: '',
    purchaseOrderId: '',
    creditDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: 'BDT',
    exchangeRate: 1,
    referenceNumber: '',
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
      const response = await api.post(`/company/${companyId}/vendor-credits`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-credits', companyId] });
      toast.success('Vendor Credit created');
      setShowDetailPanel(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create Vendor Credit');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/vendor-credits/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-credits', companyId] });
      toast.success('Vendor Credit updated');
      setViewMode('view');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update Vendor Credit');
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

  const resetForm = () => {
    setFormData({
      vendorId: '',
      billId: '',
      purchaseOrderId: '',
      creditDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      currency: 'BDT',
      exchangeRate: 1,
      referenceNumber: '',
      reason: '',
      notes: '',
      returnToStock: true,
      lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0, productId: '' }]
    });
  };

  const filteredVCs = (Array.isArray(vendorCredits) ? vendorCredits : []).filter(vc =>
    !searchTerm ||
    vc.vendorCreditNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vc.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vc.referenceNumber && vc.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()))
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

  const handleRowClick = (vc: VendorCredit) => {
    setSelectedVC(vc);
    setViewMode('view');
    setShowDetailPanel(true);
  };

  const handleEdit = () => {
    setViewMode('edit');
    setFormData({
      vendorId: selectedVC?.vendorId || '',
      billId: selectedVC?.billId || '',
      purchaseOrderId: selectedVC?.purchaseOrderId || '',
      creditDate: selectedVC?.creditDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      dueDate: selectedVC?.dueDate?.split('T')[0] || '',
      currency: selectedVC?.currency || 'BDT',
      exchangeRate: selectedVC?.exchangeRate || 1,
      referenceNumber: selectedVC?.referenceNumber || '',
      reason: selectedVC?.reason || '',
      notes: selectedVC?.notes || '',
      returnToStock: selectedVC?.returnToStock ?? true,
      lines: selectedVC?.lines?.length > 0 ? selectedVC.lines : [{ itemDescription: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0, productId: '' }]
    });
  };

  const handleClose = () => {
    setShowDetailPanel(false);
    setSelectedVC(null);
    setViewMode('view');
    resetForm();
  };

  const getDetailFields = (): DetailField[] => {
    if (!selectedVC) return [];
    return [
      { label: 'Vendor', value: selectedVC.vendor?.name || '-' },
      { label: 'Reference', value: selectedVC.referenceNumber || '-' },
      { label: 'Credit Date', value: new Date(selectedVC.creditDate).toLocaleDateString() },
      { label: 'Currency', value: selectedVC.currency },
      { label: 'Exchange Rate', value: selectedVC.exchangeRate },
      { label: 'Subtotal', value: `${getCurrencySymbol(selectedVC.currency)}${selectedVC.subtotal.toFixed(2)}`, type: 'currency' },
      { label: 'Tax Amount', value: `${getCurrencySymbol(selectedVC.currency)}${selectedVC.taxAmount.toFixed(2)}`, type: 'currency' },
      { label: 'Total', value: `${getCurrencySymbol(selectedVC.currency)}${selectedVC.totalBDT.toFixed(2)}`, type: 'currency' },
      { label: 'Reason', value: selectedVC.reason || '-' },
      { label: 'Notes', value: selectedVC.notes || '-' },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedVC) return [];
    const actions: DetailAction[] = [];

    if (viewMode === 'view') {
      actions.push(
        { label: 'Edit', icon: Trash2, onClick: handleEdit, variant: 'secondary' }
      );
      if (selectedVC.status === 'DRAFT') {
        actions.push(
          { label: 'Approve', icon: CheckCircle2, onClick: () => approveMutation.mutate(selectedVC.id), variant: 'success' }
        );
        actions.push(
          { label: 'Delete', icon: Trash2, onClick: () => deleteMutation.mutate(selectedVC.id), variant: 'danger' }
        );
      }
    } else if (viewMode === 'edit') {
      actions.push(
        { label: 'Cancel', icon: XCircle, onClick: () => { setViewMode('view'); resetForm(); }, variant: 'secondary' }
      );
      actions.push(
        { label: 'Save', icon: CheckCircle2, onClick: () => updateMutation.mutate({ id: selectedVC.id, data: formData }), variant: 'primary', loading: updateMutation.isPending }
      );
    }

    return actions;
  };

  const getEditTab = (): DetailTab | null => {
    if (!selectedVC) return null;
    return {
      id: 'edit',
      label: viewMode === 'edit' ? 'Edit' : 'Details',
      content: viewMode === 'edit' ? getCreateForm() : getViewContent(),
    };
  };

  const getCreateTab = (): DetailTab => {
    return {
      id: 'create',
      label: 'New Vendor Credit',
      content: getCreateForm(),
    };
  };

  const getViewContent = () => {
    if (!selectedVC) return null;
    return (
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Line Items</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Unit Price</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Tax %</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVC.lines?.map((line, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{line.itemDescription}</td>
                      <td className="px-3 py-2 text-right">{line.quantity}</td>
                      <td className="px-3 py-2 text-right">{line.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{line.taxRate}%</td>
                      <td className="px-3 py-2 text-right font-medium">{line.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {selectedVC.notes && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Notes</h4>
            <p className="text-sm text-slate-600">{selectedVC.notes}</p>
          </div>
        )}
      </div>
    );
  };

  const getCreateForm = () => {
    const filteredVendors = (Array.isArray(vendors) ? vendors : []).filter((v: any) =>
      v.name.toLowerCase().includes(formData.vendorId.toLowerCase()) || !formData.vendorId
    );

    const selectedVendor = (Array.isArray(vendors) ? vendors : []).find((v: any) => v.id === formData.vendorId);
    const vendorBills = (Array.isArray(bills) ? bills : []).filter((b: any) => b.vendorId === formData.vendorId && b.status === 'APPROVED') || [];
    const vendorPOs = (Array.isArray(purchaseOrders) ? purchaseOrders : []).filter((po: any) => po.supplierId === formData.vendorId && (po.status === 'SENT' || po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED')) || [];

    return (
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor *</label>
            <select
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value, billId: '', purchaseOrderId: '' })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">Select vendor...</option>
              {(Array.isArray(vendors) ? vendors : []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
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
            <label className="text-[10px] font-bold text-slate-400 uppercase">Reference Number</label>
            <input
              type="text"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              placeholder="Enter reference number"
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
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          {formData.currency !== 'BDT' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Exchange Rate</label>
              <input
                type="number"
                step="0.01"
                value={formData.exchangeRate}
                onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Link to Bill</label>
            <select
              value={formData.billId}
              onChange={(e) => setFormData({ ...formData, billId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">None</option>
              {vendorBills.map((b: any) => <option key={b.id} value={b.id}>{b.billNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Link to PO</label>
            <select
              value={formData.purchaseOrderId}
              onChange={(e) => setFormData({ ...formData, purchaseOrderId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">None</option>
              {vendorPOs.map((po: any) => <option key={po.id} value={po.id}>{po.poNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Reason</label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="">Select reason...</option>
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
          {createMutation.isPending ? 'Creating...' : 'Create Vendor Credit'}
        </button>
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-blue-600" />
              Vendor Credits
            </h1>
            <p className="text-slate-500 mt-1">Manage vendor credit memos</p>
          </div>
          <button
            onClick={() => {
              setSelectedVC(null);
              setShowDetailPanel(true);
              setViewMode('create');
              resetForm();
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2"
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
              {filteredVCs.map((vc) => (
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
                    {vc.referenceNumber && <span className="text-sm text-slate-500">Ref: {vc.referenceNumber}</span>}
                    <span className="text-sm text-slate-500">{new Date(vc.creditDate).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900">{getCurrencySymbol(vc.currency)}{vc.totalBDT.toFixed(2)}</span>
                    {getStatusBadge(vc.status)}
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
        onClose={handleClose}
        title={viewMode === 'create' ? 'New Vendor Credit' : (selectedVC?.vendorCreditNumber || 'Vendor Credit')}
        subtitle={selectedVC?.vendor?.name}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedVC ? [getEditTab()].filter(Boolean) as DetailTab[] : (showDetailPanel && !selectedVC) ? [getCreateTab()] : []}
        status={selectedVC ? { value: selectedVC.status.toLowerCase(), type: selectedVC.status === 'APPROVED' ? 'approved' : selectedVC.status === 'DRAFT' ? 'draft' : 'pending' as any } : undefined}
        metadata={selectedVC?.createdAt ? { createdAt: selectedVC.createdAt } : undefined}
        size="lg"
      />
    </div>
  );
}