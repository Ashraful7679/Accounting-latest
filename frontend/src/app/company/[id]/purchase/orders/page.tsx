'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, X, ShoppingBag, Truck, FileText, Printer, Eye,
  ChevronDown, ChevronRight, Link as LinkIcon, Trash2, Tag, Edit2
} from 'lucide-react';
import { PartialFulfillmentModal } from '@/components/PartialFulfillmentModal';
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
  exchangeRate: number;
  status: string;
  supplier?: { id: string; name: string; code: string };
  lines: any[];
  salesOrders: any[];
  grns: any[];
  invoices: any[];
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
  const [showFulfillmentModal, setShowFulfillmentModal] = useState<{ order: any, type: 'DN' | 'GRN' } | null>(null);

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
      return response.data.data?.data || response.data.data;
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

  const generateGRNMutation = useMutation({
    mutationFn: async ({ poId, items }: { poId: string, items: any[] }) => {
      const response = await api.post(`/company/${companyId}/purchase-orders/${poId}/grn`, { items });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] });
      toast.success('Goods Receipt Note created');
      setShowFulfillmentModal(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create GRN';
      toast.error(msg);
    },
  });

  const generateInvoice = (poId?: string, grnId?: string, vendorId?: string) => {
    let url = `/company/${companyId}/purchase/invoices/create?`;
    if (poId) url += `poId=${poId}&`;
    if (grnId) url += `grnIds=${grnId}&`;
    if (vendorId) url += `vendorId=${vendorId}&`;
    router.push(url);
  };

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
    return (Array.isArray(po.salesOrders) ? po.salesOrders : []).reduce((sum, so) => sum + (so.totalBDT || 0), 0);
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header section */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-gray-400" />
            Purchase Orders
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Procurement and Inventory Control</p>
        </div>
        <button 
          onClick={() => router.push(`/company/${companyId}/purchase/orders/create`)}
          className="bg-gray-900 text-white px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Create PO
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
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 py-3 px-4"></th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Order Number</th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Date</th>
              <th className="py-3 px-4 text-left font-bold text-gray-400 uppercase tracking-widest">Supplier</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Allocated</th>
              <th className="py-3 px-4 text-center font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="py-3 px-4 text-right font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-mono">LOADING DATA...</td></tr>
            ) : purchaseOrders?.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 font-mono uppercase tracking-widest">No orders found</td></tr>
            ) : (
              (Array.isArray(purchaseOrders) ? purchaseOrders : []).filter(po => 
                (po.poNumber?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
                (po.supplier?.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
              ).map((po) => (
                <React.Fragment key={po.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors group",
                    expandedOrders.has(po.id) && "bg-gray-50"
                  )}>
                    <td className="py-4 px-4">
                      <button onClick={() => toggleExpand(po.id)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                        {expandedOrders.has(po.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-gray-900 uppercase">{po.poNumber}</td>
                    <td className="py-4 px-4 font-mono text-gray-600">{new Date(po.poDate).toLocaleDateString()}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-700 uppercase tracking-tight">{po.supplier?.name}</div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{po.supplier?.code}</div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-mono font-bold text-gray-900">{po.currency} {formatCurrency(po.totalBDT / (po.exchangeRate || 1))}</div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">৳{formatCurrency(po.totalBDT)}</div>
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-gray-500">
                      {formatCurrency(calculateUsedValue(po))}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-sm border",
                        po.status === 'RECEIVED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-50 text-gray-600 border-gray-100"
                      )}>
                        {po.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right opacity-40 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => setShowFulfillmentModal({ order: po, type: 'GRN' })}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-sm transition-colors"
                          title="Receive Items (GRN)"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => generateInvoice(po.id, undefined, po.supplier?.id)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded-sm transition-colors"
                          title="Generate Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setShowSOSelector({ poId: po.id })}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          title="Link SO"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => router.push(`/company/${companyId}/purchase/orders/${po.id}`)}
                          className="p-1.5 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedOrders.has(po.id) && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={8} className="p-0">
                        <div className="mx-16 my-4 p-6 bg-white border border-gray-200 rounded-sm shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gray-900" />
                          {/* Order Items */}
                          <div className="space-y-4 mb-8">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Tag className="w-4 h-4" /> Ordered Inventory
                            </h4>
                            <table className="w-full text-left text-[11px]">
                              <thead className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <tr>
                                  <th className="py-2">Item Description</th>
                                  <th className="py-2 text-center">Ordered</th>
                                  <th className="py-2 text-center">Received</th>
                                  <th className="py-2 text-center">Billed</th>
                                  <th className="py-2 text-right">Unit Price</th>
                                  <th className="py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {(Array.isArray(po.lines) ? po.lines : [])?.map((line: any) => (
                                  <tr key={line.id} className="text-[11px] font-bold text-gray-600">
                                    <td className="py-3 uppercase tracking-tighter">{line.itemDescription || line.description}</td>
                                    <td className="py-3 text-center font-mono">{line.quantity}</td>
                                    <td className="py-3 text-center font-mono text-indigo-600">{line.receivedQuantity || 0}</td>
                                    <td className="py-3 text-center font-mono text-green-600">{line.billedQuantity || 0}</td>
                                    <td className="py-3 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                                    <td className="py-3 text-right font-mono text-gray-900">{formatCurrency(line.quantity * line.unitPrice)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Related Documents */}
                          <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            {/* GRNs */}
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Truck className="w-4 h-4" /> Goods Receipt Notes (GRN)
                              </h4>
                              <div className="space-y-2">
                                {(Array.isArray(po.grns) ? po.grns : [])?.map((grn: any) => (
                                  <div key={grn.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center group/doc">
                                    <div>
                                      <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{grn.grnNumber}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(grn.receiptDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => router.push(`/company/${companyId}/purchase/grns/${grn.id}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={() => generateInvoice(po.id, grn.id, po.supplier?.id)}
                                        className="px-2 py-1 bg-white border border-gray-200 text-[8px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all rounded-xs"
                                        title="Bill this GRN"
                                      >
                                        Invoice
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {(!Array.isArray(po.grns) || po.grns.length === 0) && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No receipts yet</p>}
                              </div>
                            </div>

                            {/* Invoices */}
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Purchase Invoices (PI)
                              </h4>
                              <div className="space-y-2">
                                {(Array.isArray(po.invoices) ? po.invoices : [])?.map((inv: any) => (
                                  <div key={inv.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center">
                                    <div>
                                      <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{inv.invoiceNumber}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "px-2 py-0.5 text-[8px] font-black uppercase rounded-xs border",
                                        inv.status === 'APPROVED' ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 text-gray-400 border-gray-100"
                                      )}>
                                        {inv.status}
                                      </span>
                                      <button onClick={() => router.push(`/company/${companyId}/purchase/invoices/${inv.id}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {(!Array.isArray(po.invoices) || po.invoices.length === 0) && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No invoices generated</p>}
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-gray-100 flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Linked Sales Orders</h4>
                            <button 
                              onClick={() => router.push(`/company/${companyId}/sales/orders/create?poId=${po.id}`)}
                              className="text-[9px] font-bold text-gray-900 hover:underline flex items-center gap-1.5 uppercase tracking-widest"
                            >
                              <Plus className="w-3 h-3" /> Create New SO
                            </button>
                          </div>
                          
                          {(!Array.isArray(po.salesOrders) || po.salesOrders.length === 0) ? (
                            <div className="text-[10px] text-gray-400 font-mono uppercase text-center py-8 border border-dashed border-gray-100 rounded-sm">
                              NO ALLOCATIONS FOUND
                            </div>
                          ) : (
                            <div className="border border-gray-100 rounded-sm overflow-hidden">
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                  <tr className="text-[9px] text-gray-400 uppercase font-bold tracking-[0.15em]">
                                    <th className="px-4 py-2">SO #</th>
                                    <th className="px-4 py-2">Customer</th>
                                    <th className="px-4 py-2 text-right">Value</th>
                                    <th className="px-4 py-2 text-center w-20">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-mono">
                                  {(Array.isArray(po.salesOrders) ? po.salesOrders : []).map((so: any) => (
                                    <tr key={so.id} className="hover:bg-gray-50/30 transition-colors">
                                      <td className="px-4 py-3 font-bold text-gray-900 uppercase">{so.soNumber}</td>
                                      <td className="px-4 py-3 text-gray-600 uppercase">{so.customer?.name}</td>
                                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                                        {formatCurrency(so.totalBDT)} {so.currency}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <button 
                                          onClick={() => assignSOMutation.mutate({ poId: po.id, soId: so.id, action: 'disconnect' })}
                                          className="text-gray-300 hover:text-red-600 transition-colors"
                                          title="Unlink"
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

      {showSOSelector && (
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
                Assign Sales Order
              </h3>
              <button onClick={() => setShowSOSelector(null)} className="p-1 hover:bg-gray-100 rounded-sm transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto border border-gray-100 rounded-sm">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-100">
                    <tr className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                      <th className="p-4">SO #</th>
                      <th className="p-4 text-right">Value</th>
                      <th className="p-4 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono">
                    {(Array.isArray(salesOrders) ? salesOrders : [])?.filter((so: any) => !(Array.isArray(purchaseOrders) ? purchaseOrders : []).find(p => p.id === showSOSelector.poId)?.salesOrders.find(s => s.id === so.id)).map((so: any) => (
                      <tr key={so.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="p-4 font-bold text-gray-900 uppercase">{so.soNumber}</td>
                        <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(so.totalBDT)} {so.currency}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              assignSOMutation.mutate({ poId: showSOSelector.poId, soId: so.id, action: 'connect' });
                              setShowSOSelector(null);
                            }}
                            className="bg-gray-900 text-white px-3 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {salesOrders?.length === 0 && (
                      <tr><td colSpan={3} className="p-12 text-center text-gray-400 font-mono uppercase tracking-widest">NO AVAILABLE ORDERS</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowSOSelector(null)} 
                className="px-4 py-2 border border-gray-200 rounded-sm text-[9px] font-bold uppercase tracking-widest text-gray-500 hover:bg-white hover:text-gray-900 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Partial Fulfillment Modal */}
      {showFulfillmentModal && (
        <PartialFulfillmentModal
          isOpen={!!showFulfillmentModal}
          onClose={() => setShowFulfillmentModal(null)}
          order={showFulfillmentModal.order}
          type={showFulfillmentModal.type}
          onSubmit={(items) => {
            if (showFulfillmentModal.type === 'GRN') {
              generateGRNMutation.mutate({ poId: showFulfillmentModal.order.id, items });
            }
          }}
        />
      )}
    </div>
  );
}



