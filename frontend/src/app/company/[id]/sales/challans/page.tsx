'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Truck, Search, Eye, ChevronDown, ChevronRight, 
  Printer, Package, FileText, ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import React from 'react';

export default function DeliveryChallansPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);
  const [expandedChallans, setExpandedChallans] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const { data: challans, isLoading } = useQuery({
    queryKey: ['delivery-challans', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/challans`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedChallans);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChallans(newExpanded);
  };

  const filteredChallans = challans?.filter((dc: any) => {
    return !searchTerm || 
      dc.dnNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dc.salesOrder?.soNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dc.salesOrder?.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  if (!mounted) return null;

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
                        <button className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"><Eye className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"><Printer className="w-4 h-4" /></button>
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
                                {dc.lines.map((line: any) => (
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
    </div>
  );
}
