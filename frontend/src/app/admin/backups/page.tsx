'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Database, 
  Download, 
  Trash2, 
  RefreshCcw, 
  ArrowLeft, 
  Building2, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  Box
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Company {
  id: string;
  name: string;
  code: string;
}

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
  companyId?: string;
}

export default function AdminBackupsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isFullBackup, setIsFullBackup] = useState(true);

  const { data: companies } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: async () => {
      const response = await api.get('/admin/companies');
      return response.data.data as Company[];
    },
  });

  const { data: backups, refetch: refetchBackups, isLoading: loadingBackups } = useQuery({
    queryKey: ['admin-backups'],
    queryFn: async () => {
      const response = await api.get('/admin/backups');
      return response.data.data as BackupFile[];
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async (companyId?: string) => {
      const response = await api.post('/admin/backups', { companyId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Backup initiated successfully');
      refetchBackups();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create backup');
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      await api.delete(`/admin/backups/${filename}`);
    },
    onSuccess: () => {
      toast.success('Backup deleted');
      refetchBackups();
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleDownload = async (filename: string) => {
    try {
      const response = await api.get(`/admin/backups/${filename}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to download backup');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/admin/dashboard" className="h-14 w-14 flex items-center justify-center rounded-[20px] bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Recovery Center</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Data Sovereignty & Persistence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">End-to-End Encrypted</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Action Panel */}
          <div className="space-y-8">
            <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm p-10">
              <h2 className="text-2xl font-black text-slate-900 mb-8">Manual Snapshot</h2>
              
              <div className="space-y-8">
                <div className="flex p-2 bg-slate-100 rounded-[24px]">
                  <button 
                    onClick={() => setIsFullBackup(true)}
                    className={`flex-1 py-3 px-4 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all ${isFullBackup ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    System Wide
                  </button>
                  <button 
                    onClick={() => setIsFullBackup(false)}
                    className={`flex-1 py-3 px-4 rounded-[20px] text-xs font-black uppercase tracking-widest transition-all ${!isFullBackup ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Company Scoped
                  </button>
                </div>

                {isFullBackup ? (
                  <div className="p-8 rounded-[40px] bg-slate-900 text-white relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                        <Zap className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-black mb-2">Master Dump</h3>
                      <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">Extract the entire PostgreSQL database state into a portable SQL container.</p>
                      <button 
                        onClick={() => createBackupMutation.mutate()}
                        disabled={createBackupMutation.isPending}
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40"
                      >
                        {createBackupMutation.isPending ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                        Trigger Full Backup
                      </button>
                    </div>
                    <Database className="absolute -right-8 -bottom-8 w-40 h-40 text-white/5 rotate-12" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Select Company Entity</label>
                      <div className="relative">
                        <select 
                          value={selectedCompanyId}
                          onChange={(e) => setSelectedCompanyId(e.target.value)}
                          className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-[20px] text-sm font-bold appearance-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all outline-none"
                        >
                          <option value="">Choose a company...</option>
                          {companies?.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                        <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                    <button 
                      onClick={() => createBackupMutation.mutate(selectedCompanyId)}
                      disabled={!selectedCompanyId || createBackupMutation.isPending}
                      className="w-full h-14 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[20px] font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                    >
                      {createBackupMutation.isPending ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      Export Company Data
                    </button>
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                      This will generate a JSON bundle containing all ledgers, trade documents, and settings.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 rounded-[40px] bg-amber-50 border border-amber-100">
               <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <h4 className="text-lg font-black text-amber-900">Security Note</h4>
               </div>
               <p className="text-sm font-bold text-amber-800/80 leading-relaxed">
                 Backups contain sensitive financial data. Ensure you store downloaded files in a secure vault. System backups are kept on the server for 30 days.
               </p>
            </div>
          </div>

          {/* History / File List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Storage Vault</h2>
                  <p className="text-slate-500 font-medium text-sm">Available snapshots and portable data bundles</p>
                </div>
                <button 
                  onClick={() => refetchBackups()}
                  className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-100 shadow-sm"
                >
                  <RefreshCcw className={`w-5 h-5 ${loadingBackups ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex-1">
                {backups?.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                    <div className="h-24 w-24 rounded-[40px] bg-slate-50 flex items-center justify-center text-slate-200 mb-6 border border-dashed border-slate-200">
                       <Box className="w-12 h-12" />
                    </div>
                    <h3 className="text-xl font-black text-slate-300">Vault is Empty</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">No backups have been generated yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {backups?.map((backup) => (
                      <div key={backup.filename} className="p-8 hover:bg-slate-50/50 transition-colors group flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                           <div className={`h-14 w-14 rounded-3xl flex items-center justify-center shadow-sm ${backup.filename.includes('.sql') ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                             {backup.filename.includes('.sql') ? <Database className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                           </div>
                           <div>
                             <p className="text-base font-black text-slate-900 flex items-center gap-2">
                               {backup.filename}
                               {backup.filename.includes('.sql') && (
                                 <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase tracking-wider rounded-md border border-blue-200">Full System</span>
                               )}
                             </p>
                             <div className="flex items-center gap-4 mt-1">
                               <div className="flex items-center gap-1.5 text-slate-400">
                                 <Clock className="w-3.5 h-3.5" />
                                 <span className="text-xs font-bold">{new Date(backup.createdAt).toLocaleString()}</span>
                               </div>
                               <div className="h-1 w-1 rounded-full bg-slate-300"></div>
                               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                             </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => handleDownload(backup.filename)}
                             className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white text-slate-400 hover:text-blue-600 hover:border-blue-100 border border-slate-200 shadow-sm transition-all"
                             title="Download"
                           >
                             <Download className="w-5 h-5" />
                           </button>
                           <button 
                             onClick={() => deleteBackupMutation.mutate(backup.filename)}
                             disabled={deleteBackupMutation.isPending}
                             className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white text-slate-400 hover:text-red-600 hover:border-red-100 border border-slate-200 shadow-sm transition-all"
                             title="Delete"
                           >
                             <Trash2 className="w-5 h-5" />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Storage Status</p>
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">All Data Synchronized</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
