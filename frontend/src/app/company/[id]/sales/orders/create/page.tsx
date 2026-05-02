'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Trash2, ArrowLeft, Save, 
  User, Calendar, Globe, Hash,
  ShoppingCart, AlertCircle, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import React from 'react';

interface SalesOrderLine {
  productId: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function CreateSalesOrderPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    lcId: '',
    soDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    currency: 'BDT',
    exchangeRate: 1,
    status: 'DRAFT',
    lines: [{ productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }] as SalesOrderLine[]
  });

  useEffect(() => {
    setMounted(true);
    if (companyExchangeRate) {
      setFormData(prev => ({ ...prev, exchangeRate: companyExchangeRate }));
    }
  }, [companyExchangeRate]);

  const { data: customers } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/customers`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/products`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const { data: lcs } = useQuery({
    queryKey: ['lcs', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/lcs`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const totalBDT = data.lines.reduce((sum: number, line: SalesOrderLine) => sum + (line.quantity * line.unitPrice), 0);
      const payload = {
        ...data,
        totalBDT,
        totalForeign: totalBDT / data.exchangeRate
      };
      const response = await api.post(`/company/${companyId}/sales-orders`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders', companyId] });
      toast.success('Sales Order created successfully');
      router.push(`/company/${companyId}/sales/orders`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create sales order');
    }
  });

  const handleLineChange = (index: number, field: keyof SalesOrderLine, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };

    if (field === 'productId') {
      const product = products?.find((p: any) => p.id === value);
      if (product) {
        line.itemDescription = product.name;
        line.unitPrice = product.unitPrice || 0;
      }
    }

    line.total = line.quantity * line.unitPrice;
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { productId: '', itemDescription: '', quantity: 1, unitPrice: 0, total: 0 }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => sum + line.total, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast.error('Please select a customer');
      return;
    }
    if (formData.lines.some(l => !l.itemDescription || l.quantity <= 0)) {
      toast.error('Please complete all line items');
      return;
    }
    createMutation.mutate(formData);
  };

  if (!mounted) return null;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 bg-gray-50 min-h-screen">
      {/* Sticky Header Actions */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-sm transition-all text-gray-400 hover:text-gray-900 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-gray-400" />
              Create Sales Order
            </h1>
            <p className="text-sm text-gray-500 mt-1">Initialize a new sales contract and allocate resources</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-sm text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-white transition-colors bg-white shadow-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-gray-900 text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Order
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Basic Info & Items */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white p-8 border border-gray-200 rounded-sm shadow-sm space-y-8">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Contract Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <User className="w-3 h-3 text-gray-400" /> Customer
                </label>
                <select 
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                >
                  <option value="">Select Customer</option>
                  {customers?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <Hash className="w-3 h-3 text-gray-400" /> Letter of Credit
                </label>
                <select 
                  value={formData.lcId}
                  onChange={(e) => setFormData({ ...formData, lcId: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                >
                  <option value="">No LC Linked</option>
                  {lcs?.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.lcNumber}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <Calendar className="w-3 h-3 text-gray-400" /> Order Date
                </label>
                <input 
                  type="date"
                  required
                  value={formData.soDate}
                  onChange={(e) => setFormData({ ...formData, soDate: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gray-900 transition-colors font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <Calendar className="w-3 h-3 text-gray-400" /> Expected Delivery
                </label>
                <input 
                  type="date"
                  value={formData.expectedDeliveryDate}
                  onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-gray-900 transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order Schedule</h3>
              <button 
                type="button"
                onClick={addLine}
                className="text-[10px] font-bold text-gray-900 hover:text-blue-600 flex items-center gap-1.5 uppercase transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Item
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                    <th className="px-6 py-4 text-left">Product</th>
                    <th className="px-6 py-4 text-left w-1/3">Description</th>
                    <th className="px-6 py-4 text-right w-24">Qty</th>
                    <th className="px-6 py-4 text-right w-32">Unit Price</th>
                    <th className="px-6 py-4 text-right w-32">Total</th>
                    <th className="px-6 py-4 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formData.lines.map((line, index) => (
                    <tr key={index} className="hover:bg-gray-50/50 group transition-colors">
                      <td className="px-6 py-3">
                        <select 
                          value={line.productId}
                          onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 font-bold text-gray-900"
                        >
                          <option value="">Select Product</option>
                          {products?.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-3">
                        <input 
                          type="text"
                          value={line.itemDescription}
                          onChange={(e) => handleLineChange(index, 'itemDescription', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 placeholder:text-gray-300 text-gray-600"
                          placeholder="Specific details..."
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input 
                          type="number"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 text-right font-mono font-medium"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input 
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 text-right font-mono font-medium"
                        />
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(line.total)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button 
                          type="button"
                          onClick={() => removeLine(index)}
                          className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Totals & Summary */}
        <div className="space-y-6">
          <div className="bg-white p-8 border border-gray-200 rounded-sm shadow-sm space-y-6">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">Financial Summary</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <Globe className="w-3 h-3 text-gray-400" /> Currency
                </label>
                <select 
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-sm px-4 py-2 text-sm focus:outline-none focus:border-gray-900 transition-colors"
                >
                  <option value="BDT">BDT - Taka</option>
                  <option value="USD">USD - Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <Hash className="w-3 h-3 text-gray-400" /> Exchange Rate
                </label>
                <input 
                  type="number"
                  step="0.01"
                  value={formData.exchangeRate}
                  onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-white border border-gray-200 rounded-sm px-4 py-2 text-sm font-mono focus:outline-none focus:border-gray-900 transition-colors"
                />
              </div>

              <div className="pt-6 border-t border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Subtotal</span>
                  <span className="font-mono text-sm font-medium text-gray-600">{formatCurrency(calculateTotal())} {formData.currency}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">Grand Total</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl font-black text-gray-900 leading-none">
                      {formatCurrency(calculateTotal())}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">{formData.currency}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-sm border border-gray-100 mt-6">
                  <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-2">Base Value (Local)</p>
                  <p className="font-mono text-sm text-gray-900 font-bold">
                    {formatCurrency(calculateTotal() * formData.exchangeRate)} <span className="text-[10px] text-gray-500 ml-1">BDT</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-6 rounded-sm flex gap-4 shadow-sm">
            <div className="p-2 bg-blue-50 rounded-sm h-fit">
              <AlertCircle className="w-4 h-4 text-blue-500" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Policy Notice</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Orders remain in <span className="font-bold text-gray-700">DRAFT</span> until manually approved. Approval locks the pricing and initiates procurement triggers.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
