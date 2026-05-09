'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface StockTransfer {
  id: string;
  transferNumber: string;
  companyId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse?: { name: string };
  toWarehouse?: { name: string };
  transferDate: string;
  status: string;
  notes: string | null;
  lines: { id: string; productId: string; product: { name: string; code: string }; quantity: number }[];
  createdAt: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

export default function StockTransfersPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  useEffect(() => { setMounted(true); }, []);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['stock-transfers', companyId],
    queryFn: () => api.get(`/company/${companyId}/stock-transfers`).then(r => r.data.data),
    enabled: !!companyId
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => api.get(`/company/${companyId}/warehouses`).then(r => r.data.data),
    enabled: !!companyId
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => api.get(`/company/${companyId}/products`).then(r => r.data.data),
    enabled: !!companyId
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/stock-transfers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers', companyId] });
      toast.success('Stock transfer created');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating transfer')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.put(`/company/${companyId}/stock-transfers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers', companyId] });
      toast.success('Stock transfer updated');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error updating transfer')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company/${companyId}/stock-transfers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers', companyId] });
      toast.success('Transfer deleted');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deleting transfer')
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/company/${companyId}/stock-transfers/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers', companyId] });
      toast.success('Stock transferred successfully');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error approving transfer')
  });

  const filtered = (Array.isArray(transfers) ? transfers : []).filter((t: StockTransfer) => 
    t.transferNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => { setSelectedTransfer(null); setViewMode('create'); setShowDetailPanel(true); };
  const handleView = (t: StockTransfer) => { setSelectedTransfer(t); setViewMode('view'); setShowDetailPanel(true); };
  const handleEdit = () => { setViewMode('edit'); };

  const tabs: DetailTab[] = [
    { id: 'details', label: 'Details', content: <div className="p-4 text-sm text-gray-500">Details view</div> },
    { id: 'lines', label: 'Items', content: <div className="p-4 text-sm text-gray-500">Items view</div> }
  ];

  const totalQuantity = (Array.isArray(selectedTransfer?.lines) ? selectedTransfer.lines : []).reduce((sum, l) => sum + l.quantity, 0) || 0;

  const fields: DetailField[] = viewMode === 'view' ? [
    { label: 'Transfer #', value: selectedTransfer?.transferNumber || '-' },
    { label: 'Date', value: selectedTransfer ? new Date(selectedTransfer.transferDate).toLocaleDateString() : '-', type: 'date' },
    { label: 'From', value: selectedTransfer?.fromWarehouse?.name || '-' },
    { label: 'To', value: selectedTransfer?.toWarehouse?.name || '-' },
    { label: 'Status', value: selectedTransfer?.status || '-', type: 'status' as any },
    { label: 'Notes', value: selectedTransfer?.notes || '-' }
  ] : [];

  const actions: DetailAction[] = viewMode === 'view' ? [
    ...(selectedTransfer?.status === 'DRAFT' ? [
      { label: 'Approve & Transfer', onClick: () => selectedTransfer && approveMutation.mutate(selectedTransfer.id), variant: 'primary' as const },
      { label: 'Edit', onClick: handleEdit, variant: 'secondary' as const },
      { label: 'Delete', onClick: () => selectedTransfer && deleteMutation.mutate(selectedTransfer.id), variant: 'danger' as const }
    ] : [])
  ] : [
    { label: 'Save', onClick: () => {
      const data = { ...selectedTransfer };
      if (viewMode === 'create') createMutation.mutate(data);
      else if (viewMode === 'edit' && selectedTransfer) updateMutation.mutate({ id: selectedTransfer.id, data });
    }, variant: 'primary' as const },
    { label: 'Cancel', onClick: () => setShowDetailPanel(false), variant: 'secondary' as const }
  ];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Stock Transfers</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transfers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Transfer
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Transfer #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">From</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">To</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Items</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transfers found</td></tr>
                  ) : filtered.map((t: StockTransfer) => (
                    <tr key={t.id} onClick={() => handleView(t)} className="border-t hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium">{t.transferNumber}</td>
                      <td className="px-4 py-3 text-sm">{new Date(t.transferDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{t.fromWarehouse?.name}</td>
                      <td className="px-4 py-3 text-sm">{t.toWarehouse?.name}</td>
                      <td className="px-4 py-3 text-center text-sm">{(Array.isArray(t.lines) ? t.lines : []).length}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${t.status === 'TRANSFERRED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DetailPanel
        isOpen={showDetailPanel}
        onClose={() => setShowDetailPanel(false)}
        title={viewMode === 'create' ? 'New Transfer' : selectedTransfer?.transferNumber || ''}
        tabs={viewMode === 'view' ? tabs : []}
        fields={fields}
        actions={actions}
      />
    </div>
  );
}