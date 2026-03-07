'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, Edit2, Trash2, Eye, 
  Package, Calendar, DollarSign, Building2, 
  Trash, ChevronDown, CheckCircle2, Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface POLine {
  productId?: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor?: { id: string; name: string };
  supplier?: { id: string; name: string };
  lc?: { id: string; lcNumber: string };
  poDate: string;
  expectedDeliveryDate: string | null;
  currency: string;
  exchangeRate: number;
  totalForeign: number;
  totalBDT: number;
  status: string;
  lines: POLine[];
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    supplierId: '',
    lcId: '',
    poDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    currency: 'BDT',
    exchangeRate: 1,
    lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }] as POLine[],
    status: 'DRAFT'
  });

  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  // Data Fetching
  const { data: posData, isLoading } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data as PurchaseOrder[];
    },
    enabled: !!companyId,
  });

  const editId = searchParams.get('edit');
  useEffect(() => {
    if (editId && !isLoading && mounted) {
      const existingPO = posData?.find((po: PurchaseOrder) => po.id === editId);
      if (existingPO) {
        openModal(existingPO);
      } else {
        api.get(`/company/${companyId}/purchase-orders/${editId}`)
          .then(res => {
            openModal(res.data.data);
          })
          .catch(err => toast.error('Failed to load PO details'));
      }
      window.history.replaceState({}, '', `/company/${companyId}/purchase/orders`);
    }
  }, [editId, isLoading, mounted, companyId, posData]);

  const { data: vendorsData } = useQuery({
    queryKey: ['company-vendors', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/vendors`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: lcsData } = useQuery({
    queryKey: ['company-lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const totalForeign = data.lines.reduce((acc: number, line: POLine) => acc + (line.quantity * line.unitPrice), 0);
      const submitData = {
        ...data,
        totalForeign,
        totalBDT: totalForeign * data.exchangeRate,
        createdById: JSON.parse(localStorage.getItem('user') || '{}').id
      };
      return await api.post(`/company/${companyId}/purchase-orders`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] });
      toast.success('Purchase Order created successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create PO');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const totalForeign = data.lines.reduce((acc: number, line: POLine) => acc + (line.quantity * line.unitPrice), 0);
      const submitData = {
        ...data,
        totalForeign,
        totalBDT: totalForeign * data.exchangeRate,
      };
      return await api.put(`/company/${companyId}/purchase-orders/${id}`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] });
      toast.success('Purchase Order updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update PO');
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      return await api.patch(`/company/${companyId}/purchase-orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] });
      toast.success('Purchase Order status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/company/${companyId}/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] });
      toast.success('Purchase Order deleted');
    }
  });

  // Line item handlers
  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = [...formData.lines];
    newLines.splice(index, 1);
    setFormData({ ...formData, lines: newLines });
  };

  const updateLine = (index: number, field: keyof POLine, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };
    
    // Auto-fill from product
    if (field === 'productId' && value) {
      const product = productsData?.find((p: any) => p.id === value);
      if (product) {
        line.itemDescription = product.name;
        line.unitPrice = product.unitPrice;
      }
    }
    
    if (field === 'quantity' || field === 'unitPrice' || field === 'productId') {
      line.total = line.quantity * line.unitPrice;
    }
    
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const openModal = (po?: PurchaseOrder) => {
    if (po) {
      setSelectedPO(po);
      setFormData({
        supplierId: po.supplier?.id || '',
        lcId: po.lc?.id || '',
        poDate: po.poDate ? new Date(po.poDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().split('T')[0] : '',
        currency: po.currency || 'BDT',
        exchangeRate: po.exchangeRate || 1,
        lines: po.lines?.length ? po.lines.map(l => ({...l, productId: l.productId || ''})) : [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }],
        status: po.status || 'DRAFT'
      });
    } else {
      setSelectedPO(null);
      setFormData({
        supplierId: '',
        lcId: '',
        poDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: '',
        currency: 'BDT',
        exchangeRate: 1,
        lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }],
        status: 'DRAFT'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPO(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-600',
      APPROVED: 'bg-emerald-100 text-emerald-700',
      SENT: 'bg-blue-100 text-blue-700',
      RECEIVED: 'bg-purple-100 text-purple-700',
      CLOSED: 'bg-gray-100 text-gray-800',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const subtotal = formData.lines.reduce((acc, line) => acc + line.total, 0);

  if (!mounted) return null;

  return (
    <div className="min-h-screen">


        <div className="p-6 max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                Purchase Orders
              </h2>
              <p className="text-slate-500 font-medium">Manage procurement and supplier orders</p>
            </div>
            <button 
              onClick={() => openModal()}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Create New PO
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Orders', value: posData?.length || 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Pending Approval', value: posData?.filter(p => p.status === 'DRAFT').length || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Active LCs', value: lcsData?.length || 0, icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Received This Month', value: 0, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search PO # or Supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">PO Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Supplier</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amout (Foreign)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Total (BDT)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 animate-pulse font-bold text-slate-400">Loading procurement data...</td></tr>
                  ) : posData?.filter(p => p.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) || p.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400">No Purchase Orders found</td></tr>
                  ) : (
                    posData?.map((po) => (
                      <tr key={po.id} className="group hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{po.poNumber}</span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {new Date(po.poDate).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{po.supplier?.name || 'Unknown'}</span>
                            <span className="text-[10px] text-blue-500 uppercase font-black">{po.lc?.lcNumber ? `LC: ${po.lc.lcNumber}` : 'Standard PO'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono font-bold text-slate-900">{po.currency} {po.totalForeign.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          {po.totalBDT.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${getStatusBadge(po.status)}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <select 
                               value={po.status}
                               onChange={(e) => statusMutation.mutate({ id: po.id, status: e.target.value })}
                               className="px-2 py-1 text-xs rounded border border-slate-200 bg-white"
                             >
                                <option value="DRAFT">DRAFT</option>
                                <option value="APPROVED">APPROVED</option>
                                <option value="SENT">SENT</option>
                                <option value="RECEIVED">RECEIVED</option>
                                <option value="CLOSED">CLOSED</option>
                             </select>
                            <button onClick={() => openModal(po)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => {
                                if (window.confirm("Are you sure you want to delete this Purchase Order?")) {
                                    deleteMutation.mutate(po.id);
                                }
                            }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Package className="w-6 h-6 text-blue-600" />
                  {selectedPO ? `Edit Purchase Order ${selectedPO.poNumber}` : 'New Purchase Order'}
                </h3>
                <p className="text-sm text-slate-500">{selectedPO ? 'Update existing procurement request' : 'Draft a new procurement request'}</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100">
                <ChevronDown className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={(e) => { 
                e.preventDefault(); 
                if (selectedPO) {
                    updateMutation.mutate({ id: selectedPO.id, data: formData });
                } else {
                    createMutation.mutate(formData); 
                }
            }} className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Side: Details */}
                <div className="lg:col-span-1 space-y-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Supplier *</label>
                    <select 
                      value={formData.supplierId} 
                      onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                      required
                    >
                      <option value="">Select Company</option>
                      {vendorsData?.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">LC Link (Optional)</label>
                    <select 
                      value={formData.lcId} 
                      onChange={(e) => setFormData({...formData, lcId: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold"
                    >
                      <option value="">Standard Purchase</option>
                      {lcsData?.map((l: any) => <option key={l.id} value={l.id}>{l.lcNumber}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Order Date</label>
                      <input type="date" value={formData.poDate} onChange={(e) => setFormData({...formData, poDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" required />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Exp. Delivery</label>
                      <input type="date" value={formData.expectedDeliveryDate} onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl px-4 py-3 outline-none transition-all font-bold" />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl space-y-3">
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Currency Sync
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} className="bg-white rounded-xl px-2 py-2 text-sm font-bold border-none outline-none">
                        <option value="USD">USD</option>
                        <option value="BDT">BDT</option>
                        <option value="EUR">EUR</option>
                      </select>
                      <input type="number" value={formData.exchangeRate} onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value)})} className="bg-white rounded-xl px-2 py-2 text-sm font-bold border-none outline-none w-full" placeholder="Rate" />
                    </div>
                  </div>
                </div>

                {/* Right Side: Lines */}
                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Order Items</h4>
                    <button type="button" onClick={addLine} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="col-span-3">Product</div>
                      <div className="col-span-3">Description</div>
                      <div className="col-span-2 text-center">Qty</div>
                      <div className="col-span-2 text-right">Price</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {formData.lines.map((line, idx) => (
                        <div key={idx} className="group grid grid-cols-12 gap-2 bg-slate-50 p-2 rounded-2xl hover:bg-slate-100 transition-colors">
                          <div className="col-span-3">
                            <select 
                              value={line.productId} 
                              onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                              className="w-full bg-transparent border-none outline-none font-bold text-slate-700 px-2 text-sm"
                            >
                              <option value="">Custom Item</option>
                              {productsData?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <input 
                              type="text" value={line.itemDescription} placeholder="Material/Product Name"
                              onChange={(e) => updateLine(idx, 'itemDescription', e.target.value)}
                              className="w-full bg-transparent border-none outline-none font-bold text-slate-700 px-2 text-sm" required
                            />
                          </div>
                          <div className="col-span-2">
                            <input 
                              type="number" value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value))}
                              className="w-full bg-transparent border-none outline-none font-bold text-center text-slate-700 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <input 
                              type="number" value={line.unitPrice}
                              onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value))}
                              className="w-full bg-transparent border-none outline-none font-bold text-right text-slate-700 text-sm"
                            />
                          </div>
                          <div className="col-span-2 relative pr-8">
                            <div className="w-full text-right font-bold text-slate-900 mt-1 text-sm">
                              {line.total.toLocaleString()}
                            </div>
                            <button 
                              type="button" onClick={() => removeLine(idx)}
                              className="absolute right-0 top-1 p-1 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-col items-end gap-2 border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-12">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foreign Subtotal</span>
                        <span className="text-xl font-black text-slate-900 font-mono">{formData.currency} {subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-12">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Total BDT Est.</span>
                        <span className="text-2xl font-black text-emerald-600 font-mono">৳ {(subtotal * formData.exchangeRate).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-8 mt-4">
                <button type="button" onClick={closeModal} className="px-8 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all active:scale-95">
                  Discard Draft
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-12 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/30 active:scale-95 disabled:bg-slate-200"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
