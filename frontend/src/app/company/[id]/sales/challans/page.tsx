'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Truck, Search, Eye, ChevronDown, ChevronRight, 
  Printer, Package, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

export default function DeliveryChallansPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const [mounted, setMounted] = useState(false);
  const [expandedChallans, setExpandedChallans] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

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
      dc.salesOrder?.soNumber?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-gray-400" />
            Delivery Challans
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track shipments and proof of delivery</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Challan # or Order..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-gray-400 transition-colors bg-white shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-12 py-3 px-4"></th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Challan #</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Shipment Date</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sales Order</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 italic">Loading shipments...</td></tr>
            ) : filteredChallans.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 italic">No Delivery Challans found</td></tr>
            ) : (
              filteredChallans.map((dc: any) => (
                <React.Fragment key={dc.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors group",
                    expandedChallans.has(dc.id) && "bg-gray-50/80"
                  )}>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => toggleExpand(dc.id)} className="p-1 hover:bg-gray-200 rounded-sm transition-colors text-gray-400">
                        {expandedChallans.has(dc.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900">{dc.dnNumber}</td>
                    <td className="py-3 px-4 text-gray-500">{new Date(dc.shipmentDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium text-gray-700">{dc.salesOrder?.soNumber}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm border",
                        dc.status === 'SHIPPED' ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-400 border-gray-200"
                      )}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-sm border border-transparent hover:border-gray-200 transition-all"><Eye className="w-4 h-4" /></button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-sm border border-transparent hover:border-gray-200 transition-all"><Printer className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedChallans.has(dc.id) && (
                    <tr className="bg-white">
                      <td colSpan={6} className="px-16 py-6 border-b border-gray-100 shadow-inner">
                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-6 max-w-4xl">
                          <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            Shipment Contents
                          </h4>
                          <table className="w-full text-xs bg-white border border-gray-100 rounded-sm">
                            <thead className="bg-white border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                              <tr>
                                <th className="px-4 py-3 text-left">Sl</th>
                                <th className="px-4 py-3 text-left">Product Description</th>
                                <th className="px-4 py-3 text-right w-32">Shipped Quantity</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {dc.lines.map((line: any, idx: number) => (
                                <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-4 py-2.5 text-gray-400 font-mono">{idx + 1}</td>
                                  <td className="px-4 py-2.5 font-bold text-gray-900">{line.product?.name || 'Item Not Specified'}</td>
                                  <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-600">{line.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center">
                                   <FileText className="w-4 h-4 text-gray-400" />
                                </div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Linked Order: <span className="text-gray-900">{dc.salesOrder?.soNumber}</span></p>
                             </div>
                             <p className="text-[10px] text-gray-400 italic">Verified by Warehouse Management System</p>
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
