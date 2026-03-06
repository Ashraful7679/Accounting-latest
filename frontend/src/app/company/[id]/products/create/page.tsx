'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Package, ArrowLeft, Save, X, Tag, FileText, DollarSign, CheckCircle2 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CreateProductPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    unitPrice: 0,
    isActive: true
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/products`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      toast.success('Product created successfully');
      router.push(`/company/${companyId}/products`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create product');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Product name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      <div className="max-w-4xl mx-auto p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:shadow-sm transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                <span className="hover:text-blue-600 transition-colors cursor-pointer" onClick={() => router.push(`/company/${companyId}/products`)}>Catalog</span>
                <span>/</span>
                <span className="text-slate-900">New Product</span>
              </nav>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <PlusIcon className="w-6 h-6 text-blue-600" />
                Add New Product
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => router.back()}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {createMutation.isPending ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>

        {/* Main Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* General Info */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">General Information</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Industrial Steel Pipe"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-lg"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Provide details about dimensions, material grade, or usage..."
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium min-h-[120px] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Identity */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">Identity & Pricing</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">SKU / Model Number</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        placeholder="e.g. SP-2024-XP"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                      Default Unit Price
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-tighter">Optional</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.unitPrice || ''}
                        onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-black text-slate-900 text-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Status & Controls */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">Visibility</h3>
              </div>
              <div className="p-6">
                <div 
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                    formData.isActive 
                    ? 'bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/50' 
                    : 'bg-slate-50 border-slate-100'
                  }`}
                  onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                >
                  <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${formData.isActive ? 'right-1' : 'left-1'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Active Status</p>
                    <p className="text-[11px] text-slate-500 font-medium">Allow this product in transactions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips/Info Card */}
            <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 space-y-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-lg">Quick Tip</h4>
                <p className="text-blue-100 text-sm leading-relaxed mt-2">
                  Adding an accurate SKU and Unit Price now will save time when creating <b>Sales Invoices</b> or <b>Purchase Orders</b> later.
                </p>
              </div>
              <div className="pt-2">
                <div className="h-px bg-blue-500/50 w-full mb-4" />
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Accounting Pro Tips</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}
