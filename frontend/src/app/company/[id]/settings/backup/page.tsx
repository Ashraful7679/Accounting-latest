'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import api, { BASE_URL } from '@/lib/api';
import { 
  Database, 
  Download, 
  RefreshCw, 
  FileArchive, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BackupLog {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  triggeredBy: string;
  createdAt: string;
}

export default function BackupRestorePage() {
  const { id: companyId } = useParams();
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await api.get(`/company/${companyId}/backups`);
      if (response.data.success) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch backup logs:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleGenerateBackup = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post(`/company/${companyId}/backup/generate`);
      if (response.data.success) {
        alert('Backup generated successfully!');
        fetchLogs();
      } else {
        alert('Backup failed: ' + (response.data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error triggering backup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (fileName: string) => {
    // Append token as query param — the auth middleware already accepts ?token=
    const token = localStorage.getItem('token');
    const url = `${BASE_URL}/api/company/${companyId}/backups/download/${encodeURIComponent(fileName)}?token=${token}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestore = async (fileName: string) => {
    if (!confirm(`CAUTION: This will overwrite your current database with the data from ${fileName}. Are you absolutely sure?`)) {
      return;
    }

    const confirmText = prompt('Please type "RESTORE" to confirm this destructive action:');
    if (confirmText !== 'RESTORE') {
      alert('Restore cancelled.');
      return;
    }

    setIsGenerating(true); // Re-use loading state
    try {
      const response = await api.post(`/company/${companyId}/backup/restore/${fileName}`);
      if (response.data.success) {
        alert('System restored successfully! The application will now reload.');
        window.location.reload();
      } else {
        alert('Restore failed: ' + (response.data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error triggering restore');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualUpload = async (file: File) => {
    if (!confirm(`CAUTION: This will overwrite your current database with the data from ${file.name}. Are you absolutely sure?`)) {
      return;
    }

    const confirmText = prompt('Please type "RESTORE" to confirm this destructive action:');
    if (confirmText !== 'RESTORE') {
      alert('Restore cancelled.');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/company/${companyId}/backup/restore/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        alert('System restored successfully! The application will now reload.');
        window.location.reload();
      } else {
        alert('Restore failed: ' + (response.data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error uploading or restoring backup');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

        <div className="p-4 md:p-8 max-w-6xl mx-auto">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar Column: Status & Info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-none">Protection Active</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">Daily Snapshots</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Database</span>
                    <span className="text-xs font-black text-slate-900 uppercase">PostgreSQL</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archives</span>
                    <span className="text-xs font-black text-slate-900 uppercase">Uploaded Files</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</span>
                    <span className="text-xs font-black text-slate-900 uppercase">02:00 AM Daily</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200/60 shadow-inner">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm mb-1 uppercase tracking-tight">Restore Note</h4>
                    <p className="text-xs text-amber-800 leading-relaxed font-semibold opacity-80">
                      System-wide restoration requires advanced privileges. Automated restore is tempered to prevent accidental data loss.
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual Generate Backup */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-none">Manual Backup</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">Create Snapshot</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Creates a single <span className="font-bold">.zip</span> archive containing:
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1 pl-1">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> All accounting data (JSON)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> All uploaded file attachments</li>
                  </ul>
                  <button
                    onClick={handleGenerateBackup}
                    disabled={isGenerating}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all",
                      isGenerating
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-95"
                    )}
                  >
                    <Database className="w-5 h-5" />
                    {isGenerating ? 'Creating Backup...' : 'Generate Full Backup (DB + Files)'}
                  </button>
                </div>
              </div>

              {/* Manual Restore Upload */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Download className="w-6 h-6 text-blue-600 rotate-180" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-none">Manual Restore</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">From Local File</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Upload a previously downloaded <span className="font-bold">.zip</span> backup archive to restore the entire system state.
                  </p>
                  <label className="block">
                    <input 
                      type="file" 
                      accept=".zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleManualUpload(file);
                      }}
                      className="hidden"
                      id="manual-backup-upload"
                      disabled={isGenerating}
                    />
                    <div className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                      isGenerating ? "border-slate-200 bg-slate-50 cursor-not-allowed" : "border-blue-200 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-400"
                    )}>
                      <FileArchive className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-bold text-blue-600">Select Backup File</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Main Column: Table */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900">Historical Backups</h3>
                  </div>
                  <div className="px-3 py-1 bg-blue-100/50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest leading-none">
                    Last 20 Records
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Asset Name</th>
                        <th className="px-6 py-4">Size</th>
                        <th className="px-6 py-4">Created On</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center">
                            <RefreshCw className="w-8 h-8 text-blue-200 animate-spin mx-auto mb-2" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Synchronizing Logs...</span>
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center">
                            <FileArchive className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">No Backups Found</span>
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              {log.status === 'SUCCESS' ? (
                                <div className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] uppercase tracking-tight">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  OK
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-rose-50 text-rose-600 rounded-full font-black text-[10px] uppercase tracking-tight">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Fail
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate max-w-[180px]">
                                  {log.fileName}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">System Archive</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-[11px] font-black text-slate-500 tabular-nums">
                              {formatSize(log.fileSize)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col select-none">
                                <span className="text-xs font-black text-slate-700 tabular-nums">
                                  {new Date(log.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                                  {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {log.status === 'SUCCESS' && (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleDownload(log.fileName)}
                                    className="w-8 h-8 inline-flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"
                                    title="Download Package"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRestore(log.fileName)}
                                    className="w-8 h-8 inline-flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-600 hover:text-white transition-all shadow-sm active:scale-90"
                                    title="Restore from this Snapshot"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

    </div>
  );
}
