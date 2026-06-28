'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Trash2, ArrowLeft, Save, 
  User, Calendar, ShoppingCart, Loader2, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';

interface LineItem {
  productId: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function CreateSalesOrderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('sales.orders', companyId);
  const queryClient = useQueryClient();
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [orderType, setOrderType] = useState<'local' | 'foreign'>('local');

  const [formData, setFormData] = useState({
    customerName: '',
    soDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }] as LineItem[],
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const type = searchParams?.get('type');
    if (type === 'foreign') setOrderType('foreign');
  }, [searchParams]);

  const { data: customers } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: () => api.get(`/company/${companyId}/customers`).then(r => r.data.data),
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => api.get(`/company/${companyId}/products`).then(r => r.data.data),
    enabled: !!companyId,
  });

  const { data: productPricing } = useQuery({
    queryKey: ['product-pricing', companyId],
    queryFn: () => api.get(`/company/${companyId}/products/pricing`).then(r => r.data.data),
    enabled: !!companyId,
  });

  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter((c: any) =>
    orderType === 'local' ? c.preferredCurrency === 'BDT' : c.preferredCurrency !== 'BDT'
  );

  const selectedCustomer = (Array.isArray(customers) ? customers : []).find(
    (c: any) => c.name === formData.customerName
  );

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };

    if (field === 'itemDescription') {
      const existingProduct = (Array.isArray(products) ? products : []).find(
        (p: any) => p.name === value
      );
      if (existingProduct) {
        let price = existingProduct.unitPrice || 0;
        const targetCurrency = orderType === 'local' ? 'BDT' : 'USD';
        if (existingProduct.currency === 'USD' && targetCurrency === 'BDT') {
          price = price * companyExchangeRate;
        } else if (existingProduct.currency === 'BDT' && targetCurrency === 'USD') {
          price = price / companyExchangeRate;
        }
        line.unitPrice = Number(price.toFixed(2));
        line.productId = existingProduct.id;
      }
    }

    line.total = Number((line.quantity * line.unitPrice).toFixed(2));
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    setFormData({ ...formData, lines: formData.lines.filter((_, i) => i !== index) });
  };

  const calculateTotal = () => formData.lines.reduce((sum, l) => sum + l.total, 0);

  const getLineMargin = (line: LineItem) => {
    const product = (Array.isArray(products) ? products : []).find((p: any) => p.name === line.itemDescription);
    const pricing = (Array.isArray(productPricing) ? productPricing : []).find((p: any) => p.productId === product?.id);
    if (!pricing?.averageCost || !line.unitPrice) return null;
    const margin = ((line.unitPrice - pricing.averageCost) / line.unitPrice) * 100;
    return {
      margin: Math.round(margin * 100) / 100,
      isBelowMargin: margin < (product?.minimumMargin || 10),
    };
  };

  const hasLowMargin = formData.lines.some(line => getLineMargin(line)?.isBelowMargin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      toast.error('Please enter or select a customer');
      return;
    }
    if (formData.lines.some(l => !l.itemDescription || l.quantity <= 0)) {
      toast.error('Please complete all product lines');
      return;
    }

    setIsSaving(true);
    try {
      // Resolve customer ID — auto-create if new
      let finalCustomerId = selectedCustomer?.id;
      if (!finalCustomerId) {
        const res = await api.post(`/company/${companyId}/customers`, {
          name: formData.customerName,
          type: orderType === 'local' ? 'Local' : 'Foreign',
          preferredCurrency: orderType === 'local' ? 'BDT' : 'USD',
        });
        finalCustomerId = res.data.data.id;
      }

      // Resolve product IDs — auto-create if new
      const finalLines = await Promise.all(
        formData.lines.map(async (line) => {
          let finalProductId = line.productId;
          if (!finalProductId) {
            const existingProduct = (Array.isArray(products) ? products : []).find(
              (p: any) => p.name === line.itemDescription
            );
            if (existingProduct) {
              finalProductId = existingProduct.id;
            } else {
              const res = await api.post(`/company/${companyId}/products`, {
                name: line.itemDescription,
                unitPrice: line.unitPrice,
                currency: orderType === 'local' ? 'BDT' : 'USD',
                type: 'Sales',
              });
              finalProductId = res.data.data.id;
            }
          }
          return {
            productId: finalProductId,
            itemDescription: line.itemDescription,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
          };
        })
      );

      const total = calculateTotal();
      const currency = orderType === 'local' ? 'BDT' : 'USD';
      const exchangeRate = orderType === 'local' ? 1 : companyExchangeRate;

      await api.post(`/company/${companyId}/sales-orders`, {
        customerId: finalCustomerId,
        soDate: formData.soDate,
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        currency,
        exchangeRate,
        status: 'DRAFT',
        lines: finalLines,
        totalBDT: orderType === 'local' ? total : total * companyExchangeRate,
        totalForeign: orderType === 'foreign' ? total : 0,
      });

      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Sales Order created');
      router.push(`/company/${companyId}/sales/orders?type=${orderType}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create sales order');
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <datalist id="customer-list">
        {filteredCustomers.map((c: any) => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="product-list">
        {(Array.isArray(products) ? products : []).filter((p: any) => {
          if (!p.type || p.type === 'Sales' || p.type === 'SALES_PURCHASE' || p.type === 'SALES_ONLY') return true;
          return false;
        }).map((p: any) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="text-gray-400 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-900" />
            Create Sales Order
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {orderType === 'foreign' && (
            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-sm">
              USD/BDT: <span className="text-gray-900">{companyExchangeRate}</span>
            </div>
          )}
          <div className="flex bg-gray-100 p-1 rounded-sm">
            <button type="button" onClick={() => setOrderType('local')}
              className={`px-4 py-1.5 rounded-sm text-xs font-bold ${orderType === 'local' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>
              Local
            </button>
            <button type="button" onClick={() => setOrderType('foreign')}
              className={`px-4 py-1.5 rounded-sm text-xs font-bold ${orderType === 'foreign' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>
              Foreign
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Customer</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                list="customer-list"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
                placeholder="Type or select..."
              />
            </div>
            {selectedCustomer && (
              <p className="text-xs text-green-600 font-medium">✓ Existing customer</p>
            )}
            {formData.customerName && !selectedCustomer && (
              <p className="text-xs text-amber-600 font-medium">⚠ New customer will be created</p>
            )}
          </div>

          {/* Order Date */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Order Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                required
                value={formData.soDate}
                onChange={(e) => setFormData({ ...formData, soDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm font-mono focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
              />
            </div>
          </div>

          {/* Expected Delivery */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Expected Delivery</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm font-mono focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-500 uppercase">Order Schedule</h3>
            <button type="button" onClick={addLine} className="text-xs font-bold text-gray-700 flex items-center gap-1 hover:text-gray-900">
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-bold">
                <th className="px-4 py-3 text-left">Product / Description</th>
                <th className="px-4 py-3 text-right w-24">Qty</th>
                {orderType === 'foreign' ? (
                  <>
                    <th className="px-4 py-3 text-right w-40">Unit Price (USD)</th>
                    <th className="px-4 py-3 text-right w-40">Total (USD)</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right w-32">Unit Price (BDT)</th>
                    <th className="px-4 py-3 text-right w-32">Total (BDT)</th>
                  </>
                )}
                <th className="px-4 py-3 text-center w-24">Margin</th>
                <th className="px-4 py-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {formData.lines.map((line, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      list="product-list"
                      value={line.itemDescription}
                      onChange={(e) => handleLineChange(index, 'itemDescription', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 rounded-sm px-2 py-1.5 text-sm outline-none"
                      placeholder="Type or select..."
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={line.quantity || ''}
                      onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={line.unitPrice || ''}
                      onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 rounded-sm px-2 py-1 text-sm text-right font-mono outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-sm">
                    {formatCurrency(line.total)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {(() => {
                      const margin = getLineMargin(line);
                      if (!margin) return <span className="text-gray-300 text-xs">--</span>;
                      return <span className={`text-xs font-bold ${margin.isBelowMargin ? 'text-red-500' : 'text-green-600'}`}>{margin.margin}%</span>;
                    })()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {formData.lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(index)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <div className="text-2xl font-black text-gray-900 font-mono">
            Total: {orderType === 'foreign' ? `USD ${formatCurrency(calculateTotal())}` : `BDT ${formatCurrency(calculateTotal())}`}
          </div>

          <div className="flex items-center gap-4">
            {hasLowMargin && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-sm">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold">Below margin</span>
              </div>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 rounded-sm text-xs font-bold uppercase flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Confirm Sales Order
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}