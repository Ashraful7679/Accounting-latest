'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, Building2, Eye, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { usePermissions } from '@/hooks/usePermissions';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
import { ConfirmModal } from '@/components/ConfirmModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AccountType {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  category?: string;
  cashFlowType?: string;
  parentId?: string | null;
  children?: Account[];
  createdAt?: string;
  updatedAt?: string;
}

export default function CompanyAccountsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { canCreate, canEdit, canDelete, canView } = usePermissions('finance.accounts', companyId);

  // Detail panel state
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');

  // Edit form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    accountTypeId: '',
    parentId: '',
    openingBalance: '0',
    cashFlowType: 'NONE',
    category: 'NONE',
    isActive: true,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['company-accounts', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/accounts?limit=500`);
      return response.data.data as Account[];
    },
    enabled: !!companyId,
  });

  const { data: accountTypesData } = useQuery({
    queryKey: ['account-types', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/account-types`);
      return response.data.data as AccountType[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        code: data.code || undefined,
        name: data.name,
        accountTypeId: data.accountTypeId,
        openingBalance: parseFloat(data.openingBalance),
        cashFlowType: data.cashFlowType,
        category: data.category,
        isActive: data.isActive,
      };
      if (data.parentId) payload.parentId = data.parentId;
      const response = await api.post(`/company/${companyId}/accounts`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-accounts', companyId] });
      toast.success('Account created successfully');
      setShowDetailPanel(false);
      setSelectedAccount(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create account');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!selectedAccount) return;
      const payload: any = {
        code: data.code || undefined,
        name: data.name,
        accountTypeId: data.accountTypeId,
        openingBalance: parseFloat(data.openingBalance),
        cashFlowType: data.cashFlowType,
        category: data.category,
        isActive: data.isActive,
      };
      if (data.parentId) payload.parentId = data.parentId;
      const response = await api.put(`/company/${companyId}/accounts/${selectedAccount.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-accounts', companyId] });
      toast.success('Account updated successfully');
      setViewMode('view');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update account');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/accounts/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-accounts', companyId] });
      toast.success('Account deleted successfully');
      setShowDetailPanel(false);
      setSelectedAccount(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete account');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/company/${companyId}/recalculate-balances`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['company-accounts', companyId] });
      toast.success(data.message || 'Balances synchronized');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to sync balances');
    },
  });

  const resetForm = () => {
    setFormData({ 
      code: '', 
      name: '', 
      accountTypeId: '', 
      parentId: '', 
      openingBalance: '0', 
      cashFlowType: 'NONE', 
      category: 'NONE',
      isActive: true 
    });
    setSelectedAccount(null);
  };

  const handleRowClick = (account: Account) => {
    setSelectedAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      accountTypeId: account.accountType.id,
      parentId: account.parentId || '',
      openingBalance: account.openingBalance.toString(),
      cashFlowType: account.cashFlowType || 'NONE',
      category: account.category || 'NONE',
      isActive: account.isActive,
    });
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const handleEdit = () => setViewMode('edit');
  const handleCancel = () => {
    if (selectedAccount) {
      setFormData({
        code: selectedAccount.code,
        name: selectedAccount.name,
        accountTypeId: selectedAccount.accountType.id,
        parentId: selectedAccount.parentId || '',
        openingBalance: selectedAccount.openingBalance.toString(),
        cashFlowType: selectedAccount.cashFlowType || 'NONE',
        category: selectedAccount.category || 'NONE',
        isActive: selectedAccount.isActive,
      });
    }
    setViewMode('view');
  };

  const handleSave = () => {
    if (viewMode === 'edit') {
      updateMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setShowDetailPanel(false);
    setSelectedAccount(null);
    setViewMode('view');
    resetForm();
  };

  const filteredAccounts = (Array.isArray(accountsData) ? accountsData : []).filter(a =>
    !searchTerm || 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group accounts by type
  const groupedAccounts = filteredAccounts.reduce((acc, account) => {
    const type = account.accountType?.name || 'Uncategorized';
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as { [key: string]: Account[] });

  const getDetailFields = (): DetailField[] => {
    if (!selectedAccount) return [];
    if (viewMode === 'edit') return [];

    return [
      { label: 'Account Code', value: selectedAccount.code },
      { label: 'Account Name', value: selectedAccount.name },
      { label: 'Account Type', value: selectedAccount.accountType?.name || '-' },
      { label: 'Cash Flow', value: selectedAccount.cashFlowType || 'NONE', type: 'select' as const },
      { label: 'Category', value: selectedAccount.category || 'NONE', type: 'select' as const },
      { label: 'Opening Balance', value: selectedAccount.openingBalance, type: 'currency' as const },
      { label: 'Current Balance', value: selectedAccount.currentBalance, type: 'currency' as const },
      { label: 'Status', value: selectedAccount.isActive ? 'Active' : 'Inactive', type: 'status' as const },
    ];
  };

  const getDetailActions = (): DetailAction[] => {
    if (!selectedAccount) return [];

    if (viewMode === 'edit') {
      return [
        { label: 'Save Changes', icon: Save, onClick: handleSave, variant: 'primary', loading: updateMutation.isPending },
        { label: 'Cancel', icon: X, onClick: handleCancel, variant: 'secondary' },
      ];
    }

const actions: DetailAction[] = [];
    if (canEdit) actions.push({ label: 'Edit Account', icon: Edit2, onClick: handleEdit, variant: 'secondary' });
    if (canDelete) actions.push({ label: 'Delete', icon: Trash2, onClick: () => setShowDeleteModal(true), variant: 'danger' });
    return actions;
  };

  const getEditTab = (): DetailTab | null => {
    if (!selectedAccount || viewMode !== 'edit') return null;

    return {
      id: 'edit',
      label: 'Edit Account',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Type *</label>
              <select
                value={formData.accountTypeId}
                onChange={(e) => setFormData({ ...formData, accountTypeId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              >
                <option value="">Select Type</option>
                {(Array.isArray(accountTypesData) ? accountTypesData : []).map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent Account</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="">No Parent (Root)</option>
                {(Array.isArray(accountsData) ? accountsData : []).filter(a => a.id !== selectedAccount?.id).map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cash Flow Category</label>
              <select
                value={formData.cashFlowType}
                onChange={(e) => setFormData({ ...formData, cashFlowType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="NONE">None (Default)</option>
                <option value="OPERATING">Operating Activity</option>
                <option value="INVESTING">Investing Activity</option>
                <option value="FINANCING">Financing Activity</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="NONE">None (Default)</option>
                <option value="CASH">CASH (Physical Cash)</option>
                <option value="BANK">BANK (Bank Accounts)</option>
                <option value="AR">AR (Accounts Receivable)</option>
                <option value="AP">AP (Accounts Payable)</option>
                <option value="REVENUE">REVENUE (Income/Sales)</option>
                <option value="EXPENSE">EXPENSE (Cost/Overhead)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium">Active Account</span>
              </label>
            </div>
          </div>
        </div>
      ),
    };
  };

  const getCreateTab = (): DetailTab | null => {
    if (!showDetailPanel || selectedAccount) return null;

    return {
      id: 'create',
      label: 'Create Account',
      content: (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Type *</label>
              <select
                value={formData.accountTypeId}
                onChange={(e) => setFormData({ ...formData, accountTypeId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                required
              >
                <option value="">Select Type</option>
                {(Array.isArray(accountTypesData) ? accountTypesData : []).map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                placeholder="Enter account name"
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parent Account</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="">No Parent (Root)</option>
                {(Array.isArray(accountsData) ? accountsData : []).map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cash Flow Category</label>
              <select
                value={formData.cashFlowType}
                onChange={(e) => setFormData({ ...formData, cashFlowType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="NONE">None (Default)</option>
                <option value="OPERATING">Operating Activity</option>
                <option value="INVESTING">Investing Activity</option>
                <option value="FINANCING">Financing Activity</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              >
                <option value="NONE">None (Default)</option>
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="AR">AR</option>
                <option value="AP">AP</option>
                <option value="REVENUE">REVENUE</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                value={formData.openingBalance}
                onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium">Active Account</span>
              </label>
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate(formData)}
            disabled={createMutation.isPending || !formData.name || !formData.accountTypeId}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Account'}
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
              <Building2 className="w-8 h-8 text-blue-600" />
              Financial Foundation
            </h1>
            <p className="text-slate-500 mt-1">Chart of Accounts & Ledger Structure</p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-all"
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync Balances'}
            </button>
            {canCreate && (
              <button
                onClick={() => {
                  resetForm();
                  setShowDetailPanel(true);
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-lg hover:shadow-blue-200 active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Account
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search accounts by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-20 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-400 mt-3">Loading accounts...</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {Object.entries(groupedAccounts).map(([type, accounts]) => (
                <div key={type} className="p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{type}</h3>
                  <div className="space-y-1">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        onClick={() => handleRowClick(account)}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm text-slate-500">{account.code}</span>
                          <span className="font-medium text-slate-900">{account.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded",
                            account.cashFlowType === 'OPERATING' ? 'bg-blue-100 text-blue-700' :
                            account.cashFlowType === 'INVESTING' ? 'bg-indigo-100 text-indigo-700' :
                            account.cashFlowType === 'FINANCING' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-500'
                          )}>
                            {account.cashFlowType || 'None'}
                          </span>
                          <span className="text-sm font-medium text-slate-900 text-right min-w-[100px]">
                            {account.currentBalance.toLocaleString()}
                          </span>
                          <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredAccounts.length === 0 && (
                <div className="p-20 text-center">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-900 font-bold">No accounts found</p>
                  <p className="text-slate-500 text-sm mt-1">Get started by adding your first account.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={showDetailPanel}
        onClose={handleClose}
        title={viewMode === 'edit' ? 'Edit Account' : (selectedAccount?.name || 'New Account')}
        subtitle={selectedAccount?.code || undefined}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={selectedAccount ? [getEditTab()].filter(Boolean) as DetailTab[] : (showDetailPanel && !selectedAccount) ? [getCreateTab()].filter(Boolean) as DetailTab[] : []}
        status={selectedAccount ? { value: selectedAccount.isActive ? 'active' : 'inactive', type: selectedAccount.isActive ? 'active' : 'inactive' } : undefined}
        metadata={selectedAccount?.createdAt ? { createdAt: selectedAccount.createdAt } : undefined}
        size="lg"
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Account"
        message={`Are you sure you want to delete "${selectedAccount?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => selectedAccount && deleteMutation.mutate(selectedAccount.id)}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}