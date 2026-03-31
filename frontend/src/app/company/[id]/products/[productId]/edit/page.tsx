'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Package, ArrowLeft, Save, Tag, FileText, DollarSign, CheckCircle2,
  Trash2, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';


interface Product {
  id: string;
  code: string;
  name: string;
  sku: string | null;
  description: string | null;
  unitPrice: number;
  isActive: boolean;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const productId = params.productId as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    unitPrice: 0,
    currency: 'BDT',
    exchangeRate: 1,
    priceBDT: 0,
    isActive: true
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products/${productId}`);
      return response.data.data as Product;
    },
    enabled: !!productId && !!companyId,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        unitPrice: product.unitPrice,
        currency: (product as any).currency || 'BDT',
        exchangeRate: (product as any).exchangeRate || 1,
        priceBDT: (product as any).priceBDT || (product.unitPrice * ((product as any).exchangeRate || 1)),
        isActive: product.isActive
      });
    }
  }, [product]);

  useEffect(() => {
    const price = parseFloat(formData.unitPrice?.toString() || '0');
    const rate = parseFloat(formData.exchangeRate?.toString() || '1');
    setFormData(prev => ({ 
      ...prev, 
      priceBDT: Number((price * rate).toFixed(2))
    }));
  }, [formData.unitPrice, formData.exchangeRate]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/company/${companyId}/products/${productId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Product updated successfully');
      router.push(`/company/${companyId}/products`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/company/${companyId}/products/${productId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      toast.success('Product deleted successfully');
      router.push(`/company/${companyId}/products`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete product');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Product name is required');
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Loading Product Data...</p>
        </div>
      </div>
    );
  }

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
                <span className="text-slate-900">{product?.code || 'Product'}</span>
              </nav>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Package className="w-7 h-7 text-blue-600" />
                Edit Product
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto invisible sm:visible">
             <button
              onClick={() => router.back()}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancel
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
                       Unit Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">
                        {formData.currency === 'USD' ? '$' : formData.currency === 'EUR' ? '€' : formData.currency === 'GBP' ? '£' : '৳'}
                      </span>
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
                  <div>
                    <label className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                       Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                    >
                      <option value="BDT">BDT (Takas)</option>
                      <option value="USD">USD (Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="GBP">GBP (Pounds)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                       Exchange Rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">৳</span>
                      <input
                        type="number"
                        step="0.0001"
                        disabled={formData.currency === 'BDT'}
                        value={formData.currency === 'BDT' ? 1 : formData.exchangeRate}
                        onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                       Final Price (BDT)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">৳</span>
                      <input
                        type="number"
                        readOnly
                        value={formData.priceBDT}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 text-lg outline-none cursor-default"
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

            {/* Warning Card */}
            <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 space-y-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900">Careful with Changes</h4>
                <p className="text-slate-600 text-sm leading-relaxed mt-2">
                  Updating the unit price will not affect existing invoices or orders, but will be the default for all future transactions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 lg:left-64 z-30">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            title="Delete Product"
          >
            <Trash2 className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => router.back()}
            className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="flex-[2] px-6 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3 text-lg"
          >
            {updateMutation.isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-6 h-6" />
            )}
            {updateMutation.isPending ? 'Updating Product...' : 'Update Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
