'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Plus, Trash2, Check, X, ArrowLeft, LogOut, Eye, 
  Building2, Bell, Send, CheckCheck, BookOpen, Printer, Info, ChevronRight, Hash, DollarSign
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { AttachmentManager } from '@/components/AttachmentManager';
import NotificationPanel from '@/components/NotificationPanel';
import UserDropdown from '@/components/UserDropdown';

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
  totalDebit: number;
  totalCredit: number;
  status: string;
  createdBy: { firstName: string; lastName: string };
  verifiedBy: { firstName: string; lastName: string } | null;
  approvedBy: { firstName: string; lastName: string } | null;
}

interface Line {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

export default function CompanyJournalsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [{ accountId: '', debit: 0, credit: 0, description: '' }] as Line[],
  });

  const [showGuide, setShowGuide] = useState(false);

  const [userRole, setUserRole] = useState('User');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    const primaryRole = roles[0] || 'User';
    setUserRole(primaryRole);
    
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Handle print mode class on body
  useEffect(() => {
    if (showViewModal) {
      document.body.classList.add('printing-mode');
    } else {
      document.body.classList.remove('printing-mode');
    }
    return () => document.body.classList.remove('printing-mode');
  }, [showViewModal]);

  const { data: journalsData, isLoading } = useQuery({
    queryKey: ['company-journals', companyId, page],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/journals?page=${page}&limit=${limit}`);
      return response.data.data as JournalEntry[];
    },
    enabled: !!companyId,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['company-accounts', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/accounts`);
      return response.data.data as Account[];
    },
    enabled: !!companyId,
  });

  // Fetch unread count for the bell icon
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', companyId],
    queryFn: async () => {
      try {
        const response = await api.get(`/company/${companyId}/notifications`);
        if (typeof response.data === 'string' && response.data.startsWith('<!DOCTYPE')) {
          console.error('Received HTML instead of JSON from notifications API');
          return { notifications: [], unreadCount: 0 };
        }
        return response.data.data;
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
        return { notifications: [], unreadCount: 0 };
      }
    },
    enabled: !!companyId,
  });

  const { data: companyData } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const unreadCount = notificationsData?.unreadCount || 0;

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post(`/company/${companyId}/journals`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal entry created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create journal entry');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (journalId: string) => {
      const response = await api.delete(`/company/${companyId}/journals/${journalId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal entry deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete journal entry');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (journalId: string) => {
      const response = await api.post(`/company/${companyId}/journals/${journalId}/verify`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal verified');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to verify journal');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (journalId: string) => {
      const response = await api.post(`/company/${companyId}/journals/${journalId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal approved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to approve journal');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ journalId, reason }: { journalId: string; reason: string }) => {
      const response = await api.post(`/company/${companyId}/journals/${journalId}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal rejected');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reject journal');
    },
  });

  const retrieveMutation = useMutation({
    mutationFn: async (journalId: string) => {
      const response = await api.post(`/company/${companyId}/journals/${journalId}/retrieve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal retrieved to draft');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to retrieve journal');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (journalId: string) => {
      const response = await api.post(`/company/${companyId}/journals/${journalId}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal submitted for verification');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to submit journal');
    },
  });

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const openModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      lines: [{ accountId: '', debit: 0, credit: 0, description: '' }],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const openViewModal = async (journal: JournalEntry) => {
    const response = await api.get(`/company/${companyId}/journals/${journal.id}`);
    setSelectedJournal(response.data.data);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedJournal(null);
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: '', debit: 0, credit: 0, description: '' }],
    });
  };

  const updateLine = (index: number, field: keyof Line, value: any) => {
    const lines = [...formData.lines];
    lines[index] = { ...lines[index], [field]: value };
    setFormData({ ...formData, lines });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 1) {
      const lines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines });
    }
  };

  const calculateTotals = () => {
    const totalDebit = formData.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = formData.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return { totalDebit, totalCredit };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totals = calculateTotals();
    if (Math.abs(totals.totalDebit - totals.totalCredit) > 0.01) {
      toast.error('Debit and Credit must be equal');
      return;
    }

    try {
      const response = await api.post(`/company/${companyId}/journals`, formData);
      const journal = response.data.data;

      // Upload files if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          const uploadData = new FormData();
          uploadData.append('file', file);
          await api.post(`/company/${companyId}/attachments/upload?entityType=VOUCHER&entityId=${journal.id}`, uploadData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['company-journals', companyId] });
      toast.success('Journal entry created successfully');
      setAttachments([]);
      closeModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create journal entry');
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName="Journal Entries" role={userRole} />

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <h1 className="text-xl font-bold text-slate-900">Voucher Journal</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setNotifOpen(true)}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
              )}
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <UserDropdown role={userRole} />
          </div>
        </header>

        <NotificationPanel
          companyId={companyId}
          isOpen={notifOpen}
          onClose={() => setNotifOpen(false)}
        />

        <div className="p-6 max-w-[1600px] mx-auto space-y-8 flex gap-8 items-start print-hide">
          <div className="flex-1 space-y-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Engine</h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowGuide(!showGuide)} 
                  className={`p-3 rounded-xl font-bold flex items-center gap-2 transition-all border ${
                    showGuide ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Info className="w-5 h-5" />
                  {showGuide ? 'Hide Guide' : 'Accounting Guide'}
                </button>
                {(userRole === 'Accountant' || userRole === 'Owner' || userRole === 'Admin') && (
                  <button onClick={openModal} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
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
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Debit</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Credit</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {journalsData?.map((journal) => (
                    <tr key={journal.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{journal.entryNumber}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                        {new Date(journal.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 italic max-w-xs truncate">{journal.description || '-'}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600 text-right font-mono font-bold">{journal.totalDebit.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-rose-600 text-right font-mono font-bold">{journal.totalCredit.toLocaleString()}</td>
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
                          
                          {(journal.status === 'DRAFT' || journal.status === 'REJECTED') && (
                            <button 
                              onClick={() => submitMutation.mutate(journal.id)} 
                              className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-all" 
                              title="Submit for Verification"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
  
                          {canVerify(journal.status) && (
                            <button 
                              onClick={() => verifyMutation.mutate(journal.id)} 
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 border border-transparent hover:border-emerald-100 rounded-lg transition-all" 
                              title="Verify (Manager Only)"
                            >
                              <CheckCheck className="w-4 h-4" />
                            </button>
                          )}
  
                          {canApprove(journal.status) && (
                            <button onClick={() => approveMutation.mutate(journal.id)} className="p-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all" title="Approve">
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          
                          {canDelete(journal.status) && (
                            <button onClick={() => deleteMutation.mutate(journal.id)} className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all" title="Delete Draft">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {journalsData?.length === 0 && (
                <div className="text-center py-16 bg-slate-50/50">
                  <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No journal entries found</p>
                </div>
              )}

              {/* Main List Pagination */}
              <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between print-hide">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-tighter">
                  Showing Page {page}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white font-mono"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={!journalsData || journalsData.length < limit}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white font-mono"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* LC & RMG Accounting Guide Sidebar */}
          {showGuide && (
            <aside className="w-96 bg-white rounded-3xl p-8 border border-slate-200 shadow-xl shadow-slate-200/50 space-y-8 sticky top-24 shrink-0 overflow-y-auto max-h-[80vh] scrollbar-hide print-hide">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">LC Guide</h3>
                <button onClick={() => setShowGuide(false)} className="p-2 hover:bg-slate-100 rounded-full">&times;</button>
              </div>

              <div className="space-y-12">
                {/* Stage 1 */}
                <div className="relative pl-8 border-l-4 border-emerald-500 border-dashed">
                  <div className="absolute -left-3 top-0 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-sm" />
                  <h4 className="font-black text-emerald-600 text-xs uppercase tracking-widest mb-2">Stage 1: Opening</h4>
                  <p className="text-sm font-bold text-slate-800 mb-4">Margin Payment (e.g. 20%)</p>
                  <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 space-y-1">
                    <div className="flex justify-between"><span>LC Margin (Asset)</span><span>DR</span></div>
                    <div className="flex justify-between pl-4 text-slate-400"><span>To Bank A/C</span><span>CR</span></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 italic leading-relaxed">Only record margin. Do NOT record total LC value yet.</p>
                </div>

                {/* Stage 2 */}
                <div className="relative pl-8 border-l-4 border-blue-500 border-dashed">
                  <div className="absolute -left-3 top-0 w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-sm" />
                  <h4 className="font-black text-blue-600 text-xs uppercase tracking-widest mb-2">Stage 2: Goods Received</h4>
                  <p className="text-sm font-bold text-slate-800 mb-4">Inventory Acceptance</p>
                  <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-blue-400 space-y-1">
                    <div className="flex justify-between"><span>Raw Materials</span><span>DR</span></div>
                    <div className="flex justify-between pl-4 text-slate-400"><span>To LC Payable</span><span>CR</span></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 italic leading-relaxed">Liability is now officially created in books.</p>
                </div>

                {/* Stage 3 */}
                <div className="relative pl-8 border-l-4 border-indigo-500 border-dashed">
                  <div className="absolute -left-3 top-0 w-5 h-5 bg-indigo-500 rounded-full border-4 border-white shadow-sm" />
                  <h4 className="font-black text-indigo-600 text-xs uppercase tracking-widest mb-2">Stage 3: Bank Payment</h4>
                  <p className="text-sm font-bold text-slate-800 mb-4">Settling Supplier</p>
                  <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-indigo-400 space-y-3">
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter mb-1">Via Bank Loan (LTR/PAD)</p>
                      <div className="flex justify-between"><span>LC Payable</span><span>DR</span></div>
                      <div className="flex justify-between pl-4 text-slate-500"><span>To Bank Loan</span><span>CR</span></div>
                    </div>
                  </div>
                </div>

                 {/* Stage 4 */}
                 <div className="relative pl-8 border-l-4 border-slate-300">
                  <div className="absolute -left-3 top-0 w-5 h-5 bg-slate-400 rounded-full border-4 border-white shadow-sm" />
                  <h4 className="font-black text-slate-500 text-xs uppercase tracking-widest mb-2">Stage 4: Loans (EMI)</h4>
                  <p className="text-sm font-bold text-slate-800 mb-4">Monthly Repayment</p>
                  <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[11px] text-rose-400 space-y-1">
                    <div className="flex justify-between"><span>Loan A/C (Principal)</span><span>DR</span></div>
                    <div className="flex justify-between"><span>Interest Expense</span><span>DR</span></div>
                    <div className="flex justify-between pl-4 text-slate-400"><span>To Bank A/C</span><span>CR</span></div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                <p className="text-[10px] text-yellow-800 font-bold leading-tight">
                  ⚠️ Avoid recording full LC amount at opening. Separate PAD/LTR tracking is mandatory for RMG audit compliance.
                </p>
              </div>
            </aside>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Create Journal Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input"
                    disabled={userRole !== 'Owner'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Documents (Optional)</label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {attachments.length > 0 && (
                    <p className="mt-1 text-xs text-blue-600 font-semibold">{attachments.length} file(s) selected</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Journal Lines</label>
                  <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800">
                    + Add Line
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.lines.map((line, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <select
                        value={line.accountId}
                        onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                        className="input flex-1"
                        required
                      >
                        <option value="">Select Account</option>
                        {accountsData?.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Debit"
                        value={line.debit || ''}
                        onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                        className="input w-28"
                      />
                      <input
                        type="number"
                        placeholder="Credit"
                        value={line.credit || ''}
                        onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                        className="input w-28"
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
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
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending ? 'Creating...' : 'Create Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedJournal && (
        <>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden no-print">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto no-print">
            <div className="flex justify-between items-center mb-6 print-hide">
              <h3 className="text-xl font-semibold">Journal Entry Details</h3>
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Description:</span>
                  <span className="text-slate-700 text-right">{selectedJournal.description || '-'}</span>
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
              <AttachmentManager 
                entityType="VOUCHER" 
                entityId={selectedJournal.id} 
                canEdit={selectedJournal.status === 'DRAFT' || selectedJournal.status === 'REJECTED'} 
              />
            </div>

            <div className="flex gap-3 pt-8 mt-4 border-t border-slate-100 print-hide">
              <button 
                onClick={handlePrint} 
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Voucher
              </button>
              <button onClick={closeViewModal} className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200 transition-colors">
                Close View
              </button>
            </div>
          </div>
        </div>
          
          {/* Printable Section - ensuring it occupies the whole print view */}
          <div className="hidden print:block print:p-0 print:m-0 w-full bg-white printable-content">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
              <div className="flex items-center gap-4">
                {companyData?.logoUrl && (
                  <img src={companyData.logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
                )}
                <div>
                  <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{companyData?.name || 'Voucher'}</h1>
                  <p className="text-sm text-slate-500 max-w-[300px] leading-relaxed">
                    {companyData?.address}<br />
                    {companyData?.city}, {companyData?.country}<br />
                    Tel: {companyData?.phone} | Email: {companyData?.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-slate-900 text-white px-4 py-1 text-xs font-bold uppercase tracking-widest mb-2 inline-block">
                  Journal Voucher
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">{selectedJournal.entryNumber}</div>
                <div className="text-slate-500 text-sm mt-1">Date: {new Date(selectedJournal.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            </div>

            <div className="mb-8 p-4 bg-slate-50 rounded border border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Description</span>
              <p className="text-slate-800 font-medium">{selectedJournal.description || 'No description provided'}</p>
            </div>

            <table className="w-full mb-12 border-collapse">
              <thead>
                <tr className="border-y-2 border-slate-900 text-slate-900 uppercase text-xs font-bold tracking-wider">
                  <th className="px-4 py-3 text-left">Account Details</th>
                  <th className="px-4 py-3 text-left">Remark</th>
                  <th className="px-4 py-3 text-right w-32">Debit ({companyData?.baseCurrency || 'BDT'})</th>
                  <th className="px-4 py-3 text-right w-32">Credit ({companyData?.baseCurrency || 'BDT'})</th>
                </tr>
              </thead>
              <tbody className="border-b border-slate-300">
                {selectedJournal.lines?.map((line: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-none">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900">{line.account?.code}</div>
                      <div className="text-xs text-slate-500 uppercase">{line.account?.name}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 text-sm italic">
                      {line.description || '-'}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-800">
                      {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-800">
                      {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-slate-900 font-black">
                  <td colSpan={2} className="px-4 py-6 text-right uppercase text-sm tracking-widest">Total Amount</td>
                  <td className="px-4 py-6 text-right font-mono border-t-2 border-slate-900">{selectedJournal.totalDebit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-6 text-right font-mono border-t-2 border-slate-900">{selectedJournal.totalCredit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>

            <div className="grid grid-cols-3 gap-12 mt-24">
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold uppercase text-slate-400">Prepared By</p>
                <p className="text-sm font-medium mt-1">{selectedJournal.createdBy.firstName} {selectedJournal.createdBy.lastName}</p>
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold uppercase text-slate-400">Verified By</p>
                <p className="text-sm font-medium mt-1">{selectedJournal.verifiedBy ? `${selectedJournal.verifiedBy.firstName} ${selectedJournal.verifiedBy.lastName}` : '.........................'}</p>
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="text-xs font-bold uppercase text-slate-400">Authorised By</p>
                <p className="text-sm font-medium mt-1">{selectedJournal.approvedBy ? `${selectedJournal.approvedBy.firstName} ${selectedJournal.approvedBy.lastName}` : '.........................'}</p>
              </div>
            </div>

            <div className="mt-20 text-[10px] text-slate-400 text-center border-t border-slate-100 pt-4">
              This is a computer generated document. Printed on {new Date().toLocaleString()}
            </div>
          </div>
        </>
      )}

      {/* Floating Action Button for mobile print */}
      {selectedJournal && showViewModal && (
        <button onClick={handlePrint} className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all z-[60] no-print lg:hidden" title="Print Selection">
          <Printer className="w-6 h-6" />
        </button>
      )}

    </div>
  );
}
