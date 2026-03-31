'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Briefcase, Plus, Search, Edit2, Trash2, Eye,
  Calendar, DollarSign, Building2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';


export default function LCPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedLC, setSelectedLC] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: lcsData, isLoading } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

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

  const filteredLCs = lcsData?.filter((lc: any) => {
    const matchesSearch = !searchTerm || 
      lc.lcNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lc.bankName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || lc.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen">



        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Letters of Credit</h2>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/company/${companyId}/lc/create/import`)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                New Import LC
              </button>
              <button
                onClick={() => router.push(`/company/${companyId}/lc/create/export`)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                New Export LC
              </button>
            </div>
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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="SETTLED">Settled</option>
              <option value="CLOSED">Closed</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">LC Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Bank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Expiry Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : filteredLCs.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No LCs found</td></tr>
                ) : (
                  filteredLCs.map((lc: any) => (
                    <tr key={lc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{lc.lcNumber}</td>
                      <td className="px-4 py-3">{lc.bankName}</td>
                      <td className="px-4 py-3 text-slate-500">{lc.type}</td>
                      <td className="px-4 py-3 text-right font-mono">{lc.currency} {lc.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{lc.issueDate ? new Date(lc.issueDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{lc.expiryDate ? new Date(lc.expiryDate).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(lc.status)}`}>{lc.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => router.push(`/company/${companyId}/finance/lc/${lc.id}`)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

    </div>
  );
}
