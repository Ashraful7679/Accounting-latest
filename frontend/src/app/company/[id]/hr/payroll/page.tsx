'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, Edit, Trash2, Loader2, CheckCircle2, DollarSign, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

interface PayrollRun {
  id: string;
  runNumber: string;
  companyId: string;
  period: string;
  runDate: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  notes: string | null;
  payslips: PayrollPayslip[];
  createdAt: string;
}

interface PayrollPayslip {
  id: string;
  employeeId: string;
  employee?: { firstName: string; lastName: string; employeeCode: string };
  basicSalary: number;
  allowances: number;
  overtime: number;
  grossSalary: number;
  taxDeduction: number;
  advanceDeduction: number;
  loanDeduction: number;
  totalDeductions: number;
  netSalary: number;
  paymentMethod: string;
  status: string;
}

export default function PayrollPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');

  const [processModal, setProcessModal] = useState(false);
  const [processPeriod, setProcessPeriod] = useState('');
  const [processDate, setProcessDate] = useState('');
  const [taxRate, setTaxRate] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['payroll-runs', companyId],
    queryFn: () => api.get(`/company/${companyId}/payroll-runs`).then(r => r.data),
    enabled: !!companyId
  });

  const processMutation = useMutation({
    mutationFn: (data: any) => api.post(`/company/${companyId}/payroll-runs/process`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      toast.success('Payroll processed');
      setProcessModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error processing payroll')
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/company/${companyId}/payroll-runs/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      toast.success('Approved');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ runId, payslipId }: { runId: string; payslipId: string }) => 
      api.post(`/company/${companyId}/payroll-runs/${runId}/payslip/${payslipId}/mark-paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      toast.success('Marked as paid');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/company/${companyId}/payroll-runs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      toast.success('Deleted');
      setShowDetailPanel(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error')
  });

  const filtered = runs.filter((r: PayrollRun) => 
    r.period.includes(searchTerm) || r.runNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleView = (r: PayrollRun) => { setSelectedRun(r); setViewMode('view'); setShowDetailPanel(true); };

  const handleProcess = () => {
    if (!processPeriod || !processDate) {
      toast.error('Please select period and date');
      return;
    }
    processMutation.mutate({ period: processPeriod, runDate: processDate, options: { taxRate } });
  };

  const tabs: DetailTab[] = [
    { id: 'details', label: 'Details', content: <div className="p-4 text-sm text-gray-500">Details view</div> }, 
    { id: 'payslips', label: 'Payslips', content: <div className="p-4 text-sm text-gray-500">Payslips list</div> }
  ];

  const fields: DetailField[] = [
    { label: 'Run Number', value: selectedRun?.runNumber || '-' },
    { label: 'Period', value: selectedRun?.period || '-' },
    { label: 'Run Date', value: selectedRun ? new Date(selectedRun.runDate).toLocaleDateString() : '-', type: 'date' },
    { label: 'Total Gross', value: selectedRun?.totalGross || 0, type: 'currency' },
    { label: 'Total Deductions', value: selectedRun?.totalDeductions || 0, type: 'currency' },
    { label: 'Total Net', value: selectedRun?.totalNet || 0, type: 'currency' },
    { label: 'Status', value: selectedRun?.status || '-', type: 'status' as any }
  ];

  const actions: DetailAction[] = viewMode === 'view' ? [
    ...(selectedRun?.status === 'PROCESSED' ? [
      { label: 'Approve', onClick: () => selectedRun && approveMutation.mutate(selectedRun.id), variant: 'primary' as const },
    ] : []),
    ...(selectedRun?.status === 'APPROVED' ? [
      ...(selectedRun.payslips?.filter(p => p.status === 'PENDING').map(p => ({
        label: `Pay ${p.employee?.firstName} ${p.employee?.lastName}`,
        onClick: () => selectedRun && markPaidMutation.mutate({ runId: selectedRun.id, payslipId: p.id }),
        variant: 'secondary' as const
      })) || [])
    ] : []),
    { label: 'Delete', onClick: () => selectedRun && deleteMutation.mutate(selectedRun.id), variant: 'danger' as const }
  ] : [];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Payroll</h1>
        <button onClick={() => setProcessModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <DollarSign className="w-4 h-4" /> Process Payroll
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search payroll runs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Run #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Period</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Gross</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Deductions</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Net</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Employees</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No payroll runs found</td></tr>
                  ) : filtered.map((r: PayrollRun) => (
                    <tr key={r.id} onClick={() => handleView(r)} className="border-t hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium">{r.runNumber}</td>
                      <td className="px-4 py-3 text-sm">{r.period}</td>
                      <td className="px-4 py-3 text-sm">{new Date(r.runDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatCurrency(r.totalGross)}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatCurrency(r.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(r.totalNet)}</td>
                      <td className="px-4 py-3 text-center text-sm">{r.payslips?.length || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                          r.status === 'PROCESSED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DetailPanel
        isOpen={showDetailPanel}
        onClose={() => setShowDetailPanel(false)}
        title={selectedRun?.runNumber || ''}
        tabs={tabs}
        fields={fields}
        actions={actions}
      />

      {processModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Process Payroll</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Period (YYYY-MM)</label>
                <input
                  type="text"
                  value={processPeriod}
                  onChange={e => setProcessPeriod(e.target.value)}
                  placeholder="2025-05"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Run Date</label>
                <input
                  type="date"
                  value={processDate}
                  onChange={e => setProcessDate(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleProcess} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Process
              </button>
              <button onClick={() => setProcessModal(false)} className="flex-1 px-4 py-2 border rounded hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}