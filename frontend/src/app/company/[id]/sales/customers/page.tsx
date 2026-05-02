'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, Search, Building2, User, X, Loader2, Globe, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

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
  preferredCurrency: string;
  exchangeRate?: number;
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
    preferredCurrency: 'BDT',
    exchangeRate: 1,
    paymentTerms: 'COD',
  });

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const endpoint = editingCustomer ? `/company/${companyId}/customers/${editingCustomer.id}` : `/company/${companyId}/customers`;
      const method = editingCustomer ? 'put' : 'post';
      const response = await api[method](endpoint, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success(editingCustomer ? 'Customer profile updated' : 'Customer profile created');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Action failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/company/${companyId}/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-customers', companyId] });
      toast.success('Customer deleted');
    },
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Delete failed'),
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
        preferredCurrency: customer.preferredCurrency || 'BDT',
        exchangeRate: customer.exchangeRate || 1,
        paymentTerms: customer.paymentTerms || 'COD',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '', email: '', phone: '', address: '', city: '', country: '',
        contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'DR',
        preferredCurrency: 'BDT', exchangeRate: 1, paymentTerms: 'COD'
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
    createMutation.mutate(formData);
  };

  const filteredCustomers = customersData?.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (c.code?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-gray-400" />
            Customer Master
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage client accounts and credit profiles</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-gray-400 transition-colors bg-white shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Client Identity</th>
              <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contact Person</th>
              <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Opening Balance</th>
              <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Currency</th>
              <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Loading customer database...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No customers matching your search</td></tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{customer.name}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{customer.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700">{customer.contactPerson || '-'}</span>
                      <span className="text-[10px] text-gray-400">{customer.email || customer.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 font-mono">
                        ৳{((customer.openingBalance || 0) * (customer.exchangeRate || 1)).toLocaleString()}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        customer.balanceType === 'CR' ? 'text-emerald-500' : 'text-amber-600'
                      )}>
                        {customer.openingBalance?.toLocaleString()} {customer.preferredCurrency} ({customer.balanceType})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-gray-100 rounded-sm text-[10px] font-bold text-gray-600 uppercase tracking-widest border border-gray-200">
                      {customer.preferredCurrency}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(customer)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-sm border border-transparent hover:border-gray-200 transition-all" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => deleteMutation.mutate(customer.id)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
            {/* Sticky Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">
                  {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'New Customer Registration'}
                </h3>
              </div>

              <div className="flex gap-2">
                <button 
                  type="submit" 
                  form="customer-form"
                  disabled={createMutation.isPending}
                  className="px-6 py-2 bg-gray-900 text-white font-bold text-[10px] uppercase tracking-widest rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-all shadow-sm flex items-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingCustomer ? 'Update Profile' : 'Initialize Account'}
                </button>

                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-sm transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <form onSubmit={handleSubmit} id="customer-form" className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Identity Section */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] border-b border-gray-100 pb-2">Business Identity</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Legal Entity Name *</label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white font-bold" required />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Person</label>
                          <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({...formData, contactPerson: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">TIN / VAT No</label>
                          <input type="text" value={formData.tinVat} onChange={(e) => setFormData({...formData, tinVat: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white font-mono" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                          <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                          <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-sm bg-white font-mono" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registered Office Address</label>
                        <textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full border border-gray-200 rounded-sm p-3 text-sm focus:outline-none focus:border-gray-900 bg-white resize-none min-h-[100px]" />
                      </div>
                    </div>
                  </div>

                  {/* Financial Section */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] border-b border-gray-100 pb-2">Financial Profile</h4>

                    <div className="bg-gray-50 p-6 border border-gray-100 rounded-sm space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Opening Balance</label>
                          <input type="number" value={formData.openingBalance} onChange={(e) => setFormData({...formData, openingBalance: parseFloat(e.target.value) || 0})} className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-gray-900" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance Type</label>
                          <select value={formData.balanceType} onChange={(e) => setFormData({...formData, balanceType: e.target.value})} className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gray-900 font-bold">
                            <option value="DR">Debit (Receivable)</option>
                            <option value="CR">Credit (Advance)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preferred Settlement Currency</label>
                        <div className="flex gap-2">
                          {['BDT', 'USD', 'EUR', 'GBP'].map((curr) => (
                            <button
                              key={curr}
                              type="button"
                              onClick={() => setFormData({...formData, preferredCurrency: curr, exchangeRate: curr === 'BDT' ? 1 : formData.exchangeRate})}
                              className={cn(
                                "flex-1 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all border",
                                formData.preferredCurrency === curr 
                                  ? "bg-gray-900 text-white border-gray-900 shadow-sm" 
                                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-900 hover:text-gray-900"
                              )}
                            >
                              {curr}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exchange Rate (to BDT)</label>
                          <input 
                            type="number" step="any"
                            value={formData.exchangeRate} 
                            onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})} 
                            className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-gray-900" 
                            disabled={formData.preferredCurrency === 'BDT'}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valuation (BDT)</label>
                          <div className="w-full bg-gray-100 border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono font-bold text-gray-600">
                             ৳{(formData.openingBalance * (formData.exchangeRate || 1)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50/50 rounded-sm border border-blue-100 flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest">Accounting Integrity</p>
                        <p className="text-[10px] text-blue-700/70 leading-relaxed italic mt-0.5">Opening balances are reflected in the General Ledger upon initialization.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
