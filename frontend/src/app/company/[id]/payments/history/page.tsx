'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import UserDropdown from '@/components/UserDropdown';
import { 
  History, Search, Filter, Eye, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';

interface Payment {
  id: string;
  type: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  date: string;
  reference: string;
  status: string;
  customer?: { name: string };
  vendor?: { name: string };
  account?: { name: string; code: string };
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('all');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payment-history', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/payments`);
      return response.data.data as Payment[];
    },
    enabled: !!companyId,
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredPayments = paymentsData?.filter((payment: Payment) => {
    const matchesSearch = !searchTerm || 
      payment.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || payment.type === filterType;
    
    let matchesDate = true;
    if (filterDate === 'today') {
      const today = new Date().toISOString().split('T')[0];
      matchesDate = payment.date?.startsWith(today);
    } else if (filterDate === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      matchesDate = new Date(payment.date) >= weekAgo;
    } else if (filterDate === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      matchesDate = new Date(payment.date) >= monthAgo;
    }
    
    return matchesSearch && matchesType && matchesDate;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName="Payment History" />

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <h1 className="text-xl font-bold text-slate-900">Payment History</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown />
          </div>
        </header>

        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">All Payments</h2>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by reference or party name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="RECEIVE">Receive</option>
              <option value="MAKE">Make</option>
              <option value="TRANSFER">Transfer</option>
            </select>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Party</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredPayments.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No payments found</td></tr>
                ) : (
                  filteredPayments.map((payment: Payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">
                        {payment.date ? new Date(payment.date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 ${payment.type === 'RECEIVE' ? 'text-green-600' : payment.type === 'MAKE' ? 'text-red-600' : 'text-blue-600'}`}>
                          {payment.type === 'RECEIVE' ? <ArrowDownLeft className="w-4 h-4" /> : payment.type === 'MAKE' ? <ArrowUpRight className="w-4 h-4" /> : <History className="w-4 h-4" />}
                          {payment.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{payment.customer?.name || payment.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{payment.currency} {payment.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{payment.paymentMethod}</td>
                      <td className="px-4 py-3 text-slate-500">{payment.reference || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(payment.status)}`}>{payment.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
