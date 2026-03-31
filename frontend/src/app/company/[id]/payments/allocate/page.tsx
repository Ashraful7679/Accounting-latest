'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Link2, Search, Plus, CheckCircle2, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';


interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  customer?: { name: string };
  vendor?: { name: string };
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  date: string;
  reference: string;
  unallocatedAmount: number;
  customer?: { name: string };
  vendor?: { name: string };
}

export default function PaymentAllocationPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [allocations, setAllocations] = useState<{ invoiceId: string; amount: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['unallocated-payments', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/payments?status=COMPLETED&unallocated=true`);
      return response.data.data as Payment[];
    },
    enabled: !!companyId,
  });

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['pending-invoices', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/invoices?status=APPROVED&pending=true`);
      return response.data.data as Invoice[];
    },
    enabled: !!companyId && !!selectedPayment,
  });

  const allocateMutation = useMutation({
    mutationFn: async (data: { paymentId: string; allocations: { invoiceId: string; amount: number }[] }) => {
      const response = await api.post(`/company/${companyId}/payments/allocate`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unallocated-payments', companyId] });
      toast.success('Payment allocated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to allocate payment');
    },
  });

  const openAllocation = (payment: Payment) => {
    setSelectedPayment(payment);
    setAllocations([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPayment(null);
    setAllocations([]);
  };

  const handleAllocationChange = (invoiceId: string, amount: number) => {
    const existing = allocations.find(a => a.invoiceId === invoiceId);
    if (existing) {
      setAllocations(allocations.map(a => a.invoiceId === invoiceId ? { ...a, amount } : a));
    } else {
      setAllocations([...allocations, { invoiceId, amount }]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    
    const validAllocations = allocations.filter(a => a.amount > 0);
    if (validAllocations.length === 0) {
      toast.error('Please allocate at least one invoice');
      return;
    }
    
    allocateMutation.mutate({
      paymentId: selectedPayment.id,
      allocations: validAllocations,
    });
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

  if (!mounted) return null;

  return (
    <div className="min-h-screen">



        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Allocate Payments to Invoices</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Party</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Unallocated</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingPayments ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : !paymentsData || paymentsData.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No unallocated payments found</td></tr>
                ) : (
                  paymentsData.map((payment: Payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">
                        {payment.date ? new Date(payment.date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">{payment.reference || '-'}</td>
                      <td className="px-4 py-3">{payment.customer?.name || payment.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{payment.currency} {payment.amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">{payment.currency} {(payment.unallocatedAmount || payment.amount)?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => openAllocation(payment)}
                          className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1 mx-auto"
                        >
                          <Link2 className="w-3 h-3" />
                          Allocate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-semibold mb-4">How Payment Allocation Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="flex gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <p>Select a payment that needs to be allocated</p>
              </div>
              <div className="flex gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <p>Choose which invoices to allocate the payment to</p>
              </div>
              <div className="flex gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <p>Enter the amount for each invoice and save</p>
              </div>
            </div>
          </div>
        </div>
      

      {showModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Allocate Payment</h3>
            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-slate-500">Payment Reference: {selectedPayment.reference}</p>
              <p className="text-sm text-slate-500">Available to Allocate: {selectedPayment.currency} {selectedPayment.unallocatedAmount?.toLocaleString() || selectedPayment.amount?.toLocaleString()}</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Invoices</label>
                {loadingInvoices ? (
                  <p className="text-slate-500">Loading invoices...</p>
                ) : !invoicesData || invoicesData.length === 0 ? (
                  <p className="text-slate-500">No pending invoices found</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {invoicesData.map((invoice: Invoice) => (
                      <div key={invoice.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <input
                          type="checkbox"
                          checked={allocations.some(a => a.invoiceId === invoice.id)}
                          onChange={(e) => handleAllocationChange(invoice.id, e.target.checked ? invoice.dueAmount : 0)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-slate-500">{invoice.customer?.name || invoice.vendor?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono">Due: {invoice.dueAmount?.toLocaleString()}</p>
                        </div>
                        {allocations.some(a => a.invoiceId === invoice.id) && (
                          <input
                            type="number"
                            step="0.01"
                            value={allocations.find(a => a.invoiceId === invoice.id)?.amount || 0}
                            onChange={(e) => handleAllocationChange(invoice.id, parseFloat(e.target.value))}
                            className="w-24 input text-right"
                            max={invoice.dueAmount}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between mb-4">
                  <span className="font-medium">Total Allocated:</span>
                  <span className="font-mono font-bold">{selectedPayment.currency} {totalAllocated.toLocaleString()}</span>
                </div>
                {totalAllocated > (selectedPayment.unallocatedAmount || selectedPayment.amount) && (
                  <p className="text-red-500 text-sm mb-4">Warning: Allocation exceeds available amount</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button 
                  type="submit" 
                  disabled={allocateMutation.isPending || totalAllocated <= 0}
                  className="btn btn-primary flex-1"
                >
                  {allocateMutation.isPending ? 'Processing...' : 'Allocate Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
