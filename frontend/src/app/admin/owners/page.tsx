'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Users, Plus, Trash2, Edit, ArrowLeft, LogOut, Key, UserCheck, ShieldAlert, ShieldCheck, Ban, Unlock, Settings2 } from 'lucide-react';

interface Owner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  isBlocked: boolean;
  isSystem: boolean;
  blockedIps: string | null;
  maxCompanies: number;
  companies: { id: string; name: string; code: string }[];
}

export default function AdminOwnersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    maxCompanies: 5,
  });

  const { data: ownersData, isLoading } = useQuery({
    queryKey: ['admin-owners'],
    queryFn: async () => {
      const response = await api.get('/admin/owners');
      return response.data.data as Owner[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/admin/owners', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-owners'] });
      toast.success('Owner created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create owner');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Owner> }) => {
      const response = await api.put(`/admin/owners/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-owners'] });
      toast.success('Owner updated successfully');
      setShowEditModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update owner');
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/admin/users/${id}/block`, {});
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-owners'] });
      toast.success(data.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to toggle block status');
    },
  });

  const toggleSystemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/admin/users/${id}/system`, {});
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-owners'] });
      toast.success(data.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to toggle system status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/admin/owners/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-owners'] });
      toast.success('Owner deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete owner');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await api.post(`/admin/owners/${id}/reset-password`, { password });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Password reset successfully');
      closePasswordModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reset password');
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/admin/owners/${id}/impersonate`);
      return response.data.data;
    },
    onSuccess: (data: any) => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        sessionStorage.setItem('admin_token', currentToken);
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Impersonation active. Redirecting to owner session...');
      window.location.href = '/';
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to impersonate owner');
    },
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = user.roles || [];

    if (!token || !roles.includes('Admin')) {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const openModal = (owner?: Owner) => {
    if (owner) {
      setEditingOwner(owner);
      setFormData({
        email: owner.email,
        password: '',
        firstName: owner.firstName,
        lastName: owner.lastName,
        maxCompanies: owner.maxCompanies,
      });
    } else {
      setEditingOwner(null);
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        maxCompanies: 5,
      });
    }
    setShowModal(true);
  };

  const openEditModal = (owner: Owner) => {
    setEditingOwner(owner);
    setFormData({
      email: owner.email,
      password: '',
      firstName: owner.firstName,
      lastName: owner.lastName,
      maxCompanies: owner.maxCompanies,
    });
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingOwner(null);
  };

  const openPasswordModal = (ownerId: string) => {
    setSelectedOwnerId(ownerId);
    setPasswordData({ password: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedOwnerId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOwner) {
      updateMutation.mutate({ 
        id: editingOwner.id, 
        data: { 
          firstName: formData.firstName, 
          lastName: formData.lastName, 
          maxCompanies: formData.maxCompanies 
        } 
      });
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    resetPasswordMutation.mutate({ id: selectedOwnerId, password: passwordData.password });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this owner? All related company data will be preserved but access will be removed.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard" className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight">Owner Management</h1>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-red-600 transition-colors">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            <Link href="/admin/companies" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-sm font-bold text-slate-500 hover:text-slate-900 transition-all">
              Companies
            </Link>
            <Link href="/admin/owners" className="flex items-center gap-2 py-4 border-b-2 border-blue-600 text-sm font-bold text-blue-600">
              Owners
            </Link>
             <Link href="/admin/audit-logs" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-sm font-bold text-slate-500 hover:text-slate-900 transition-all">
              Audit Logs
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Platform Owners</h2>
            <p className="text-slate-500 font-medium">Manage user access, security levels, and company quotas</p>
          </div>
          <button 
            onClick={() => openModal()} 
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-5 h-5" />
            Create Owner
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-[32px] p-20 text-center shadow-sm border border-slate-200">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Fetching records...</p>
          </div>
        ) : (
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">User Details</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Status & Security</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Quotas</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Companies</th>
                    <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ownersData?.map((owner) => (
                    <tr key={owner.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                            {owner.firstName[0]}{owner.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{owner.firstName} {owner.lastName}</p>
                            <p className="text-xs font-semibold text-slate-500">{owner.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                             <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg ${
                              owner.isBlocked ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              {owner.isBlocked ? 'Blocked' : 'Active'}
                            </span>
                            {owner.isSystem && (
                              <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200">
                                System
                              </span>
                            )}
                          </div>
                          {owner.isBlocked && (
                             <p className="text-[10px] font-bold text-red-500 italic">Access Suspended</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                           <p className="text-sm font-black text-slate-900">{owner.companies.length} / {owner.maxCompanies}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Slots</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-semibold text-slate-500 line-clamp-2 max-w-[200px]">
                          {owner.companies.length > 0
                            ? owner.companies.map((c) => c.name).join(', ')
                            : 'No companies linked'}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => impersonateMutation.mutate(owner.id)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Impersonate"
                            disabled={impersonateMutation.isPending}
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => toggleBlockMutation.mutate(owner.id)}
                            className={`p-2 rounded-xl transition-all ${
                              owner.isBlocked 
                                ? 'text-green-500 hover:text-green-600 hover:bg-green-50' 
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={owner.isBlocked ? 'Unblock' : 'Block Access'}
                          >
                            {owner.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => toggleSystemMutation.mutate(owner.id)}
                            className={`p-2 rounded-xl transition-all ${
                              owner.isSystem 
                                ? 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50' 
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                            title={owner.isSystem ? 'Remove System Status' : 'Mark as System Account'}
                          >
                            {owner.isSystem ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => openEditModal(owner)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                            title="Edit Settings"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openPasswordModal(owner.id)}
                            className="p-2 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-xl transition-all"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(owner.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ownersData?.length === 0 && (
                <div className="py-20 text-center">
                   <div className="h-16 w-16 rounded-[24px] bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
                     <Users className="w-8 h-8" />
                   </div>
                   <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No owner accounts found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal (Max Companies) */}
      {showEditModal && editingOwner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black mb-1 text-slate-900">Owner Settings</h3>
            <p className="text-slate-500 font-medium mb-6">Updating account for {editingOwner.email}</p>
            
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Company Limit (Quotas)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.maxCompanies}
                    onChange={(e) => setFormData({ ...formData, maxCompanies: parseInt(e.target.value) })}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                    required
                    min={1}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Companies</div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending} className="flex-1 h-12 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black mb-1 text-slate-900">New Owner</h3>
            <p className="text-slate-500 font-medium mb-6">Create a master account with company management access</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Temporary Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 h-12 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">
                  {createMutation.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-black mb-1 text-slate-900">Override Password</h3>
            <p className="text-slate-500 font-medium mb-6">Force update the password for this owner account</p>
            
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">New Password *</label>
                <input
                  type="password"
                  value={passwordData.password}
                  onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Confirm New Password *</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closePasswordModal} className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={resetPasswordMutation.isPending} className="flex-1 h-12 bg-yellow-600 text-white rounded-2xl font-black text-sm hover:bg-yellow-700 shadow-lg shadow-yellow-100 transition-all">
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
