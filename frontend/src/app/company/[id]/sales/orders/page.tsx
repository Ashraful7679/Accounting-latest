'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, ChevronDown, ChevronRight, 
  Truck, Tag, Link as LinkIcon, Trash2,
  X, FileText, ShoppingBag
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
  orderDate: string;
  totalAmount: number;
  currency: string;
  status: string;
  customer?: { name: string };
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

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-white min-h-screen">
      <div className="flex justify-between items-end border-b border-gray-900 pb-4">
        <div>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Sales Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Contract and supply chain management</p>
        </div>
        <button 
          onClick={() => router.push(`/company/${companyId}/sales/orders/create`)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Sales Order
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
            className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>
      </div>

      <div className="border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-12 py-3 px-4"></th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Order Number</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Value</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Allocated</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading orders...</td></tr>
            ) : salesOrders?.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders found</td></tr>
            ) : (
              salesOrders?.filter(so => 
                so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                so.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((so) => (
                <React.Fragment key={so.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors",
                    expandedOrders.has(so.id) && "bg-gray-50"
                  )}>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleExpand(so.id)} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                        {expandedOrders.has(so.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{so.soNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(so.orderDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-600">{so.customer?.name}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                      {formatCurrency(so.totalAmount)} {so.currency}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-500">
                      {formatCurrency(calculateUsedValue(so))} {so.currency}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                        so.status === 'APPROVED' ? "bg-white text-gray-900 border-gray-900" : "bg-white text-gray-400 border-gray-200"
                      )}>
                        {so.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setShowPOSelector({ soId: so.id })}
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="Link PO"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm('Generate Delivery Challan? This will impact inventory.')) {
                              generateChallanMutation.mutate(so.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title="Generate Challan"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedOrders.has(so.id) && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={8} className="p-0 border-b border-gray-100">
                        <div className="px-16 py-6 border-l-2 border-gray-900 bg-white">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Connected Purchase Orders</h4>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => router.push(`/company/${companyId}/purchase/orders/create?soId=${so.id}`)}
                                className="text-[10px] font-bold text-gray-900 hover:underline flex items-center gap-1.5 uppercase"
                              >
                                <Plus className="w-3 h-3" /> Create New PO
                              </button>
                            </div>
                          </div>
                          
                          {so.purchaseOrders.length === 0 ? (
                            <div className="text-[11px] text-gray-400 italic py-4 border border-dashed border-gray-200 text-center rounded">
                              No purchase orders linked to this sales contract.
                            </div>
                          ) : (
                            <table className="w-full text-xs border border-gray-200">
                              <thead>
                                <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                                  <th className="px-4 py-2 border-b border-gray-200 text-left">PO #</th>
                                  <th className="px-4 py-2 border-b border-gray-200 text-left">Supplier</th>
                                  <th className="px-4 py-2 border-b border-gray-200 text-right">Value (BDT)</th>
                                  <th className="px-4 py-2 border-b border-gray-200 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {so.purchaseOrders.map((po: any) => (
                                  <tr key={po.id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-2 font-medium text-gray-900">{po.poNumber}</td>
                                    <td className="px-4 py-2 text-gray-600">{po.supplier?.name}</td>
                                    <td className="px-4 py-2 text-right font-mono text-gray-900">
                                      {formatCurrency(po.totalBDT)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <button 
                                        onClick={() => assignPOMutation.mutate({ soId: so.id, poId: po.id, action: 'disconnect' })}
                                        className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-tighter"
                                      >
                                        Unlink
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-900 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Assign Purchase Order
              </h3>
              <button onClick={() => setShowPOSelector(null)} className="p-1 hover:bg-gray-200 rounded transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto border border-gray-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                      <th className="p-3 border-b text-left">PO #</th>
                      <th className="p-3 border-b text-right">Value (BDT)</th>
                      <th className="p-3 border-b text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchaseOrders?.filter((po: any) => !salesOrders?.find(s => s.id === showPOSelector.soId)?.purchaseOrders.find(p => p.id === po.id)).map((po: any) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{po.poNumber}</td>
                        <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(po.totalBDT)}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => {
                              assignPOMutation.mutate({ soId: showPOSelector.soId, poId: po.id, action: 'connect' });
                              setShowPOSelector(null);
                            }}
                            className="text-[10px] font-bold text-gray-900 hover:underline uppercase"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {purchaseOrders?.length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic text-xs">No available purchase orders</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setShowPOSelector(null)} 
                className="px-4 py-2 border border-gray-200 text-sm font-medium hover:bg-white transition-colors"
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

