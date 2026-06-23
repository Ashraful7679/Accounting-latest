'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ArrowLeft, ShoppingCart, Calendar, User, Package, Truck, FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import Link from 'next/link';
import DocumentTreeView from '@/components/DocumentTreeView';

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id: companyId, poId } = params as { id: string; poId: string };
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-order-detail', companyId, poId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/purchase-orders?limit=100`);
      const result = response.data.data;
      const data = Array.isArray(result) ? result : (result?.data || []);
      return data.find((o: any) => o.id === poId);
    },
    enabled: !!companyId && !!poId,
  });

  if (!mounted) return null;

  if (isLoading) return (
    <div className="p-6 max-w-6xl mx-auto flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  if (!orders) return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Purchase Order not found</div>
    </div>
  );

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-600', APPROVED: 'bg-blue-100 text-blue-600',
      SENT: 'bg-indigo-100 text-indigo-600', RECEIVED: 'bg-purple-100 text-purple-600',
      CLOSED: 'bg-green-100 text-green-600', REJECTED: 'bg-red-100 text-red-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const totalForeign = orders.lines?.reduce((s: number, l: any) => s + (l.quantity * l.unitPrice), 0) || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-4 bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <ShoppingCart className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold">{orders.poNumber}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(orders.status)}`}>{orders.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">Order Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Supplier</span><p className="font-semibold">{orders.supplier?.name || '--'}</p></div>
              <div><span className="text-gray-400">PO Date</span><p className="font-semibold">{formatDate(orders.poDate)}</p></div>
              <div><span className="text-gray-400">Expected Delivery</span><p className="font-semibold">{formatDate(orders.expectedDeliveryDate)}</p></div>
              <div><span className="text-gray-400">Currency</span><p className="font-semibold">{orders.currency}</p></div>
              {orders.currency !== 'BDT' && (
                <div><span className="text-gray-400">Exchange Rate</span><p className="font-semibold">{orders.exchangeRate || companyExchangeRate}</p></div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-500 uppercase">Order Lines</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase font-bold">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {orders.lines?.map((line: any) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{line.itemDescription || line.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-600">{line.receivedQuantity || 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(line.quantity * line.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-gray-50 font-bold">
                <td colSpan={4} className="px-4 py-3 text-right">Total</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalForeign)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <DocumentTreeView
            groups={[
              ...(orders.lc ? [{ label: 'LC', icon: LinkIcon, documents: [{ id: orders.lc.id, number: orders.lc.lcNumber || orders.lc.id.slice(0, 8), status: orders.lc.status || '', href: `/company/${companyId}/finance/lc/${orders.lc.id}` }] }] : []),
              ...(orders.grns?.length > 0 ? [{ label: 'GRNs', icon: Truck, documents: orders.grns.map((grn: any) => ({ id: grn.id, number: grn.grnNumber, status: grn.status })) }] : []),
              ...(orders.invoices?.length > 0 ? [{ label: 'Invoices', icon: FileText, documents: orders.invoices.map((inv: any) => ({ id: inv.id, number: inv.invoiceNumber || inv.id.slice(0, 8), status: inv.status || '' })) }] : []),
              ...(orders.salesOrders?.length > 0 ? [{ label: 'Sales Orders', icon: ShoppingCart, documents: orders.salesOrders.map((so: any) => ({ id: so.id, number: so.soNumber, status: so.status || '', href: `/company/${companyId}/sales/orders/${so.id}` })) }] : []),
            ]}
            variant="sidebar"
          />

          <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="font-mono font-semibold">{formatCurrency(totalForeign)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-100"><span className="font-bold">Total ({orders.currency})</span><span className="font-mono font-bold">{formatCurrency(totalForeign)}</span></div>
              {orders.currency !== 'BDT' && (
                <div className="flex justify-between text-blue-600"><span>Total (BDT)</span><span className="font-mono font-bold">{formatCurrency(totalForeign * (orders.exchangeRate || companyExchangeRate))}</span></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
