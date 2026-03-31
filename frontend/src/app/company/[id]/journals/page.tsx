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
import { AttachmentManager } from '@/components/AttachmentManager';

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

export default function JournalsPage() {
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
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:32px; margin-top:48px; padding-top:24px; border-top:1px solid #e2e8f0;">
          <div style="text-align:center;">
            <p style="border-top:1px solid #64748b; padding-top:8px; font-weight:600;">Prepared By</p>
            <p style="font-size:12px; color:#64748b; margin-top:4px;">${journal.createdBy?.firstName || '-'} ${journal.createdBy?.lastName || ''}</p>
          </div>
          <div style="text-align:center;">
            <p style="border-top:1px solid #64748b; padding-top:8px; font-weight:600;">Verified By</p>
            <p style="font-size:12px; color:#64748b; margin-top:4px;">${journal.verifiedBy?.firstName ? `${journal.verifiedBy.firstName} ${journal.verifiedBy.lastName}` : '...........................'}</p>
          </div>
          <div style="text-align:center;">
            <p style="border-top:1px solid #64748b; padding-top:8px; font-weight:600;">Approved By</p>
            <p style="font-size:12px; color:#64748b; margin-top:4px;">${journal.approvedBy?.firstName ? `${journal.approvedBy.firstName} ${journal.approvedBy.lastName}` : '...........................'}</p>
          </div>
        </div>
      `;

      openPrintWindow(buildPrintDocument({ title: `Journal Voucher - ${journal.entryNumber}`, company, body }));
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

  const { data: companyData } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}`);
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

  const openModal = (journal?: JournalEntry) => {
    if (journal) {
      setEditingJournalId(journal.id);
      setFormData({
        date: new Date(journal.date).toISOString().split('T')[0],
        description: journal.description || '',
        lines: journal.lines.map((l: any) => ({
          accountId: l.accountId,
          amount: l.debit > 0 ? l.debit : l.credit,
          debitCredit: l.debit > 0 ? 'debit' : 'credit',
          description: l.description || '',
        })),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
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

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.post(`/company/${companyId}/journals/${id}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success('Journal rejected');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reject journal');
    },
  });

  const retrieveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/company/${companyId}/journals/${id}/retrieve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success('Journal retrieved to draft');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to retrieve journal');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totals = calculateTotals();
    if (Math.abs(totals.totalDebit - totals.totalCredit) > 0.01) {
      toast.error('Total Debit and Credit must be equal');
      return;
    }

    const payload = {
      date: formData.date,
      description: formData.description || null,
      lines: formData.lines
        .filter(line => line.accountId && line.amount > 0)
        .map(line => ({
          accountId: line.accountId,
          debit: line.debitCredit === 'debit' ? line.amount : 0,
          credit: line.debitCredit === 'credit' ? line.amount : 0,
          debitBase: line.debitCredit === 'debit' ? line.amount : 0,
          creditBase: line.debitCredit === 'credit' ? line.amount : 0,
          debitForeign: line.debitCredit === 'debit' ? line.amount : 0,
          creditForeign: line.debitCredit === 'credit' ? line.amount : 0,
          exchangeRate: 1,
          description: line.description || null,
        })),
    };

    if (editingJournalId) {
      updateMutation.mutate({ id: editingJournalId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

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

  const handlePrint = () => {
    window.print();
  };

  const buildPrintDocument = ({ title, company, body }: { title: string; company: any; body: string }) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1e293b; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e2e8f0; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
          .meta-field { display: flex; flex-direction: column; }
          .meta-field label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .meta-field span { font-size: 14px; color: #334155; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; }
          th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
          td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; }
          .totals { display: flex; justify-content: flex-end; gap: 32px; margin-top: 16px; padding-top: 16px; border-top: 2px solid #e2e8f0; }
          .totals p { font-size: 14px; }
          .grand-total { font-size: 16px !important; font-weight: 700; }
          @media print { body { padding: 20px; } }
          @page { size: A4; margin: 20mm; }
        </style>
      </head>
      <body>
        ${body}
      </body>
      </html>
    `;
  };

  const openPrintWindow = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role) setUserRole(role);
  }, []);

  if (!companyId) return <div>Loading...</div>;

  return (
    <div className="min-h-screen">
      <NotificationPanel companyId={companyId} isOpen={notifOpen} onClose={() => setNotifOpen(false)} />

      <div className="p-6 max-w-[1600px] mx-auto space-y-8 flex gap-8 items-start print-hide">
        <div className="flex-1 space-y-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Engine</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowGuide(!showGuide)} className={`p-3 rounded-xl font-bold flex items-center gap-2 transition-all border ${showGuide ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Info className="w-5 h-5" />
                {showGuide ? 'Hide Guide' : 'Accounting Guide'}
              </button>
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
                    <p className="text-sm text-gray-500">Total Debit: {calculateTotals().totalDebit.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">Total Credit: {calculateTotals().totalCredit.toFixed(2)}</p>
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
                      <td className="px-4 py-2 text-right font-mono font-medium text-emerald-600">
                        {line.debit?.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-rose-600">
                        {line.credit?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-100 font-bold text-slate-800">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right text-slate-500 uppercase text-xs tracking-wider">Total Amount</td>
                    <td className="px-4 py-3 text-right font-mono">{selectedJournal.totalDebit?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">{selectedJournal.totalCredit?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 print-hide">
              <AttachmentManager entityType="VOUCHER" entityId={selectedJournal.id} canEdit={selectedJournal.status === 'DRAFT' || selectedJournal.status === 'REJECTED'} />
            </div>

            <div className="flex flex-wrap gap-2 pt-6 mt-4 border-t border-slate-100 print-hide">
              {(selectedJournal.status === 'DRAFT' || selectedJournal.status === 'REJECTED') && (
                <button onClick={() => handleEdit(selectedJournal)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-200 flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4" /> Edit Journal
                </button>
              )}
              {(selectedJournal.status === 'DRAFT' || selectedJournal.status === 'REJECTED') && (
                <button onClick={() => { submitMutation.mutate(selectedJournal.id); setShowViewModal(false); }} disabled={submitMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                  <Send className="w-4 h-4" /> Submit for Verification
                </button>
              )}
              {selectedJournal.status === 'PENDING_VERIFICATION' && (userRole === 'Manager' || userRole === 'Owner' || userRole === 'Admin') && (
                <>
                  <button onClick={() => { verifyMutation.mutate(selectedJournal.id); setShowViewModal(false); }} disabled={verifyMutation.isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                    <CheckCheck className="w-4 h-4" /> Verify
                  </button>
                  <button onClick={() => { const reason = window.prompt('Rejection reason (optional):') ?? ''; rejectMutation.mutate({ id: selectedJournal.id, reason }); setShowViewModal(false); }} disabled={rejectMutation.isPending} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold text-sm hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </>
              )}
              {(selectedJournal.status === 'VERIFIED' || selectedJournal.status === 'PENDING_APPROVAL') && (userRole === 'Owner' || userRole === 'Admin') && (
                <>
                  <button onClick={() => { approveMutation.mutate(selectedJournal.id); setShowViewModal(false); }} disabled={approveMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => { const reason = window.prompt('Rejection reason (optional):') ?? ''; rejectMutation.mutate({ id: selectedJournal.id, reason }); setShowViewModal(false); }} disabled={rejectMutation.isPending} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold text-sm hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </>
              )}
              {selectedJournal.status === 'REJECTED' && (userRole === 'Owner' || userRole === 'Admin') && (
                <button onClick={() => { retrieveMutation.mutate(selectedJournal.id); setShowViewModal(false); }} disabled={retrieveMutation.isPending} className="px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold text-sm hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Retrieve to Draft
                </button>
              )}

              <div className="flex gap-2 ml-auto">
                <button onClick={handlePrint} className="py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button onClick={closeViewModal} className="py-2 px-4 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200 transition-colors text-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedJournal && showViewModal && (
        <button onClick={handlePrint} className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all z-[60] no-print lg:hidden" title="Print Selection">
          <Printer className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}