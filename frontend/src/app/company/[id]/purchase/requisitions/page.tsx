'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  FileText, Plus, Search, Eye, Edit2, Trash2, 
  CheckCircle2, AlertCircle, XCircle, ArrowRight,
  Package, Loader2, Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
import { ConfirmModal } from '@/components/ConfirmModal';

interface PurchaseRequisition {
  id: string;
  prNumber: string;
  companyId: string;
  supplierId: string | null;
  supplier?: { name: string } | null;
  prDate: string;
  expectedDate: string | null;
  currency: string;
  exchangeRate: number;
  totalForeign: number;
  totalBDT: number;
  status: string;
  notes: string | null;
  purchaseOrderId: string | null;
  lines: any[];
  createdAt: string;
}

export default function PurchaseRequisitionsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  // Create form
  const [formData, setFormData] = useState({
    supplierId: '',
    prDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    currency: 'BDT',
    exchangeRate: 1,
    notes: '',
    lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }]
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: requisitions, isLoading } = useQuery({
    queryKey: ['purchase-requisitions', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-requisitions`);
      return response.data.data as PurchaseRequisition[];
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
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/purchase-requisitions`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions', companyId] });
      toast.success('Purchase Requisition created');
      setShowDetailPanel(false);
      setFormData({
        supplierId: '',
        prDate: new Date().toISOString().split('T')[0],
        expectedDate: '',
        currency: 'BDT',
        exchangeRate: 1,
        notes: '',
        lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }]
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create requisition');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (prId: string) => {
      const response = await api.post(`/company/${companyId}/purchase-requisitions/${prId}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions', companyId] });
      toast.success('Requisition submitted for approval');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (prId: string) => {
      const response = await api.post(`/company/${companyId}/purchase-requisitions/${prId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions', companyId] });
      toast.success('Requisition approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (prId: string) => {
      const response = await api.delete(`/company/${companyId}/purchase-requisitions/${prId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions', companyId] });
      toast.success('Requisition deleted');
      setShowDetailPanel(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const filteredPRs = (Array.isArray(requisitions) ? requisitions : []).filter(pr =>
    !searchTerm || 
    pr.prNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pr.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleRowClick = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setShowDetailPanel(true);
    setViewMode('view');
  };

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

    if (field === 'quantity' || field === 'unitPrice') {
      newLines[index].total = newLines[index].quantity * newLines[index].unitPrice;
    }

    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { itemDescription: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }]
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
      PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Loader2 },
      APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
      REJECTED: { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle },
      CONVERTED: { bg: 'bg-blue-50', text: 'text-blue-700', icon: ArrowRight },
      CANCELLED: { bg: 'bg-slate-50', text: 'text-slate-500', icon: XCircle },
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
    if (!selectedPR) return [];
    const currencySymbol = getCurrencySymbol(selectedPR.currency);
    return [
      { label: 'PR Number', value: selectedPR.prNumber },
      { label: 'Supplier', value: selectedPR.supplier?.name || '-' },
      { label: 'Date', value: new Date(selectedPR.prDate).toLocaleDateString(), type: 'date' },
      { label: 'Expected Date', value: selectedPR.expectedDate ? new Date(selectedPR.expectedDate).toLocaleDateString() : '-', type: 'date' },
      { label: 'Total', value: `${currencySymbol}${formatCurrency(selectedPR.totalBDT)}`, type: 'currency' },
      { label: 'Status', value: getStatusBadge(selectedPR.status) },
      { label: 'Notes', value: selectedPR.notes || '-' },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedPR) return [];
    if (viewMode === 'create') return [];

    const actions: DetailAction[] = [];

    if (selectedPR.status === 'DRAFT') {
      actions.push({ label: 'Submit', icon: Send, onClick: () => submitMutation.mutate(selectedPR.id), variant: 'primary' });
      actions.push({ label: 'Delete', icon: Trash2, onClick: () => setShowDeleteModal(true), variant: 'danger' });
    }
    if (selectedPR.status === 'PENDING') {
      actions.push({ label: 'Approve', icon: CheckCircle2, onClick: () => approveMutation.mutate(selectedPR.id), variant: 'success' });
    }

    return actions;
  };

  const getLinesTab = (): DetailTab => {
    return {
      id: 'lines',
      label: `Lines (${selectedPR?.lines?.length || 0})`,
      icon: Package,
      content: (
        <div className="p-4">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Item</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Unit Price</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedPR?.lines?.map((line: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-3 py-2">{line.itemDescription}</td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{line.unitPrice}</td>
                  <td className="px-3 py-2 text-right font-medium">{line.total}</td>
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
      label: 'New Requisition',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Supplier</label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="">Select Supplier</option>
                {(Array.isArray(vendors) ? vendors : []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
              <input
                type="date"
                value={formData.prDate}
                onChange={(e) => setFormData({ ...formData, prDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Expected Date</label>
              <input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
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
                    onChange={(e) => handleLineChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="Qty"
                    className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right"
                  />
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    placeholder="Price"
                    className="w-24 px-2 py-2 border border-slate-200 rounded-lg text-sm text-right"
                  />
                  <span className="w-24 text-right font-medium text-sm">{line.total.toFixed(2)}</span>
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
            disabled={createMutation.isPending || formData.lines.some(l => !l.itemDescription || l.quantity <= 0)}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Requisition'}
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
              <FileText className="w-8 h-8 text-blue-600" />
              Purchase Requisitions
            </h1>
            <p className="text-slate-500 mt-1">Request and approve purchases before creating POs</p>
          </div>
          <button
            onClick={() => {
              setFormData({
                supplierId: '',
                prDate: new Date().toISOString().split('T')[0],
                expectedDate: '',
                currency: 'BDT',
                exchangeRate: 1,
                notes: '',
                lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }]
              });
              setSelectedPR(null);
              setShowDetailPanel(true);
              setViewMode('create');
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Requisition
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search requisitions..."
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
          ) : filteredPRs.length === 0 ? (
            <div className="p-20 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-900 font-bold">No requisitions found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPRs.map((pr) => (
                <div
                  key={pr.id}
                  onClick={() => handleRowClick(pr)}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{pr.prNumber}</div>
                      <div className="text-sm text-slate-500">{pr.supplier?.name || 'No supplier'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{new Date(pr.prDate).toLocaleDateString()}</span>
                    <span className="font-bold text-slate-900">{getCurrencySymbol(pr.currency)}{pr.totalBDT.toFixed(2)}</span>
                    {getStatusBadge(pr.status)}
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
        onClose={() => { setShowDetailPanel(false); setSelectedPR(null); }}
        title={viewMode === 'create' ? 'New Requisition' : (selectedPR?.prNumber || '')}
        subtitle={selectedPR?.supplier?.name}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedPR ? [getLinesTab()] : (showDetailPanel && !selectedPR) ? [getCreateTab()] : []}
        status={selectedPR ? { value: selectedPR.status.toLowerCase() as any, type: selectedPR.status.toLowerCase() as any } : undefined}
        size="lg"
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Requisition"
        message="Are you sure you want to delete this requisition? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedPR && deleteMutation.mutate(selectedPR.id)}
        onCancel={() => { setShowDeleteModal(false); }}
      />
    </div>
  );
}