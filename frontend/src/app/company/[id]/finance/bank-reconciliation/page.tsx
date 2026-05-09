'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, Upload, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface BankReconciliation {
  id: string;
  reconciliationNumber: string;
  companyId: string;
  accountId: string;
  account?: { name: string };
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  status: string;
  notes: string | null;
  lines: any[];
  createdAt: string;
}

export default function BankReconciliationsPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<BankReconciliation | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  useEffect(() => { setMounted(true); }, []);

  const { data: reconciliationsRaw, isLoading } = useQuery({
    queryKey: ['bank-reconciliations', companyId],
    queryFn: () => api.get(`/company/${companyId}/bank-reconciliations`).then(r => r.data.data),
    enabled: !!companyId
  });
  const reconciliations: BankReconciliation[] = Array.isArray(reconciliationsRaw) ? reconciliationsRaw : [];

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', companyId],
    queryFn: () => api.get(`/company/${companyId}/accounts`).then(r => r.data.data),
    enabled: !!companyId
  });

  const bankAccounts = (Array.isArray(accounts) ? accounts : []).filter((a: any) => a.category === 'BANK');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/bank-reconciliations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', companyId] });
      toast.success('Bank reconciliation created');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.put(`/company/${companyId}/bank-reconciliations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', companyId] });
      toast.success('Updated');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company/${companyId}/bank-reconciliations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', companyId] });
      toast.success('Deleted');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/company/${companyId}/bank-reconciliations/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', companyId] });
      toast.success('Approved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) => 
      api.post(`/company/${companyId}/bank-reconciliations/${id}/match`, { accountId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', companyId] });
      toast.success('Transactions matched');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const filtered = reconciliations.filter((r: BankReconciliation) => 
    r.reconciliationNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => { setSelectedReconciliation(null); setViewMode('create'); setShowDetailPanel(true); };
  const handleView = (r: BankReconciliation) => { setSelectedReconciliation(r); setViewMode('view'); setShowDetailPanel(true); };
  const handleEdit = () => { setViewMode('edit'); };

  const fields: DetailField[] = viewMode === 'view' ? [
    { label: 'Number', value: selectedReconciliation?.reconciliationNumber || '-' },
    { label: 'Statement Date', value: selectedReconciliation ? new Date(selectedReconciliation.statementDate).toLocaleDateString() : '-', type: 'date' },
    { label: 'Bank Account', value: selectedReconciliation?.account?.name || '-' },
    { label: 'Statement Balance', value: selectedReconciliation?.statementBalance || 0, type: 'currency' },
    { label: 'Book Balance', value: selectedReconciliation?.bookBalance || 0, type: 'currency' },
    { label: 'Status', value: selectedReconciliation?.status || '-', type: 'status' as any },
    { label: 'Notes', value: selectedReconciliation?.notes || '-' }
  ] : [];

  const actions: DetailAction[] = viewMode === 'view' ? [
    ...(selectedReconciliation?.status === 'DRAFT' ? [
      { label: 'Match Transactions', onClick: () => selectedReconciliation && matchMutation.mutate({ id: selectedReconciliation.id, accountId: selectedReconciliation.accountId }), variant: 'primary' as const },
      { label: 'Approve', onClick: () => selectedReconciliation && approveMutation.mutate(selectedReconciliation.id), variant: 'secondary' as const },
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
        <h1 className="text-xl font-semibold">Bank Reconciliation</h1>
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bank</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Statement</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Book Balance</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No reconciliations found</td></tr>
                  ) : filtered.map((r: BankReconciliation) => (
                    <tr key={r.id} onClick={() => handleView(r)} className="border-t hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium">{r.reconciliationNumber}</td>
                      <td className="px-4 py-3 text-sm">{new Date(r.statementDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{r.account?.name}</td>
                      <td className="px-4 py-3 text-right text-sm">{r.statementBalance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm">{r.bookBalance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
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
        tabs={viewMode === 'view' ? [
          { id: 'details', label: 'Details', content: <div className="p-4 text-sm text-gray-500">Details view</div> }, 
          { id: 'lines', label: 'Items', content: <div className="p-4 text-sm text-gray-500">Items view</div> }
        ] : []}
        fields={fields}
        actions={actions}
      />
    </div>
  );
}