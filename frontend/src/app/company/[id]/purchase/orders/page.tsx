'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, ChevronDown, ChevronRight, 
  Tag, Link as LinkIcon, Trash2, Edit2, 
  X, ShoppingBag, TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import React from 'react';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  totalBDT: number;
  currency: string;
  status: string;
  supplier?: { name: string };
  salesOrders: any[];
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showSOSelector, setShowSOSelector] = useState<{ poId: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data as PurchaseOrder[];
    },
    enabled: !!companyId,
  });

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const assignSOMutation = useMutation({
    mutationFn: async ({ poId, soId, action }: { poId: string; soId: string; action: 'connect' | 'disconnect' }) => {
      const response = await api.post(`/company/${companyId}/purchase-orders/${poId}/assign-so`, { soId, action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] });
      toast.success('Sales Order updated');
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

  const calculateUsedValue = (po: PurchaseOrder) => {
    return po.salesOrders.reduce((sum, so) => sum + (so.totalBDT || 0), 0);
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-gray-600" />
            Purchase Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">Supply chain and inventory procurement</p>
        </div>
        <button 
          onClick={() => router.push(`/company/${companyId}/purchase/orders/create`)}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Purchase Order
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-gray-900 transition-colors bg-white"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="w-10 py-3 px-4"></th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Order Number</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Supplier</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Total (BDT)</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Allocated</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading orders...</td></tr>
            ) : purchaseOrders?.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
            ) : (
              purchaseOrders?.filter(po => 
                po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                po.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((po) => (
                <React.Fragment key={po.id}>
                  <tr className={cn(
                    "hover:bg-gray-50 transition-colors",
                    expandedOrders.has(po.id) && "bg-gray-50"
                  )}>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleExpand(po.id)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                        {expandedOrders.has(po.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{po.poNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(po.poDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-600">{po.supplier?.name}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                      {formatCurrency(po.totalBDT)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-500">
                      {formatCurrency(calculateUsedValue(po))}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                        po.status === 'RECEIVED' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600 border-gray-200"
                      )}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setShowSOSelector({ poId: po.id })}
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors"
                          title="Link SO"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => router.push(`/company/${companyId}/purchase/orders/${po.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedOrders.has(po.id) && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={8} className="p-0">
                        <div className="px-12 py-4 border-l-2 border-gray-900 bg-white ml-4 my-2">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Linked Sales Orders</h4>
                            <button 
                              onClick={() => router.push(`/company/${companyId}/sales/orders/create?poId=${po.id}`)}
                              className="text-[10px] font-bold text-gray-900 hover:underline flex items-center gap-1 uppercase"
                            >
                              <Plus className="w-3 h-3" /> Create New SO
                            </button>
                          </div>
                          
                          {po.salesOrders.length === 0 ? (
                            <div className="text-[11px] text-gray-400 italic py-3 border border-dashed border-gray-200 text-center rounded-sm">
                              No sales orders linked to this purchase order.
                            </div>
                          ) : (
                            <div className="border border-gray-200 rounded-sm">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr className="text-[10px] text-gray-500 uppercase font-bold">
                                    <th className="px-4 py-2 text-left">SO #</th>
                                    <th className="px-4 py-2 text-left">Customer</th>
                                    <th className="px-4 py-2 text-right">Value</th>
                                    <th className="px-4 py-2 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {po.salesOrders.map((so: any) => (
                                    <tr key={so.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 font-medium text-gray-900">{so.soNumber}</td>
                                      <td className="px-4 py-2 text-gray-600">{so.customer?.name}</td>
                                      <td className="px-4 py-2 text-right font-mono text-gray-900">
                                        {formatCurrency(so.totalBDT)} {so.currency}
                                      </td>
                                      <td className="px-4 py-2 text-center">
                                        <button 
                                          onClick={() => assignSOMutation.mutate({ poId: po.id, soId: so.id, action: 'disconnect' })}
                                          className="text-[10px] font-bold text-red-500 hover:underline uppercase"
                                        >
                                          Unlink
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

      {/* SO Selector Modal */}
      {showSOSelector && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-600" />
                Assign Sales Order
              </h3>
              <button onClick={() => setShowSOSelector(null)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-sm">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                    <tr className="text-[10px] text-gray-500 uppercase font-bold">
                      <th className="p-3 text-left">SO #</th>
                      <th className="p-3 text-right">Value</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesOrders?.filter((so: any) => !purchaseOrders?.find(p => p.id === showSOSelector.poId)?.salesOrders.find(s => s.id === so.id)).map((so: any) => (
                      <tr key={so.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-medium text-gray-900">{so.soNumber}</td>
                        <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(so.totalBDT)} {so.currency}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => {
                              assignSOMutation.mutate({ poId: showSOSelector.poId, soId: so.id, action: 'connect' });
                              setShowSOSelector(null);
                            }}
                            className="text-[10px] font-bold text-gray-900 hover:underline uppercase"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setShowSOSelector(null)} 
                className="px-4 py-2 border border-gray-300 rounded-sm text-sm font-medium hover:bg-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
);  );
}

