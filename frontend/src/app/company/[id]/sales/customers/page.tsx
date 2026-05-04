'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
import { Plus, Trash2, Edit, Search, Building2, Eye, Save, X, User } from 'lucide-react';

interface Customer {
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
  openingBalance: number;
  balanceType?: string | null;
  preferredCurrency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  createdAt?: string;
}

export default function CompanyCustomersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
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
    balanceType: 'DR',
    preferredCurrency: 'BDT',
    exchangeRate: 1,
    paymentTerms: 'COD',
    isActive: true,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['company-customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data as Customer[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post(`/company/${companyId}/customers`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer created');
      setShowDetailPanel(false);
      setFormData({
        name: '', email: '', phone: '', address: '', city: '', country: '',
        contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'DR',
        preferredCurrency: 'BDT', exchangeRate: 1, paymentTerms: 'COD', isActive: true
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.put(`/company/${companyId}/customers/${selectedCustomer?.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer updated');
      setViewMode('view');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/customers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer deleted');
      setShowDetailPanel(false);
      setSelectedCustomer(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const filteredCustomers = customers?.filter(c =>
    !searchTerm || 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      country: customer.country || '',
      contactPerson: customer.contactPerson || '',
      tinVat: customer.tinVat || '',
      openingBalance: customer.openingBalance || 0,
      balanceType: customer.balanceType || 'DR',
      preferredCurrency: customer.preferredCurrency || 'BDT',
      exchangeRate: customer.exchangeRate || 1,
      paymentTerms: customer.paymentTerms || 'COD',
      isActive: customer.isActive,
    });
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const handleEdit = () => setViewMode('edit');
  const handleCancel = () => {
    if (selectedCustomer) {
      setFormData({
        name: selectedCustomer.name,
        email: selectedCustomer.email || '',
        phone: selectedCustomer.phone || '',
        address: selectedCustomer.address || '',
        city: selectedCustomer.city || '',
        country: selectedCustomer.country || '',
        contactPerson: selectedCustomer.contactPerson || '',
        tinVat: selectedCustomer.tinVat || '',
        openingBalance: selectedCustomer.openingBalance || 0,
        balanceType: selectedCustomer.balanceType || 'DR',
        preferredCurrency: selectedCustomer.preferredCurrency || 'BDT',
        exchangeRate: selectedCustomer.exchangeRate || 1,
        paymentTerms: selectedCustomer.paymentTerms || 'COD',
        isActive: selectedCustomer.isActive,
      });
    }
    setViewMode('view');
  };

  const handleSave = () => updateMutation.mutate(formData);

  const getDetailFields = (): DetailField[] => {
    if (!selectedCustomer) return [];
    return [
      { label: 'Customer Code', value: selectedCustomer.code },
      { label: 'Customer Name', value: selectedCustomer.name },
      { label: 'Contact Person', value: selectedCustomer.contactPerson || '-' },
      { label: 'Email', value: selectedCustomer.email || '-' },
      { label: 'Phone', value: selectedCustomer.phone || '-' },
      { label: 'Address', value: selectedCustomer.address || '-' },
      { label: 'City', value: selectedCustomer.city || '-' },
      { label: 'Country', value: selectedCustomer.country || '-' },
      { label: 'TIN/VAT', value: selectedCustomer.tinVat || '-' },
      { label: 'Payment Terms', value: selectedCustomer.paymentTerms || 'COD' },
      { label: 'Opening Balance', value: `${selectedCustomer.openingBalance || 0} ${selectedCustomer.balanceType || 'DR'}`, type: 'text' },
      { label: 'Currency', value: selectedCustomer.preferredCurrency || 'BDT' },
      { label: 'Status', value: selectedCustomer.isActive ? 'Active' : 'Inactive', type: 'status' },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedCustomer || viewMode === 'create') return [];
    if (viewMode === 'edit') {
      return [
        { label: 'Save Changes', icon: Save, onClick: handleSave, variant: 'primary', loading: updateMutation.isPending },
        { label: 'Cancel', icon: X, onClick: handleCancel, variant: 'secondary' },
      ];
    }
    return [
      { label: 'Edit', icon: Edit, onClick: handleEdit, variant: 'secondary' },
      { label: 'Delete', icon: Trash2, onClick: () => {
        if (confirm('Delete this customer?')) deleteMutation.mutate(selectedCustomer.id);
      }, variant: 'danger' },
    ];
  };

  const getEditTab = (): DetailTab | null => {
    if (!selectedCustomer || viewMode !== 'edit') return null;
    return {
      id: 'edit',
      label: 'Edit Customer',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Name *</label>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              >
                <option value="COD">COD</option>
                <option value="NET15">NET 15</option>
                <option value="NET30">NET 30</option>
                <option value="NET45">NET 45</option>
                <option value="NET60">NET 60</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Address</label>
              <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
              <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Country</label>
              <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Currency</label>
              <select value={formData.preferredCurrency} onChange={(e) => setFormData({ ...formData, preferredCurrency: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                <option value="BDT">BDT</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Balance Type</label>
              <select value={formData.balanceType} onChange={(e) => setFormData({ ...formData, balanceType: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                <option value="DR">Debit (Receivable)</option><option value="CR">Credit (Payable)</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-medium">Active Customer</span>
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
      label: 'New Customer',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Person</label>
              <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
              <select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                <option value="COD">COD</option><option value="NET15">NET 15</option><option value="NET30">NET 30</option><option value="NET45">NET 45</option><option value="NET60">NET 60</option>
              </select>
            </div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div className="col-span-2"><label className="text-[10px] font-bold text-slate-400 uppercase">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Country</label><input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Currency</label>
              <select value={formData.preferredCurrency} onChange={(e) => setFormData({ ...formData, preferredCurrency: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                <option value="BDT">BDT</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Balance Type</label>
              <select value={formData.balanceType} onChange={(e) => setFormData({ ...formData, balanceType: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg">
                <option value="DR">Debit (Receivable)</option><option value="CR">Credit (Payable)</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm font-medium">Active Customer</span>
              </label>
            </div>
          </div>
          <button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || !formData.name} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Creating...' : 'Create Customer'}
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
            <User className="w-8 h-8 text-blue-600" />
            Customer Master
          </h1>
          <button onClick={() => { setFormData({ name: '', email: '', phone: '', address: '', city: '', country: '', contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'DR', preferredCurrency: 'BDT', exchangeRate: 1, paymentTerms: 'COD', isActive: true }); setSelectedCustomer(null); setShowDetailPanel(true); setViewMode('create'); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700">
            <Plus className="w-5 h-5" /> Add Customer
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Search customers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl" />
            </div>
          </div>

          {isLoading ? (
            <div className="p-20 text-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-20 text-center"><User className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-900 font-bold">No customers found</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} onClick={() => handleRowClick(customer)} className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div><div className="font-bold text-slate-900">{customer.name}</div><div className="text-sm text-slate-500">{customer.code}</div></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{customer.email || '-'}</span>
                    <span className="font-bold text-slate-900">{getCurrencySymbol(customer.preferredCurrency)}{customer.openingBalance?.toLocaleString()}</span>
                    <span className={cn("text-xs px-2 py-1 rounded", customer.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500')}>{customer.isActive ? 'Active' : 'Inactive'}</span>
                    <Eye className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DetailPanel isOpen={showDetailPanel} onClose={() => { setShowDetailPanel(false); setSelectedCustomer(null); setViewMode('view'); }} title={viewMode === 'edit' ? 'Edit Customer' : (selectedCustomer?.name || 'New Customer')} subtitle={selectedCustomer?.code} fields={getDetailFields()} actions={getDetailActions()} tabs={selectedCustomer ? [getEditTab()].filter(Boolean) as DetailTab[] : (showDetailPanel && !selectedCustomer) ? [getCreateTab()] : []} status={selectedCustomer ? { value: selectedCustomer.isActive ? 'active' : 'inactive' } : undefined} metadata={selectedCustomer?.createdAt ? { createdAt: selectedCustomer.createdAt } : undefined} size="lg" />
    </div>
  );
}