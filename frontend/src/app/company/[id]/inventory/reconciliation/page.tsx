'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface StockReconciliation {
  id: string;
  reconciliationNumber: string;
  companyId: string;
  warehouseId: string;
  warehouse?: { name: string };
  reconciliationDate: string;
  status: string;
  notes: string | null;
  lines: { id: string; productId: string; product: { name: string; code: string }; systemQuantity: number; physicalQuantity: number; variance: number; varianceReason: string | null }[];
  createdAt: string;
}

export default function StockReconciliationsPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<StockReconciliation | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  useEffect(() => { setMounted(true); }, []);

  const { data: reconciliations = [], isLoading } = useQuery({
    queryKey: ['stock-reconciliations', companyId],
    queryFn: () => api.get(`/company/${companyId}/stock-reconciliations`).then(r => r.data),
    enabled: !!companyId
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => api.get(`/company/${companyId}/warehouses`).then(r => r.data),
    enabled: !!companyId
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/stock-reconciliations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-reconciliations', companyId] });
      toast.success('Stock reconciliation created');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating reconciliation')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.put(`/company/${companyId}/stock-reconciliations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-reconciliations', companyId] });
      toast.success('Stock reconciliation updated');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error updating reconciliation')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company/${companyId}/stock-reconciliations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-reconciliations', companyId] });
      toast.success('Reconciliation deleted');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deleting reconciliation')
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/company/${companyId}/stock-reconciliations/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-reconciliations', companyId] });
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      toast.success('Stock reconciled successfully');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error approving reconciliation')
  });

  const filtered = reconciliations.filter((r: StockReconciliation) => 
    r.reconciliationNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => { setSelectedReconciliation(null); setViewMode('create'); setShowDetailPanel(true); };
  const handleView = (r: StockReconciliation) => { setSelectedReconciliation(r); setViewMode('view'); setShowDetailPanel(true); };
  const handleEdit = () => { setViewMode('edit'); };

  const tabs: DetailTab[] = [
    { id: 'details', label: 'Details', content: <div className="p-4 text-sm text-gray-500">Details view</div> },
    { id: 'lines', label: 'Variances', content: <div className="p-4 text-sm text-gray-500">Variances list</div> }
  ];

  const fields: DetailField[] = viewMode === 'view' ? [
    { label: 'Number', value: selectedReconciliation?.reconciliationNumber || '-' },
    { label: 'Date', value: selectedReconciliation ? new Date(selectedReconciliation.reconciliationDate).toLocaleDateString() : '-', type: 'date' },
    { label: 'Warehouse', value: selectedReconciliation?.warehouse?.name || '-' },
    { label: 'Status', value: selectedReconciliation?.status || '-', type: 'status' as any },
    { label: 'Notes', value: selectedReconciliation?.notes || '-' }
  ] : [];

  const actions: DetailAction[] = viewMode === 'view' ? [
    ...(selectedReconciliation?.status === 'DRAFT' ? [
      { label: 'Approve', onClick: () => selectedReconciliation && approveMutation.mutate(selectedReconciliation.id), variant: 'primary' as const },
      { label: 'Edit', onClick: handleEdit, variant: 'secondary' as const },
      { label: 'Delete', onClick: () => selectedReconciliation && deleteMutation.mutate(selectedReconciliation.id), variant: 'danger' as const }
    ] : [])
  ] : [
    { label: 'Save', onClick: () => {
      const data = { ...selectedReconciliation };
      if (viewMode === 'create') createMutation.mutate(data);
      else if (viewMode === 'edit' && selectedReconciliation) updateMutation.mutate({ id: selectedReconciliation.id, data });
    }, variant: 'primary' as const },
    { label: 'Cancel', onClick: () => setShowDetailPanel(false), variant: 'secondary' as const }
  ];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Stock Reconciliation</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Reconciliation
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Number</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Warehouse</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Items</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No reconciliations found</td></tr>
                  ) : filtered.map((r: StockReconciliation) => (
                    <tr key={r.id} onClick={() => handleView(r)} className="border-t hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium">{r.reconciliationNumber}</td>
                      <td className="px-4 py-3 text-sm">{new Date(r.reconciliationDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{r.warehouse?.name}</td>
                      <td className="px-4 py-3 text-center text-sm">{r.lines?.length || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {r.status}
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
        title={viewMode === 'create' ? 'New Reconciliation' : selectedReconciliation?.reconciliationNumber || ''}
        tabs={viewMode === 'view' ? tabs : []}
        fields={fields}
        actions={actions}
      />
    </div>
  );
}