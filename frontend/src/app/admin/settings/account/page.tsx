'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Shield, User, Mail, Key, Lock, Save, X, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface AdminProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt?: string;
}

export default function AdminAccountSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const { data: userData, isLoading } = useQuery<AdminProfile>({
    queryKey: ['admin-profile'],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      return response.data.data;
    },
    enabled: mounted,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  useEffect(() => {
    if (userData) {
      setProfileForm({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
      });
    }
  }, [userData]);

  const profileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const response = await api.put('/admin/profile', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
      toast.success('Profile updated successfully');
      setIsEditingProfile(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update profile');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.put('/admin/profile/password', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update password');
    },
  });

  const handlePasswordSubmit = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation must match');
      return;
    }

    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400">Loading admin profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
              <Shield className="w-10 h-10 text-slate-900" />
              Admin Account Settings
            </h1>
            <p className="text-slate-500 font-bold mt-2">Update your profile details and change your password securely.</p>
          </div>
          <Link href="/admin/settings/backup" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-3xl font-black hover:bg-slate-800 transition-all">
            <Key className="w-4 h-4" />
            Backup Settings
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Profile Details</h2>
                <p className="text-slate-500 font-medium">Manage your email and display name.</p>
              </div>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                {isEditingProfile ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">First Name</label>
                <input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Last Name</label>
                <input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Email Address</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
                />
              </div>

              {isEditingProfile && (
                <button
                  onClick={() => profileMutation.mutate(profileForm)}
                  disabled={profileMutation.isPending}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-3xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </section>

          <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900">Change Password</h2>
              <p className="text-slate-500 font-medium">Update your password with your current credentials.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <button
                onClick={handlePasswordSubmit}
                disabled={passwordMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-3xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all disabled:opacity-60"
              >
                <Lock className="w-4 h-4" />
                {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
