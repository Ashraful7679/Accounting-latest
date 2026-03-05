'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, ArrowLeft, LogOut, Building2, Bell, RefreshCw, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Sidebar from '@/components/Sidebar';
import UserDropdown from '@/components/UserDropdown';

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
  cashFlowType?: string;
  parentId?: string | null;
  children?: Account[];
}

export default function CompanyAccountsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    accountTypeId: '',
    parentId: '',
    openingBalance: '0',
    cashFlowType: 'NONE'
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['company-accounts', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/accounts?limit=100`);
      return response.data.data as Account[];
    },
    enabled: !!companyId,
  });

  const { data: accountTypesData } = useQuery({
    queryKey: ['account-types'],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/account-types`);
      return response.data.data as AccountType[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        ...data,
        openingBalance: parseFloat(data.openingBalance),
      };
      if (!payload.parentId) delete payload.parentId;
      const response = await api.post(`/company/${companyId}/accounts`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-accounts', companyId] });
      toast.success('Account created successfully');
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create account');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = {
        ...data,
        openingBalance: parseFloat(data.openingBalance),
      };
      if (!payload.parentId) delete payload.parentId;
      const response = await api.put(`/company/${companyId}/accounts/${selectedAccount?.id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-accounts', companyId] });
      toast.success('Account updated successfully');
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update account');
    },
  });

  const resetForm = () => {
    setFormData({ code: '', name: '', accountTypeId: '', parentId: '', openingBalance: '0', cashFlowType: 'NONE' });
    setSelectedAccount(null);
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/company/${companyId}/heal-balances`);
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

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const generateCode = (typeName: string) => {
    const prefix = typeName.slice(0, 1);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${random}`;
  };

  const handleTypeChange = (typeId: string) => {
    setFormData({ ...formData, accountTypeId: typeId, code: '' });
  };

  const handleParentChange = (parentId: string) => {
    if (parentId) {
      const parent = accountsData?.find(a => a.id === parentId);
      if (parent) {
        setFormData({ ...formData, parentId, code: '' });
      }
    } else {
      setFormData({ ...formData, parentId: '', code: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAccount) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (account: Account) => {
    setSelectedAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      accountTypeId: account.accountType.id,
      parentId: account.parentId || '',
      openingBalance: account.openingBalance.toString(),
      cashFlowType: account.cashFlowType || 'NONE'
    });
    setShowModal(true);
  };

  const groupedAccounts = accountsData?.reduce((acc, account) => {
    const type = account.accountType.name;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as { [key: string]: Account[] });

  const buildAccountTree = (accounts: Account[]): Account[] => {
    const accountMap = new Map<string, Account>();
    const roots: Account[] = [];
    
    accounts.forEach(account => {
      accountMap.set(account.id, { ...account, children: [] });
    });
    
    accounts.forEach(account => {
      const node = accountMap.get(account.id)!;
      if (account.parentId && accountMap.has(account.parentId)) {
        accountMap.get(account.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    
    return roots;
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderAccountTree = (accounts: Account[], level: number = 0): React.ReactNode => {
    return accounts.map(account => {
      const hasChildren = account.children && account.children.length > 0;
      const isExpanded = expandedNodes.has(account.id);
      
      return (
        <React.Fragment key={account.id}>
          <tr className="hover:bg-gray-50">
            <td className="px-6 py-3 text-sm font-medium text-gray-900" style={{ paddingLeft: `${level * 24 + 24}px` }}>
              <div className="flex items-center gap-2">
                {hasChildren ? (
                  <button 
                    onClick={() => toggleNode(account.id)}
                    className="p-0.5 hover:bg-gray-200 rounded"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  </button>
                ) : (
                  <span className="w-5" />
                )}
                {account.code}
              </div>
            </td>
            <td className="px-6 py-3 text-sm text-gray-900">{account.name}</td>
            <td className="px-6 py-3 text-sm text-gray-500">
              {account.cashFlowType && account.cashFlowType !== 'NONE' ? (
                <span className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                  account.cashFlowType === 'OPERATING' ? "bg-blue-100 text-blue-800" :
                  account.cashFlowType === 'INVESTING' ? "bg-indigo-100 text-indigo-800" :
                  "bg-purple-100 text-purple-800"
                )}>
                  {account.cashFlowType}
                </span>
              ) : (
                <span className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">N/A</span>
              )}
            </td>
            <td className="px-6 py-3 text-sm text-gray-500 text-right">
              {account.openingBalance.toLocaleString()}
            </td>
            <td className="px-6 py-3 text-sm text-gray-900 text-right font-medium">
              {account.currentBalance.toLocaleString()}
            </td>
            <td className="px-6 py-3 text-center">
              <button 
                onClick={() => handleEdit(account)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Edit Account"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
          {hasChildren && isExpanded && renderAccountTree(account.children!, level + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName="Company Accounts" />

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <h1 className="text-xl font-bold text-slate-900">Chart of Accounts</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className={`flex items-center gap-2 px-3 lg:px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all ${syncMutation.isPending ? 'opacity-50' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncMutation.isPending ? 'Syncing...' : 'Sync Balances'}</span>
            </button>
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown />
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Financial Foundation</h2>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
              <Plus className="w-5 h-5" />
              Add Account
            </button>
          </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-6">
            {accountTypesData?.map((type) => {
              const typeAccounts = accountsData?.filter(a => a.accountType.id === type.id) || [];
              if (typeAccounts.length === 0) return null;
              const tree = buildAccountTree(typeAccounts);
              const isExpanded = expandedTypes.has(type.id);
              
              return (
                <div key={type.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between">
                    <button 
                      onClick={() => setExpandedTypes(prev => {
                        const next = new Set(prev);
                        if (next.has(type.id)) {
                          next.delete(type.id);
                        } else {
                          next.add(type.id);
                        }
                        return next;
                      })}
                      className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      {type.name}
                    </button>
                    <span className="text-xs text-gray-500">{typeAccounts.length} accounts</span>
                  </div>
                  {isExpanded && (
                    <table className="w-full">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-400 uppercase">Account</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-400 uppercase">CF Category</th>
                          <th className="px-6 py-2 text-right text-xs font-medium text-gray-400 uppercase">Opening Balance</th>
                          <th className="px-6 py-2 text-right text-xs font-medium text-gray-400 uppercase">Current Balance</th>
                          <th className="px-6 py-2 text-center text-xs font-medium text-gray-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {renderAccountTree(tree)}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
            {accountsData?.length === 0 && (
              <div className="text-center py-8 text-gray-500">No accounts found</div>
            )}
          </div>
        )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">{selectedAccount ? 'Edit Account' : 'Create Account'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type *</label>
                <select
                  value={formData.accountTypeId}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select Type</option>
                  {accountTypesData?.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="input"
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => handleParentChange(e.target.value)}
                  className="input"
                >
                  <option value="">No Parent (Root)</option>
                  {accountsData?.filter(a => a.id !== selectedAccount?.id).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash Flow Category (RMG Standard)</label>
                <select
                  value={formData.cashFlowType}
                  onChange={(e) => setFormData({ ...formData, cashFlowType: e.target.value })}
                  className="input"
                >
                  <option value="NONE">None (Default)</option>
                  <option value="OPERATING">Operating Activity</option>
                  <option value="INVESTING">Investing Activity</option>
                  <option value="FINANCING">Financing Activity</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">Used for Monthly Cash Flow Reporting on Dashboard.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  className="input"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending || updateMutation.isPending ? (selectedAccount ? 'Updating...' : 'Creating...') : (selectedAccount ? 'Save Changes' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
