'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Truck, Search, Eye, ChevronDown, ChevronRight, 
  Printer, Package
} from 'lucide-react';
import { formatCurrency } from '@/lib/decimalUtils';
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
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-white min-h-screen">
      <div className="flex justify-between items-end border-b border-gray-900 pb-4">
        <div>
          <h1 className="text-3xl font-light text-gray-900 tracking-tight">Delivery Challans</h1>
          <p className="text-sm text-gray-500 mt-1">Track shipments and proof of delivery</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search challans..."
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
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Challan #</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Shipment Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Sales Order</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading shipments...</td></tr>
            ) : filteredChallans.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No records found</td></tr>
            ) : (
              filteredChallans.map((dc: any) => (
                <React.Fragment key={dc.id}>
                  <tr className={cn(
                    "hover:bg-gray-50/50 transition-colors",
                    expandedChallans.has(dc.id) && "bg-gray-50"
                  )}>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => toggleExpand(dc.id)} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400">
                        {expandedChallans.has(dc.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{dc.dnNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(dc.shipmentDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{dc.salesOrder?.soNumber}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                        dc.status === 'SHIPPED' ? "bg-white text-gray-900 border-gray-900" : "bg-white text-gray-400 border-gray-200"
                      )}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedChallans.has(dc.id) && (
                    <tr className="bg-gray-50/30">
                      <td colSpan={6} className="p-0 border-b border-gray-100">
                        <div className="px-16 py-6 border-l-2 border-gray-900 bg-white">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Itemized Shipment Details</h4>
                          <table className="w-full text-xs border border-gray-200">
                            <thead>
                              <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-2 border-b border-gray-200 text-left">Product</th>
                                <th className="px-4 py-2 border-b border-gray-200 text-right">Quantity</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {dc.lines.map((line: any) => (
                                <tr key={line.id} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2 font-medium text-gray-900">{line.product?.name || 'Unknown Product'}</td>
                                  <td className="px-4 py-2 text-right font-mono text-gray-900">{line.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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

