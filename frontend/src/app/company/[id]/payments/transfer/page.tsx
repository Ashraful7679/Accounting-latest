'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  ArrowLeftRight, Calendar, Building2, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';

export default function TransferPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    currency: 'USD',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/accounts?limit=100`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: transfersData, refetch: refetchTransfers } = useQuery({
    queryKey: ['transfers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/payments?method=TRANSFER`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const pendingTransfers = transfersData?.filter((t: any) => t.status === 'PENDING_VERIFICATION') || [];
  const approvedTransfers = transfersData?.filter((t: any) => t.status === 'APPROVED' || t.status === 'COMPLETED') || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/payments/transfer`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', companyId] });
      refetchTransfers();
      toast.success('Transfer created and pending verification');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create transfer');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await api.post(`/company/${companyId}/payments/${paymentId}/verify`);
      return response.data;
    },
    onSuccess: () => {
      refetchTransfers();
      toast.success('Transfer verified');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to verify transfer');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ paymentId, toAccountId }: { paymentId: string; toAccountId: string }) => {
      const response = await api.post(`/company/${companyId}/payments/${paymentId}/approve`, { toAccountId });
      return response.data;
    },
    onSuccess: () => {
      refetchTransfers();
      toast.success('Transfer approved and completed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve transfer');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setFormData({
      fromAccountId: '',
      toAccountId: '',
      amount: 0,
      currency: 'USD',
      date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen">



        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transfer Between Accounts</h2>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
            >
              <ArrowLeftRight className="w-4 h-4" />
              New Transfer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pending Transfers</p>
                  <p className="text-xl font-bold">{pendingTransfers.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Completed</p>
                  <p className="text-xl font-bold">{approvedTransfers.length}</p>
                </div>
              </div>
            </div>
          </div>

          {pendingTransfers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Pending Verification
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Ref</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTransfers.map((t: any) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="p-3">{t.paymentNumber}</td>
                        <td className="p-3 font-semibold">{formatCurrency(t.amount)}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            Pending Verification
                          </span>
                        </td>
                        <td className="p-3 flex gap-2">
                          <button
                            onClick={() => verifyMutation.mutate(t.id)}
                            disabled={verifyMutation.isPending}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Verify"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          {t.status === 'APPROVED' && (
                            <button
                              onClick={() => approveMutation.mutate({ paymentId: t.id, toAccountId: formData.toAccountId || accountsData?.[0]?.id })}
                              disabled={approveMutation.isPending}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Approve & Execute"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-semibold mb-4">Transfer History</h3>
            {transfersData?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Ref</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfersData.slice(0, 10).map((t: any) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="p-3">{t.paymentNumber}</td>
                        <td className="p-3 font-semibold">{formatCurrency(t.amount)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            t.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center">Recent transfers will appear here</p>
            )}
          </div>
        </div>
      

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-4">Transfer Between Accounts</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Account *</label>
                <select 
                  value={formData.fromAccountId} 
                  onChange={(e) => setFormData({...formData, fromAccountId: e.target.value})} 
                  className="input" 
                  required
                >
                  <option value="">Select Source Account</option>
                  {accountsData?.filter((a: any) => a.code.endsWith('1000') || a.category === 'BANK').map((a: any) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">To Account *</label>
                <select 
                  value={formData.toAccountId} 
                  onChange={(e) => setFormData({...formData, toAccountId: e.target.value})} 
                  className="input" 
                  required
                >
                  <option value="">Select Destination Account</option>
                  {accountsData?.filter((a: any) => a.code.endsWith('1000') || a.category === 'BANK' || a.category === 'CASH').map((a: any) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})} 
                    className="input" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="input" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input type="text" value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} className="input" placeholder="Optional reference" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input" rows={2} />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending ? 'Processing...' : 'Create Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
