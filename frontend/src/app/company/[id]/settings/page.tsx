'use client';


import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Settings, Shield, Calendar, CheckCircle, ToggleLeft, ToggleRight, Save, RefreshCw } from 'lucide-react';

interface CompanySettings {
  companyId: string;
  disallowFutureDates: boolean;
  lockPreviousMonths: boolean;
  approvalWorkflow: boolean;
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-5 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5 max-w-md">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="flex-shrink-0 mt-0.5"
        aria-checked={value}
        role="switch"
      >
        {value ? (
          <ToggleRight className="w-8 h-8 text-blue-600 transition-colors" />
        ) : (
          <ToggleLeft className="w-8 h-8 text-slate-300 transition-colors" />
        )}
      </button>
    </div>
  );
}


export default function CompanySettingsPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ['company-settings', companyId],
    queryFn: () => api.get(`/company/${companyId}/settings`).then(r => r.data.data),
  });

  const [local, setLocal] = useState<CompanySettings | null>(null);
  const current = local ?? settings;

  const mutation = useMutation({
    mutationFn: (payload: Partial<CompanySettings>) =>
      api.put(`/company/${companyId}/settings`, payload).then(r => r.data.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['company-settings', companyId], data);
      setLocal(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleToggle = (key: keyof CompanySettings) => (value: boolean) => {
    setLocal(prev => ({ ...(prev ?? current!), [key]: value }));
  };

  const handleSave = () => {
    if (!current) return;
    mutation.mutate({
      disallowFutureDates: current.disallowFutureDates,
      lockPreviousMonths: current.lockPreviousMonths,
      approvalWorkflow: current.approvalWorkflow,
    });
  };

  if (isLoading || !current) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Company Settings</h1>
            <p className="text-xs text-slate-400 font-medium">Accounting controls & workflow configuration</p>
          </div>
        </div>

        {/* Settings Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Accounting Controls</h2>

          <ToggleRow
            label="Disallow Future Dates"
            description="Prevent journal entries and invoices from being posted with a future date."
            value={current.disallowFutureDates}
            onChange={handleToggle('disallowFutureDates')}
            icon={Calendar}
          />
          <ToggleRow
            label="Lock Previous Months"
            description="Once a period is closed, reject any new postings into that month."
            value={current.lockPreviousMonths}
            onChange={handleToggle('lockPreviousMonths')}
            icon={Shield}
          />
          <ToggleRow
            label="Multi-Level Approval Workflow"
            description="Require verification and approval stages before documents are posted to the ledger."
            value={current.approvalWorkflow}
            onChange={handleToggle('approvalWorkflow')}
            icon={CheckCircle}
          />
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={mutation.isPending || !local}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {mutation.isPending ? 'Savingâ€¦' : 'Save Changes'}
          </button>

          {saved && (
            <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Settings saved
            </span>
          )}
          {mutation.isError && (
            <span className="text-sm font-bold text-red-600">
              Failed to save. Please try again.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


