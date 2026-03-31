'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, Search, Building2, User, Mail, Phone, MapPin, DollarSign, CreditCard, ShieldCheck, ChevronDown } from 'lucide-react';


interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  contactPerson?: string;
  tinVat?: string;
  openingBalance: number;
  balanceType?: string;
  creditLimit?: number;
  preferredCurrency: string;
  paymentTerms: string;
}

export default function CompanyCustomersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    contactPerson: '',
    tinVat: '',
    openingBalance: 0,
    balanceType: 'DR',
    creditLimit: 0,
    preferredCurrency: 'BDT',
    paymentTerms: 'COD',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: customersData, isLoading } = useQuery({
    queryKey: ['company-customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data as Customer[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/customers`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer profile created');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create customer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/company/${companyId}/customers/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer profile updated');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update customer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/customers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer deleted');
    },
  });

  if (!mounted) return null;

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        country: customer.country || '',
        contactPerson: customer.contactPerson || '',
        tinVat: customer.tinVat || '',
        openingBalance: customer.openingBalance || 0,
        balanceType: customer.balanceType || 'DR',
        creditLimit: customer.creditLimit || 0,
        preferredCurrency: customer.preferredCurrency || 'BDT',
        paymentTerms: customer.paymentTerms || 'COD',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '', email: '', phone: '', address: '', city: '', country: '',
        contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'DR',
        creditLimit: 0, preferredCurrency: 'BDT', paymentTerms: 'COD'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredCustomers = customersData?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen">


        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Building2 className="w-8 h-8 text-indigo-600" />
                Customer Master
              </h2>
              <p className="text-slate-500 font-medium">Manage client relations and credit profiles</p>
            </div>
            <button 
              onClick={() => openModal()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              New Customer
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Client Identity</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Contact Person</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Financial Info</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Currency</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={5} className="text-center py-12 animate-pulse font-bold text-slate-400">Loading customer database...</td></tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">No customers matching your search</td></tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="group hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{customer.name}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{customer.code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-700">{customer.contactPerson || '-'}</span>
                            <span className="text-[10px] text-slate-400">{customer.email || customer.phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">
                              Limit: {customer.creditLimit?.toLocaleString() || '∞'}
                            </span>
                            <span className={`text-[10px] font-black ${customer.balanceType === 'CR' ? 'text-emerald-500' : 'text-amber-500'}`}>
                              BAL: {customer.openingBalance?.toLocaleString()} ({customer.balanceType})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600 underline decoration-indigo-400 underline-offset-2">
                            {customer.preferredCurrency}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => openModal(customer)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => deleteMutation.mutate(customer.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      

      {/* CUSTOMER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <User className="w-6 h-6 text-indigo-600" />
                  {editingCustomer ? 'Update Customer Profile' : 'New Customer Registration'}
                </h3>
                <p className="text-sm text-slate-500">Define financial parameters and contact details</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100">
                <ChevronDown className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Identity & Contact</span>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company Name *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" required />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Person</label>
                      <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({...formData, contactPerson: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">TIN / VAT No</label>
                      <input type="text" value={formData.tinVat} onChange={(e) => setFormData({...formData, tinVat: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                      <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Address</label>
                    <textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold min-h-[100px]" />
                  </div>
                </div>

                {/* Financial Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Financial Profile</span>
                  </div>

                  <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5 ml-1">Opening Balance</label>
                        <input type="number" value={formData.openingBalance} onChange={(e) => setFormData({...formData, openingBalance: parseFloat(e.target.value)})} className="w-full bg-white border-2 border-transparent focus:border-emerald-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5 ml-1">Balance Type</label>
                        <select value={formData.balanceType} onChange={(e) => setFormData({...formData, balanceType: e.target.value})} className="w-full bg-white border-2 border-transparent focus:border-emerald-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold">
                          <option value="DR">Debit (Receivable)</option>
                          <option value="CR">Credit (Prepayment)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5 ml-1">Credit Limit</label>
                      <input type="number" value={formData.creditLimit} onChange={(e) => setFormData({...formData, creditLimit: parseFloat(e.target.value)})} className="w-full bg-white border-2 border-transparent focus:border-emerald-500 rounded-2xl px-4 py-3 outline-none transition-all font-bold" placeholder="Set 0 for unlimited" />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5 ml-1">Preferred Currency</label>
                      <div className="flex gap-2">
                        {['BDT', 'USD', 'EUR', 'GBP'].map((curr) => (
                          <button
                            key={curr}
                            type="button"
                            onClick={() => setFormData({...formData, preferredCurrency: curr})}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${formData.preferredCurrency === curr ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-emerald-700 hover:bg-emerald-100'}`}
                          >
                            {curr}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">South Asian Compliance Enabled</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed">Financial data is stored for NBR reporting and audit readiness.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
                <button type="button" onClick={closeModal} className="px-8 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-12 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/30 active:scale-95 disabled:bg-slate-200"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Propagating Changes...' : (editingCustomer ? 'Save Customer Update' : 'Initialize Customer Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
