'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, FileText, BarChart3, PieChart, Landmark,
  ChevronRight, Filter, Download, Printer, ArrowLeft,
  Calendar, Layers, Briefcase, Users, Search, AlertCircle,
  FileBarChart, Receipt, DollarSign, CreditCard, Globe, Bell
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Sidebar from '@/components/Sidebar';
import UserDropdown from '@/components/UserDropdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ReportCategory = 'FINANCIAL' | 'LEDGER' | 'PAYABLE_RECEIVABLE' | 'TAX' | 'RMG';

interface ReportInfo {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  endpoint: string;
}

const REPORTS: ReportInfo[] = [
  { id: 'trial-balance', name: 'Trial Balance', category: 'FINANCIAL', description: 'Summary of all account balances', endpoint: '/reports/trial-balance' },
  { id: 'profit-loss', name: 'Profit & Loss', category: 'FINANCIAL', description: 'Revenue and expense performance', endpoint: '/reports/profit-loss' },
  { id: 'balance-sheet', name: 'Balance Sheet', category: 'FINANCIAL', description: 'Assets, liabilities, and equity', endpoint: '/reports/balance-sheet' },
  { id: 'ledger', name: 'General Ledger', category: 'LEDGER', description: 'Detailed transaction history', endpoint: '/reports/ledger' },
  { id: 'customer-aging', name: 'Customer Aging', category: 'PAYABLE_RECEIVABLE', description: 'Accounts receivable breakdown', endpoint: '/reports/aging?type=CUSTOMER' },
  { id: 'vendor-aging', name: 'Vendor Aging', category: 'PAYABLE_RECEIVABLE', description: 'Accounts payable breakdown', endpoint: '/reports/aging?type=VENDOR' },
  { id: 'lc-liability', name: 'LC Liability Report', category: 'RMG', description: 'Outstanding Letter of Credit exposure', endpoint: '/reports/lc-liability' },
];

export default function ReportCenterPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  
  const [selectedReport, setSelectedReport] = useState<ReportInfo | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branchId: '',
    projectId: '',
    costCenterId: '',
    status: 'APPROVED'
  });

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => api.get(`/company/${companyId}`).then(res => res.data.data)
  });

  const { data: reportData, isFetching: loadingReport } = useQuery({
    queryKey: ['report', selectedReport?.id, filters],
    queryFn: () => {
      const queryParams = new URLSearchParams(filters).toString();
      const baseEndpoint = `/company/${companyId}${selectedReport!.endpoint}`;
      const url = baseEndpoint.includes('?') 
        ? `${baseEndpoint}&${queryParams}` 
        : `${baseEndpoint}?${queryParams}`;
      return api.get(url).then(res => res.data.data);
    },
    enabled: !!selectedReport
  });

  const { data: branches } = useQuery({ queryKey: ['branches', companyId], queryFn: () => api.get(`/company/${companyId}/branches`).then(res => res.data.data) });
  const { data: projects } = useQuery({ queryKey: ['projects', companyId], queryFn: () => api.get(`/company/${companyId}/projects`).then(res => res.data.data) });

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName={company?.name || 'Report Center'} />

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4 pl-10 lg:pl-0">
            <button 
              onClick={() => selectedReport ? setSelectedReport(null) : router.back()} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {selectedReport ? selectedReport.name : 'Report Center'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedReport && (
              <>
                <button 
                  onClick={handlePrint}
                  className="bg-white border-2 border-slate-200 hover:border-blue-600 text-slate-700 hover:text-blue-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print / PDF</span>
                </button>
                <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </>
            )}
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown />
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
          {!selectedReport ? (
            <div className="space-y-12 animate-in fade-in duration-500">
              {(['FINANCIAL', 'LEDGER', 'PAYABLE_RECEIVABLE', 'RMG'] as ReportCategory[]).map(cat => (
                <section key={cat}>
                  <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                    <div className="w-2 h-6 bg-blue-600 rounded-full" />
                    {cat.replace('_', ' ')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {REPORTS.filter(r => r.category === cat).map(report => (
                      <button 
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="group bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all text-left relative overflow-hidden"
                      >
                        <div className="relative z-10">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                            <FileBarChart className="w-6 h-6 text-blue-600 group-hover:text-white" />
                          </div>
                          <h3 className="font-black text-slate-900 text-lg mb-1 group-hover:text-blue-600 transition-colors">{report.name}</h3>
                          <p className="text-sm text-slate-500 font-medium leading-relaxed">{report.description}</p>
                        </div>
                        <ChevronRight className="absolute bottom-6 right-6 w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-50/50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end print:hidden">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date Range</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filters.startDate}
                      onChange={e => setFilters({...filters, startDate: e.target.value})}
                    />
                    <span className="text-slate-300">-</span>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={filters.endDate}
                      onChange={e => setFilters({...filters, endDate: e.target.value})}
                    />
                  </div>
                </div>
                {selectedReport && !['profit-loss', 'trial-balance', 'balance-sheet'].includes(selectedReport.id) && (
                  <div className="flex-1 min-w-[300px] flex gap-4">
                    <div className="w-1/2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Account Name</label>
                      <input 
                        type="text"
                        placeholder="Filter by account..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={(filters as any).accountName || ''}
                        onChange={e => setFilters({...filters, accountName: e.target.value} as any)}
                      />
                    </div>
                  </div>
                )}
                <button 
                  className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors flex items-center gap-2 h-[44px]"
                  onClick={() => setSelectedReport({...selectedReport!})}
                >
                  Apply Filters
                </button>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-none">
                <div className="hidden print:block p-12 border-b-4 border-slate-900">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-4xl font-black text-slate-900 mb-2">{company?.name}</h1>
                      <p className="text-slate-600 font-bold max-w-md">{company?.address}</p>
                      <p className="text-slate-500 mt-1">TIN: {company?.tin || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <h2 className="text-2xl font-black text-blue-600 mb-1">{selectedReport.name}</h2>
                      <p className="text-slate-500 font-bold">
                        {filters.startDate ? `From: ${filters.startDate}` : 'Beginning'} - {filters.endDate ? `To: ${filters.endDate}` : 'Today'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-4 uppercase font-black">Generated: {new Date().toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  {loadingReport ? (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-slate-500 font-black">Generating Report...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {selectedReport?.id === 'profit-loss' ? (
                        <div className="space-y-8">
                          <section>
                            <h3 className="text-emerald-600 font-black uppercase tracking-widest text-xs mb-4">Operating Income</h3>
                            <div className="divide-y divide-slate-100">
                              {reportData?.income?.map((i: any, idx: number) => (
                                <div key={idx} className="flex justify-between py-3">
                                  <span className="font-bold text-slate-700">{i.name}</span>
                                  <span className="font-black text-slate-900">{i.amount.toLocaleString()}</span>
                                </div>
                              ))}
                              <div className="flex justify-between py-4 border-t-2 border-emerald-100 bg-emerald-50 px-4 rounded-xl mt-2">
                                <span className="font-black text-emerald-700">Total Income</span>
                                <span className="font-black text-emerald-900">{reportData?.totalIncome?.toLocaleString()}</span>
                              </div>
                            </div>
                          </section>
                          <section>
                            <h3 className="text-rose-600 font-black uppercase tracking-widest text-xs mb-4">Operating Expenses</h3>
                            <div className="divide-y divide-slate-100">
                              {reportData?.expenses?.map((e: any, idx: number) => (
                                <div key={idx} className="flex justify-between py-3">
                                  <span className="font-bold text-slate-700">{e.name}</span>
                                  <span className="font-black text-slate-900">{e.amount.toLocaleString()}</span>
                                </div>
                              ))}
                              <div className="flex justify-between py-4 border-t-2 border-rose-100 bg-rose-50 px-4 rounded-xl mt-2">
                                <span className="font-black text-rose-700">Total Expenses</span>
                                <span className="font-black text-rose-900">{reportData?.totalExpense?.toLocaleString()}</span>
                              </div>
                            </div>
                          </section>
                          <div className="flex justify-between py-6 border-y-4 border-slate-900 mt-10">
                            <h2 className="text-2xl font-black text-slate-900">Net Profit / (Loss)</h2>
                            <span className={cn(
                              "text-3xl font-black",
                              reportData?.netProfit >= 0 ? "text-blue-600" : "text-rose-600"
                            )}>
                              {reportData?.netProfit?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : selectedReport?.id === 'balance-sheet' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <div className="space-y-8">
                            <section>
                              <h3 className="text-emerald-600 font-black uppercase tracking-widest text-xs mb-4">Assets</h3>
                              <div className="divide-y divide-slate-100">
                                {reportData?.assets?.map((a: any, idx: number) => (
                                  <div key={idx} className="flex justify-between py-3">
                                    <span className="font-bold text-slate-700">{a.name}</span>
                                    <span className="font-black text-slate-900">{a.balance.toLocaleString()}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between py-4 border-t-2 border-emerald-100 bg-emerald-50 px-4 rounded-xl mt-2">
                                  <span className="font-black text-emerald-700">Total Assets</span>
                                  <span className="font-black text-emerald-900">
                                    {reportData?.assets?.reduce((sum: number, a: any) => sum + (a.balance || 0), 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </section>
                          </div>
                          
                          <div className="space-y-8">
                            <section>
                              <h3 className="text-rose-600 font-black uppercase tracking-widest text-xs mb-4">Liabilities</h3>
                              <div className="divide-y divide-slate-100">
                                {reportData?.liabilities?.map((l: any, idx: number) => (
                                  <div key={idx} className="flex justify-between py-3">
                                    <span className="font-bold text-slate-700">{l.name}</span>
                                    <span className="font-black text-slate-900">{l.balance.toLocaleString()}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between py-4 border-t-2 border-rose-100 bg-rose-50 px-4 rounded-xl mt-2">
                                  <span className="font-black text-rose-700">Total Liabilities</span>
                                  <span className="font-black text-rose-900">
                                    {reportData?.liabilities?.reduce((sum: number, l: any) => sum + (l.balance || 0), 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </section>

                            <section>
                              <h3 className="text-blue-600 font-black uppercase tracking-widest text-xs mb-4">Equity</h3>
                              <div className="divide-y divide-slate-100">
                                {reportData?.equity?.map((e: any, idx: number) => (
                                  <div key={idx} className="flex justify-between py-3">
                                    <span className="font-bold text-slate-700">{e.name}</span>
                                    <span className="font-black text-slate-900">{e.balance.toLocaleString()}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between py-4 border-t-2 border-blue-100 bg-blue-50 px-4 rounded-xl mt-2">
                                  <span className="font-black text-blue-700">Total Equity</span>
                                  <span className="font-black text-blue-900">
                                    {reportData?.equity?.reduce((sum: number, e: any) => sum + (e.balance || 0), 0).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </section>

                            <div className="flex justify-between py-6 border-y-4 border-slate-900 mt-10">
                              <h2 className="text-xl font-black text-slate-900">Total Liabilities + Equity</h2>
                              <span className="text-2xl font-black text-slate-900">
                                {((reportData?.liabilities?.reduce((s: number, l: any) => s + (l.balance || 0), 0) || 0) + 
                                  (reportData?.equity?.reduce((s: number, e: any) => s + (e.balance || 0), 0) || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <table className="w-full text-sm text-left">
                          {selectedReport?.id === 'ledger' && (
                            <>
                              <thead>
                                <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                  <th className="py-4 px-2">Date</th>
                                  <th className="py-4 px-2">Reference</th>
                                  <th className="py-4 px-2">Description</th>
                                  <th className="py-4 px-2 text-right">Debit</th>
                                  <th className="py-4 px-2 text-right">Credit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {reportData?.map((line: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-2 font-bold text-slate-500 whitespace-nowrap">
                                      {new Date(line.journalEntry.date).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-2 font-black text-slate-900">{line.journalEntry.entryNumber}</td>
                                    <td className="py-4 px-2 font-medium text-slate-600">{line.description || line.journalEntry.description}</td>
                                    <td className="py-4 px-2 text-right font-bold text-emerald-600">
                                      {line.debit > 0 ? line.debit.toLocaleString() : '-'}
                                    </td>
                                    <td className="py-4 px-2 text-right font-bold text-rose-600">
                                      {line.credit > 0 ? line.credit.toLocaleString() : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                          {selectedReport?.id === 'trial-balance' && (
                            <>
                              <thead>
                                <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                  <th className="py-4 px-2">Account</th>
                                  <th className="py-4 px-2 text-right">Debit</th>
                                  <th className="py-4 px-2 text-right">Credit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {reportData?.map((account: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-2 font-black text-slate-900">{account.name || account.accountName}</td>
                                    <td className="py-4 px-2 text-right font-bold text-emerald-600">
                                      {(account.debit || 0) > 0 ? (account.debit || 0).toLocaleString() : '-'}
                                    </td>
                                    <td className="py-4 px-2 text-right font-bold text-rose-600">
                                      {(account.credit || 0) > 0 ? (account.credit || 0).toLocaleString() : '-'}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-slate-900 font-black text-lg">
                                  <td className="py-4 px-2">Total</td>
                                  <td className="py-4 px-2 text-right text-emerald-600">
                                    {Array.isArray(reportData) 
                                      ? reportData.reduce((sum: number, acc: any) => sum + (acc.debit || 0), 0).toLocaleString()
                                      : (reportData?.totalDebit || 0).toLocaleString()}
                                  </td>
                                  <td className="py-4 px-2 text-right text-rose-600">
                                    {Array.isArray(reportData) 
                                      ? reportData.reduce((sum: number, acc: any) => sum + (acc.credit || 0), 0).toLocaleString()
                                      : (reportData?.totalCredit || 0).toLocaleString()}
                                  </td>
                                </tr>
                              </tbody>
                            </>
                          )}
                          {(selectedReport?.id === 'customer-aging' || selectedReport?.id === 'vendor-aging') && (
                            <>
                              <thead>
                                <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                  <th className="py-4 px-2">Entity Name</th>
                                  <th className="py-4 px-2 text-right">Current</th>
                                  <th className="py-4 px-2 text-right">1-30 Days</th>
                                  <th className="py-4 px-2 text-right">31-60 Days</th>
                                  <th className="py-4 px-2 text-right">61-90 Days</th>
                                  <th className="py-4 px-2 text-right">Total Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {reportData?.map((row: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-2 font-black text-slate-900">{row.name}</td>
                                    <td className="py-4 px-2 text-right font-bold">{row.dueCurrent.toLocaleString()}</td>
                                    <td className="py-4 px-2 text-right font-bold text-slate-400">-</td>
                                    <td className="py-4 px-2 text-right font-bold text-slate-400">-</td>
                                    <td className="py-4 px-2 text-right font-bold text-slate-400">-</td>
                                    <td className="py-4 px-2 text-right font-black text-blue-600">{row.balance.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                          {selectedReport?.id === 'lc-liability' && (
                            <>
                              <thead>
                                <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                  <th className="py-4 px-2">LC Number</th>
                                  <th className="py-4 px-2">Bank</th>
                                  <th className="py-4 px-2">Issue Date</th>
                                  <th className="py-4 px-2">Expiry</th>
                                  <th className="py-4 px-2 text-right">LC Amount</th>
                                  <th className="py-4 px-2 text-right">Rate</th>
                                  <th className="py-4 px-2 text-right">Exposure (BDT)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {reportData?.map((lc: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-2 font-black text-slate-900">{lc.lcNumber}</td>
                                    <td className="py-4 px-2 font-bold text-slate-600">{lc.bankName}</td>
                                    <td className="py-4 px-2 font-medium text-slate-500">{new Date(lc.issueDate).toLocaleDateString()}</td>
                                    <td className="py-4 px-2 font-black text-amber-600">{new Date(lc.expiryDate).toLocaleDateString()}</td>
                                    <td className="py-4 px-2 text-right font-bold">{lc.amount.toLocaleString()} {lc.currency}</td>
                                    <td className="py-4 px-2 text-right font-medium text-slate-400">{lc.conversionRate}</td>
                                    <td className="py-4 px-2 text-right font-black text-red-600">{(lc.amount * lc.conversionRate).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                        </table>
                      )}
                    </div>
                  )}

                  {!loadingReport && (!reportData || reportData.length === 0) && selectedReport?.id !== 'profit-loss' && (
                    <div className="py-20 text-center">
                      <p className="text-slate-400 font-bold">No transaction data found for selected filters</p>
                    </div>
                  )}
                </div>

                <div className="hidden print:flex justify-between items-center p-12 border-t-2 border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <span>System Report: Accounting Engine v2.0</span>
                  <span>Generated by: {company?.name} Terminal</span>
                  <span>Page 1 of 1</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
