'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ArrowLeft, ShoppingCart, Calendar, User, Package, Truck, FileText, Link as LinkIcon, Loader2, Globe, Printer, Plus, X, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import Link from 'next/link';
import DocumentTreeView from '@/components/DocumentTreeView';
import { AttachmentManager } from '@/components/AttachmentManager';
import { toast } from 'react-hot-toast';

export default function SalesOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { id: companyId, orderId } = params as { id: string; orderId: string };
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  const [showDnModal, setShowDnModal] = useState(false);
  const [dnItems, setDnItems] = useState<Array<{productId: string; productName: string; quantity: number; maxQty: number}>>([]);
  const [dnShipmentDate, setDnShipmentDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { setMounted(true); }, []);

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order-detail', companyId, orderId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders/${orderId}`);
      return response.data.data;
    },
    enabled: !!companyId && !!orderId,
  });

  const dnCreateMutation = useMutation({
    mutationFn: async ({ soId, data }: { soId: string; data: { items: { productId: string; quantity: number }[]; shipmentDate?: string } }) => {
      const response = await api.post(`/company/${companyId}/sales-orders/${soId}/dn`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order-detail', companyId, orderId] });
      toast.success('Delivery Challan generated');
      setShowDnModal(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to generate DC');
    },
  });

  const openDnModal = () => {
    if (!order) return;
    setDnShipmentDate(new Date().toISOString().split('T')[0]);
    const items = (order.lines || [])
      .filter((l: any) => {
        const remaining = l.quantity - (l.deliveredQuantity || 0);
        return remaining > 0 && l.productId;
      })
      .map((l: any) => {
        const remaining = l.quantity - (l.deliveredQuantity || 0);
        return {
          productId: l.productId,
          productName: l.product?.name || l.itemDescription || l.description || 'Unknown',
          quantity: remaining,
          maxQty: remaining,
        };
      });
    setDnItems(items);
    setShowDnModal(true);
  };

  const handleDnCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const validItems = dnItems.filter(item => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('At least one item with quantity > 0 is required');
      return;
    }
    const body: any = { items: validItems.map(i => ({ productId: i.productId, quantity: i.quantity })) };
    if (dnShipmentDate) body.shipmentDate = new Date(dnShipmentDate).toISOString();
    dnCreateMutation.mutate({ soId: order.id, data: body });
  };

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
        <div className="flex items-center gap-2">
          {/* DN button */}
          {['CONFIRMED', 'FULFILLED'].includes(order.status) && (
            <div className="relative">
              <button
                onClick={openDnModal}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors rounded-sm"
                title={order.dns?.length > 0 ? 'Create another Delivery Challan' : 'Generate Delivery Challan'}
              >
                <Truck className="w-4 h-4" />
                {order.dns?.length > 0 ? `DN (${order.dns.length})` : 'DN'}
              </button>
            </div>
          )}
          {/* Invoice button */}
          {order.status === 'FULFILLED' && (
            <button
              onClick={() => router.push(`/company/${companyId}/sales/invoices/create?soId=${order.id}&type=${order.currency === 'BDT' ? 'local' : 'foreign'}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors rounded-sm"
            >
              <FileText className="w-4 h-4" />
              Invoice
            </button>
          )}
          {/* PI button */}
          {['CONFIRMED', 'FULFILLED', 'INVOICED', 'COMPLETED'].includes(order.status) && (
            <button
              onClick={() => router.push(`/company/${companyId}/sales/pis?soId=${order.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-green-50 text-green-700 hover:bg-green-100 transition-colors rounded-sm"
            >
              <DollarSign className="w-4 h-4" />
              PI
            </button>
          )}
          <button
            onClick={() => window.open(`/company/${companyId}/sales/orders/${orderId}/print`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors rounded-sm"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
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

      {/* DN Creation Modal */}
      {showDnModal && (
        <div className="fixed inset-0 bg-gray-900/10 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Generate Delivery Challan — {order.soNumber}</h3>
              </div>
              <button type="button" onClick={() => setShowDnModal(false)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              <form onSubmit={handleDnCreateSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Customer</label>
                  <p className="text-sm font-bold text-gray-900">{order.customer?.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Shipment Date</label>
                  <input type="date" value={dnShipmentDate} onChange={(e) => setDnShipmentDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
                </div>
                {dnItems.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-4 text-center">All items in this order have been fully delivered.</p>
                ) : (
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-center w-24">Max Qty</th>
                          <th className="px-4 py-3 text-center w-24">Ship Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dnItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                            <td className="px-4 py-3 text-center text-gray-500">{item.maxQty}</td>
                            <td className="px-4 py-3 text-center">
                              <input type="number" min={0} max={item.maxQty} step="any" value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const newItems = [...dnItems];
                                  newItems[idx] = { ...newItems[idx], quantity: Math.max(0, Math.min(val, item.maxQty)) };
                                  setDnItems(newItems);
                                }}
                                className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm font-mono"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button type="submit" disabled={dnCreateMutation.isPending || dnItems.length === 0}
                    className="px-8 py-3 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest rounded hover:bg-gray-800 disabled:bg-gray-300 transition-all flex items-center gap-2">
                    {dnCreateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Generate Challan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
