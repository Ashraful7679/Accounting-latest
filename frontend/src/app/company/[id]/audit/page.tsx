'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ShieldAlert, Search, FileText, UserCircle, Calendar } from 'lucide-react';

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + 
         ' ' + 
         d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
};


export default function AuditTrailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['audit-logs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/audit`);
      return response.data.data;
    },
    enabled: !!companyId && mounted,
  });

  if (!mounted) return null;

  const filtered = activities.filter((log: any) => {
    const matchesSearch = 
      JSON.stringify(log.metadata || {}).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.performedBy?.firstName + ' ' + log.performedBy?.lastName).toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'ALL') return matchesSearch;
    return matchesSearch && log.entityType.toUpperCase() === filterType;
  });

  return (
    <div className="min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-indigo-600" />
              Audit Trail
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">System-wide immutable activity logs</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search user, action, or document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2 text-sm w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              {['ALL', 'INVOICE', 'JOURNAL', 'PAYMENT', 'BILL', 'LC'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium transition-colors ${
                    filterType === f 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f === 'ALL' ? 'All Activities' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="p-4 w-48">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading logs...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No activity logs found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-slate-600 whitespace-nowrap">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(log.createdAt)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-medium text-slate-900">
                          <UserCircle className="w-5 h-5 text-indigo-400" />
                          {log.performedBy ? `${log.performedBy.firstName} ${log.performedBy.lastName}` : 'System'}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          log.action.includes('CREATED') ? 'bg-emerald-100 text-emerald-700' :
                          log.action.includes('APPROVED') ? 'bg-blue-100 text-blue-700' :
                          log.action.includes('REJECTED') ? 'bg-rose-100 text-rose-700' :
                          log.action.includes('VERIFIED') ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-slate-700 capitalize font-medium">
                          <FileText className="w-4 h-4 text-slate-400" />
                          {log.entityType.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="p-4">
                        <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded block max-w-sm truncate" title={JSON.stringify(log.metadata)}>
                          {log.metadata?.docNumber || log.metadata?.entityNumber || log.entityId.substring(0,8)} 
                          {log.metadata?.reason ? ` - ${log.metadata.reason}` : ''}
                        </code>
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
  );
}
