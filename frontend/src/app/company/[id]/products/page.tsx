'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Package, Plus, Search, Edit2, Trash2, Eye,
  CheckCircle2, AlertCircle, ShoppingBag, 
  Tag, Info, MoreVertical, X, RefreshCw,
  Save, Printer, Link2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol, formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
import { ConfirmModal } from '@/components/ConfirmModal';
import { usePermissions } from '@/hooks/usePermissions';


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
  isActive: boolean;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('inventory.products', companyId);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'local' | 'foreign'>('local');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  // Detail panel state
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');

  // Edit form state
  const [editForm, setEditForm] = useState({
    code: '',
    name: '',
    sku: '',
    description: '',
    unitType: '',
    unitPrice: '',
    type: 'SALES_PURCHASE',
    currency: 'BDT',
    isActive: true,
  });

  // Stock adjustment state
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      setShowDetailPanel(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const response = await api.put(`/company/${companyId}/products/${selectedProduct?.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      toast.success('Product updated successfully');
      setViewMode('view');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update product');
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/products/${data.id}/adjust-stock`, {
        adjustmentAmount: data.adjustmentAmount,
        notes: data.notes
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', companyId] });
      toast.success('Stock adjusted successfully');
      setShowAdjustModal(false);
      // Reset form fields so next open starts fresh
      setAdjustAmount(0);
      setAdjustNotes('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to adjust stock');
    },
  });

  const filteredProducts = (Array.isArray(products) ? products : [])?.filter(p =>
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
     p.sku?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    ((activeTab === 'local' && p.currency === 'BDT') || (activeTab === 'foreign' && p.currency !== 'BDT'))
  ) || [];

  const handleRowClick = (product: Product) => {
    setSelectedProduct(product);
    setEditForm({
      code: product.code,
      name: product.name,
      sku: product.sku || '',
      description: product.description || '',
      unitType: product.unitType,
      unitPrice: product.unitPrice.toString(),
      type: product.type || 'SALES_PURCHASE',
      currency: product.currency,
      isActive: product.isActive,
    });
    setShowDetailPanel(true);
    setViewMode('view');
  };

  const handleEdit = () => {
    setViewMode('edit');
  };

  const handleSave = () => {
    updateMutation.mutate({
      code: editForm.code,
      name: editForm.name,
      sku: editForm.sku || null,
      description: editForm.description || null,
      unitType: editForm.unitType,
      unitPrice: parseFloat(editForm.unitPrice),
      type: editForm.type,
      currency: editForm.currency,
      isActive: editForm.isActive,
    });
  };

  const handleCancel = () => {
    if (selectedProduct) {
      setEditForm({
        code: selectedProduct.code,
        name: selectedProduct.name,
        sku: selectedProduct.sku || '',
        description: selectedProduct.description || '',
        unitType: selectedProduct.unitType,
        unitPrice: selectedProduct.unitPrice.toString(),
        type: selectedProduct.type || 'SALES_PURCHASE',
        currency: selectedProduct.currency,
        isActive: selectedProduct.isActive,
      });
    }
    setViewMode('view');
  };

  const handleAdjustStock = () => {
    if (!selectedProduct) return;
    adjustMutation.mutate({
      id: selectedProduct.id,
      adjustmentAmount: adjustAmount,
      notes: adjustNotes
    });
  };

  // Build detail panel fields
  const getDetailFields = (): DetailField[] => {
    if (!selectedProduct) return [];
    
    const currencySymbol = getCurrencySymbol(selectedProduct.currency);
    
    if (viewMode === 'edit') {
      return [
        { label: 'Product Code', value: '', type: 'text' },
        { label: 'Product Name', value: '', type: 'text' },
        { label: 'SKU', value: '', type: 'text' },
        { label: 'Unit Type', value: '', type: 'text' },
        { label: 'Unit Price', value: '', type: 'number' },
        { label: 'Currency', value: '', type: 'text' },
        { label: 'Type', value: '', type: 'text' },
        { label: 'Active', value: '', type: 'text' },
      ];
    }

    return [
      { label: 'Product Code', value: selectedProduct.code },
      { label: 'Product Name', value: selectedProduct.name },
      { label: 'SKU', value: selectedProduct.sku || '-' },
      { label: 'Description', value: selectedProduct.description || '-' },
      { label: 'Unit Type', value: selectedProduct.unitType },
      { label: 'Unit Price', value: `${currencySymbol}${formatCurrency(selectedProduct.unitPrice)}`, type: 'currency' },
      { label: 'Current Stock', value: selectedProduct.stockAmount.toString(), type: 'quantity' },
      { label: 'Status', value: selectedProduct.isActive ? 'Active' : 'Inactive', type: 'status' },
    ];
  };

  // Build detail panel actions
  const getDetailActions = (): DetailAction[] => {
    if (!selectedProduct) return [];

    if (viewMode === 'edit') {
      return [
        { label: 'Save Changes', icon: Save, onClick: handleSave, variant: 'primary', loading: updateMutation.isPending },
        { label: 'Cancel', icon: X, onClick: handleCancel, variant: 'secondary' },
      ];
    }

    return [
      { label: 'Adjust Stock', icon: RefreshCw, onClick: () => setShowAdjustModal(true), variant: 'secondary' },
      { label: 'Edit Product', icon: Edit2, onClick: handleEdit, variant: 'secondary' },
      { label: 'Delete', icon: Trash2, onClick: () => setShowDeleteModal(true), variant: 'danger' },
    ];
  };

  // Build detail panel tabs
  const getDetailTabs = (): DetailTab[] => {
    if (!selectedProduct) return [];

    return [
      {
        id: 'details',
        label: 'Details',
        content: (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {getDetailFields().map((field, idx) => {
                if (viewMode === 'edit') {
                  const isSelect = field.label.toLowerCase().includes('currency') || field.label.toLowerCase().includes('type') || field.label.toLowerCase().includes('status');
                  
                  if (field.label === 'Product Code') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <input
                          type="text"
                          value={editForm.code}
                          onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    );
                  }
                  if (field.label === 'Product Name') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    );
                  }
                  if (field.label === 'SKU') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <input
                          type="text"
                          value={editForm.sku}
                          onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    );
                  }
                  if (field.label === 'Unit Type') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <input
                          type="text"
                          value={editForm.unitType}
                          onChange={(e) => setEditForm({ ...editForm, unitType: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    );
                  }
                  if (field.label === 'Unit Price') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <input
                          type="number"
                          value={editForm.unitPrice}
                          onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        />
                      </div>
                    );
                  }
                  if (field.label === 'Currency') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <select
                          value={editForm.currency}
                          onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        >
                          <option value="BDT">BDT</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>
                    );
                  }
                  if (field.label === 'Type') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                        >
                          <option value="SALES_PURCHASE">Sales & Purchase</option>
                          <option value="SALES_ONLY">Sales Only</option>
                          <option value="PURCHASE_ONLY">Purchase Only</option>
                        </select>
                      </div>
                    );
                  }
                  if (field.label === 'Status' || field.label === 'Active') {
                    return (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</label>
                        <label className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            checked={editForm.isActive}
                            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium">Active Product</span>
                        </label>
                      </div>
                    );
                  }
                  return null;
                }

                return (
                  <div key={idx} className={cn(
                    'space-y-1',
                    field.label.toLowerCase().includes('description') ? 'col-span-2' : ''
                  )}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {field.label}
                    </label>
                    <div className="text-slate-900 font-medium">
                      {field.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      },
      {
        id: 'stock',
        label: 'Stock History',
        content: (
          <div className="p-6">
            <div className="text-center py-8 text-slate-400">
              <RefreshCw className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Stock history will appear here</p>
            </div>
          </div>
        ),
      },
      {
        id: 'transactions',
        label: 'Transactions',
        content: (
          <div className="p-6">
            <div className="text-center py-8 text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No transactions yet</p>
            </div>
          </div>
        ),
      },
    ];
  };

  if (!mounted) return null;

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

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
            className="group relative px-6 py-3 bg-gray-900 hover:bg-gray-700 text-white rounded-xl font-bold transition-all duration-300 hover:shadow-lg active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
            Add New Product
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('local')}
            className={cn(
              "px-4 py-2 rounded",
              activeTab === 'local' ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-800"
            )}
          >Local</button>
          <button
            onClick={() => setActiveTab('foreign')}
            className={cn(
              "px-4 py-2 rounded",
              activeTab === 'foreign' ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-800"
            )}
          >Foreign</button>
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
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-slate-400 font-medium">Loading catalog...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-slate-300" />
                        </div>
                        <div className="max-w-xs">
                          <p className="text-slate-900 font-bold text-lg">No products found</p>
                          <p className="text-slate-500 text-sm mt-1">Get started by adding your first product to the catalog.</p>
                        </div>
                        <button 
                          onClick={() => router.push(`/company/${companyId}/products/create`)} 
                          className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add your first product
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const currencySymbol = getCurrencySymbol(product.currency);
                    return (
                      <tr 
                        key={product.id} 
                        onClick={() => handleRowClick(product)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                              <Tag className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{product.name}</div>
                              <div className="text-xs text-slate-500 font-mono uppercase tracking-tight">{product.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600 font-medium">{product.sku || '---'}</span>
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
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => handleRowClick(product)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/company/${companyId}/products/${product.id}/edit`)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={showDetailPanel}
        onClose={() => {
          setShowDetailPanel(false);
          setSelectedProduct(null);
          setViewMode('view');
        }}
        title={viewMode === 'edit' ? 'Edit Product' : (selectedProduct?.name || 'New Product')}
        subtitle={selectedProduct ? selectedProduct.code : undefined}
        fields={getDetailFields()}
        actions={getDetailActions()}
        tabs={getDetailTabs()}
        status={selectedProduct ? {
          value: selectedProduct.isActive ? 'active' : 'inactive',
          type: selectedProduct.isActive ? 'active' : 'inactive',
        } : undefined}
        metadata={selectedProduct?.createdAt ? {
          createdAt: selectedProduct.createdAt,
          updatedAt: selectedProduct.updatedAt,
        } : undefined}
        size="lg"
      />

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Adjust Stock</h3>
                <p className="text-sm text-slate-500">{selectedProduct.name}</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Stock</label>
                  <p className="text-xl font-black text-slate-900">{selectedProduct.stockAmount}</p>
                </div>
                <div className={`p-3 rounded-2xl border transition-colors ${adjustAmount === 0 ? 'bg-slate-50 border-slate-100' : adjustAmount > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Total</label>
                  <p className={`text-xl font-black ${adjustAmount === 0 ? 'text-slate-900' : adjustAmount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(selectedProduct.stockAmount + adjustAmount).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex justify-between">
                  <span>Adjustment Amount (+/-)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{selectedProduct.unitType}</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={adjustAmount || ''}
                    onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter + to add or - to subtract"
                    className={`w-full px-4 py-3 bg-white border-2 rounded-2xl focus:outline-none focus:ring-4 transition-all font-black text-xl text-center ${
                      adjustAmount === 0 ? 'border-slate-200 focus:ring-slate-500/10 focus:border-slate-400' : 
                      adjustAmount > 0 ? 'border-emerald-200 focus:ring-emerald-500/10 focus:border-emerald-500 text-emerald-600' : 
                      'border-red-200 focus:ring-red-500/10 focus:border-red-500 text-red-600'
                    }`}
                  />
                  {adjustAmount !== 0 && (
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 font-black text-sm uppercase ${adjustAmount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {adjustAmount > 0 ? 'Increase' : 'Decrease'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Adjustment Notes</label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Reason for adjustment (e.g. Damage, Production, Stocktake...)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[100px]"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg flex gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  This adjustment will automatically generate a **Journal Entry** to reflect the stock value change in your accounts.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustStock}
                disabled={adjustMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adjustMutation.isPending ? 'Processing...' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Product"
        message={`Are you sure you want to delete "${selectedProduct?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (selectedProduct) {
            deleteMutation.mutate(selectedProduct.id);
          }
        }}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}