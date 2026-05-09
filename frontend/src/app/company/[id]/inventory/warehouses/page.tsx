'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, Warehouse, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  companyId: string;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  isDefault: boolean;
  _count?: { productStock: number };
  createdAt: string;
}

export default function WarehousesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  useEffect(() => { setMounted(true); }, []);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses', companyId],
    queryFn: () => api.get(`/company/${companyId}/warehouses`).then(r => r.data),
    enabled: !!companyId
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Warehouse>) => api.post(`/company/${companyId}/warehouses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      toast.success('Warehouse created');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error creating warehouse')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Warehouse> }) => 
      api.put(`/company/${companyId}/warehouses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      toast.success('Warehouse updated');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error updating warehouse')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company/${companyId}/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', companyId] });
      toast.success('Warehouse deleted');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deleting warehouse')
  });

  const filtered = (Array.isArray(warehouses) ? warehouses : []).filter((w: Warehouse) => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => { setSelectedWarehouse(null); setViewMode('create'); setShowDetailPanel(true); };
  const handleView = (w: Warehouse) => { setSelectedWarehouse(w); setViewMode('view'); setShowDetailPanel(true); };
  const handleEdit = () => { setViewMode('edit'); };

  const tabs: DetailTab[] = [
    { id: 'details', label: 'Details', content: <div className="p-4 text-sm text-gray-500">Details view</div> },
    { id: 'stock', label: 'Stock', content: <div className="p-4 text-sm text-gray-500">Stock view</div> }
  ];

  const fields: DetailField[] = viewMode === 'view' ? [
    { label: 'Code', value: selectedWarehouse?.code || '-' },
    { label: 'Name', value: selectedWarehouse?.name || '-' },
    { label: 'Address', value: selectedWarehouse?.address || '-' },
    { label: 'City', value: selectedWarehouse?.city || '-' },
    { label: 'Country', value: selectedWarehouse?.country || '-' },
    { label: 'Active', value: selectedWarehouse?.isActive ? 'Yes' : 'No' },
    { label: 'Default Warehouse', value: selectedWarehouse?.isDefault ? 'Yes' : 'No' }
  ] : [];

  const actions: DetailAction[] = viewMode === 'view' ? [
    { label: 'Edit', onClick: handleEdit, variant: 'primary' as const },
    { label: 'Delete', onClick: () => selectedWarehouse && deleteMutation.mutate(selectedWarehouse.id), variant: 'danger' as const }
  ] : [
    { label: 'Save', onClick: () => {
      const data = { ...selectedWarehouse };
      if (viewMode === 'create') createMutation.mutate(data);
      else if (viewMode === 'edit' && selectedWarehouse) updateMutation.mutate({ id: selectedWarehouse.id, data });
    }, variant: 'primary' as const },
    { label: 'Cancel', onClick: () => setShowDetailPanel(false), variant: 'secondary' as const }
  ];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Warehouses</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Warehouse
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Location</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Default</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Active</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Products</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No warehouses found</td></tr>
                  ) : filtered.map((w: Warehouse) => (
                    <tr key={w.id} onClick={() => handleView(w)} className="border-t hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-sm">{w.code}</td>
                      <td className="px-4 py-3 text-sm font-medium">{w.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{[w.city, w.country].filter(Boolean).join(', ')}</td>
                      <td className="px-4 py-3 text-center">{w.isDefault ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Default</span> : '-'}</td>
                      <td className="px-4 py-3 text-center">{w.isActive ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Inactive</span>}</td>
                      <td className="px-4 py-3 text-right text-sm">{w._count?.productStock || 0}</td>
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
        title={viewMode === 'create' ? 'New Warehouse' : selectedWarehouse?.code || ''}
        tabs={viewMode === 'view' ? tabs : []}
        fields={fields}
        actions={actions}
      />
    </div>
  );
}