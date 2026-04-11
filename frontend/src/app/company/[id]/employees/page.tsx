'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { handleError } from '@/lib/error-handler';
import { Plus, Trash2, Edit2, Check, X, User, DollarSign, Wallet, CreditCard, FileText, ChevronRight } from 'lucide-react';


interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  joinDate: string | null;
  salary: number;
  isActive: boolean;
}

interface EmployeeAdvance {
  id: string;
  employeeId: string;
  amount: number;
  purpose: string | null;
  date: string;
  status: string;
  paymentMethod: string | null;
  employee: { firstName: string; lastName: string };
}

interface EmployeeLoan {
  id: string;
  employeeId: string;
  principalAmount: number;
  interestRate: number;
  interestAmount: number;
  totalAmount: number;
  installments: number;
  startDate: string;
  purpose: string | null;
  status: string;
  employee: { firstName: string; lastName: string };
  repayments: any[];
}

interface EmployeeExpense {
  id: string;
  employeeId: string;
  amount: number;
  description: string | null;
  category: string;
  date: string;
  status: string;
  paymentMethod: string | null;
  employee: { firstName: string; lastName: string };
}

export default function EmployeesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'employees' | 'advances' | 'loans' | 'expenses'>('employees');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'employee' | 'advance' | 'loan' | 'expense'>('employee');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/employees`);
      return response.data.data as Employee[];
    },
    enabled: !!companyId,
  });

  const { data: advancesData, isLoading: advancesLoading } = useQuery({
    queryKey: ['employee-advances', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/employee-advances`);
      return response.data.data as EmployeeAdvance[];
    },
    enabled: !!companyId,
  });

  const { data: loansData, isLoading: loansLoading } = useQuery({
    queryKey: ['employee-loans', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/employee-loans`);
      return response.data.data as EmployeeLoan[];
    },
    enabled: !!companyId,
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['employee-expenses', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/employee-expenses`);
      return response.data.data as EmployeeExpense[];
    },
    enabled: !!companyId,
  });

  const { data: accountsData } = useQuery({
    queryKey: ['company-accounts', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/accounts`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = {
        employee: `/company/${companyId}/employees`,
        advance: `/company/${companyId}/employee-advances`,
        loan: `/company/${companyId}/employee-loans`,
        expense: `/company/${companyId}/employee-expenses`,
      }[modalType];
      const response = await api.post(endpoint, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-advances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-expenses', companyId] });
      toast.success('Created successfully');
      closeModal();
    },
    onError: (error: any) => {
      handleError(error, 'Failed to create');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, data }: { type: string; id: string; data: any }) => {
      const endpoint = {
        employee: `/company/${companyId}/employees/${id}`,
        advance: `/company/${companyId}/employee-advances/${id}`,
        loan: `/company/${companyId}/employee-loans/${id}`,
        expense: `/company/${companyId}/employee-expenses/${id}`,
      }[type] as string;
      if (!endpoint) throw new Error('Invalid type');
      const response = await api.put(endpoint, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-advances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-expenses', companyId] });
      toast.success('Updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      handleError(error, 'Failed to update');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const endpoint = {
        employee: `/company/${companyId}/employees/${id}`,
        advance: `/company/${companyId}/employee-advances/${id}`,
        loan: `/company/${companyId}/employee-loans/${id}`,
        expense: `/company/${companyId}/employee-expenses/${id}`,
      }[type] as string;
      if (!endpoint) throw new Error('Invalid type');
      const response = await api.delete(endpoint);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-advances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-expenses', companyId] });
      toast.success('Deleted successfully');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ type, id, action }: { type: string; id: string; action: 'verify' | 'approve' }) => {
      const endpoint = {
        advance: action === 'verify' 
          ? `/company/${companyId}/employee-advances/${id}/verify`
          : `/company/${companyId}/employee-advances/${id}/approve`,
        loan: action === 'verify'
          ? `/company/${companyId}/employee-loans/${id}/verify`
          : `/company/${companyId}/employee-loans/${id}/approve`,
        expense: action === 'verify'
          ? `/company/${companyId}/employee-expenses/${id}/verify`
          : `/company/${companyId}/employee-expenses/${id}/approve`,
        repayment: action === 'verify'
          ? `/company/${companyId}/employee-loan-repayments/${id}/verify`
          : `/company/${companyId}/employee-loan-repayments/${id}/approve`,
      }[`${type}`] as string;
      if (!endpoint) throw new Error('Invalid type');
      const response = await api.post(endpoint);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employee-advances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employee-expenses', companyId] });
      queryClient.invalidateQueries({ queryKey: ['journals', companyId] });
      toast.success(variables.action === 'verify' ? 'Verified successfully' : 'Approved - Journal created');
      closeModal();
    },
    onError: (error: any) => {
      handleError(error, `Failed to ${approveMutation.variables?.action || 'process'}`);
    },
  });

  if (!mounted) return null;

  const openModal = (type: 'employee' | 'advance' | 'loan' | 'expense', item?: any) => {
    setModalType(type);
    setSelectedItem(item);
    const initialData = type === 'employee' ? { firstName: '', lastName: '', email: '', phone: '', designation: '', department: '', salary: 0, joiningDate: new Date().toISOString() } :
                 type === 'advance' ? { employeeId: '', amount: 0, purpose: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'CASH' } :
                 type === 'loan' ? { employeeId: '', principalAmount: 0, interestRate: 0, termMonths: 12, startDate: new Date().toISOString().split('T')[0], monthlyInstallment: 0 } :
                 { employeeId: '', amount: 0, purpose: '', date: new Date().toISOString().split('T')[0], category: 'TRAVEL' };
    
    if (item && type === 'advance') {
      setFormData({ ...item, date: new Date().toISOString().split('T')[0] });
    } else {
      setFormData(item ? { ...item } : initialData);
    }
    setShowModal(true);
  };

  const getModalType = (tab: string): 'employee' | 'advance' | 'loan' | 'expense' => {
    const map: Record<string, 'employee' | 'advance' | 'loan' | 'expense'> = {
      employees: 'employee',
      advances: 'advance',
      loans: 'loan',
      expenses: 'expense',
    };
    return map[tab] || 'employee';
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem) {
      updateMutation.mutate({ type: modalType, id: selectedItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
      VERIFIED: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      PAID: 'bg-green-100 text-green-800',
      ACTIVE: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const tabs = [
    { id: 'employees', label: 'Employees', icon: User },
    { id: 'advances', label: 'Advances', icon: Wallet },
    { id: 'loans', label: 'Loans', icon: CreditCard },
    { id: 'expenses', label: 'Expenses', icon: FileText },
  ];

  return (
    <div className="min-h-screen">



        <div className="p-6 max-w-[1600px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">HR & Payroll</h2>
          </div>

          <div className="flex gap-2 mb-6 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 font-semibold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">{tabs.find(t => t.id === activeTab)?.label}</h3>
              <button
                onClick={() => openModal(getModalType(activeTab))}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add {activeTab === 'employees' ? 'Employee' : activeTab === 'advances' ? 'Advance' : activeTab === 'loans' ? 'Loan' : 'Expense'}
              </button>
            </div>

            {activeTab === 'employees' && (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Designation</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Phone</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Salary</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employeesData?.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{emp.employeeCode}</td>
                      <td className="px-4 py-3">{emp.firstName} {emp.lastName}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.designation || '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.department || '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.phone || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{emp.salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openModal('employee', emp)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteMutation.mutate({ type: 'employee', id: emp.id })} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'advances' && (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Employee</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Purpose</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {advancesData?.map((adv) => (
                    <tr key={adv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{new Date(adv.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{adv.employee.firstName} {adv.employee.lastName}</td>
                      <td className="px-4 py-3 text-slate-500">{adv.purpose || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{adv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(adv.status)}`}>{adv.status}</span></td>
                      <td className="px-4 py-3 text-center">
                        {adv.status === 'DRAFT' && (
                          <>
                            <button onClick={() => openModal('advance', adv)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => approveMutation.mutate({ type: 'advance', id: adv.id, action: 'verify' })} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded ml-1" title="Verify"><Check className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate({ type: 'advance', id: adv.id })} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {adv.status === 'PENDING_VERIFICATION' && (
                          <>
                            <button onClick={() => approveMutation.mutate({ type: 'advance', id: adv.id, action: 'verify' })} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded" title="Verify"><Check className="w-4 h-4" /></button>
                            <button onClick={() => approveMutation.mutate({ type: 'advance', id: adv.id, action: 'approve' })} className="p-1 text-green-600 hover:bg-green-50 rounded ml-1" title="Approve & Create Journal"><Check className="w-4 h-4" /></button>
                          </>
                        )}
                        {adv.status === 'VERIFIED' && (
                          <button onClick={() => approveMutation.mutate({ type: 'advance', id: adv.id, action: 'approve' })} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve & Create Journal"><Check className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'loans' && (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Employee</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Principal</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Interest</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Installments</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Start Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loansData?.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{loan.employee.firstName} {loan.employee.lastName}</td>
                      <td className="px-4 py-3 text-right font-mono">{loan.principalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">{loan.interestAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{loan.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3">{loan.installments}</td>
                      <td className="px-4 py-3">{new Date(loan.startDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(loan.status)}`}>{loan.status}</span></td>
                      <td className="px-4 py-3 text-center">
                        {loan.status === 'DRAFT' && (
                          <>
                            <button onClick={() => openModal('loan', loan)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => approveMutation.mutate({ type: 'loan', id: loan.id, action: 'verify' })} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded ml-1" title="Verify"><Check className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate({ type: 'loan', id: loan.id })} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {loan.status === 'PENDING_VERIFICATION' && (
                          <>
                            <button onClick={() => approveMutation.mutate({ type: 'loan', id: loan.id, action: 'verify' })} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded" title="Verify"><Check className="w-4 h-4" /></button>
                            <button onClick={() => approveMutation.mutate({ type: 'loan', id: loan.id, action: 'approve' })} className="p-1 text-green-600 hover:bg-green-50 rounded ml-1" title="Approve & Create Journal"><Check className="w-4 h-4" /></button>
                          </>
                        )}
                        {loan.status === 'VERIFIED' && (
                          <button onClick={() => approveMutation.mutate({ type: 'loan', id: loan.id, action: 'approve' })} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve & Create Journal"><Check className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'expenses' && (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Employee</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expensesData?.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{new Date(exp.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{exp.employee.firstName} {exp.employee.lastName}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{exp.category}</span></td>
                      <td className="px-4 py-3 text-slate-500">{exp.description || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono">{exp.amount.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(exp.status)}`}>{exp.status}</span></td>
                      <td className="px-4 py-3 text-center">
                        {exp.status === 'DRAFT' && (
                          <>
                            <button onClick={() => openModal('expense', exp)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => approveMutation.mutate({ type: 'expense', id: exp.id, action: 'verify' })} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded ml-1" title="Verify"><Check className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate({ type: 'expense', id: exp.id })} className="p-1 text-red-600 hover:bg-red-50 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {exp.status === 'PENDING_VERIFICATION' && (
                          <>
                            <button onClick={() => approveMutation.mutate({ type: 'expense', id: exp.id, action: 'verify' })} className="p-1 text-yellow-600 hover:bg-yellow-50 rounded" title="Verify"><Check className="w-4 h-4" /></button>
                            <button onClick={() => approveMutation.mutate({ type: 'expense', id: exp.id, action: 'approve' })} className="p-1 text-green-600 hover:bg-green-50 rounded ml-1" title="Approve & Create Journal"><Check className="w-4 h-4" /></button>
                          </>
                        )}
                        {exp.status === 'VERIFIED' && (
                          <button onClick={() => approveMutation.mutate({ type: 'expense', id: exp.id, action: 'approve' })} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve & Create Journal"><Check className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {selectedItem ? 'Edit' : 'Add'} {modalType === 'employee' ? 'Employee' : modalType === 'advance' ? 'Advance' : modalType === 'loan' ? 'Loan' : 'Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {modalType === 'employee' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">First Name *</label>
                      <input type="text" value={formData.firstName || ''} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Last Name *</label>
                      <input type="text" value={formData.lastName || ''} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="input" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input type="email" value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone</label>
                      <input type="text" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="input" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Designation</label>
                      <input type="text" value={formData.designation || ''} onChange={(e) => setFormData({...formData, designation: e.target.value})} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Department</label>
                      <input type="text" value={formData.department || ''} onChange={(e) => setFormData({...formData, department: e.target.value})} className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Salary</label>
                    <input type="number" value={formData.salary || 0} onChange={(e) => setFormData({...formData, salary: parseFloat(e.target.value)})} className="input" />
                  </div>
                </>
              )}

              {modalType === 'advance' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Employee *</label>
                    <select value={formData.employeeId || ''} onChange={(e) => setFormData({...formData, employeeId: e.target.value})} className="input" required>
                      <option value="">Select Employee</option>
                      {employeesData?.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Amount *</label>
                      <input type="number" value={formData.amount || 0} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date</label>
                      <input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Purpose</label>
                    <input type="text" value={formData.purpose || ''} onChange={(e) => setFormData({...formData, purpose: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                    <select value={formData.paymentMethod || 'CASH'} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} className="input">
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>
                </>
              )}

              {modalType === 'loan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Employee *</label>
                    <select value={formData.employeeId || ''} onChange={(e) => setFormData({...formData, employeeId: e.target.value})} className="input" required>
                      <option value="">Select Employee</option>
                      {employeesData?.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Principal Amount *</label>
                      <input type="number" value={formData.principalAmount || 0} onChange={(e) => setFormData({...formData, principalAmount: e.target.value})} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                      <input type="number" value={formData.interestRate || 0} onChange={(e) => setFormData({...formData, interestRate: e.target.value})} className="input" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Installments</label>
                      <input type="number" value={formData.installments || 1} onChange={(e) => setFormData({...formData, installments: e.target.value})} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date</label>
                      <input type="date" value={formData.startDate || ''} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Purpose</label>
                    <input type="text" value={formData.purpose || ''} onChange={(e) => setFormData({...formData, purpose: e.target.value})} className="input" />
                  </div>
                </>
              )}

              {modalType === 'expense' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Employee *</label>
                    <select value={formData.employeeId || ''} onChange={(e) => setFormData({...formData, employeeId: e.target.value})} className="input" required>
                      <option value="">Select Employee</option>
                      {employeesData?.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Amount *</label>
                      <input type="number" value={formData.amount || 0} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date</label>
                      <input type="date" value={formData.date || ''} onChange={(e) => setFormData({...formData, date: e.target.value})} className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <select value={formData.category || 'SALARY'} onChange={(e) => setFormData({...formData, category: e.target.value})} className="input" required>
                      <option value="SALARY">Salary</option>
                      <option value="BONUS">Bonus</option>
                      <option value="OVERTIME">Overtime</option>
                      <option value="CONVEYANCE">Conveyance</option>
                      <option value="FOOD">Food Allowance</option>
                      <option value="MEDICAL">Medical</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} className="input" rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                    <select value={formData.paymentMethod || 'CASH'} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})} className="input">
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


