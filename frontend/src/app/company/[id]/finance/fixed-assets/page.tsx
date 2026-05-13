'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, Loader2, TrendingDown, DollarSign, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
import { ConfirmModal } from '@/components/ConfirmModal';

const ASSET_CATEGORIES = [
  { value: 'BUILDING', label: 'Building' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'COMPUTER', label: 'Computer' },
  { value: 'OTHER', label: 'Other' }
];

const DEPRECIATION_METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Straight Line' },
  { value: 'REDUCING_BALANCE', label: 'Reducing Balance' }
];

interface FixedAsset {
  id: string;
  assetNumber: string;
  companyId: string;
  assetName: string;
  description: string | null;
  category: string;
  purchaseDate: string;
  purchaseValue: number;
  currency: string;
  usefulLife: number;
  salvageValue: number;
  depreciationMethod: string;
  depreciationRate: number;
  status: string;
  accumulatedDepreciation: number;
  currentValue: number;
  depreciationEntries: any[];
  createdAt: string;
}

export default function FixedAssetsPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');
  const [showDepreciateModal, setShowDepreciateModal] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);

  const [formData, setFormData] = useState({
    assetName: '',
    description: '',
    category: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseValue: '0',
    salvageValue: '0',
    usefulLife: '5',
    depreciationMethod: 'STRAIGHT_LINE',
    depreciationRate: '20',
  });

  useEffect(() => { setMounted(true); }, []);

  const { data: assetsRaw, isLoading } = useQuery({
    queryKey: ['fixed-assets', companyId],
    queryFn: () => api.get(`/company/${companyId}/fixed-assets`).then(r => r.data.data),
    enabled: !!companyId
  });
  const assets: FixedAsset[] = Array.isArray(assetsRaw) ? assetsRaw : [];

  const runDepreciation = async () => {
    try {
      const response = await api.post(`/company/${companyId}/fixed-assets/run-depreciation`);
      toast.success(`Depreciation completed: ${response.data.data?.depreciated?.length || 0} assets`);
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to run depreciation');
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/fixed-assets`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      toast.success('Asset created');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.put(`/company/${companyId}/fixed-assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      toast.success('Asset updated');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company/${companyId}/fixed-assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      toast.success('Asset deleted');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const disposeMutation = useMutation({
    mutationFn: ({ id, saleValue }: { id: string; saleValue: number }) => 
      api.post(`/company/${companyId}/fixed-assets/${id}/dispose`, { saleValue, createJournal: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets', companyId] });
      toast.success('Asset disposed');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const resetForm = () => {
    setFormData({
      assetName: '',
      description: '',
      category: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseValue: '0',
      salvageValue: '0',
      usefulLife: '5',
      depreciationMethod: 'STRAIGHT_LINE',
      depreciationRate: '20',
    });
  };

  const handleCreate = () => {
    resetForm();
    setSelectedAsset(null);
    setViewMode('create');
    setShowDetailPanel(true);
  };

  const handleView = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setFormData({
      assetName: asset.assetName,
      description: asset.description || '',
      category: asset.category || '',
      purchaseDate: new Date(asset.purchaseDate).toISOString().split('T')[0],
      purchaseValue: asset.purchaseValue.toString(),
      salvageValue: asset.salvageValue.toString(),
      usefulLife: asset.usefulLife.toString(),
      depreciationMethod: asset.depreciationMethod || 'STRAIGHT_LINE',
      depreciationRate: (asset.depreciationRate || 20).toString(),
    });
    setViewMode('view');
    setShowDetailPanel(true);
  };

  const handleEdit = () => setViewMode('edit');

  const handleCancel = () => {
    if (selectedAsset) {
      setFormData({
        assetName: selectedAsset.assetName,
        description: selectedAsset.description || '',
        category: selectedAsset.category || '',
        purchaseDate: new Date(selectedAsset.purchaseDate).toISOString().split('T')[0],
        purchaseValue: selectedAsset.purchaseValue.toString(),
        salvageValue: selectedAsset.salvageValue.toString(),
        usefulLife: selectedAsset.usefulLife.toString(),
        depreciationMethod: selectedAsset.depreciationMethod || 'STRAIGHT_LINE',
        depreciationRate: (selectedAsset.depreciationRate || 20).toString(),
      });
    }
    setViewMode('view');
  };

  const handleClose = () => {
    setShowDetailPanel(false);
    setSelectedAsset(null);
    setViewMode('view');
    resetForm();
  };

  const filtered = assets.filter((a: FixedAsset) => 
    a.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.assetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDetailFields = (): DetailField[] => {
    if (!selectedAsset || viewMode !== 'view') return [];
    const totalDep = selectedAsset.accumulatedDepreciation || 0;
    const bookVal = (selectedAsset.purchaseValue || 0) - totalDep;
    return [
      { label: 'Asset Number', value: selectedAsset.assetNumber },
      { label: 'Name', value: selectedAsset.assetName },
      { label: 'Description', value: selectedAsset.description || '-' },
      { label: 'Category', value: selectedAsset.category || '-' },
      { label: 'Purchase Date', value: selectedAsset.purchaseDate, type: 'date' as const },
      { label: 'Purchase Value', value: selectedAsset.purchaseValue, type: 'currency' as const },
      { label: 'Salvage Value', value: selectedAsset.salvageValue, type: 'currency' as const },
      { label: 'Useful Life', value: `${selectedAsset.usefulLife} years` },
      { label: 'Depreciation Method', value: selectedAsset.depreciationMethod?.replace('_', ' ') || '-' },
      { label: 'Accumulated Depreciation', value: totalDep, type: 'currency' as const },
      { label: 'Current / Book Value', value: bookVal, type: 'currency' as const },
      { label: 'Status', value: selectedAsset.status, type: 'status' as const },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedAsset && viewMode !== 'create') return [];

    if (viewMode === 'view' && selectedAsset) {
      return [
        { label: 'Run Depreciation', onClick: () => setShowDepreciateModal(true), variant: 'primary' as const },
        ...(selectedAsset.status === 'ACTIVE' || selectedAsset.status === 'APPROVED' ? [
          { label: 'Dispose', onClick: () => {
            setShowDisposeModal(true);
          }, variant: 'danger' as const }
        ] : []),
        { label: 'Edit', onClick: handleEdit, variant: 'secondary' as const },
        { label: 'Delete', onClick: () => selectedAsset && deleteMutation.mutate(selectedAsset.id), variant: 'danger' as const }
      ];
    }

    if (viewMode === 'edit' && selectedAsset) {
      return [
        { label: 'Save Changes', icon: Save, onClick: () => handleSaveEdit(), variant: 'primary' as const, loading: updateMutation.isPending },
        { label: 'Cancel', icon: X, onClick: handleCancel, variant: 'secondary' as const },
      ];
    }

    return [];
  };

  const handleSaveCreate = () => {
    const payload = {
      assetName: formData.assetName,
      description: formData.description || null,
      category: formData.category || null,
      purchaseDate: new Date(formData.purchaseDate).toISOString(),
      purchaseValue: parseFloat(formData.purchaseValue) || 0,
      salvageValue: parseFloat(formData.salvageValue) || 0,
      usefulLife: parseInt(formData.usefulLife) || 5,
      depreciationMethod: formData.depreciationMethod,
      depreciationRate: parseFloat(formData.depreciationRate) || 0,
    };
    createMutation.mutate(payload);
  };

  const handleSaveEdit = () => {
    if (!selectedAsset) return;
    const payload = {
      assetName: formData.assetName,
      description: formData.description || null,
      category: formData.category || null,
      purchaseDate: new Date(formData.purchaseDate).toISOString(),
      purchaseValue: parseFloat(formData.purchaseValue) || 0,
      salvageValue: parseFloat(formData.salvageValue) || 0,
      usefulLife: parseInt(formData.usefulLife) || 5,
      depreciationMethod: formData.depreciationMethod,
      depreciationRate: parseFloat(formData.depreciationRate) || 0,
    };
    updateMutation.mutate({ id: selectedAsset.id, data: payload });
  };

  const getCreateTab = (): DetailTab | null => {
    if (viewMode !== 'create') return null;
    return {
      id: 'create',
      label: 'New Asset',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asset Name *</label>
              <input
                type="text"
                value={formData.assetName}
                onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                placeholder="Enter asset name"
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              >
                <option value="">Select Category</option>
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Date *</label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Value *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.purchaseValue}
                onChange={(e) => setFormData({ ...formData, purchaseValue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salvage Value</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.salvageValue}
                onChange={(e) => setFormData({ ...formData, salvageValue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Useful Life (Years) *</label>
              <input
                type="number"
                min="1"
                value={formData.usefulLife}
                onChange={(e) => setFormData({ ...formData, usefulLife: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depreciation Method</label>
              <select
                value={formData.depreciationMethod}
                onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                {DEPRECIATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            {formData.depreciationMethod === 'REDUCING_BALANCE' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depreciation Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.depreciationRate}
                  onChange={(e) => setFormData({ ...formData, depreciationRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                />
              </div>
            )}
          </div>
          <button
            onClick={handleSaveCreate}
            disabled={createMutation.isPending || !formData.assetName || !formData.category}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Asset'}
          </button>
        </div>
      ),
    };
  };

  const getEditTab = (): DetailTab | null => {
    if (viewMode !== 'edit' || !selectedAsset) return null;
    return {
      id: 'edit',
      label: 'Edit Asset',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Asset Name *</label>
              <input
                type="text"
                value={formData.assetName}
                onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="">Select Category</option>
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Date *</label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Value *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.purchaseValue}
                onChange={(e) => setFormData({ ...formData, purchaseValue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salvage Value</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.salvageValue}
                onChange={(e) => setFormData({ ...formData, salvageValue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Useful Life (Years) *</label>
              <input
                type="number"
                min="1"
                value={formData.usefulLife}
                onChange={(e) => setFormData({ ...formData, usefulLife: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depreciation Method</label>
              <select
                value={formData.depreciationMethod}
                onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                {DEPRECIATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            {formData.depreciationMethod === 'REDUCING_BALANCE' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depreciation Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.depreciationRate}
                  onChange={(e) => setFormData({ ...formData, depreciationRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                />
              </div>
            )}
          </div>
        </div>
      ),
    };
  };

  const tabs: DetailTab[] = [
    {
      id: 'details',
      label: 'Details',
      content: viewMode === 'create' ? (getCreateTab()?.content || null) : viewMode === 'edit' ? (getEditTab()?.content || null) : (
        <div className="p-4 space-y-4">
          {selectedAsset && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Asset Number</span>
                <p className="text-sm font-medium">{selectedAsset.assetNumber}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Name</span>
                <p className="text-sm font-medium">{selectedAsset.assetName}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Category</span>
                <p className="text-sm font-medium">{selectedAsset.category || '-'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Purchase Date</span>
                <p className="text-sm font-medium">{new Date(selectedAsset.purchaseDate).toLocaleDateString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Purchase Value</span>
                <p className="text-sm font-medium">{formatCurrency(selectedAsset.purchaseValue)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Current / Book Value</span>
                <p className="text-sm font-medium">{formatCurrency(selectedAsset.currentValue || selectedAsset.purchaseValue)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Salvage Value</span>
                <p className="text-sm font-medium">{formatCurrency(selectedAsset.salvageValue)}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Useful Life</span>
                <p className="text-sm font-medium">{selectedAsset.usefulLife} years</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Depreciation Method</span>
                <p className="text-sm font-medium">{selectedAsset.depreciationMethod?.replace('_', ' ') || '-'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                <p className="text-sm font-medium">{selectedAsset.status}</p>
              </div>
            </div>
          )}
        </div>
      )
    },
    { id: 'depreciation', label: 'Depreciation', content: <div className="p-4 text-sm text-gray-500">Depreciation schedule</div> }
  ];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Fixed Assets</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Asset #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Purchase Date</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Purchase Value</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Book Value</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No assets found</td></tr>
                  ) : filtered.map((asset: FixedAsset) => {
                    const bv = asset.currentValue || asset.purchaseValue;
                    return (
                      <tr key={asset.id} onClick={() => handleView(asset)} className="border-t hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3 text-sm font-medium">{asset.assetNumber}</td>
                        <td className="px-4 py-3 text-sm">{asset.assetName}</td>
                        <td className="px-4 py-3 text-sm">{asset.category || '-'}</td>
                        <td className="px-4 py-3 text-sm">{new Date(asset.purchaseDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right text-sm">{asset.purchaseValue.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium">{bv.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${asset.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {asset.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DetailPanel
        isOpen={showDetailPanel}
        onClose={handleClose}
        title={viewMode === 'create' ? 'New Asset' : selectedAsset?.assetNumber || ''}
        subtitle={viewMode === 'view' ? selectedAsset?.assetName : undefined}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={tabs}
        size="lg"
      />

      <ConfirmModal
        isOpen={showDepreciateModal}
        title="Run Depreciation"
        message="Run depreciation for all active assets? This will create journal entries."
        confirmLabel="Run"
        variant="warning"
        isLoading={false}
        onConfirm={() => { setShowDepreciateModal(false); runDepreciation(); }}
        onCancel={() => setShowDepreciateModal(false)}
      />

      <ConfirmModal
        isOpen={showDisposeModal}
        title="Dispose Asset"
        message={`Enter sale value for ${selectedAsset?.assetName || 'this asset'}:`}
        confirmLabel="Dispose"
        variant="danger"
        isLoading={disposeMutation.isPending}
        onConfirm={async () => {
          if (selectedAsset) {
            const saleValue = prompt('Enter sale value:');
            if (saleValue) {
              disposeMutation.mutate({ id: selectedAsset.id, saleValue: parseFloat(saleValue) });
            }
          }
          setShowDisposeModal(false);
        }}
        onCancel={() => setShowDisposeModal(false)}
      />
    </div>
  );
}