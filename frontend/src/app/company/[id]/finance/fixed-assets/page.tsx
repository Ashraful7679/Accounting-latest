'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, Loader2, TrendingDown, DollarSign } from 'lucide-react';
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
  name: string;
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

  const filtered = assets.filter((a: FixedAsset) => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.assetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => { setSelectedAsset(null); setViewMode('create'); setShowDetailPanel(true); };
  const handleView = (asset: FixedAsset) => { setSelectedAsset(asset); setViewMode('view'); setShowDetailPanel(true); };
  const handleEdit = () => { setViewMode('edit'); };

  const tabs: DetailTab[] = [
    { id: 'details', label: 'Details', content: <div className="p-4 text-sm text-gray-500">Details view</div> },
    { id: 'depreciation', label: 'Depreciation', content: <div className="p-4 text-sm text-gray-500">Depreciation schedule</div> }
  ];

  const totalDepreciation = selectedAsset?.depreciationEntries?.reduce((sum, d) => sum + d.depreciationAmount, 0) || 0;
  const bookValue = (selectedAsset?.purchaseValue || 0) - totalDepreciation;

  const fields: DetailField[] = viewMode === 'view' ? [
    { label: 'Asset Number', value: selectedAsset?.assetNumber || '-' },
    { label: 'Name', value: selectedAsset?.name || '-' },
    { label: 'Category', value: selectedAsset?.category || '-' },
    { label: 'Purchase Date', value: selectedAsset ? new Date(selectedAsset.purchaseDate).toLocaleDateString() : '-', type: 'date' },
    { label: 'Purchase Value', value: selectedAsset?.purchaseValue || 0, type: 'currency' },
    { label: 'Useful Life (Years)', value: selectedAsset?.usefulLife || 0 },
    { label: 'Salvage Value', value: selectedAsset?.salvageValue || 0, type: 'currency' },
    { label: 'Depreciation Method', value: selectedAsset?.depreciationMethod || '-' },
    { label: 'Status', value: selectedAsset?.status || '-', type: 'status' as any }
  ] : [];

  const actions: DetailAction[] = viewMode === 'view' ? [
    { label: 'Run Depreciation', onClick: () => setShowDepreciateModal(true), variant: 'primary' as const },
    ...(selectedAsset?.status === 'ACTIVE' ? [
      { label: 'Dispose', onClick: () => {
        const saleValue = prompt('Enter sale value:');
        if (saleValue && selectedAsset) disposeMutation.mutate({ id: selectedAsset.id, saleValue: parseFloat(saleValue) });
      }, variant: 'danger' as const }
    ] : []),
    { label: 'Edit', onClick: handleEdit, variant: 'secondary' as const },
    { label: 'Delete', onClick: () => selectedAsset && deleteMutation.mutate(selectedAsset.id), variant: 'danger' as const }
  ] : [
    { label: 'Save', onClick: () => {
      const data = { ...selectedAsset };
      if (viewMode === 'create') createMutation.mutate(data);
      else if (viewMode === 'edit' && selectedAsset) updateMutation.mutate({ id: selectedAsset.id, data });
    }, variant: 'primary' as const },
    { label: 'Cancel', onClick: () => setShowDetailPanel(false), variant: 'secondary' as const }
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
                    const dep = asset.depreciationEntries?.reduce((sum, d) => sum + d.depreciationAmount, 0) || 0;
                    const bv = asset.purchaseValue - dep;
                    return (
                      <tr key={asset.id} onClick={() => handleView(asset)} className="border-t hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3 text-sm font-medium">{asset.assetNumber}</td>
                        <td className="px-4 py-3 text-sm">{asset.name}</td>
                        <td className="px-4 py-3 text-sm">{asset.category}</td>
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
        onClose={() => setShowDetailPanel(false)}
        title={viewMode === 'create' ? 'New Asset' : selectedAsset?.assetNumber || ''}
        tabs={viewMode === 'view' ? tabs : []}
        fields={fields}
        actions={actions}
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
    </div>
  );
}