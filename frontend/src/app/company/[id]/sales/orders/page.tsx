'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
  X, ShoppingBag, Eye, FileText, Printer
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
  totalAmount: number;
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
  const [activeTab, setActiveTab] = useState<'local' | 'foreign'>('local');
  const [challanMap, setChallanMap] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showPOSelector, setShowPOSelector] = useState<{ soId: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
      await api.post(`/company/${companyId}/sales-orders/${soId}/assign-po`, { poId, action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Inventory link updated');
    },
  });

  const generateChallanMutation = useMutation({
    mutationFn: async (soId: string) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/challan`);
      return response.data;
    },
    onSuccess: (result, variables) => {
      const dn = result?.data;
      if (dn?.id) {
        setChallanMap(prev => ({ ...prev, [variables]: dn.id }));
      }
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Delivery Challan created');
    },
    onError: (err: any) => {
      console.error('Challan generation error:', err);
      const msg = err?.response?.data?.message || 'Failed to create delivery challan';
      toast.error(msg);
    },
  });

    const generateInvoiceMutation = useMutation({
    mutationFn: async (soId: string) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/invoice`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Invoice created');
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create invoice';
      toast.error(msg);
    },
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedOrders(newExpanded);
  };

  const filteredOrders = salesOrders?.filter(so =>
    (!searchTerm ||
      so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    ((activeTab === 'local' && so.currency === 'BDT') || (activeTab === 'foreign' && so.currency !== 'BDT'))
  ) || [];

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header Area */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tighter">
            <ShoppingBag className="w-6 h-6 text-gray-400" />
            Sales Orders
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Managed Client Commitments & Fulfillment</p>
        </div>
        <button
          onClick={() => router.push(`/company/${companyId}/sales/orders/create`)}
          className="px-6 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-gray-200"
        >
          <Plus className="w-4 h-4" /> Issue Order
        </button>
      </div>

      {/* Search Area */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm text-gray-400">
          <Search className="absolute left-3 top-3 w-4 h-4" />
          <input
            type="text"
            placeholder="Search Reference or Client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:border-gray-900 outline-none transition-colors bg-white shadow-sm"
          />
        </div>
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

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">
              <th className="w-12 px-6 py-4"></th>
              <th className="px-6 py-4">Instrument #</th>
              <th className="px-6 py-4">Customer Entity</th>
              <th className="px-6 py-4 text-right">Value (USD/BDT)</th>
              <th className="px-6 py-4 text-center">Lifecycle</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] animate-pulse">Syncing orders...</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">No records found</td></tr>
            ) : (
              filteredOrders.map((so) => (
                <React.Fragment key={so.id}>
                  <tr className={cn(
                    "hover:bg-gray-50 group transition-colors",
                    expandedOrders.has(so.id) && "bg-gray-50"
                  )}>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleExpand(so.id)} className="p-1 text-gray-400 hover:text-gray-900 transition-colors">
                        {expandedOrders.has(so.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-gray-900 text-xs">
                      {so.soNumber}
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{new Date(so.soDate).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-black text-gray-600 uppercase tracking-tight">{so.customer?.name || '---'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col font-mono text-xs">
                        <span className="font-bold text-gray-900">{so.currency} {formatCurrency(so.totalAmount)}</span>
                        <span className="text-[10px] text-gray-400 font-bold">৳ {formatCurrency(so.totalBDT)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm border",
                        so.status === 'SHIPPED' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                        so.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-gray-50 text-gray-400 border-gray-100"
                      )}>
                        {so.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
  {challanMap[so.id] ? (
    <button
      onClick={() => router.push(`/company/${companyId}/sales/challans/${challanMap[so.id]}`)}
      className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
    >
      <Eye className="w-4 h-4" />
    </button>
  ) : (
    <button
      onClick={() => generateChallanMutation.mutate(so.id)}
      className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
    >
      <Truck className="w-4 h-4" />
    </button>
  )}
  <button
    onClick={() => window.print()}
    className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
  >
    <Printer className="w-4 h-4" />
  </button>
  <button
    onClick={() => generateInvoiceMutation.mutate(so.id)}
    className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
  >
    <FileText className="w-4 h-4" />
  </button>
</div>
                    </td>
                  </tr>
                  {expandedOrders.has(so.id) && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={6} className="px-12 py-8 border-l-4 border-gray-900">
                        <div className="bg-white rounded-sm border border-gray-200 shadow-sm p-6 space-y-8 animate-in slide-in-from-top-2 duration-200">
                          {/* Order Items */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Tag className="w-4 h-4" /> Ordered Inventory
                            </h4>
                            <table className="w-full text-left">
                              <thead className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <tr>
                                  <th className="py-2">Item Description</th>
                                  <th className="py-2 text-center">Qty</th>
                                  <th className="py-2 text-right">Unit Price</th>
                                  <th className="py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {so.lines.map((line) => (
                                  <tr key={line.id} className="text-[11px] font-bold text-gray-600">
                                    <td className="py-3 uppercase tracking-tighter">{line.description}</td>
                                    <td className="py-3 text-center font-mono">{line.quantity}</td>
                                    <td className="py-3 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                                    <td className="py-3 text-right font-mono text-gray-900">{formatCurrency(line.quantity * line.unitPrice)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Inventory Links */}
                          <div className="pt-6 border-t border-gray-100 space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" /> Inventory Procurement Links
                              </h4>
                              <button onClick={() => setShowPOSelector({ soId: so.id })} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Link PO</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {so.purchaseOrders.map((po: any) => (
                                <div key={po.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center group/link">
                                  <div>
                                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{po.poNumber}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">{po.supplier?.name}</p>
                                  </div>
                                  <button onClick={() => assignPOMutation.mutate({ soId: so.id, poId: po.id, action: 'disconnect' })} className="opacity-0 group-hover/link:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {so.purchaseOrders.length === 0 && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No procurement records linked</p>}
                            </div>
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

      {/* PO Link Modal */}
      {showPOSelector && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg border border-gray-200 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
             <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
               <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Link Procurement Record</h3>
               <button onClick={() => setShowPOSelector(null)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400"><X className="w-4 h-4" /></button>
             </div>
             <div className="p-6 overflow-y-auto max-h-[60vh] space-y-2">
                {purchaseOrders?.filter((po: any) => !salesOrders?.find(s => s.id === showPOSelector.soId)?.purchaseOrders.find((p: any) => p.id === po.id)).map((po: any) => (
                  <div key={po.id} className="p-4 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center hover:border-gray-900 transition-colors cursor-pointer group" onClick={() => { assignPOMutation.mutate({ soId: showPOSelector.soId, poId: po.id, action: 'connect' }); setShowPOSelector(null); }}>
                    <div>
                      <p className="text-[11px] font-black text-gray-900 uppercase">{po.poNumber}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{po.supplier?.name}</p>
                    </div>
                    <button className="px-4 py-1.5 bg-white border border-gray-200 text-[9px] font-black uppercase tracking-widest group-hover:bg-gray-900 group-hover:text-white transition-all">Link</button>
                  </div>
                ))}
             </div>
             <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button onClick={() => setShowPOSelector(null)} className="px-6 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
