'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import UserDropdown from '@/components/UserDropdown';
import { 
  CheckCircle2, Search, FileText, DollarSign, Calendar,
  Building2, AlertCircle, ArrowRight
} from 'lucide-react';

interface LC {
  id: string;
  lcNumber: string;
  bankName: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  customer?: { name: string };
}

interface PISummary {
  totalPI: number;
  totalPaid: number;
  totalDue: number;
}

interface LoanSummary {
  totalLoan: number;
  totalPaid: number;
  totalDue: number;
}

export default function LCSettlementPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: lcsData, isLoading } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data as LC[];
    },
    enabled: !!companyId,
  });

  const { data: pisData } = useQuery({
    queryKey: ['pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: loansData } = useQuery({
    queryKey: ['loans', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/loans`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const getLCPITotal = (lcId: string): PISummary => {
    const lcpis = pisData?.filter((pi: any) => pi.lc?.id === lcId) || [];
    const totalPI = lcpis.reduce((sum: number, pi: any) => sum + (pi.amount || 0), 0);
    const totalPaid = lcpis.reduce((sum: number, pi: any) => {
      if (pi.status === 'PAID') return sum + (pi.amount || 0);
      if (pi.status === 'PARTIAL') return sum + (pi.paidAmount || 0);
      return sum;
    }, 0);
    return {
      totalPI,
      totalPaid,
      totalDue: totalPI - totalPaid,
    };
  };

  const getLCLoanTotal = (lcId: string): LoanSummary => {
    const lcloans = loansData?.filter((loan: any) => loan.lc?.id === lcId) || [];
    const totalLoan = lcloans.reduce((sum: number, loan: any) => sum + (loan.principalAmount || 0), 0);
    const totalPaid = lcloans.reduce((sum: number, loan: any) => sum + ((loan.principalAmount || 0) - (loan.outstandingBalance || 0)), 0);
    return {
      totalLoan,
      totalPaid,
      totalDue: totalLoan - totalPaid,
    };
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-blue-100 text-blue-800',
      SETTLED: 'bg-green-100 text-green-800',
      CLOSED: 'bg-purple-100 text-purple-800',
      EXPIRED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredLCs = lcsData?.filter((lc: LC) => {
    return !searchTerm || 
      lc.lcNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lc.bankName?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName="LC Settlement" />

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <h1 className="text-xl font-bold text-slate-900">LC Settlement</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown />
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">LC Settlement Summary</h2>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by LC Number or Bank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">LC Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Bank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">LC Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">PI Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">PI Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">PI Due</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Loan Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Loan Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Loan Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredLCs.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No LCs found</td></tr>
                ) : (
                  filteredLCs.map((lc: LC) => {
                    const piSummary = getLCPITotal(lc.id);
                    const loanSummary = getLCLoanTotal(lc.id);
                    return (
                      <tr key={lc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{lc.lcNumber}</td>
                        <td className="px-4 py-3">{lc.bankName}</td>
                        <td className="px-4 py-3">{lc.customer?.name || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono">{lc.currency} {lc.amount?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600">{lc.currency} {piSummary.totalPI?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">{lc.currency} {piSummary.totalPaid?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">{lc.currency} {piSummary.totalDue?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">{lc.currency} {loanSummary.totalLoan?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">{lc.currency} {loanSummary.totalPaid?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">{lc.currency} {loanSummary.totalDue?.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(lc.status)}`}>{lc.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold mb-4">Understanding LC Settlement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="flex gap-2">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">PI Total</p>
                  <p className="text-xs">Total value of all PIs under this LC</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">PI Paid</p>
                  <p className="text-xs">Amount received against PIs</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">PI Due</p>
                  <p className="text-xs">Outstanding amount to be received</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
