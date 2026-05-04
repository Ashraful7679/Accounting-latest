'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Building2, Loader2, LogOut } from 'lucide-react';
import { formatCurrency } from '@/lib/decimalUtils';
import { AlertCircle } from 'lucide-react';

export default function VendorPortalPage() {
  const params = useParams();
  const companyId = params.companyId as string;
  const token = params.token as string;

  const [activeTab, setActiveTab] = useState<'summary' | 'invoices' | 'payments'>('summary');

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendor-portal', companyId, token],
    queryFn: () => api.get(`/portal/${companyId}/vendor/${token}`).then(r => r.data.data),
    enabled: !!companyId && !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data?.vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-red-700">Access Denied</h1>
          <p className="text-red-600 mt-2">Invalid or expired portal link</p>
        </div>
      </div>
    );
  }

  const { vendor, invoices, payments, aging, summary } = data;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="font-bold text-slate-900">{vendor.companyName || 'Vendor Portal'}</h1>
              <p className="text-xs text-slate-500">Welcome, {vendor.name}</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">{vendor.code}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-xs text-slate-500 uppercase">Amount Owed</p>
            <p className="text-2xl font-black text-rose-600 mt-1">৳ {formatCurrency(summary.totalDue)}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-xs text-slate-500 uppercase">Credit Limit</p>
            <p className="text-2xl font-black text-blue-600 mt-1">৳ {formatCurrency(vendor.creditLimit || 0)}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-xs text-slate-500 uppercase">Open PIs</p>
            <p className="text-2xl font-black text-slate-700 mt-1">{summary.openInvoices}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <p className="text-xs text-slate-500 uppercase">Paid</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">৳ {formatCurrency(summary.totalPaid)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="font-bold text-slate-700 mb-4">Aging Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">Current</p>
              <p className="text-lg font-bold text-emerald-600">৳ {formatCurrency(aging.current)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">1-30 Days</p>
              <p className="text-lg font-bold text-yellow-600">৳ {formatCurrency(aging.days30)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">31-60 Days</p>
              <p className="text-lg font-bold text-orange-600">৳ {formatCurrency(aging.days60)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase">90+ Days</p>
              <p className="text-lg font-bold text-red-600">৳ {formatCurrency(aging.days90Plus)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="flex border-b">
            <button onClick={() => setActiveTab('summary')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'summary' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Summary</button>
            <button onClick={() => setActiveTab('invoices')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'invoices' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Purchase Invoices</button>
            <button onClick={() => setActiveTab('payments')} className={`px-6 py-3 font-bold text-sm ${activeTab === 'payments' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Payments</button>
          </div>

          <div className="p-6">
            {activeTab === 'invoices' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b">
                    <th className="pb-3">PI #</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Due Date</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices?.map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="py-3 font-mono">{inv.number}</td>
                      <td className="py-3">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="py-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="py-3 text-right font-bold">৳ {formatCurrency(inv.total)}</td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                          inv.status === 'PARTIALLY_PAID' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-rose-50 text-rose-600'
                        }`}>{inv.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'payments' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase border-b">
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments?.map((pay: any) => (
                    <tr key={pay.id}>
                      <td className="py-3">{new Date(pay.date).toLocaleDateString()}</td>
                      <td className="py-3 text-right font-bold text-emerald-600">৳ {formatCurrency(pay.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}