'use client';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Package, Plus, Search, Edit2, Trash2, 
  CheckCircle2, AlertCircle, ShoppingBag, 
  Tag, Info, MoreVertical, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';


interface Product {
  id: string;
  code: string;
  name: string;
  sku: string | null;
  description: string | null;
  unitType: string;
  unitPrice: number;
  currency: string;
  stockAmount: number;
  type: string;
  isActive: boolean;
}

export default function ProductsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data as Product[];
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/products/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      toast.success('Product deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete product');
    },
  });

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              Products & Items
            </h1>
            <p className="text-slate-500 mt-1">Manage your catalog for sales and purchases</p>
          </div>
          
          <button
            onClick={() => router.push(`/company/${companyId}/products/create`)}
            className="group relative px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-lg hover:shadow-blue-200 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            Add New Product
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name, code or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product Info</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Unit Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Stock</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-slate-400 font-medium">Loading catalog...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="max-w-xs">
                          <p className="text-slate-900 font-bold text-lg">No products found</p>
                          <p className="text-slate-500 text-sm mt-1">Get started by adding your first product to the catalog.</p>
                        </div>
                        <button onClick={() => router.push(`/company/${companyId}/products/create`)} className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1">
                          <Plus className="w-4 h-4" /> Add your first product
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const currencySymbol = getCurrencySymbol(product.currency);
                    return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Tag className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{product.name}</div>
                            <div className="text-xs text-slate-500 font-mono uppercase tracking-tight">{product.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-medium">{product.sku || '---'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          product.type === 'Sales' 
                            ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                            : 'bg-orange-50 text-orange-600 border border-orange-100'
                        }`}>
                          {product.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-bold text-xs uppercase tracking-wider">{product.unitType}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-slate-900 font-black">
                          {currencySymbol}{formatCurrency(product.unitPrice)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-black ${product.stockAmount <= 5 ? 'text-red-600' : 'text-slate-900'}`}>
                          {product.stockAmount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <AlertCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => router.push(`/company/${companyId}/products/${product.id}/edit`)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this product?')) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


