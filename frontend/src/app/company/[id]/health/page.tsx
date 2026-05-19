'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePermissions } from '@/hooks/usePermissions';

export default function SystemHealthPage() {
  const params = useParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('company.health', companyId);

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }


  const { data: health, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['system-health', companyId],
    queryFn: () => api.get(`/system/health/integrity`).then(res => res.data)
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" /> System Health
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Verify structural integrity and ledger accuracy of the AccaBiz system.</p>
        </div>
        <button 
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
          Run Integrity Check
        </button>
      </div>

      {isLoading ? (
        <div className="flex py-20 justify-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : isError ? (
        <div className="bg-red-50 text-red-600 p-8 rounded-[32px] border border-red-100 flex flex-col items-center justify-center">
           <XCircle className="w-12 h-12 mb-4" />
           <h2 className="text-xl font-black">Failed to load system health data</h2>
           <p className="mt-2 text-sm font-medium">Please check your connection or contact support.</p>
        </div>
      ) : health ? (
        <div className="space-y-8">
           {/* General Status */}
           <div className={`p-8 rounded-[32px] border flex flex-col items-center justify-center text-center shadow-lg ${health.isHealthy ? 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/20' : 'bg-red-500 border-red-600 text-white shadow-red-500/20'}`}>
              {health.isHealthy ? <CheckCircle2 className="w-16 h-16 mb-4 opacity-90" /> : <AlertTriangle className="w-16 h-16 mb-4 opacity-90" />}
              <h2 className="text-3xl font-black tracking-tight">{health.isHealthy ? 'All Systems Operational' : 'Integrity Issues Detected'}</h2>
              <p className="mt-2 font-medium opacity-80 uppercase tracking-widest text-sm">Last Checked: {new Date(health.timestamp).toLocaleString()}</p>
           </div>

           {/* Issues List */}
           {!health.isHealthy && health.issues && health.issues.length > 0 && (
             <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-red-50/50 flex items-center gap-3">
                 <AlertTriangle className="w-6 h-6 text-red-500" />
                 <h3 className="text-lg font-black text-slate-900">Detected Anomalies</h3>
               </div>
               <div className="divide-y divide-slate-100">
                 {health.issues.map((issue: any, index: number) => (
                   <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} key={issue.type} className="p-6">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-md font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-red-500" /> {issue.type.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-sm text-slate-500 mt-1 font-medium">{issue.description}</p>
                        </div>
                        <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg">
                          {issue.count} {issue.count === 1 ? 'Record' : 'Records'}
                        </span>
                     </div>
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden text-xs">
                        {issue.items && issue.items.slice(0, 10).map((item: any, idx: number) => (
                          <div key={idx} className="p-3 border-b border-slate-200 last:border-b-0 font-mono text-slate-600 flex justify-between">
                            <span>ID: {item.id}</span>
                            <span className="font-bold text-slate-900">{JSON.stringify(item).slice(0, 80)}{JSON.stringify(item).length > 80 ? '...' : ''}</span>
                          </div>
                        ))}
                        {issue.items && issue.items.length > 10 && (
                          <div className="p-3 bg-slate-100 text-slate-500 font-bold text-center">
                            + {issue.items.length - 10} more records omitted.
                          </div>
                        )}
                     </div>
                   </motion.div>
                 ))}
               </div>
             </div>
           )}
        </div>
      ) : null}
    </div>
  );
}
