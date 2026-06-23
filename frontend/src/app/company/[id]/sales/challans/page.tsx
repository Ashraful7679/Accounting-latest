'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Truck, Search, Eye, ChevronDown, ChevronRight, 
  Printer, Package, FileText, ArrowUpRight, Plus, Trash2, X, Loader2, ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'react-hot-toast';

export default function DeliveryChallansPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { canView, canCreate, canDelete, isLoading: permsLoading } = usePermissions('sales.challans', companyId);
  const { exchangeRate: companyExchangeRate } = useCompany();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [expandedChallans, setExpandedChallans] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSOId, setSelectedSOId] = useState('');
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dnItems, setDnItems] = useState<Array<{productId: string; productName: string; quantity: number; maxQty: number}>>([]);

  useEffect(() => { setMounted(true); }, []);

  const { data: challans, isLoading } = useQuery({
    queryKey: ['delivery-challans', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/challans`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders`);
      const result = response.data.data;
      return (Array.isArray(result) ? result : (result?.data || []));
    },
    enabled: !!companyId,
  });

  const availableSOs = (Array.isArray(salesOrders) ? salesOrders : []).filter((so: any) =>
    !['CANCELLED', 'COMPLETED', 'DRAFT'].includes(so.status)
  );

  const createMutation = useMutation({
    mutationFn: async ({ soId, data }: { soId: string; data: { items: { productId: string; quantity: number }[]; shipmentDate?: string } }) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/dn`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans', companyId] });
      toast.success('Delivery Challan created');
      closeCreateModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create Delivery Challan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (dnId: string) => {
      await api.delete(`/company/${companyId}/challans/${dnId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans', companyId] });
      toast.success('Delivery Challan deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete Delivery Challan');
    },
  });

  const handleSOChange = (soId: string) => {
    setSelectedSOId(soId);
    const so = (Array.isArray(salesOrders) ? salesOrders : []).find((s: any) => s.id === soId);
    if (so && Array.isArray(so.lines)) {
      setDnItems(so.lines
        .filter((line: any) => {
          const remaining = line.quantity - (line.deliveredQuantity || 0);
          return remaining > 0 && line.productId;
        })
        .map((line: any) => {
          const remaining = line.quantity - (line.deliveredQuantity || 0);
          return {
            productId: line.productId,
            productName: line.product?.name || line.description || 'Unknown',
            quantity: remaining,
            maxQty: remaining,
          };
        }));
    } else {
      setDnItems([]);
    }
  };

  const openCreateModal = () => {
    setSelectedSOId('');
    setShipmentDate(new Date().toISOString().split('T')[0]);
    setDnItems([]);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedSOId('');
    setShipmentDate(new Date().toISOString().split('T')[0]);
    setDnItems([]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSOId) {
      toast.error('Please select a Sales Order');
      return;
    }
    const validItems = dnItems.filter(item => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('At least one item with quantity > 0 is required');
      return;
    }
    const body: any = { items: validItems.map(i => ({ productId: i.productId, quantity: i.quantity })) };
    if (shipmentDate) body.shipmentDate = new Date(shipmentDate).toISOString();
    createMutation.mutate({ soId: selectedSOId, data: body });
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedChallans);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChallans(newExpanded);
  };

  const filteredChallans = (Array.isArray(challans) ? challans : [])?.filter((dc: any) => {
    return !searchTerm || 
      dc.dnNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dc.salesOrder?.soNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dc.salesOrder?.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header Area */}
      <div className="flex justify-between items-end bg-white p-6 rounded-sm border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            <Truck className="w-6 h-6 text-emerald-600" />
            Delivery Challans
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipment Tracking & Logistics Proof</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Challan
          </button>
        )}
      </div>

      {/* Filters Area */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Challan #, Order or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-xs focus:border-gray-900 outline-none transition-colors bg-white shadow-sm"
          />
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <th className="w-12 px-6 py-4"></th>
              <th className="px-6 py-4">Challan Details</th>
              <th className="px-6 py-4">Recipient</th>
              <th className="px-6 py-4">Order Link</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-mono">LOADING SHIPMENTS...</td></tr>
            ) : filteredChallans.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No active shipments</td></tr>
            ) : (
              filteredChallans.map((dc: any) => (
                <React.Fragment key={dc.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors group",
                    expandedChallans.has(dc.id) && "bg-gray-50/80"
                  )}>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleExpand(dc.id)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                        {expandedChallans.has(dc.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-gray-900">{dc.dnNumber}</span>
                        <span className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">Shipped: {new Date(dc.shipmentDate).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-700 uppercase tracking-tight">{dc.salesOrder?.customer?.name || '---'}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-gray-500">{dc.salesOrder?.soNumber}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm border",
                        dc.status === 'SHIPPED' ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-400 border-gray-100"
                      )}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          onClick={() => router.push(`/company/${companyId}/sales/challans/${dc.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          onClick={() => window.print()}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            className="p-2 text-gray-300 hover:text-red-600 rounded-sm transition-colors"
                            onClick={() => {
                              if (window.confirm(`Delete Delivery Challan ${dc.dnNumber}? This will revert inventory and quantities.`)) {
                                deleteMutation.mutate(dc.id);
                              }
                            }}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedChallans.has(dc.id) && (
                    <tr className="bg-white">
                      <td colSpan={6} className="px-16 py-8 border-b border-gray-100 shadow-inner">
                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 max-w-5xl space-y-6">
                          <div className="flex justify-between items-start">
                            <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400" />
                              Manifest Details
                            </h4>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Order Valuation</p>
                              <p className="text-sm font-black text-gray-900 font-mono tracking-tighter">
                                {dc.salesOrder?.currency} {formatCurrency(dc.salesOrder?.totalAmount || 0)}
                              </p>
                              {dc.salesOrder?.currency !== 'BDT' && (
                                <p className="text-[9px] font-bold text-gray-400 font-mono italic">
                                  ৳ {formatCurrency((dc.salesOrder?.totalAmount || 0) * (dc.salesOrder?.exchangeRate || companyExchangeRate))}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="border border-gray-200 rounded-sm overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-left">
                              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                                <tr>
                                  <th className="px-6 py-3">Product Description</th>
                                  <th className="px-6 py-3 text-right">Shipped Quantity</th>
                                  <th className="px-6 py-3 text-right">Unit Value ({dc.salesOrder?.currency})</th>
                                  <th className="px-6 py-3 text-right">Ext. Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {(Array.isArray(dc.lines) ? dc.lines : []).map((line: any) => (
                                  <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-3">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-gray-900">{line.product?.name || 'Unknown Item'}</span>
                                        <span className="text-[9px] text-gray-400 uppercase tracking-widest">{line.product?.code}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-black text-gray-900">{line.quantity}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-gray-500">{formatCurrency(line.unitPrice || 0)}</td>
                                    <td className="px-6 py-3 text-right font-mono font-black text-gray-900">
                                      {formatCurrency((line.quantity || 0) * (line.unitPrice || 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                             <div className="flex items-center gap-4">
                                <Link 
                                  href={`/company/${companyId}/sales/orders`} 
                                  className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:underline"
                                >
                                   <ArrowUpRight className="w-3.5 h-3.5" /> View Sales Order
                                </Link>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Logistics Verified</p>
                             </div>
                             <p className="text-[9px] text-gray-400 italic font-mono uppercase tracking-widest">Digital Stamp: {dc.id.slice(0,8)}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">New Delivery Challan</h3>
              </div>
              <button type="button" onClick={closeCreateModal} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Sales Order *</label>
                  <select
                    value={selectedSOId}
                    onChange={(e) => handleSOChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-bold uppercase tracking-tight bg-white shadow-sm"
                    required
                  >
                    <option value="">SELECT SALES ORDER</option>
                    {availableSOs.map((so: any) => (
                      <option key={so.id} value={so.id}>
                        {so.soNumber} — {so.customer?.name || 'N/A'} ({so.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Shipment Date</label>
                  <input
                    type="date"
                    value={shipmentDate}
                    onChange={(e) => setShipmentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-900 text-[11px] font-mono bg-white shadow-sm"
                  />
                </div>

                {selectedSOId && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-gray-400" />
                        Items to Ship
                      </h4>
                      <span className="text-[9px] text-gray-400 font-mono">Remaining qty shown</span>
                    </div>
                    {dnItems.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic py-4 text-center">All items in this order have been fully delivered.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-sm overflow-hidden shadow-sm">
                        <table className="w-full text-[11px]">
                          <thead className="bg-gray-50 border-b border-gray-200 text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                            <tr>
                              <th className="px-4 py-3 text-left">Product</th>
                              <th className="px-4 py-3 text-center w-24">Max Qty</th>
                              <th className="px-4 py-3 text-center w-24">Ship Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {dnItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 font-bold text-gray-900 text-[11px]">{item.productName}</td>
                                <td className="px-4 py-3 text-center font-mono text-gray-500 text-[11px]">{item.maxQty}</td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.maxQty}
                                    step="any"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const newItems = [...dnItems];
                                      newItems[idx] = { ...newItems[idx], quantity: Math.max(0, Math.min(val, item.maxQty)) };
                                      setDnItems(newItems);
                                    }}
                                    className="w-20 text-center border border-gray-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:outline-none focus:border-gray-900 bg-white shadow-sm"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || !selectedSOId || dnItems.length === 0}
                    className="px-8 py-3 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-all flex items-center gap-2 shadow-sm"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Generate Challan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
