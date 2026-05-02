'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Search, ChevronDown, ChevronRight, 
  ShoppingBag, TrendingUp, Eye, Trash2,
  Link as LinkIcon, X, Briefcase
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';
import React from 'react';

export default function LCPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [expandedLCs, setExpandedLCs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showSOSelector, setShowSOSelector] = useState<{ lcId: string } | null>(null);
  const [showPOSelector, setShowPOSelector] = useState<{ lcId: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: lcs, isLoading } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
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

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const assignSOMutation = useMutation({
    mutationFn: async ({ lcId, soId, action }: { lcId: string; soId: string; action: 'connect' | 'disconnect' }) => {
      const response = await api.post(`/company/${companyId}/lcs/${lcId}/assign-so`, { soId, action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lcs', companyId] });
      toast.success('Sales Order updated');
    },
  });

  const assignPOMutation = useMutation({
    mutationFn: async ({ lcId, poId, action }: { lcId: string; poId: string; action: 'connect' | 'disconnect' }) => {
      const response = await api.post(`/company/${companyId}/lcs/${lcId}/assign-po`, { poId, action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lcs', companyId] });
      toast.success('Purchase Order updated');
    },
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLCs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLCs(newExpanded);
  };

  const filteredLCs = lcs?.filter((lc: any) => {
    const matchesSearch = !searchTerm || 
      lc.lcNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lc.bankName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || lc.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  const calculateUsedValue = (lc: any) => {
    if (lc.type === 'IMPORT') {
      return lc.purchaseOrders?.reduce((sum: number, po: any) => sum + (po.totalBDT || 0), 0) || 0;
    } else {
      return lc.salesOrders?.reduce((sum: number, so: any) => sum + (so.totalAmount || 0), 0) || 0;
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-white min-h-screen">
      <div className="flex justify-between items-end border-b border-gray-900 pb-4">
        <div>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Letters of Credit</h1>
          <p className="text-sm text-gray-500 mt-1">Trade finance and banking instruments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/company/${companyId}/lc/create/import`)}
            className="px-4 py-2 border border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Import LC
          </button>
          <button
            onClick={() => router.push(`/company/${companyId}/lc/create/export`)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Export LC
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search LC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-900 transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-gray-900 bg-white"
        >
          <option value="all">All Status</option>
          <option value="OPEN">Open</option>
          <option value="SETTLED">Settled</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-12 py-3 px-4"></th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">LC Number</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Bank</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Type</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Limit</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Used Value</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Expiry</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading instruments...</td></tr>
            ) : filteredLCs.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">No LC records found</td></tr>
            ) : (
              filteredLCs.map((lc: any) => (
                <React.Fragment key={lc.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors",
                    expandedLCs.has(lc.id) && "bg-gray-50"
                  )}>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => toggleExpand(lc.id)} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                        {expandedLCs.has(lc.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{lc.lcNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{lc.bankName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-black rounded border tracking-tighter uppercase",
                        lc.type === 'IMPORT' ? "bg-white text-gray-900 border-gray-900" : "bg-white text-gray-400 border-gray-200"
                      )}>
                        {lc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-gray-900">
                      {lc.currency} {formatCurrency(lc.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-500">
                      {lc.currency} {formatCurrency(calculateUsedValue(lc))}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{new Date(lc.expiryDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                        lc.status === 'OPEN' ? "bg-white text-gray-900 border-gray-900" : "bg-white text-gray-400 border-gray-200"
                      )}>
                        {lc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button 
                        onClick={() => router.push(`/company/${companyId}/finance/lc/${lc.id}`)} 
                        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedLCs.has(lc.id) && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={9} className="p-0 border-b border-gray-100">
                        <div className="px-16 py-8 border-l-2 border-gray-900 bg-white space-y-8">
                          {/* Linked Purchase Orders */}
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShoppingBag className="w-3 h-3" /> Linked Purchase Orders
                              </h4>
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => router.push(`/company/${companyId}/purchase/orders/create?lcId=${lc.id}`)}
                                  className="text-[10px] font-bold text-gray-900 hover:underline flex items-center gap-1.5 uppercase"
                                >
                                  <Plus className="w-3 h-3" /> New PO
                                </button>
                                <button 
                                  onClick={() => setShowPOSelector({ lcId: lc.id })}
                                  className="text-[10px] font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 uppercase transition-colors"
                                >
                                  <LinkIcon className="w-3 h-3" /> Assign Existing
                                </button>
                              </div>
                            </div>
                            {lc.purchaseOrders?.length === 0 ? (
                              <div className="text-[11px] text-gray-400 italic py-4 border border-dashed border-gray-200 text-center rounded">
                                No purchase orders linked to this credit line.
                              </div>
                            ) : (
                              <table className="w-full text-xs border border-gray-200">
                                <thead>
                                  <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                                    <th className="px-4 py-2 border-b border-gray-200 text-left">PO #</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-left">Supplier</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-right">Value (BDT)</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-center">Status</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {lc.purchaseOrders.map((po: any) => (
                                    <tr key={po.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 font-medium text-gray-900">{po.poNumber}</td>
                                      <td className="px-4 py-2 text-gray-600">{po.supplier?.name}</td>
                                      <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCurrency(po.totalBDT)}</td>
                                      <td className="px-4 py-2 text-center uppercase text-[9px] font-bold text-gray-500">{po.status}</td>
                                      <td className="px-4 py-2 text-center">
                                        <button 
                                          onClick={() => assignPOMutation.mutate({ lcId: lc.id, poId: po.id, action: 'disconnect' })}
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

                          {/* Linked Sales Orders */}
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" /> Linked Sales Orders
                              </h4>
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => router.push(`/company/${companyId}/sales/orders/create?lcId=${lc.id}`)}
                                  className="text-[10px] font-bold text-gray-900 hover:underline flex items-center gap-1.5 uppercase"
                                >
                                  <Plus className="w-3 h-3" /> New SO
                                </button>
                                <button 
                                  onClick={() => setShowSOSelector({ lcId: lc.id })}
                                  className="text-[10px] font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 uppercase transition-colors"
                                >
                                  <LinkIcon className="w-3 h-3" /> Assign Existing
                                </button>
                              </div>
                            </div>
                            {lc.salesOrders?.length === 0 ? (
                              <div className="text-[11px] text-gray-400 italic py-4 border border-dashed border-gray-200 text-center rounded">
                                No sales orders linked to this credit line.
                              </div>
                            ) : (
                              <table className="w-full text-xs border border-gray-200">
                                <thead>
                                  <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                                    <th className="px-4 py-2 border-b border-gray-200 text-left">SO #</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-left">Customer</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-right">Value</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-center">Status</th>
                                    <th className="px-4 py-2 border-b border-gray-200 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {lc.salesOrders.map((so: any) => (
                                    <tr key={so.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 font-medium text-gray-900">{so.soNumber}</td>
                                      <td className="px-4 py-2 text-gray-600">{so.customer?.name}</td>
                                      <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCurrency(so.totalAmount)} {so.currency}</td>
                                      <td className="px-4 py-2 text-center uppercase text-[9px] font-bold text-gray-500">{so.status}</td>
                                      <td className="px-4 py-2 text-center">
                                        <button 
                                          onClick={() => assignSOMutation.mutate({ lcId: lc.id, soId: so.id, action: 'disconnect' })}
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
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-900 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Assign Sales Order
              </h3>
              <button onClick={() => setShowSOSelector(null)} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto border border-gray-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                      <th className="p-3 border-b text-left">SO #</th>
                      <th className="p-3 border-b text-right">Value</th>
                      <th className="p-3 border-b text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesOrders?.filter((so: any) => !lcs?.find(l => l.id === showSOSelector.lcId)?.salesOrders.find(s => s.id === so.id)).map((so: any) => (
                      <tr key={so.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{so.soNumber}</td>
                        <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(so.totalAmount)} {so.currency}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => {
                              assignSOMutation.mutate({ lcId: showSOSelector.lcId, soId: so.id, action: 'connect' });
                              setShowSOSelector(null);
                            }}
                            className="text-[10px] font-bold text-gray-900 hover:underline uppercase"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!salesOrders || salesOrders.length === 0) && (
                      <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic text-xs">No available sales orders</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setShowSOSelector(null)} 
                className="px-4 py-2 border border-gray-200 text-sm font-medium hover:bg-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO Selector Modal */}
      {showPOSelector && (
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-900 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Assign Purchase Order
              </h3>
              <button onClick={() => setShowPOSelector(null)} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                <X className="w-4 h-4" />
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
                    {purchaseOrders?.filter((po: any) => !lcs?.find(l => l.id === showPOSelector.lcId)?.purchaseOrders.find(p => p.id === po.id)).map((po: any) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{po.poNumber}</td>
                        <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(po.totalBDT)}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => {
                              assignPOMutation.mutate({ lcId: showPOSelector.lcId, poId: po.id, action: 'connect' });
                              setShowPOSelector(null);
                            }}
                            className="text-[10px] font-bold text-gray-900 hover:underline uppercase"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!purchaseOrders || purchaseOrders.length === 0) && (
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

