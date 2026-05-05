'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ShieldCheck, Clock, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminAuditLogsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const response = await api.get('/admin/audit-logs');
      return response.data.data;
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-slate-900">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
            <h1 className="text-3xl font-black">Audit Logs</h1>
          </div>
          <Link href="/admin/dashboard" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">System Audit Trail</p>
              <h2 className="text-xl font-black text-slate-900">Superadmin actions and support mode events</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-slate-500">Loading audit logs...</div>
          ) : error ? (
            <div className="py-20 text-center text-red-600">Unable to load audit logs.</div>
          ) : data?.length === 0 ? (
            <div className="py-20 text-center text-slate-500">No audit events recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.map((event: any) => (
                    <tr key={event.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-900">
                        {event.admin?.firstName ? `${event.admin.firstName} ${event.admin.lastName}` : event.admin?.email || 'Unknown'}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{event.action}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{event.targetResource} / {event.targetId}</td>
                      <td className="px-4 py-4 text-sm text-slate-600 break-words max-w-[280px]">{event.details ? JSON.stringify(event.details) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
