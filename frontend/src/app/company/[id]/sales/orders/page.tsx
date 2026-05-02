'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, ChevronDown, ChevronRight, 
  Truck, Tag, Link as LinkIcon, Trash2,
  X, ShoppingBag
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import React from 'react';

interface SalesOrderLine {
  id: string;
  productId?: string;
  product?: { name: string };
  description: string;
  quantity: number;
  unitPrice: number;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  soDate: string;
  totalBDT: number;
  currency: string;
  status: string;
  customer?: { name: string; code: string };
  lines: SalesOrderLine[];
  purchaseOrders: any[];
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showPOSelector, setShowPOSelector] = useState<{ soId: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: salesOrders, isLoading } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders`);
      return response.data.data as SalesOrder[];
    },
    enabled: !!companyId,
  });

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const assignPOMutation = useMutation({
    mutationFn: async ({ soId, poId, action }: { soId: string; poId: string; action: 'connect' | 'disconnect' }) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/assign-po`, { poId, action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Purchase Order updated');
    },
  });

  const generateChallanMutation = useMutation({
    mutationFn: async (soId: string) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/challan`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Challan generated');
      router.push(`/company/${companyId}/sales/challans`);
    },
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedOrders(newExpanded);
  };

  const calculateUsedValue = (so: SalesOrder) => {
    return so.purchaseOrders.reduce((sum, po) => sum + (po.totalBDT || 0), 0);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'SENT':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'DRAFT':
        return 'bg-gray-50 text-gray-600 border-gray-100';
      case 'CANCELLED':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header section */}
      <div className="flex justify-between items-center pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-gray-400" />
            Sales Orders
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage customer contracts and allocations</p>
        </div>
        <button 
          onClick={() => router.push(`/company/${companyId}/sales/orders/create`)}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Create SO
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="SEARCH ORDERS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-gray-900 transition-colors bg-white shadow-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 py-3 px-4"></th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Order Number</th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Date</th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Customer</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Total Value</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Allocated</th>
              <th className="py-3 px-4 text-center font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-mono">LOADING DATA...</td></tr>
            ) : salesOrders?.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No orders found</td></tr>
            ) : (
              salesOrders?.filter(so => 
                (so.soNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (so.customer?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
              ).map((so) => (
                <React.Fragment key={so.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors group",
                    expandedOrders.has(so.id) && "bg-gray-50"
                  )}>
                    <td className="py-4 px-4">
                      <button onClick={() => toggleExpand(so.id)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                        {expandedOrders.has(so.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-gray-900 uppercase">{so.soNumber}</td>
                    <td className="py-4 px-4 font-mono text-gray-600">{new Date(so.soDate).toLocaleDateString()}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-700 uppercase tracking-tight">{so.customer?.name}</div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{so.customer?.code}</div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-gray-900">
                      {formatCurrency(so.totalBDT)} {so.currency}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-gray-500">
                      {formatCurrency(calculateUsedValue(so))} {so.currency}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm border",
                        getStatusStyle(so.status)
                      )}>
                        {so.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right opacity-40 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setShowPOSelector({ soId: so.id })}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          title="Link PO"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('Generate Delivery Challan? This will impact inventory.')) {
                              generateChallanMutation.mutate(so.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          title="Generate Challan"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => router.push(`/company/${companyId}/sales/orders/${so.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          title="Edit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedOrders.has(so.id) && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={8} className="p-0">
                        <div className="mx-16 my-4 p-6 bg-white border border-gray-200 rounded-sm shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gray-900" />
                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Linked Procurement (PO)</h4>
                            <button 
                              onClick={() => router.push(`/company/${companyId}/purchase/orders/create?soId=${so.id}`)}
                              className="text-[9px] font-bold text-gray-900 hover:underline flex items-center gap-1.5 uppercase tracking-widest"
                            >
                              <Plus className="w-3 h-3" /> Create New PO
                            </button>
                          </div>
                          
                          {so.purchaseOrders.length === 0 ? (
                            <div className="text-[10px] text-gray-400 font-mono uppercase text-center py-8 border border-dashed border-gray-100 rounded-sm">
                              NO LINKED PROCUREMENT
                            </div>
                          ) : (
                            <div className="border border-gray-100 rounded-sm overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                  <tr className="text-[9px] text-gray-400 uppercase font-bold tracking-[0.15em]">
                                    <th className="px-4 py-2 text-left">PO #</th>
                                    <th className="px-4 py-2 text-left">Supplier</th>
                                    <th className="px-4 py-2 text-right">Value (BDT)</th>
                                    <th className="px-4 py-2 text-center w-20">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-mono">
                                  {so.purchaseOrders.map((po: any) => (
                                    <tr key={po.id} className="hover:bg-gray-50/30 transition-colors">
                                      <td className="px-4 py-3 font-bold text-gray-900 uppercase">{po.poNumber}</td>
                                      <td className="px-4 py-3 text-gray-600 uppercase">{po.supplier?.name}</td>
                                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                                        {formatCurrency(po.totalBDT)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <button 
                                          onClick={() => assignPOMutation.mutate({ soId: so.id, poId: po.id, action: 'disconnect' })}
                                          className="text-gray-300 hover:text-red-600 transition-colors"
                                          title="Unlink PO"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
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

      {/* PO Selector Modal */}
      {showPOSelector && (
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
                Assign Purchase Order
              </h3>
              <button onClick={() => setShowPOSelector(null)} className="p-1 hover:bg-gray-100 rounded-sm transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto border border-gray-100 rounded-sm">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-100">
                    <tr className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                      <th className="p-4">PO #</th>
                      <th className="p-4 text-right">Value (BDT)</th>
                      <th className="p-4 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono">
                    {purchaseOrders?.filter((po: any) => !salesOrders?.find(s => s.id === showPOSelector.soId)?.purchaseOrders.find(p => p.id === po.id)).map((po: any) => (
                      <tr key={po.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="p-4 font-bold text-gray-900 uppercase">{po.poNumber}</td>
                        <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(po.totalBDT)}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              assignPOMutation.mutate({ soId: showPOSelector.soId, poId: po.id, action: 'connect' });
                              setShowPOSelector(null);
                            }}
                            className="bg-gray-900 text-white px-3 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {purchaseOrders?.length === 0 && (
                      <tr><td colSpan={3} className="p-12 text-center text-gray-400 font-mono uppercase tracking-widest">NO AVAILABLE POs</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowPOSelector(null)} 
                className="px-4 py-2 border border-gray-200 rounded-sm text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:bg-white hover:text-gray-900 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

