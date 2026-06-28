'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ArrowLeft, ShoppingCart, Calendar, User, Package, Truck, FileText, Link as LinkIcon, Loader2, Globe, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import Link from 'next/link';
import DocumentTreeView from '@/components/DocumentTreeView';
import { AttachmentManager } from '@/components/AttachmentManager';

export default function SalesOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id: companyId, orderId } = params as { id: string; orderId: string };
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order-detail', companyId, orderId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders/${orderId}`);
      return response.data.data;
    },
    enabled: !!companyId && !!orderId,
  });

  if (!mounted) return null;

  if (isLoading) return (
    <div className="p-6 max-w-6xl mx-auto flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );

  if (!order) return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Sales Order not found</div>
    </div>
  );

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-600', CONFIRMED: 'bg-blue-100 text-blue-600',
      FULFILLED: 'bg-purple-100 text-purple-600', INVOICED: 'bg-amber-100 text-amber-600',
      COMPLETED: 'bg-green-100 text-green-600', CANCELLED: 'bg-red-100 text-red-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const totalForeign = order.lines?.reduce((s: number, l: any) => s + (l.quantity * l.unitPrice), 0) || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-4 bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <ShoppingCart className="w-5 h-5 text-gray-900" />
          <h1 className="text-xl font-bold">{order.soNumber}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>{order.status}</span>
        </div>
        <button
          onClick={() => window.open(`/company/${companyId}/sales/orders/${orderId}/print`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-4">Order Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400">Customer</span><p className="font-semibold">{order.customer?.name || '--'}</p></div>
              <div><span className="text-gray-400">Order Date</span><p className="font-semibold">{formatDate(order.soDate)}</p></div>
              <div><span className="text-gray-400">Expected Delivery</span><p className="font-semibold">{formatDate(order.expectedDeliveryDate)}</p></div>
              <div><span className="text-gray-400">Currency</span><p className="font-semibold">{order.currency}</p></div>
              {order.currency !== 'BDT' && (
                <div><span className="text-gray-400">Exchange Rate</span><p className="font-semibold">{order.exchangeRate || companyExchangeRate}</p></div>
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
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Delivered</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {order.lines?.map((line: any) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{line.itemDescription || line.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(line.quantity * line.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono">{line.deliveredQuantity || 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-gray-50 font-bold">
                <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(totalForeign)}</td>
                <td></td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <DocumentTreeView
            groups={[
              ...(order.lc ? [{ label: 'LC', icon: LinkIcon, documents: [{ id: order.lc.id, number: order.lc.lcNumber || order.lc.id.slice(0, 8), status: order.lc.status || '', href: `/company/${companyId}/finance/lc/${order.lc.id}` }] }] : []),
              ...(order.dns?.length > 0 ? [{ label: 'Delivery Challans', icon: Truck, documents: order.dns.map((dn: any) => ({ id: dn.id, number: dn.dnNumber, status: dn.status, href: `/company/${companyId}/sales/challans/${dn.id}` })) }] : []),
              ...(order.invoices?.length > 0 ? [{ label: 'Invoices', icon: FileText, documents: order.invoices.map((inv: any) => ({ id: inv.id, number: inv.invoiceNumber || inv.id.slice(0, 8), status: inv.status || '' })) }] : []),
              ...(order.purchaseOrders?.length > 0 ? [{ label: 'Purchase Orders', icon: Package, documents: order.purchaseOrders.map((po: any) => ({ id: po.id, number: po.poNumber, status: po.status || '', href: `/company/${companyId}/purchase/orders/${po.id}` })) }] : []),
            ]}
            variant="sidebar"
          />

          <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="font-mono font-semibold">{formatCurrency(totalForeign)}</span></div>
              <div className="flex justify-between pt-2 border-t border-gray-100"><span className="font-bold">Total ({order.currency})</span><span className="font-mono font-bold">{formatCurrency(totalForeign)}</span></div>
              {order.currency !== 'BDT' && (
                <div className="flex justify-between text-blue-600"><span>Total (BDT)</span><span className="font-mono font-bold">{formatCurrency(totalForeign * (order.exchangeRate || companyExchangeRate))}</span></div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <AttachmentManager entityType="SALES_ORDER" entityId={order.id} />
      </div>
    </div>
  );
}
