'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 

  CheckCircle2, Search, FileText, DollarSign, Calendar,
  Building2, AlertCircle, ArrowRight, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <Link href={`/company/${companyId}/lc`} className="p-2 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-gray-400" />
              Settlement Ledger
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-medium tracking-tight">Consolidated Utilization & Liability Matrix</p>
          </div>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="FILTER BY LC OR BANK..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-sm focus:border-gray-400 outline-none text-[10px] font-bold uppercase tracking-widest transition-colors"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-r border-gray-100">LC Identity</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest border-r border-gray-100">Bank / Agent</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest border-r border-gray-100">LC Value</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-emerald-50/30 border-r border-gray-100">Order Book</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-emerald-50/50 border-r border-gray-100">Realized</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-rose-50/50 border-r border-gray-100 text-rose-600">Pending</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-blue-50/30 border-r border-gray-100">Loan Exposure</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-blue-50/50 border-r border-gray-100">Retired</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-rose-50/50 text-rose-600">Debt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Synchronizing Data...</td></tr>
              ) : filteredLCs.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">No matching records found</td></tr>
              ) : (
                filteredLCs.map((lc: LC) => {
                  const pi = getLCPITotal(lc.id);
                  const loan = getLCLoanTotal(lc.id);
                  return (
                    <tr key={lc.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-4 border-r border-gray-100">
                        <div className="text-xs font-black text-gray-900 uppercase tracking-tight">{lc.lcNumber}</div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{lc.type}</div>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-100">
                        <div className="text-[10px] font-bold text-gray-700 uppercase">{lc.bankName}</div>
                        <div className="text-[9px] font-medium text-gray-400 mt-0.5 italic">{lc.customer?.name || 'internal'}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-black text-gray-900 border-r border-gray-100">
                        {lc.currency} {lc.amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-emerald-600 bg-emerald-50/10 border-r border-gray-100">
                        {pi.totalPI?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-emerald-700 bg-emerald-50/20 border-r border-gray-100">
                        {pi.totalPaid?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-rose-600 bg-rose-50/20 border-r border-gray-100">
                        {pi.totalDue?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-blue-600 bg-blue-50/10 border-r border-gray-100">
                        {loan.totalLoan?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-blue-700 bg-blue-50/20 border-r border-gray-100">
                        {loan.totalPaid?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs font-bold text-rose-600 bg-rose-50/20">
                        {loan.totalDue?.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
        <div className="space-y-2 p-4 bg-white border border-gray-200 rounded-sm shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-sm">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Order Utilization</h3>
          </div>
          <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-tight">Total value of linked sales/purchase proforma invoices against the credit limit.</p>
        </div>
        
        <div className="space-y-2 p-4 bg-white border border-gray-200 rounded-sm shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-sm">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Loan Retirement</h3>
          </div>
          <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-tight">Active bank financing (LIM/LTR) and repayment progress for the specific instrument.</p>
        </div>

        <div className="space-y-2 p-4 bg-white border border-gray-200 rounded-sm shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-sm">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Residual Liability</h3>
          </div>
          <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-tight">Unfulfilled orders or outstanding debt that must be settled prior to LC expiry.</p>
        </div>
      </div>
    </div>
  );
}
