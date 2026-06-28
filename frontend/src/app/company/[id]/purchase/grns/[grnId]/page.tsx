'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  ArrowLeft, Package, Printer, Receipt, User,
  ArrowUpRight, Calendar, FileText
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function GRNDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id: companyId, grnId } = params as { id: string; grnId: string };
  const { canView, isLoading: permsLoading } = usePermissions('purchase.orders', companyId);
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-detail', companyId, grnId],
    queryFn: async () => {
      const res = await api.get(`/company/${companyId}/grns/${grnId}`);
      return res.data.data;
    },
    enabled: !!companyId && !!grnId,
  });

  if (!mounted) return null;

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  if (isLoading) return <p className="text-center p-10">Loading…</p>;
  if (!grn) return <p className="text-center p-10">GRN not found</p>;

  const isForeign = grn.purchaseOrder?.currency && grn.purchaseOrder.currency !== 'BDT';
  const supplierId = grn.purchaseOrder?.supplier?.id;
  const supplierName = grn.purchaseOrder?.supplier?.name;
  const totalValue = (grn.lines || []).reduce((sum: number, l: any) => {
    const poLine = grn.purchaseOrder?.lines?.find((pl: any) => pl.productId === l.productId);
    return sum + (l.quantity * (poLine?.unitPrice || 0));
  }, 0);

  const createBillUrl = `/company/${companyId}/purchase/invoices/create?grnIds=${grn.id}${supplierId ? `&supplierId=${supplierId}` : ''}&type=${isForeign ? 'foreign' : 'local'}`;

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end bg-white p-6 rounded-sm border border-gray-200 shadow-sm">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="mt-1 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
              <Package className="w-6 h-6 text-indigo-600" />
              GRN – {grn.grnNumber}
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Goods Receipt Note</p>
            {supplierName && (
              <p className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {supplierName}
                {isForeign && (
                  <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Import</span>
                )}
              </p>
            )}
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Received: {formatDate(grn.receiptDate)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href={createBillUrl}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            Create Bill
          </Link>
          <button
            onClick={() => window.print()}
            className="p-2 text-gray-400 hover:text-gray-900 rounded-sm transition-colors border border-gray-200"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Receipt Details */}
      <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 space-y-6">
        <div className="flex justify-between items-start">
          <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Received Items
          </h4>
          <div className="text-right">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Order Valuation</p>
            <p className="text-sm font-black text-gray-900 font-mono tracking-tighter">
              {grn.purchaseOrder?.currency} {formatCurrency(totalValue)}
            </p>
            {isForeign && (
              <p className="text-[9px] font-bold text-gray-400 font-mono italic">
                ৳ {formatCurrency(totalValue * (grn.purchaseOrder?.exchangeRate || companyExchangeRate))}
              </p>
            )}
          </div>
        </div>

        {/* Lines table */}
        <div className="border border-gray-200 rounded-sm overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3 text-right">Received Qty</th>
                <th className="px-6 py-3 text-right">Unit Price ({grn.purchaseOrder?.currency})</th>
                <th className="px-6 py-3 text-right">Ext. Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(grn.lines || []).map((line: any) => {
                const poLine = grn.purchaseOrder?.lines?.find((pl: any) => pl.productId === line.productId);
                const unitPrice = poLine?.unitPrice || 0;
                return (
                  <tr key={line.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{line.product?.name || poLine?.itemDescription || 'Unknown'}</span>
                        <span className="text-[9px] text-gray-400 uppercase tracking-widest">{line.product?.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-black text-gray-900">{line.quantity}</td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-gray-500">{formatCurrency(unitPrice)}</td>
                    <td className="px-6 py-3 text-right font-mono font-black text-gray-900">
                      {formatCurrency(line.quantity * unitPrice)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer row */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          {grn.purchaseOrderId ? (
            <Link
              href={`/company/${companyId}/purchase/orders/${grn.purchaseOrderId}`}
              className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:underline"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> View Purchase Order
            </Link>
          ) : (
            <span className="text-[9px] text-gray-400">No linked Purchase Order</span>
          )}
          <p className="text-[9px] text-gray-400 italic font-mono uppercase tracking-widest">
            Digital Stamp: {grn.id.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  );
}
