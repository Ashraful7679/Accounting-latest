'use client';
// Triggering fresh build after syntax fixes

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Search, ChevronDown, ChevronRight, Truck, Tag, Link as LinkIcon, Trash2, X, ShoppingBag, Eye, FileText, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency, getCurrencySymbol } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import React from 'react';
import { PartialFulfillmentModal } from '@/components/PartialFulfillmentModal';
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

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
  customer?: { id: string; name: string; code: string };
  lines: SalesOrderLine[];
  purchaseOrders: any[];
  dns: any[];
  invoices: any[];
  piSalesOrders: any[];
  exportPIs: any[];
  piLCs: any[];
}

function SalesOrdersPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'local' | 'foreign'>('local');
  const [challanMap, setChallanMap] = useState<Record<string, string>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showPOSelector, setShowPOSelector] = useState<{ soId: string } | null>(null);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState<{ order: any, type: 'DN' | 'GRN' } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

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
    mutationFn: async ({ soId, items }: { soId: string, items: any[] }) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/challan`, { items });
      return response.data;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Delivery Challan created');
      setShowFulfillmentModal(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create delivery challan';
      toast.error(msg);
    },
  });

  const generateInvoice = (soId?: string, dnId?: string, customerId?: string) => {
    let url = `/company/${companyId}/sales/invoices/create?`;
    if (soId) url += `soId=${soId}&`;
    if (dnId) url += `dnIds=${dnId}&`;
    if (customerId) url += `customerId=${customerId}&`;
    router.push(url);
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedOrders(newExpanded);
  };

  // DetailPanel state
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  const handleOrderClick = (order: SalesOrder) => {
    setSelectedOrder(order);
    setShowDetailPanel(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600' },
      SENT: { bg: 'bg-blue-50', text: 'text-blue-600' },
      PARTIAL: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
      COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
      CANCELLED: { bg: 'bg-red-50', text: 'text-red-600' },
    };
    const s = styles[status] || styles.DRAFT;
    return <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase", s.bg, s.text)}>{status}</span>;
  };

  const filteredOrders = salesOrders?.filter(so =>
    (!searchTerm ||
      so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    ((activeTab === 'local' && so.currency === 'BDT') || (activeTab === 'foreign' && so.currency !== 'BDT'))
  ) || [];

  return (
    <>
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
                    "hover:bg-gray-50 group transition-colors cursor-pointer",
                    expandedOrders.has(so.id) && "bg-gray-50"
                  )} onClick={() => handleOrderClick(so)}>
                    <td className="px-6 py-4">
                      <button onClick={(e) => { e.stopPropagation(); toggleExpand(so.id); }} className="p-1 text-gray-400 hover:text-gray-900 transition-colors">
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
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOrderClick(so); }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowFulfillmentModal({ order: so, type: 'DN' }) }}
                          className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                          title="Generate Delivery Note"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => generateInvoice(so.id, undefined, so.customer?.id)}
                          className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                          title="Generate Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
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
                                  <th className="py-2 text-center">Ordered</th>
                                  <th className="py-2 text-center">Delivered</th>
                                  <th className="py-2 text-center">Invoiced</th>
                                  <th className="py-2 text-right">Unit Price</th>
                                  <th className="py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {so.lines.map((line: any) => (
                                  <tr key={line.id} className="text-[11px] font-bold text-gray-600">
                                    <td className="py-3 uppercase tracking-tighter">{line.description}</td>
                                    <td className="py-3 text-center font-mono">{line.quantity}</td>
                                    <td className="py-3 text-center font-mono text-indigo-600">{(line as any).deliveredQuantity || 0}</td>
                                    <td className="py-3 text-center font-mono text-green-600">{(line as any).invoicedQuantity || 0}</td>
                                    <td className="py-3 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                                    <td className="py-3 text-right font-mono text-gray-900">{formatCurrency(line.quantity * line.unitPrice)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Related Documents */}
                          <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Delivery Notes */}
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Truck className="w-4 h-4" /> Delivery Challans (DN)
                              </h4>
                              <div className="space-y-2">
                                {so.dns?.map((dn: any) => (
                                  <div key={dn.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center group/doc">
                                    <div>
                                      <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{dn.dnNumber}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(dn.shipmentDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => router.push(`/company/${companyId}/sales/challans/${dn.id}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={() => generateInvoice(so.id, dn.id, so.customer?.id)}
                                        className="px-2 py-1 bg-white border border-gray-200 text-[8px] font-black uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all rounded-xs"
                                        title="Bill this DN"
                                      >
                                        Invoice
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {(!so.dns || so.dns.length === 0) && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No deliveries yet</p>}
                              </div>
                            </div>

                            {/* Invoices */}
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Sales Invoices (SI)
                              </h4>
                              <div className="space-y-2">
                                {so.invoices?.map((inv: any) => (
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
                                      <button onClick={() => router.push(`/company/${companyId}/sales/invoices/${inv.id}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {(!so.invoices || so.invoices.length === 0) && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No invoices generated</p>}
                              </div>
                            </div>
                          </div>

                          {/* Inventory & Trade Links */}
                          <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                  <LinkIcon className="w-4 h-4" /> Procurement Links (PO)
                                </h4>
                                <button onClick={() => setShowPOSelector({ soId: so.id })} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Link PO</button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {so.purchaseOrders?.map((po: any) => (
                                  <div key={po.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center group/link">
                                    <div>
                                      <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">{po.poNumber}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">{po.supplier?.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => router.push(`/company/${companyId}/purchase/orders?search=${po.poNumber}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => assignPOMutation.mutate({ soId: so.id, poId: po.id, action: 'disconnect' })} className="opacity-0 group-hover/link:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {(!so.purchaseOrders || so.purchaseOrders.length === 0) && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No procurement records linked</p>}
                              </div>
                            </div>

                            {/* Proforma & LC */}
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Tag className="w-4 h-4" /> Proforma & LC Documents
                              </h4>
                              <div className="grid grid-cols-1 gap-2">
                                {so.piSalesOrders?.map((rel: any) => (
                                  <div key={rel.piId} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center">
                                    <div>
                                      <p className="text-[10px] font-black text-indigo-900 uppercase tracking-tighter">PI: {rel.pi?.piNumber}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">Proforma Invoice</p>
                                    </div>
                                    <button onClick={() => router.push(`/company/${companyId}/sales/proforma?search=${rel.pi?.piNumber}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                {so.piLCs?.map((lc: any) => (
                                  <div key={lc.id} className="p-3 bg-gray-50 rounded-sm border border-gray-100 flex justify-between items-center">
                                    <div>
                                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-tighter">LC: {lc.lcNumber}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">Letter of Credit</p>
                                    </div>
                                    <button onClick={() => router.push(`/company/${companyId}/lcs?search=${lc.lcNumber}`)} className="p-1 text-gray-400 hover:text-gray-900 transition-all">
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                {(!so.piSalesOrders?.length && !so.piLCs?.length) && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic py-2">No trade instruments linked</p>}
                              </div>
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
      {/* Partial Fulfillment Modal */}
      {showFulfillmentModal && (
        <PartialFulfillmentModal
          isOpen={!!showFulfillmentModal}
          onClose={() => setShowFulfillmentModal(null)}
          order={showFulfillmentModal.order}
          type={showFulfillmentModal.type}
          onSubmit={(items) => {
            if (showFulfillmentModal.type === 'DN') {
              generateChallanMutation.mutate({ soId: showFulfillmentModal.order.id, items });
            }
          }}
        />
      )}
    </div>
    {showDetailPanel && selectedOrder && (
      <DetailPanel
        isOpen={showDetailPanel}
        onClose={() => { setShowDetailPanel(false); setSelectedOrder(null); }}
        title={selectedOrder!.soNumber}
        subtitle={selectedOrder!.customer?.name}
        fields={[
          { label: 'SO Number', value: selectedOrder!.soNumber },
          { label: 'Customer', value: selectedOrder!.customer?.name || '-' },
          { label: 'Date', value: new Date(selectedOrder!.soDate).toLocaleDateString(), type: 'date' },
          { label: 'Total', value: `${getCurrencySymbol(selectedOrder!.currency)}${formatCurrency(selectedOrder!.totalBDT)}`, type: 'currency' },
          { label: 'Currency', value: selectedOrder!.currency },
          { label: 'Status', value: getStatusBadge(selectedOrder!.status) },
        ]}
        actions={[
          { label: 'View Details', icon: Eye, onClick: () => toggleExpand(selectedOrder!.id), variant: 'secondary' },
          { label: 'Create Invoice', icon: FileText, onClick: () => generateInvoice(selectedOrder!.id, undefined, selectedOrder!.customer?.id), variant: 'primary' },
        ]}
        tabs={[{
          id: 'lines',
          label: `Lines (${selectedOrder!.lines?.length || 0})`,
          content: (
            <div className="p-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-slate-500">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Delivered</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Invoiced</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOrder!.lines?.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">{line.description || line.product?.name}</td>
                      <td className="px-3 py-2 text-right">{line.quantity}</td>
                      <td className="px-3 py-2 text-right">{line.deliveredQuantity || 0}</td>
                      <td className="px-3 py-2 text-right">{line.invoicedQuantity || 0}</td>
                      <td className="px-3 py-2 text-right font-medium">{line.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        }]}
        status={{ value: selectedOrder!.status.toLowerCase() as any, type: selectedOrder!.status.toLowerCase() as any }}
        size="lg"
      />
    )}
    </>
  );
}

export default SalesOrdersPage;
