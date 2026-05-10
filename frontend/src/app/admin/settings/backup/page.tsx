'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Database, Download, RotateCcw, Shield, Clock, 
  Settings, AlertTriangle, CheckCircle2, Search,
  HardDrive, FileCode, Trash2, ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function BackupDashboard() {
  const queryClient = useQueryClient();
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [backupScope, setBackupScope] = useState<'system' | 'company'>('system');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get('/admin/backups').then(res => res.data.data)
  });

  const { data: companies } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api.get('/admin/companies').then(res => res.data.data),
    enabled: backupScope === 'company',
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      if (backupScope === 'company' && !selectedCompanyId) {
        throw new Error('Select a company before creating a company-scoped backup.');
      }
      const config = backupScope === 'company'
        ? { params: { companyId: selectedCompanyId } }
        : undefined;
      const response = await api.post('/admin/backups', undefined, config);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup created successfully');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || error.message || 'Failed to create backup')
  });

  const restoreMutation = useMutation({
    mutationFn: (fileName: string) => api.post('/admin/backups/restore', { fileName }),
    onSuccess: () => {
      toast.success('Database restored successfully');
      setIsRestoring(false);
    },
    onError: () => toast.error('Restoration failed')
  });

  const handleRestore = (fileName: string) => {
    setRestoreTarget(fileName);
    setShowRestoreModal(true);
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(2)} KB` : `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
              <Database className="w-10 h-10 text-blue-600" />
              Backup Management
            </h1>
            <p className="text-slate-500 font-bold mt-2">Secure your data with manual snapshots and managed restores.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <label htmlFor="backupScope" className="text-sm font-semibold text-slate-700">Scope</label>
              <select
                id="backupScope"
                value={backupScope}
                onChange={(e) => setBackupScope(e.target.value as 'system' | 'company')}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none"
              >
                <option value="system">System</option>
                <option value="company">Company</option>
              </select>
              {backupScope === 'company' && (
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none"
                >
                  <option value="">Select company</option>
                  {companies?.map((company: any) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              )}
            </div>
            <button 
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending || (backupScope === 'company' && !selectedCompanyId)}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-8 py-4 rounded-[20px] font-black flex items-center gap-3 shadow-xl shadow-blue-600/20 transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]"
            >
              {createBackupMutation.isPending ? 'Creating...' : 'Create Manual Backup'}
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Status Cards */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <Shield className="w-10 h-10 text-emerald-600 mb-4" />
                <h3 className="text-lg font-black text-slate-900">System Integrity</h3>
                <p className="text-sm text-slate-500 font-bold">Auto-backup before restore enabled</p>
                <div className="mt-6 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-emerald-600 uppercase">Protection Active</span>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            </div>

            <div className="bg-slate-900 p-8 rounded-[32px] text-white overflow-hidden relative group">
              <div className="relative z-10">
                <Clock className="w-10 h-10 text-blue-400 mb-4" />
                <h3 className="text-lg font-black text-white">Latest Snapshot</h3>
                <p className="text-slate-400 font-bold">
                  {backups?.[0] ? new Date(backups[0].createdAt).toLocaleString() : 'No backups found'}
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <span className="text-3xl font-black">{backups?.[0] ? formatSize(backups[0].size) : '0 MB'}</span>
                </div>
              </div>
              <Settings className="absolute -bottom-8 -right-8 w-32 h-32 text-white/5 rotate-12" />
            </div>
          </div>

          {/* Backup History */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Backup History</h2>
                <div className="bg-slate-50 px-4 py-2 rounded-full flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Search backups..." className="bg-transparent text-sm font-bold outline-none w-40" />
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {isLoading ? (
                  <div className="p-20 text-center">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : backups?.length === 0 ? (
                  <div className="p-20 text-center flex flex-col items-center gap-4">
                    <HardDrive className="w-16 h-16 text-slate-200" />
                    <p className="text-slate-400 font-bold">No backups available in the system repository.</p>
                  </div>
                ) : backups?.map((backup: any, idx: number) => (
                  <div key={idx} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <FileCode className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900">{backup.fileName}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${backup.scope === 'COMPANY' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                            {backup.scope ?? (backup.fileName.endsWith('.sql') ? 'SYSTEM' : 'COMPANY')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(backup.createdAt).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatSize(backup.size ?? backup.fileSize)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api'}/admin/backups/download/${backup.fileName}`, '_blank');
                        }}
                        className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleRestore(backup.fileName)}
                        disabled={!backup.fileName.endsWith('.sql')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs transition-colors ${backup.fileName.endsWith('.sql') ? 'bg-slate-900 text-white hover:bg-rose-600' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                        title={backup.fileName.endsWith('.sql') ? 'Restore' : 'Restore not supported for this backup type'}
                      >
                        <RotateCcw className="w-4 h-4" />
                        {backup.fileName.endsWith('.sql') ? 'Restore' : 'Unsupported'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[24px] flex gap-4">
              <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-black text-amber-900">Critical Warning</h4>
                <p className="text-sm text-amber-700 font-medium leading-relaxed mt-1">
                  Restoring a backup will overwrite all current data. Ensure users are logged out and critical operations are paused. 
                  Pre-restore snapshots are kept for 24 hours only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showRestoreModal}
        title="Restore Backup"
        message="Are you absolutely sure? This will overwrite the current database. A pre-restore backup will be created automatically."
        confirmLabel="Restore"
        variant="danger"
        isLoading={restoreMutation.isPending}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget)}
        onCancel={() => { setShowRestoreModal(false); setRestoreTarget(null); }}
      />
    </div>
  );
}
