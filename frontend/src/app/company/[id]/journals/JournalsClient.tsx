'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  Plus, Search, Filter, Download, Upload, Printer, Send, Check, X, 
  Edit2, Trash2, Eye, ArrowLeft, ChevronRight, ArrowRight, Info, 
  CheckCheck, FileText, Clock, Bell, MoreHorizontal, Wallet, Receipt
} from 'lucide-react';
import api from '@/lib/api';
import NotificationPanel from '@/components/NotificationPanel';
import UserDropdown from '@/components/UserDropdown';
import { renderActivityMessage, type ActivityLog } from '@/utils/activityRenderer';
import { handleError } from '@/lib/error-handler';
import { buildPrintDocument, openPrintWindow } from '@/lib/printUtils';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: { name: string };
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string | null;
  status: string;
  totalDebit: number;
  totalCredit: number;
  lines: any[];
  createdBy: any;
  verifiedBy?: any;
  approvedBy?: any;
}

interface Line {
  accountId: string;
  amount: number;
  debitCredit: 'debit' | 'credit';
  description?: string;
}

export default function JournalsClient() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [userRole, setUserRole] = useState<string>('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const numberToWords = (num: number): string => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    const convert = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };

    const main = Math.floor(num);
    const decimal = Math.round((num - main) * 100);
    
    if (main === 0) return 'zero';
    return convert(main) + (decimal > 0 ? ' and ' + (decimal < 20 ? ones[decimal] : tens[Math.floor(decimal / 10)] + (decimal % 10 ? '-' + ones[decimal % 10] : '')) + ' paisa' : '');
  };

  const handlePrintVoucher = async (journal: any) => {
    try {
      const companyRes = await api.get(`/company/${companyId}`);
      const c = companyRes.data.data;
      const company = {
        name: c.name, address: c.address, phone: c.phone,
        email: c.email, taxId: c.taxId || c.tin,
        registrationNumber: c.registrationNumber, website: c.website,
      };

      const body = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px;">
          <div>
            <h1 style="margin:0 0 4px 0;">JOURNAL VOUCHER</h1>
            <span class="status-badge">${journal.status}</span>
          </div>
          <div style="text-align:right; font-size:13px;">
            <p style="margin:2px 0;"><strong>Voucher #:</strong> ${journal.entryNumber}</p>
            <p style="margin:2px 0;"><strong>Date:</strong> ${new Date(journal.date).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="meta-grid">
          <div class="meta-field"><label>Description</label><span>${journal.description || '-'}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th style="text-align:right;">Debit</th>
              <th style="text-align:right;">Credit</th>
            </tr>
          </thead>
          <tbody>
            ${(journal.lines || []).map((line: any) => `
              <tr>
                <td>
                  <div style="font-weight:bold;">${line.account?.name || 'Unknown'}</div>
                  <div style="font-size:11px; color:#64748b;">${line.account?.code || ''}</div>
                </td>
                <td style="text-align:right; color:#059669; font-weight:600;">${line.debit > 0 ? line.debit.toLocaleString() : '-'}</td>
                <td style="text-align:right; color:#dc2626; font-weight:600;">${line.credit > 0 ? line.credit.toLocaleString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>Total Debit: <strong>${journal.totalDebit.toLocaleString()}</strong></p>
          <p class="grand-total">Total Credit: ${journal.totalCredit.toLocaleString()}</p>
        </div>
        <div class="in-words" style="margin-top:24px; padding:16px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <p style="font-size:12px; color:#64748b; margin-bottom:4px;">In Words</p>
          <p style="font-size:14px; font-weight:600; color:#334155; text-transform:capitalize;">${numberToWords(journal.totalDebit)} Taka Only</p>
        </div>
      `;

      openPrintWindow(buildPrintDocument({ 
        title: `Journal Voucher - ${journal.entryNumber}`, 
        company, 
        body,
        signatures: {
          createdBy: `${journal.createdBy?.firstName || '-'} ${journal.createdBy?.lastName || ''}`,
          verifiedBy: journal.verifiedBy?.firstName ? `${journal.verifiedBy.firstName} ${journal.verifiedBy.lastName}` : undefined,
          approvedBy: journal.approvedBy?.firstName ? `${journal.approvedBy.firstName} ${journal.approvedBy.lastName}` : undefined
        }
      }));
    } catch {
      toast.error('Could not load company info for printing.');
    }
  };

  const { data: journalsData, isLoading } = useQuery({
    queryKey: ['journals', companyId, page],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/journals?limit=${limit}&page=${page}`);
      return response.data.data;
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ['accounts', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/accounts?tree=true`);
      return response.data.data;
    },
  });

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [{ accountId: '', amount: 0, debitCredit: 'debit' as const, description: '' }] as Line[],
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  const uploadAttachments = async (journalId: string) => {
    for (const file of attachments) {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(
        `/company/${companyId}/attachments/upload?entityType=VOUCHER&entityId=${journalId}&documentType=GENERAL`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    }
  };

  const openModal = (journal?: JournalEntry) => {
    if (journal) {
      setEditingJournalId(journal.id);
      const lines = (journal.lines || []).map((l: any) => {
        const debit = Number(l.debit) || 0;
        const credit = Number(l.credit) || 0;
        const amount = debit > 0 ? debit : credit;
        const debitCredit = debit > 0 ? 'debit' : (credit > 0 ? 'credit' : 'debit');
        return {
          accountId: l.accountId || '',
          amount,
          debitCredit: debitCredit as 'debit' | 'credit',
          description: l.description || '',
        };
      });
      setFormData({
        date: journal.date ? new Date(journal.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description: journal.description || '',
        lines: lines.length > 0 ? lines : [{ accountId: '', amount: 0, debitCredit: 'debit' as const, description: '' }],
      });
    } else {
      setEditingJournalId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [{ accountId: '', amount: 0, debitCredit: 'debit' as const, description: '' }],
      });
    }
    setAttachments([]);
    setShowModal(true);
    setShowViewModal(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingJournalId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      lines: [{ accountId: '', amount: 0, debitCredit: 'debit' as const, description: '' }],
    });
    setAttachments([]);
  };

  const openViewModal = async (journal: JournalEntry) => {
    const response = await api.get(`/company/${companyId}/journals/${journal.id}`);
    setSelectedJournal(response.data.data);
    setShowViewModal(true);
    setShowModal(false);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedJournal(null);
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', amount: 0, debitCredit: 'debit', description: '' }],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 1) {
      setFormData({
        ...formData,
        lines: formData.lines.filter((_, i) => i !== index),
      });
    }
  };

  const updateLine = (index: number, field: keyof Line, value: any) => {
    const newLines = [...formData.lines];
    (newLines[index] as any)[field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const calculateTotals = () => {
    return formData.lines.reduce(
      (acc, line) => {
        if (line.debitCredit === 'debit') acc.totalDebit += line.amount;
        else acc.totalCredit += line.amount;
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 }
    );
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/journals`, data);
      return response.data;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      if (attachments.length > 0 && data?.data?.id) {
        await uploadAttachments(data.data.id);
      }
      toast.success('Journal created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create journal');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/journals/${id}`, data);
      return response.data;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      if (editingJournalId && attachments.length > 0) {
        await uploadAttachments(editingJournalId);
      }
      toast.success('Journal updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update journal');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/journals/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success('Journal deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete journal');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/company/${companyId}/journals/${id}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success('Journal submitted for verification');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit journal');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/company/${companyId}/journals/${id}/verify`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success('Journal verified');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to verify journal');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/company/${companyId}/journals/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success('Journal approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve journal');
    },
  });

  const handleEdit = (journal: JournalEntry) => {
    openModal(journal);
    setShowViewModal(false);
  };

  const navigateJournal = async (direction: 'next' | 'prev') => {
    if (!journalsData || !selectedJournal) return;
    
    const currentIndex = journalsData.findIndex((j: any) => j.id === selectedJournal.id);
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

    if (newIndex >= 0 && newIndex < journalsData.length) {
      const nextJournal = journalsData[newIndex];
      const response = await api.get(`/company/${companyId}/journals/${nextJournal.id}`);
      setSelectedJournal(response.data.data);
    } else {
      toast.error(`No more journals in this ${direction === 'next' ? 'direction' : 'page'}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
      VERIFIED: 'bg-blue-100 text-blue-800',
      PENDING_APPROVAL: 'bg-purple-100 text-purple-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const canVerify = (status: string) => 
    status === 'PENDING_VERIFICATION' && (userRole === 'Manager' || userRole === 'Owner' || userRole === 'Admin');
  
  const canApprove = (status: string) => 
    (status === 'VERIFIED' || status === 'PENDING_APPROVAL') && (userRole === 'Owner' || userRole === 'Admin');
  
  const canDelete = (status: string) => status === 'DRAFT';

  useEffect(() => {
    const role = localStorage.getItem('userRole') || JSON.parse(localStorage.getItem('roles') || '[]')[0] || '';
    setUserRole(role);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { totalDebit, totalCredit } = calculateTotals();
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error('Total Debit must equal Total Credit');
      return;
    }
    if (totalDebit === 0) {
      toast.error('Journal entry cannot be empty');
      return;
    }
    if (editingJournalId) {
      updateMutation.mutate({ id: editingJournalId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!companyId) return <div>Loading...</div>;

  return (
    <div className="min-h-screen">
      <NotificationPanel companyId={companyId} isOpen={notifOpen} onClose={() => setNotifOpen(false)} />

      <div className="p-6 max-w-[1600px] mx-auto space-y-8 flex gap-8 items-start print-hide">
        <div className="flex-1 space-y-8">
            <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Engine</h2>
            <div className="flex items-center gap-3">
              {(userRole === 'Accountant' || userRole === 'Owner' || userRole === 'Admin') && (
                <button onClick={() => openModal()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                  <Plus className="w-5 h-5" />
                  Create Voucher
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Entry #</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {journalsData?.map((journal: any) => (
                    <tr key={journal.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{journal.entryNumber}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                        {new Date(journal.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 italic max-w-xs truncate">{journal.description || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 text-right font-mono font-bold">{journal.totalDebit.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${getStatusBadge(journal.status)}`}>
                          {journal.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openViewModal(journal)} className="p-1.5 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePrintVoucher(journal)} className="p-1.5 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all" title="Print Voucher">
                            <Printer className="w-4 h-4" />
                          </button>
                          {(journal.status === 'DRAFT' || journal.status === 'REJECTED') && (
                            <button onClick={() => handleEdit(journal)} className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all" title="Edit Entry">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {(journal.status === 'DRAFT' || journal.status === 'REJECTED') && (
                            <button onClick={() => submitMutation.mutate(journal.id)} className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all" title="Submit for Verification">
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {canVerify(journal.status) && (
                            <button onClick={() => verifyMutation.mutate(journal.id)} className="p-1.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 border border-transparent hover:border-emerald-100 rounded-lg transition-all" title="Verify">
                              <CheckCheck className="w-4 h-4" />
                            </button>
                          )}
                          {canApprove(journal.status) && (
                            <button onClick={() => approveMutation.mutate(journal.id)} className="p-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all" title="Approve">
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete(journal.status) && (
                            <button onClick={() => { if (confirm('Delete this journal?')) deleteMutation.mutate(journal.id); }} className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{editingJournalId ? 'Edit' : 'Create'} Journal Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input" disabled={userRole !== 'Owner'} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Journal Lines</label>
                <div className="space-y-2">
                  {formData.lines.map((line, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <select value={line.accountId} onChange={(e) => updateLine(index, 'accountId', e.target.value)} className="input flex-1" required>
                        <option value="">Select Account</option>
                        {accountsData?.map((account: any) => (
                          <option key={account.id} value={account.id}>
                            {account.code.split('-').pop()} - {account.name}
                          </option>
                        ))}
                      </select>
                      <select value={line.debitCredit} onChange={(e) => updateLine(index, 'debitCredit', e.target.value)} className="input w-24">
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                      <input type="number" value={line.amount} onChange={(e) => updateLine(index, 'amount', parseFloat(e.target.value) || 0)} className="input w-32" placeholder="Amount" required min="0" step="0.01" />
                      <button type="button" onClick={() => removeLine(index)} className="p-2 text-red-600 hover:text-red-800">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800 mt-2">
                    + Add Line
                  </button>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-end gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Debit: {getCurrencySymbol('BDT')}{formatCurrency(calculateTotals().totalDebit)}</p>
                    <p className="text-sm text-gray-500">Total Credit: {getCurrencySymbol('BDT')}{formatCurrency(calculateTotals().totalCredit)}</p>
                    {Math.abs(calculateTotals().totalDebit - calculateTotals().totalCredit) > 0.01 && (
                      <p className="text-sm text-red-500">Difference must be 0</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingJournalId ? 'Update Journal' : 'Create Journal')}
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAttachments(prev => [...prev, ...files]);
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {createMutation.isPending && (
                  <p className="text-xs text-blue-500 mt-1">Saving journal and attachments...</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedJournal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden no-print">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto no-print">
            <div className="flex justify-between items-center mb-6 print-hide">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold">Journal Entry Details</h3>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => navigateJournal('prev')} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-slate-900 disabled:opacity-30" title="Previous Journal">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button onClick={() => navigateJournal('next')} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-slate-900 disabled:opacity-30" title="Next Journal">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button onClick={closeViewModal} className="text-slate-400 hover:text-slate-600 text-2xl print-hide">&times;</button>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-6 print-hide">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Entry Number:</span>
                  <span className="font-medium text-slate-900">{selectedJournal.entryNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="text-slate-700">{new Date(selectedJournal.date).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(selectedJournal.status)}`}>
                    {selectedJournal.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-slate-100 rounded-lg overflow-hidden mb-8 print-hide">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-2">Account</th>
                    <th className="px-4 py-2">Line Description</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedJournal.lines?.map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2 border-r border-slate-50">
                        <div className="font-semibold text-slate-700">{line.account?.code}</div>
                        <div className="text-xs text-slate-500">{line.account?.name}</div>
                      </td>
                      <td className="px-4 py-2 text-slate-600 italic">
                        {line.description || '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">
                        {line.debit > 0 ? line.debit.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-rose-600">
                        {line.credit > 0 ? line.credit.toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black">
                    <td colSpan={2} className="px-4 py-3 text-right text-slate-900">Voucher Totals:</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{selectedJournal.totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-rose-600">{selectedJournal.totalCredit.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
