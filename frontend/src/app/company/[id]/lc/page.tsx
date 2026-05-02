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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-gray-400" />
            Letters of Credit
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium tracking-tight">Trade finance instruments and banking facilities</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/company/${companyId}/lc/create/import`)}
            className="px-6 py-2.5 bg-white border border-gray-900 text-gray-900 text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Import LC
          </button>
          <button
            onClick={() => router.push(`/company/${companyId}/lc/create/export`)}
            className="px-6 py-2.5 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-gray-200"
          >
            <Plus className="w-4 h-4" /> Export LC
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="FILTER BY INSTRUMENT OR BANK..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:border-gray-400 outline-none transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest text-gray-600 outline-none hover:border-gray-400 transition-colors"
        >
          <option value="all">ALL STATUS</option>
          <option value="OPEN">OPEN</option>
          <option value="SETTLED">SETTLED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 py-3 px-4"></th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Instrument Details</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Institution / Branch</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Type</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Limit</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Utilization</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Expiry</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">Status</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Syncing instruments...</td></tr>
            ) : filteredLCs.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-[10px] font-bold text-gray-400 uppercase tracking-widest">No matching instruments found</td></tr>
            ) : (
              filteredLCs.map((lc: any) => (
                <React.Fragment key={lc.id}>
                  <tr className={cn(
                    "hover:bg-gray-50 transition-colors group",
                    expandedLCs.has(lc.id) && "bg-gray-50"
                  )}>
                    <td className="py-4 px-4">
                      <button onClick={() => toggleExpand(lc.id)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                        {expandedLCs.has(lc.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-xs font-black text-gray-900 uppercase tracking-tight">{lc.lcNumber}</div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Created {new Date(lc.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-4 px-4 text-[10px] font-bold text-gray-600 uppercase">{lc.bankName}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-black rounded-sm border tracking-tighter uppercase",
                        lc.type === 'IMPORT' ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-400 border-gray-200"
                      )}>
                        {lc.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-mono text-xs font-black text-gray-900">
                        <span className="text-[10px] text-gray-400 mr-1">{lc.currency}</span>
                        {formatCurrency(lc.amount)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-mono text-xs font-bold text-gray-500">
                        <span className="text-[10px] text-gray-300 mr-1">{lc.currency}</span>
                        {formatCurrency(calculateUsedValue(lc))}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-[10px] font-bold text-gray-600 uppercase">
                      {new Date(lc.expiryDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border",
                        lc.status === 'OPEN' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-gray-50 text-gray-400 border-gray-100"
                      )}>
                        {lc.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => router.push(`/company/${companyId}/finance/lc/${lc.id}`)} 
                          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white border border-gray-200 rounded-sm transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedLCs.has(lc.id) && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={9} className="p-0 border-b border-gray-200">
                        <div className="px-12 py-8 border-l-4 border-gray-900 bg-white ml-4 my-4 rounded-sm shadow-sm border border-gray-200 space-y-8 animate-in slide-in-from-top-2 duration-200">
                          {/* Linked Purchase Orders */}
                          <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4" /> Linked Purchase Orders
                              </h4>
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => router.push(`/company/${companyId}/purchase/orders/create?lcId=${lc.id}`)}
                                  className="text-[10px] font-black text-gray-900 hover:text-blue-600 flex items-center gap-1.5 uppercase tracking-widest transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" /> New PO
                                </button>
                                <button 
                                  onClick={() => setShowPOSelector({ lcId: lc.id })}
                                  className="text-[10px] font-black text-gray-400 hover:text-gray-900 flex items-center gap-1.5 uppercase tracking-widest transition-colors"
                                >
                                  <LinkIcon className="w-3.5 h-3.5" /> Assign Existing
                                </button>
                              </div>
                            </div>
                            {lc.purchaseOrders?.length === 0 ? (
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest py-8 border border-dashed border-gray-200 text-center rounded-sm bg-gray-50/50">
                                No purchase orders linked to this credit line.
                              </div>
                            ) : (
                              <div className="border border-gray-200 rounded-sm overflow-hidden bg-white shadow-sm">
                                <table className="w-full text-left">
                                  <thead className="bg-gray-50 border-b border-gray-200 text-[9px] text-gray-500 uppercase font-black tracking-widest">
                                    <tr>
                                      <th className="px-4 py-2.5">PO Reference</th>
                                      <th className="px-4 py-2.5">Supplier</th>
                                      <th className="px-4 py-2.5 text-right">Value (BDT)</th>
                                      <th className="px-4 py-2.5 text-center">Status</th>
                                      <th className="px-4 py-2.5 text-center w-20">Unlink</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {lc.purchaseOrders.map((po: any) => (
                                      <tr key={po.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-4 py-3 text-xs font-black text-gray-900 uppercase">{po.poNumber}</td>
                                        <td className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase">{po.supplier?.name}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs font-black text-gray-900">{formatCurrency(po.totalBDT)}</td>
                                        <td className="px-4 py-3 text-center">
                                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                            {po.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <button 
                                            onClick={() => assignPOMutation.mutate({ lcId: lc.id, poId: po.id, action: 'disconnect' })}
                                            className="text-gray-300 hover:text-rose-600 p-1 rounded-sm transition-colors"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Linked Sales Orders */}
                          <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Linked Sales Orders
                              </h4>
                              <div className="flex gap-4">
                                <button 
                                  onClick={() => router.push(`/company/${companyId}/sales/orders/create?lcId=${lc.id}`)}
                                  className="text-[10px] font-black text-gray-900 hover:text-blue-600 flex items-center gap-1.5 uppercase tracking-widest transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" /> New SO
                                </button>
                                <button 
                                  onClick={() => setShowSOSelector({ lcId: lc.id })}
                                  className="text-[10px] font-black text-gray-400 hover:text-gray-900 flex items-center gap-1.5 uppercase tracking-widest transition-colors"
                                >
                                  <LinkIcon className="w-3.5 h-3.5" /> Assign Existing
                                </button>
                              </div>
                            </div>
                            {lc.salesOrders?.length === 0 ? (
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest py-8 border border-dashed border-gray-200 text-center rounded-sm bg-gray-50/50">
                                No sales orders linked to this credit line.
                              </div>
                            ) : (
                              <div className="border border-gray-200 rounded-sm overflow-hidden bg-white shadow-sm">
                                <table className="w-full text-left">
                                  <thead className="bg-gray-50 border-b border-gray-200 text-[9px] text-gray-500 uppercase font-black tracking-widest">
                                    <tr>
                                      <th className="px-4 py-2.5">SO Reference</th>
                                      <th className="px-4 py-2.5">Customer</th>
                                      <th className="px-4 py-2.5 text-right">Value</th>
                                      <th className="px-4 py-2.5 text-center">Status</th>
                                      <th className="px-4 py-2.5 text-center w-20">Unlink</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {lc.salesOrders.map((so: any) => (
                                      <tr key={so.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-4 py-3 text-xs font-black text-gray-900 uppercase">{so.soNumber}</td>
                                        <td className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase">{so.customer?.name}</td>
                                        <td className="px-4 py-3 text-right">
                                          <div className="font-mono text-xs font-black text-gray-900">
                                            <span className="text-[10px] text-gray-400 mr-1">{so.currency}</span>
                                            {formatCurrency(so.totalAmount)}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                            {so.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <button 
                                            onClick={() => assignSOMutation.mutate({ lcId: lc.id, soId: so.id, action: 'disconnect' })}
                                            className="text-gray-300 hover:text-rose-600 p-1 rounded-sm transition-colors"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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

      {/* Selector Modals */}
      {showSOSelector && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-400" />
                Assign Sales Order
              </h3>
              <button onClick={() => setShowSOSelector(null)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-sm shadow-inner bg-gray-50/30">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-[9px] text-gray-500 uppercase font-black tracking-widest z-10">
                    <tr>
                      <th className="p-4">SO #</th>
                      <th className="p-4 text-right">Value</th>
                      <th className="p-4 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesOrders?.filter((so: any) => !lcs?.find((l: any) => l.id === showSOSelector.lcId)?.salesOrders.find((s: any) => s.id === so.id)).map((so: any) => (
                      <tr key={so.id} className="hover:bg-white transition-colors">
                        <td className="p-4 text-xs font-black text-gray-900 uppercase">{so.soNumber}</td>
                        <td className="p-4 text-right">
                          <div className="font-mono text-xs font-black text-gray-900">
                            <span className="text-[10px] text-gray-400 mr-1">{so.currency}</span>
                            {formatCurrency(so.totalAmount)}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              assignSOMutation.mutate({ lcId: showSOSelector.lcId, soId: so.id, action: 'connect' });
                              setShowSOSelector(null);
                            }}
                            className="bg-gray-900 text-white px-4 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!salesOrders || salesOrders.length === 0) && (
                      <tr><td colSpan={3} className="p-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">No available orders</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setShowSOSelector(null)} 
                className="px-6 py-2 bg-white border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPOSelector && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-400" />
                Assign Purchase Order
              </h3>
              <button onClick={() => setShowPOSelector(null)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-sm shadow-inner bg-gray-50/30">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-[9px] text-gray-500 uppercase font-black tracking-widest z-10">
                    <tr>
                      <th className="p-4">PO #</th>
                      <th className="p-4 text-right">Value (BDT)</th>
                      <th className="p-4 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchaseOrders?.filter((po: any) => !lcs?.find((l: any) => l.id === showPOSelector.lcId)?.purchaseOrders.find((p: any) => p.id === po.id)).map((po: any) => (
                      <tr key={po.id} className="hover:bg-white transition-colors">
                        <td className="p-4 text-xs font-black text-gray-900 uppercase">{po.poNumber}</td>
                        <td className="p-4 text-right font-mono text-xs font-black text-gray-900">{formatCurrency(po.totalBDT)}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => {
                              assignPOMutation.mutate({ lcId: showPOSelector.lcId, poId: po.id, action: 'connect' });
                              setShowPOSelector(null);
                            }}
                            className="bg-gray-900 text-white px-4 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                          >
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!purchaseOrders || purchaseOrders.length === 0) && (
                      <tr><td colSpan={3} className="p-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">No available orders</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button 
                onClick={() => setShowPOSelector(null)} 
                className="px-6 py-2 bg-white border border-gray-200 rounded-sm text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors"
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
