'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit, ArrowLeft, LogOut, Building2, Bell, X, Package, DollarSign } from 'lucide-react';
import UserDropdown from '@/components/UserDropdown';

interface Vendor {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  contactPerson?: string | null;
  tinVat?: string | null;
  openingBalance?: number;
  balanceType?: string | null;
  creditLimit?: number | null;
  preferredCurrency?: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  baseCurrency: string;
}

interface ProductPriceMapping {
  id: string;
  productId: string;
  product: Product;
  price: number;
  currency: string;
}

export default function CompanyVendorsPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
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
    balanceType: 'CR',
    creditLimit: 0,
    preferredCurrency: 'BDT',
  });

  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  
  const [productFormData, setProductFormData] = useState({
    productId: '',
    price: 0,
    currency: 'USD',
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const { data: vendorsData, isLoading } = useQuery({
    queryKey: ['company-vendors', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendors`);
      return response.data.data as Vendor[];
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post(`/company/${companyId}/vendors`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vendors', companyId] });
      toast.success('Vendor created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create vendor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await api.put(`/company/${companyId}/vendors/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vendors', companyId] });
      toast.success('Vendor updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update vendor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/company/${companyId}/vendors/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vendors', companyId] });
      toast.success('Vendor deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete vendor');
    },
  });

  // --- Product Mapping Mutations ---
  const { data: allProducts } = useQuery({
    queryKey: ['company-products', companyId],
    queryFn: async () => {
      const resp = await api.get(`/company/${companyId}/products`);
      return resp.data.data as Product[];
    },
    enabled: showProductModal
  });

  const assignProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/company/${companyId}/products/prices`, {
        ...data,
        entityId: selectedEntityId,
        type: 'vendor'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-products', selectedEntityId] });
      toast.success('Product price assigned');
      setShowProductModal(false);
      setProductFormData({ productId: '', price: 0, currency: 'USD' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to assign product')
  });

  const removeProductMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      await api.delete(`/company/${companyId}/products/prices/${mappingId}`);
    },
    onSuccess: (_, mappingId) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-products', selectedEntityId] });
      toast.success('Mapping removed');
    }
  });

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const openModal = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({
        name: vendor.name,
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        city: vendor.city || '',
        country: vendor.country || '',
        contactPerson: vendor.contactPerson || '',
        tinVat: vendor.tinVat || '',
        openingBalance: vendor.openingBalance || 0,
        balanceType: vendor.balanceType || 'CR',
        creditLimit: vendor.creditLimit || 0,
        preferredCurrency: vendor.preferredCurrency || 'BDT',
      });
    } else {
      setEditingVendor(null);
      setFormData({ 
        name: '', email: '', phone: '', address: '', city: '', country: '',
        contactPerson: '', tinVat: '', openingBalance: 0, balanceType: 'CR', 
        creditLimit: 0, preferredCurrency: 'BDT'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const VendorProducts = ({ vendorId }: { vendorId: string }) => {
    const { data: mappings, isLoading: loadingMappings } = useQuery({
      queryKey: ['vendor-products', vendorId],
      queryFn: async () => {
        const resp = await api.get(`/company/${companyId}/products/entity?entityId=${vendorId}&type=vendor`);
        return resp.data.data as ProductPriceMapping[];
      }
    });

    return (
      <div className="bg-slate-50/80 p-6 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            Supplier-Specific Sourcing Prices
          </h4>
          <button 
            onClick={() => {
              setSelectedEntityId(vendorId);
              setShowProductModal(true);
            }}
            className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" /> Assign Item
          </button>
        </div>

        {loadingMappings ? (
          <div className="text-center py-4 text-slate-400 text-xs font-bold animate-pulse">Fetching catalogues...</div>
        ) : mappings?.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-400 font-medium">No specialized products assigned to this supplier.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mappings?.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-slate-800">{m.product.name}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{m.product.code}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600">{m.price.toLocaleString()}</span>
                    <span className="text-[9px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{m.currency}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedEntityId(vendorId);
                    removeProductMutation.mutate(m.id);
                  }}
                  className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this vendor?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen">


        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vendor Master</h2>
            <button onClick={() => openModal()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
              <Plus className="w-5 h-5" />
              Add Vendor
            </button>
          </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Email/Phone</th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                  <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vendorsData?.map((vendor) => (
                  <>
                    <tr 
                      key={vendor.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${expandedVendorId === vendor.id ? 'bg-blue-50/30' : ''}`}
                      onClick={() => setExpandedVendorId(expandedVendorId === vendor.id ? null : vendor.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{vendor.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{vendor.code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <span>{vendor.contactPerson || '-'}</span>
                          <span className="text-xs text-slate-500">{vendor.tinVat ? `TIN: ${vendor.tinVat}` : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <span>{vendor.email || '-'}</span>
                          <span className="text-xs text-slate-500">{vendor.phone || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        <span className={vendor.balanceType === 'DR' ? 'text-blue-600' : 'text-red-600'}>
                          {vendor.openingBalance?.toLocaleString()} {vendor.balanceType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm uppercase font-bold text-slate-600">{vendor.preferredCurrency}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openModal(vendor)} className="p-1 text-blue-600 hover:text-blue-800">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(vendor.id)} className="p-1 text-red-600 hover:text-red-800">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedVendorId === vendor.id && (
                      <tr>
                        <td colSpan={6} className="p-0 border-none bg-white">
                          <VendorProducts vendorId={vendor.id} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {vendorsData?.length === 0 && (
              <div className="text-center py-8 text-gray-500">No vendors found</div>
            )}
          </div>
        )}
        </div>
      

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingVendor ? 'Edit Supplier' : 'Register New Supplier'}
                </h3>
                <p className="text-sm text-slate-500">Configure basic and financial details</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Basic Section */}
                <div className="lg:col-span-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Company Information
                  </h4>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Supplier Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" placeholder="e.g. Acme Corp" required />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Person</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="input w-full" placeholder="Full Name" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input w-full" placeholder="supplier@example.com" />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input w-full" placeholder="+1..." />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">TIN / VAT No</label>
                  <input type="text" value={formData.tinVat} onChange={(e) => setFormData({ ...formData, tinVat: e.target.value })} className="input w-full" placeholder="Tax ID" />
                </div>

                {/* Address Section */}
                <div className="lg:col-span-3 mt-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Location Details
                  </h4>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Street Address</label>
                  <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input w-full" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">City</label>
                    <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Country</label>
                    <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="input w-full" />
                  </div>
                </div>

                {/* Financial Section */}
                <div className="lg:col-span-3 mt-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Financial Configuration
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Preferred Currency</label>
                  <select value={formData.preferredCurrency} onChange={(e) => setFormData({ ...formData, preferredCurrency: e.target.value })} className="input w-full">
                    <option value="BDT">BDT (Local)</option>
                    <option value="USD">USD (Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (Pound)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Credit Limit</label>
                  <input type="number" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) })} className="input w-full" placeholder="0.00" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Opening Bal.</label>
                    <input type="number" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) })} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
                    <select value={formData.balanceType} onChange={(e) => setFormData({ ...formData, balanceType: e.target.value })} className="input w-full">
                      <option value="CR">Credit (Payable)</option>
                      <option value="DR">Debit (Advance)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-8 mt-8 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-6 py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                  {editingVendor ? 'Update Supplier' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PRODUCT ASSIGNMENT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Assign Sourcing Price
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Product</label>
                <select 
                  value={productFormData.productId} 
                  onChange={(e) => setProductFormData({...productFormData, productId: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-xl px-4 py-2.5 outline-none font-bold"
                >
                  <option value="">Select a product...</option>
                  {allProducts?.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sourcing Price</label>
                  <input 
                    type="number" 
                    value={productFormData.price} 
                    onChange={(e) => setProductFormData({...productFormData, price: parseFloat(e.target.value)})}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-xl px-4 py-2.5 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Currency</label>
                  <select 
                    value={productFormData.currency} 
                    onChange={(e) => setProductFormData({...productFormData, currency: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-xl px-4 py-2.5 outline-none font-bold"
                  >
                    <option value="USD">USD</option>
                    <option value="BDT">BDT</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowProductModal(false)} className="flex-1 py-3 font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
              <button 
                onClick={() => assignProductMutation.mutate(productFormData)}
                disabled={!productFormData.productId || assignProductMutation.isPending}
                className="flex-3 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:bg-slate-200"
              >
                {assignProductMutation.isPending ? 'Mapping...' : 'Assign Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
