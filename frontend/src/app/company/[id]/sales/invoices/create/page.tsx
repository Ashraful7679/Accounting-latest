'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Trash2, ArrowLeft, Save, 
  User, Calendar, Receipt, Loader2, Link as LinkIcon,
  TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import React from 'react';

export default function CreateSalesInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const { exchangeRate: companyExchangeRate } = useCompany();
  const [mounted, setMounted] = useState(false);

  const initialType = searchParams.get('type') === 'foreign' ? 'foreign' : 'local';
  const [orderType, setOrderType] = useState<'local'|'foreign'>(initialType);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    customerName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    piIds: [] as string[],
    lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, total: 0, piId: '' }] as any[]
  });

  useEffect(() => { setMounted(true); }, []);

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

  const { data: exportPIs } = useQuery({
    queryKey: ['export-pis', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/pis?type=export`);
      return response.data.data;
    },
    enabled: !!companyId,
  });

  const filteredCustomers = customers?.filter((c: any) => 
    orderType === 'local' ? c.type === 'Local' || !c.type : c.type === 'Foreign'
  );

  const selectedCustomer = customers?.find((c: any) => c.name === formData.customerName);
  const customerPIs = exportPIs?.filter((pi: any) => pi.customerId === selectedCustomer?.id && (pi.status === 'SENT' || pi.status === 'APPROVED' || pi.status === 'PARTIAL')) || [];

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };

    if (field === 'itemDescription') {
      const existingProduct = products?.find((p: any) => p.name === value);
      if (existingProduct) {
        let price = existingProduct.unitPrice || 0;
        const targetCurrency = orderType === 'local' ? 'BDT' : 'USD';
        
        if (existingProduct.currency === 'USD' && targetCurrency === 'BDT') {
          price = price * companyExchangeRate;
        } else if (existingProduct.currency === 'BDT' && targetCurrency === 'USD') {
          price = price / companyExchangeRate;
        }
        
        line.unitPrice = Number(price.toFixed(2));
      }
    }

    line.total = Number((line.quantity * line.unitPrice).toFixed(2));
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { itemDescription: '', quantity: 1, unitPrice: 0, total: 0, piId: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const handlePIToggle = (piId: string) => {
    const currentPIs = [...formData.piIds];
    const piIndex = currentPIs.indexOf(piId);
    
    if (piIndex > -1) {
      currentPIs.splice(piIndex, 1);
      setFormData({
        ...formData,
        piIds: currentPIs,
        lines: formData.lines.filter(l => l.piId !== piId)
      });
    } else {
      currentPIs.push(piId);
      const pi = customerPIs.find((p: any) => p.id === piId);
      if (pi && pi.lines) {
        const newLinesFromPI = pi.lines.map((l: any) => ({
          productId: l.productId,
          itemDescription: l.description || l.itemDescription,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.quantity * l.unitPrice,
          piId: pi.id
        }));
        
        setFormData({
          ...formData,
          piIds: currentPIs,
          lines: [...formData.lines.filter(l => l.itemDescription !== ''), ...newLinesFromPI]
        });
      }
    }
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => sum + line.total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) { toast.error('Please select a customer'); return; }
    if (formData.lines.length === 0 || formData.lines.some(l => !l.itemDescription || l.quantity <= 0)) {
      toast.error('Please complete all item lines'); return;
    }

    setIsSaving(true);
    try {
      let finalCustomerId = selectedCustomer?.id;
      if (!finalCustomerId) {
        const res = await api.post(`/company/${companyId}/customers`, {
          name: formData.customerName,
          type: orderType === 'local' ? 'Local' : 'Foreign',
          preferredCurrency: orderType === 'local' ? 'BDT' : 'USD'
        });
        finalCustomerId = res.data.data.id;
      }

      const finalLines = await Promise.all(formData.lines.map(async (line) => {
        let finalProductId = line.productId;
        if (!finalProductId) {
          const existingProduct = products?.find((p: any) => p.name === line.itemDescription);
          if (existingProduct) {
            finalProductId = existingProduct.id;
          } else {
            const res = await api.post(`/company/${companyId}/products`, {
              name: line.itemDescription,
              unitPrice: line.unitPrice,
              currency: orderType === 'local' ? 'BDT' : 'USD',
              type: 'Sales'
            });
            finalProductId = res.data.data.id;
          }
        }
        return { 
          productId: finalProductId, 
          description: line.itemDescription, 
          quantity: line.quantity, 
          unitPrice: line.unitPrice,
          total: line.total,
          piId: line.piId || undefined
        };
      }));

      const total = calculateTotal();
      const payload = {
        customerId: finalCustomerId,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || undefined,
        type: 'sales',
        currency: orderType === 'local' ? 'BDT' : 'USD',
        exchangeRate: orderType === 'local' ? 1 : companyExchangeRate,
        status: 'DRAFT',
        lines: finalLines,
        piIds: formData.piIds,
        totalAmount: total,
        totalBDT: orderType === 'local' ? total : total * companyExchangeRate
      };

      await api.post(`/company/${companyId}/invoices?type=sales`, payload);
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      toast.success('Sales Invoice created successfully');
      router.push(`/company/${companyId}/sales/invoices`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
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
        {products?.filter((p:any) => p.type === 'Sales' || !p.type).map((p: any) => <option key={p.id} value={p.name} />)}
      </datalist>

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Create Sales Invoice
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {orderType === 'foreign' && (
            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-sm">
              USD/BDT Rate: <span className="text-gray-900">{companyExchangeRate}</span>
            </div>
          )}
          <div className="flex bg-gray-100 p-1 rounded-sm">
            <button 
              onClick={() => setOrderType('local')} 
              className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${orderType === 'local' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Local
            </button>
            <button 
              onClick={() => setOrderType('foreign')} 
              className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${orderType === 'foreign' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Foreign
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customer</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                list="customer-list"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                placeholder="Type or select..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoice Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="date"
                required
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Linked PIs */}
        {selectedCustomer && customerPIs.length > 0 && (
          <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <LinkIcon className="w-3 h-3" /> Link Export Proforma Invoices
            </h3>
            <div className="flex flex-wrap gap-2">
              {customerPIs.map((pi: any) => (
                <button
                  key={pi.id}
                  type="button"
                  onClick={() => handlePIToggle(pi.id)}
                  className={`px-3 py-1.5 rounded-sm text-[10px] font-bold transition-all border ${
                    formData.piIds.includes(pi.id) 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {pi.piNumber}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lines */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Billable Items</h3>
            <button 
              type="button"
              onClick={addLine}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 uppercase transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                <th className="px-4 py-3 text-left">Item Description</th>
                <th className="px-4 py-3 text-right w-24">Qty</th>
                {orderType === 'foreign' ? (
                  <>
                    <th className="px-4 py-3 text-right w-40">Price (USD/BDT)</th>
                    <th className="px-4 py-3 text-right w-40">Total (USD/BDT)</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right w-32">Price (BDT)</th>
                    <th className="px-4 py-3 text-right w-32">Total (BDT)</th>
                  </>
                )}
                <th className="px-4 py-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {formData.lines.map((line, index) => (
                <tr key={index} className={`hover:bg-gray-50/50 group transition-colors ${line.piId ? 'bg-emerald-50/20' : ''}`}>
                  <td className="px-4 py-2">
                    <input 
                      list="product-list"
                      required
                      value={line.itemDescription}
                      onChange={(e) => handleLineChange(index, 'itemDescription', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm focus:ring-0 outline-none text-gray-900 transition-colors"
                      placeholder="Type item name..."
                    />
                    {line.piId && (
                      <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter pl-2">Source: {customerPIs.find((p: any) => p.id === line.piId)?.piNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="number"
                      required min="0.01" step="any"
                      value={line.quantity}
                      onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none transition-colors"
                    />
                  </td>
                  {orderType === 'foreign' ? (
                    <>
                      <td className="px-4 py-2">
                        <div className="flex flex-col items-end">
                          <input 
                            type="number" step="any"
                            value={line.unitPrice}
                            onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1 text-sm text-right font-mono outline-none transition-colors"
                          />
                          <span className="text-[10px] text-gray-400 font-mono pr-2">BDT {formatCurrency(line.unitPrice * companyExchangeRate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex flex-col items-end pr-2 justify-center h-full pt-1.5">
                          <span className="font-mono font-bold text-gray-900">{formatCurrency(line.total)}</span>
                          <span className="text-[10px] text-gray-400 font-mono mt-0.5">BDT {formatCurrency(line.total * companyExchangeRate)}</span>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2">
                        <input 
                          type="number" step="any"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none transition-colors"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(line.total)}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-center">
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

          <div className="flex justify-end p-6 bg-gray-50 border-t border-gray-200">
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Receivable</p>
              {orderType === 'foreign' ? (
                <>
                  <p className="text-2xl font-black text-gray-900 font-mono">USD {formatCurrency(calculateTotal())}</p>
                  <p className="text-sm font-bold text-gray-500 font-mono mt-1">BDT {formatCurrency(calculateTotal() * companyExchangeRate)}</p>
                </>
              ) : (
                <p className="text-2xl font-black text-gray-900 font-mono">BDT {formatCurrency(calculateTotal())}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 bg-gray-900 text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Confirm Sales Invoice
          </button>
        </div>
      </form>
    </div>
  );
}
