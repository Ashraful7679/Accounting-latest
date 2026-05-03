'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  X, Save, Loader2, CreditCard, 
  Banknote, Calendar, FileText, User
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import React from 'react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId?: string;
  lcId?: string;
  defaultAmount?: number;
  companyId: string;
  currency: string;
}

export function PaymentModal({ isOpen, onClose, invoiceId, lcId, defaultAmount, companyId, currency }: PaymentModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: defaultAmount || 0,
    method: 'BANK',
    accountId: '',
    reference: '',
    description: ''
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts', companyId],
    queryFn: async () => {
      const res = await api.get(`/company/${companyId}/accounts`);
      return res.data.data;
    },
    enabled: !!companyId && isOpen
  });

  const bankAccounts = accounts?.filter((a: any) => a.category === 'BANK' || a.category === 'CASH') || [];

  const createPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/company/${companyId}/payments`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['lcs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payments', companyId] });
      toast.success('Payment recorded successfully');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId) { toast.error('Please select an account'); return; }
    if (formData.amount <= 0) { toast.error('Amount must be greater than zero'); return; }

    createPaymentMutation.mutate({
      ...formData,
      invoiceId,
      lcId,
      amount: Number(formData.amount)
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-900" />
            <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Record Payment</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-xs font-mono focus:border-gray-900 outline-none transition-colors"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Amount ({currency})</label>
              <div className="relative">
                <Banknote className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="number"
                  step="any"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-xs font-mono font-bold focus:border-gray-900 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Account / Bank</label>
            <select 
              required
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-sm text-xs font-bold uppercase tracking-tight focus:border-gray-900 outline-none transition-colors bg-white"
            >
              <option value="">SELECT ACCOUNT...</option>
              {bankAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({a.category})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reference / Cheque No.</label>
            <input 
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-sm text-xs focus:border-gray-900 outline-none transition-colors"
              placeholder="Ref #..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-sm text-xs focus:border-gray-900 outline-none transition-colors h-20 resize-none"
              placeholder="Payment notes..."
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit"
              disabled={createPaymentMutation.isPending}
              className="px-8 py-2.5 bg-gray-900 text-white rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {createPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
