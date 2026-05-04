'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
import { Plus, Trash2, Edit, Search, Building2, Eye, Save, X } from 'lucide-react';

interface Vendor {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  contactPerson?: string | null;
  tinVat?: string | null;
  openingBalance?: number;
  balanceType?: string | null;
  preferredCurrency?: string;
  exchangeRate?: number;
  createdAt?: string;
}

export default function CompanyVendorsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create' | 'edit'>('view');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    contactPerson: '',
    tinVat: '',
    openingBalance: 0,
    balanceType: 'CR',
    preferredCurrency: 'BDT',
    exchangeRate: 1,
    isActive: true,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['company-vendors', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendors`);
      return response.data.data as Vendor[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post(`/company/${companyId}/vendors`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vendors', companyId] });
      toast.success('Vendor created');
      setShowDetailPanel(false);
      setFormData({
        name: '', email: '', phone: '', address: '', city: '', country: '',
        contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'CR',
        preferredCurrency: 'BDT', exchangeRate: 1, isActive: true
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.put(`/company/${companyId}/vendors/${selectedVendor?.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vendors', companyId] });
      toast.success('Vendor updated');
      setViewMode('view');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/vendors/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vendors', companyId] });
      toast.success('Vendor deleted');
      setShowDetailPanel(false);
      setSelectedVendor(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const filteredVendors = vendors?.filter(v =>
    !searchTerm || 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleRowClick = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      country: vendor.country || '',
      contactPerson: vendor.contactPerson || '',
      tinVat: vendor.tinVat || '',
      openingBalance: vendor.openingBalance || 0,
      balanceType: vendor.balanceType || 'CR',
      preferredCurrency: vendor.preferredCurrency || 'BDT',
      exchangeRate: vendor.exchangeRate || 1,
      isActive: vendor.isActive,
    });
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const handleEdit = () => setViewMode('edit');
  const handleCancel = () => {
    if (selectedVendor) {
      setFormData({
        name: selectedVendor.name,
        email: selectedVendor.email || '',
        phone: selectedVendor.phone || '',
        address: selectedVendor.address || '',
        city: selectedVendor.city || '',
        country: selectedVendor.country || '',
        contactPerson: selectedVendor.contactPerson || '',
        tinVat: selectedVendor.tinVat || '',
        openingBalance: selectedVendor.openingBalance || 0,
        balanceType: selectedVendor.balanceType || 'CR',
        preferredCurrency: selectedVendor.preferredCurrency || 'BDT',
        exchangeRate: selectedVendor.exchangeRate || 1,
        isActive: selectedVendor.isActive,
      });
    }
    setViewMode('view');
  };

  const handleSave = () => updateMutation.mutate(formData);

  const getDetailFields = (): DetailField[] => {
    if (!selectedVendor) return [];
    return [
      { label: 'Vendor Code', value: selectedVendor.code },
      { label: 'Vendor Name', value: selectedVendor.name },
      { label: 'Contact Person', value: selectedVendor.contactPerson || '-' },
      { label: 'Email', value: selectedVendor.email || '-' },
      { label: 'Phone', value: selectedVendor.phone || '-' },
      { label: 'Address', value: selectedVendor.address || '-' },
      { label: 'City', value: selectedVendor.city || '-' },
      { label: 'Country', value: selectedVendor.country || '-' },
      { label: 'TIN/VAT', value: selectedVendor.tinVat || '-' },
      { label: 'Opening Balance', value: `${selectedVendor.openingBalance || 0} ${selectedVendor.balanceType || 'CR'}`, type: 'text' },
      { label: 'Currency', value: selectedVendor.preferredCurrency || 'BDT' },
      { label: 'Status', value: selectedVendor.isActive ? 'Active' : 'Inactive', type: 'status' },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedVendor || viewMode === 'create') return [];
    if (viewMode === 'edit') {
      return [
        { label: 'Save Changes', icon: Save, onClick: handleSave, variant: 'primary', loading: updateMutation.isPending },
        { label: 'Cancel', icon: X, onClick: handleCancel, variant: 'secondary' },
      ];
    }
    return [
      { label: 'Edit Vendor', icon: Edit, onClick: handleEdit, variant: 'secondary' },
      { label: 'Delete', icon: Trash2, onClick: () => {
        if (confirm('Delete this vendor?')) deleteMutation.mutate(selectedVendor.id);
      }, variant: 'danger' },
    ];
  };

  const getEditTab = (): DetailTab | null => {
    if (!selectedVendor || viewMode !== 'edit') return null;
    return {
      id: 'edit',
      label: 'Edit Vendor',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">TIN/VAT</label>
              <input
                type="text"
                value={formData.tinVat}
                onChange={(e) => setFormData({ ...formData, tinVat: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Currency</label>
              <select
                value={formData.preferredCurrency}
                onChange={(e) => setFormData({ ...formData, preferredCurrency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Balance Type</label>
              <select
                value={formData.balanceType}
                onChange={(e) => setFormData({ ...formData, balanceType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="CR">Credit (Receivable)</option>
                <option value="DR">Debit (Payable)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Active Vendor</span>
              </label>
            </div>
          </div>
        </div>
      ),
    };
  };

  const getCreateTab = (): DetailTab => {
    return {
      id: 'create',
      label: 'New Vendor',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                placeholder="Enter vendor name"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">TIN/VAT</label>
              <input
                type="text"
                value={formData.tinVat}
                onChange={(e) => setFormData({ ...formData, tinVat: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Currency</label>
              <select
                value={formData.preferredCurrency}
                onChange={(e) => setFormData({ ...formData, preferredCurrency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="BDT">BDT</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Balance Type</label>
              <select
                value={formData.balanceType}
                onChange={(e) => setFormData({ ...formData, balanceType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="CR">Credit (Receivable)</option>
                <option value="DR">Debit (Payable)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Active Vendor</span>
              </label>
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate(formData)}
            disabled={createMutation.isPending || !formData.name}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Vendor'}
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
            <Building2 className="w-8 h-8 text-blue-600" />
            Vendor Master
          </h1>
          <button
            onClick={() => {
              setFormData({
                name: '', email: '', phone: '', address: '', city: '', country: '',
                contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'CR',
                preferredCurrency: 'BDT', exchangeRate: 1, isActive: true
              });
              setSelectedVendor(null);
              setShowDetailPanel(true);
              setViewMode('create');
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" /> Add Vendor
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search vendors..."
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
          ) : filteredVendors.length === 0 ? (
            <div className="p-20 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-900 font-bold">No vendors found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  onClick={() => handleRowClick(vendor)}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{vendor.name}</div>
                      <div className="text-sm text-slate-500">{vendor.code}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{vendor.email || '-'}</span>
                    <span className="font-bold text-slate-900">
                      {getCurrencySymbol(vendor.preferredCurrency)}{vendor.openingBalance?.toLocaleString()}
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                    )}>
                      {vendor.isActive ? 'Active' : 'Inactive'}
                    </span>
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
        onClose={() => { setShowDetailPanel(false); setSelectedVendor(null); setViewMode('view'); }}
        title={viewMode === 'edit' ? 'Edit Vendor' : (selectedVendor?.name || 'New Vendor')}
        subtitle={selectedVendor?.code}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedVendor ? [getEditTab()].filter(Boolean) as DetailTab[] : (showDetailPanel && !selectedVendor) ? [getCreateTab()] : []}
        status={selectedVendor ? { value: selectedVendor.isActive ? 'active' : 'inactive' } : undefined}
        metadata={selectedVendor?.createdAt ? { createdAt: selectedVendor.createdAt } : undefined}
        size="lg"
      />
    </div>
  );
}