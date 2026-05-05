'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { 
  Plus, Trash2, ArrowLeft, Save, 
  User, Calendar, ShoppingCart, Loader2, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency, defaultCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import { z } from 'zod';

const salesOrderLineSchema = z.object({
  productId: z.string().optional(),
  itemDescription: z.string().min(1, 'Product required'),
  quantity: z.number().min(1, 'Min 1'),
  unitPrice: z.number().min(0),
  total: z.number(),
});

const createSalesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  soDate: z.string().min(1, 'Date required'),
  expectedDeliveryDate: z.string().optional(),
  orderType: z.enum(['local', 'foreign']),
  lines: z.array(salesOrderLineSchema).min(1),
});

type SalesOrderFormData = z.infer<typeof createSalesOrderSchema>;

export default function CreateSalesOrderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  const initialType = searchParams.get('type') === 'foreign' ? 'foreign' : 'local';
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingEntities, setPendingEntities] = useState<{customers: string[], products: string[]}>({ customers: [], products: [] });

  useEffect(() => { setMounted(true); }, []);

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

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<SalesOrderFormData>({
    resolver: zodResolver(createSalesOrderSchema),
    defaultValues: {
      customerId: '',
      soDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      orderType: initialType,
      lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const orderType = watch('orderType');

  const filteredCustomers = customers?.filter((c: any) => 
    orderType === 'local' ? c.preferredCurrency === 'BDT' : c.preferredCurrency !== 'BDT'
  );

  const calculateLineTotal = (index: number) => {
    const line = watch(`lines.${index}`);
    return (line?.quantity || 0) * (line?.unitPrice || 0);
  };

  const calculateTotal = () => {
    return fields.reduce((sum, _, i) => sum + calculateLineTotal(i), 0);
  };

  const getLineMargin = (line: SalesOrderFormData['lines'][0]) => {
    const product = products?.find((p: any) => p.name === line.itemDescription);
    const pricing = productPricing?.find((p: any) => p.productId === product?.id);
    if (!pricing?.averageCost || !line.unitPrice) return null;
    const margin = ((line.unitPrice - pricing.averageCost) / line.unitPrice) * 100;
    return {
      margin: Math.round(margin * 100) / 100,
      isBelowMargin: margin < (product?.minimumMargin || 10),
      averageCost: pricing.averageCost
    };
  };

  const hasLowMargin = fields.some((_, i) => {
    const line = watch(`lines.${i}`);
    return getLineMargin(line)?.isBelowMargin;
  });

  const onSubmit = async (data: SalesOrderFormData) => {
    setIsSaving(true);
    try {
      const total = calculateTotal();
      const currency = orderType === 'local' ? 'BDT' : 'USD';
      const exchangeRate = orderType === 'local' ? 1 : companyExchangeRate;

      await api.post(`/company/${companyId}/sales-orders`, {
        customerId: data.customerId,
        soDate: data.soDate,
        expectedDeliveryDate: data.expectedDeliveryDate,
        currency,
        exchangeRate,
        status: 'DRAFT',
        lines: data.lines.map(l => ({ ...l, total: l.quantity * l.unitPrice })),
        totalBDT: orderType === 'local' ? total : total * companyExchangeRate,
        totalForeign: orderType === 'foreign' ? total : 0,
      });

      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Sales Order created');
      router.push(`/company/${companyId}/sales/orders`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      <datalist id="customer-list">
        {filteredCustomers?.map((c: any) => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="product-list">
        {products?.map((p: any) => <option key={p.id} value={p.name} />)}
      </datalist>

      <div className="flex justify-between items-center bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Create Sales Order
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {orderType === 'foreign' && (
            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-sm">
              USD/BDT: <span className="text-gray-900">{companyExchangeRate}</span>
            </div>
          )}
          <Controller
            name="orderType"
            control={control}
            render={({ field }) => (
              <div className="flex bg-gray-100 p-1 rounded-sm">
                <button type="button" onClick={() => field.onChange('local')} className={`px-4 py-1.5 rounded-sm text-xs font-bold ${field.value === 'local' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>Local</button>
                <button type="button" onClick={() => field.onChange('foreign')} className={`px-4 py-1.5 rounded-sm text-xs font-bold ${field.value === 'foreign' ? 'bg-white text-gray-900' : 'text-gray-500'}`}>Foreign</button>
              </div>
            )}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          <Controller
            name="customerId"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Customer</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input list="customer-list" {...field} onChange={(e) => field.onChange(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm" placeholder="Type or select..." />
                </div>
                {errors.customerId && <p className="text-xs text-red-500">{errors.customerId.message}</p>}
              </div>
            )}
          />

          <Controller
            name="soDate"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Order Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="date" {...field} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm font-mono" />
                </div>
                {errors.soDate && <p className="text-xs text-red-500">{errors.soDate.message}</p>}
              </div>
            )}
          />

          <Controller
            name="expectedDeliveryDate"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Expected Delivery</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="date" {...field} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm font-mono" />
                </div>
              </div>
            )}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-500 uppercase">Order Schedule</h3>
            <button type="button" onClick={() => append({ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 })} className="text-xs font-bold text-blue-600 flex items-center gap-1">
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
                    <th className="px-4 py-3 text-right w-40">Unit Price (USD/BDT)</th>
                    <th className="px-4 py-3 text-right w-40">Total (USD/BDT)</th>
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
              {fields.map((field, index) => (
                <tr key={field.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Controller
                      name={`lines.${index}.itemDescription`}
                      control={control}
                      render={({ field: f }) => (
                        <input list="product-list" {...f} onChange={(e) => f.onChange(e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded-sm px-2 py-1.5 text-sm" placeholder="Type or select..." />
                      )}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Controller
                      name={`lines.${index}.quantity`}
                      control={control}
                      render={({ field: f }) => (
                        <input type="number" step="any" {...f} onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono" />
                      )}
                    />
                  </td>
                  {orderType === 'foreign' ? (
                    <>
                      <td className="px-4 py-2">
                        <Controller
                          name={`lines.${index}.unitPrice`}
                          control={control}
                          render={({ field: f }) => (
                            <input type="number" step="any" {...f} onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded-sm px-2 py-1 text-sm text-right font-mono" />
                          )}
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(calculateLineTotal(index))}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2">
                        <Controller
                          name={`lines.${index}.unitPrice`}
                          control={control}
                          render={({ field: f }) => (
                            <input type="number" step="any" {...f} onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)} className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-500 rounded-sm px-2 py-1 text-sm text-right font-mono" />
                          )}
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(calculateLineTotal(index))}</td>
                    </>
                  )}
                  <td className="px-4 py-2 text-center">
                    {(() => {
                      const line = watch(`lines.${index}`);
                      const margin = getLineMargin(line);
                      if (!margin) return <span className="text-gray-300">--</span>;
                      return <span className={margin.isBelowMargin ? 'text-red-500' : 'text-green-600'}>{margin.margin}%</span>;
                    })()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
            <button type="submit" disabled={isSaving} className="px-8 py-3 rounded-sm text-xs font-bold uppercase flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Confirm Sales Order
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}