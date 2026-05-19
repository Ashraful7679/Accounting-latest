'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Calendar, Lock, Unlock, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

interface ClosedPeriod {
  id: string;
  companyId: string;
  closeDate: string;
  description: string;
  closedBy: { name: string };
}

interface FiscalYear {
  year: number;
  closed: boolean;
  period?: ClosedPeriod;
}

function FinancePeriodClosePage() {
  const params = useParams();
  const companyId = params.id as string;
  const [mounted, setMounted] = useState(false);
  const [closeDate, setCloseDate] = useState('');
  const [description, setDescription] = useState('');
  
  const { canCreate, canEdit } = usePermissions('finance.journals', companyId);

  useEffect(() => { setMounted(true); }, []);

  const { data: periods, isLoading, refetch } = useQuery({
    queryKey: ['fiscal-years', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/fiscal-years`);
      return response.data.data as FiscalYear[];
    },
    enabled: !!companyId && mounted,
  });

  const closeMutation = useMutation({
    mutationFn: async ({ year, closeDate, description }: { year: number; closeDate: string; description: string }) => {
      const response = await api.post(`/company/${companyId}/period-close`, { year, closingDate: closeDate, description });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Period closed successfully');
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to close period');
    },
  });

  const handleClosePeriod = async (year: number) => {
    if (!closeDate) {
      toast.error('Please select a closing date');
      return;
    }
    closeMutation.mutate({ year, closeDate, description });
  };

  if (!mounted) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Period Closing
        </h1>
        <div className="text-sm text-slate-500">
          Lock historical ledgers to prevent modification
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Fiscal Years</h2>
            <p className="text-sm text-slate-500">Close periods to create a hard-lock on all transactions</p>
          </div>

          <div className="divide-y divide-slate-100">
            {years.map((year) => {
              const period = periods?.find(p => p.year === year);
              const isClosed = period?.closed || period?.period;
              
              return (
                <div key={year} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isClosed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">FY {year}</div>
                      {period?.period && (
                        <div className="text-sm text-slate-500">
                          Closed on {new Date(period.period.closeDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {isClosed ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                      <Lock className="w-4 h-4" />
                      Locked
                    </div>
                  ) : (
                    canCreate && (
                      <button
                        onClick={() => handleClosePeriod(year)}
                        disabled={closeMutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {closeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        Close Period
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {canCreate && (
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-900 mb-3">Close Period Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Closing Date</label>
                  <input
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., End of Q4"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">Important</div>
              <div className="text-sm text-amber-700">
                Once a period is closed, it cannot be reopened. All journal entries, invoices, and transactions for that fiscal year will be permanently locked. Ensure all entries are verified before closing.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancePeriodClosePage;