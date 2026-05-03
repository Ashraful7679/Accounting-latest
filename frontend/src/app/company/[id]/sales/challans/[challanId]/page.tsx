'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Truck, Eye, Printer, Package, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import React from 'react';

export default function DeliveryChallanDetail() {
  const router = useRouter();
  const params = useParams();
  const { id: companyId, challanId } = params as { id: string; challanId: string };
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data: challans, isLoading } = useQuery({
    queryKey: ['delivery-challans', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/challans`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const challan = challans?.find((c: any) => c.id === challanId);

  if (!mounted) return null;
  if (isLoading) return <p className="text-center">Loading…</p>;
  if (!challan) return <p className="text-center">Challan not found</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end bg-white p-6 rounded-sm border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
            <Truck className="w-6 h-6 text-emerald-600" />
            Delivery Challan – {challan.dnNumber}
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shipment Details</p>
        </div>
        <button
          onClick={() => window.print()}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
        </button>
      </div>

      {/* Manifest */}
      <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 space-y-6">
        <div className="flex justify-between items-start">
          <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            Manifest Details
          </h4>
          <div className="text-right">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Order Valuation</p>
            <p className="text-sm font-black text-gray-900 font-mono tracking-tighter">
              {challan.salesOrder?.currency} {formatCurrency(challan.salesOrder?.totalAmount || 0)}
            </p>
            {challan.salesOrder?.currency !== 'BDT' && (
              <p className="text-[9px] font-bold text-gray-400 font-mono italic">
                ৳ {formatCurrency((challan.salesOrder?.totalAmount || 0) * (challan.salesOrder?.exchangeRate || companyExchangeRate))}
              </p>
            )}
          </div>
        </div>

        {/* Lines table */}
        <div className="border border-gray-200 rounded-sm overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <tr>
                <th className="px-6 py-3">Product Description</th>
                <th className="px-6 py-3 text-right">Shipped Quantity</th>
                <th className="px-6 py-3 text-right">Unit Value ({challan.salesOrder?.currency})</th>
                <th className="px-6 py-3 text-right">Ext. Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {challan.lines.map((line: any) => (
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

        {/* Link back to order */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <Link
            href={`/company/${companyId}/sales/orders`}
            className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:underline"
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> View Sales Order
          </Link>
          <p className="text-[9px] text-gray-400 italic font-mono uppercase tracking-widest">
            Digital Stamp: {challan.id.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  );
}
