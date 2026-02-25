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

export default function BackupDashboard() {
  const queryClient = useQueryClient();
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get('/admin/backups').then(res => res.data.data)
  });

  const createBackupMutation = useMutation({
    mutationFn: () => api.post('/admin/backups'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup created successfully');
    },
    onError: () => toast.error('Failed to create backup')
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
    if (confirm('Are you absolutely sure? This will overwrite the current database. A pre-restore backup will be created automatically.')) {
      restoreMutation.mutate(fileName);
    }
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
          
          <button 
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-8 py-4 rounded-[20px] font-black flex items-center gap-3 shadow-xl shadow-blue-600/20 transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            {createBackupMutation.isPending ? 'Creating...' : 'Create Manual Backup'}
            <Download className="w-5 h-5" />
          </button>
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
                <h3 className="text-lg font-black">Latest Snapshot</h3>
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
                        <h4 className="font-black text-slate-900">{backup.fileName}</h4>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(backup.createdAt).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatSize(backup.size)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" title="Download">
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleRestore(backup.fileName)}
                        className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-rose-600 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
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
    </div>
  );
}
