'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Plus, Trash2, ArrowLeft, Save, 
  User, Calendar, Receipt, Loader2, Link as LinkIcon,
  TrendingUp, Truck, ShoppingCart, ShieldAlert, RotateCcw, MapPin, Globe
} from 'lucide-react';
import DocumentTreeView from '@/components/DocumentTreeView';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/decimalUtils';
import { useCompany } from '@/lib/CompanyContext';
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export default function CreateSalesInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('sales.invoices', companyId);
  const queryClient = useQueryClient();
  const { exchangeRate: companyExchangeRate, multiBranchEnabled, defaultBranchId } = useCompany();
  const [mounted, setMounted] = useState(false);

  const initialType = searchParams.get('type') === 'foreign' ? 'foreign' : 'local';
  const [orderType, setOrderType] = useState<'local'|'foreign'>(initialType);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingEntities, setPendingEntities] = useState<{customers: string[], products: string[]}>({ customers: [], products: [] });

  const [formData, setFormData] = useState({
    customerName: '',
    branchId: defaultBranchId || '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    soIds: [] as string[],
    piIds: [] as string[],
    dnIds: [] as string[],
    otherExpenses: 0,
    taxAmount: 0,
    discountAmount: 0,
    lines: [{ itemDescription: '', quantity: 1, unitPrice: 0, total: 0, piId: '', dnId: '', soId: '', returnQuantity: 0, damagedQuantity: 0 }] as any[]
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

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/sales-orders`);
      const result = response.data.data;
      return (Array.isArray(result) ? result : (result?.data || []));
    },
    enabled: !!companyId,
  });

  const { data: challans } = useQuery({
    queryKey: ['delivery-notes', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/challans`);
      const result = response.data.data;
      return Array.isArray(result) ? result : (result?.data || []);
    },
    enabled: !!companyId,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches', companyId],
    queryFn: async () => {
      const response = await api.get(`/company/${companyId}/branches`);
      return response.data.data;
    },
    enabled: !!companyId && multiBranchEnabled,
  });

  useEffect(() => {
    if (mounted && challans && searchParams.get('dnIds')) {
      const dnIds = searchParams.get('dnIds')?.split(',') || [];
      const customerId = searchParams.get('customerId');
      
      if (customerId) {
        const customer = (Array.isArray(customers) ? customers : []).find((c: any) => c.id === customerId);
        if (customer) {
          setFormData(prev => ({ ...prev, customerName: customer.name }));
        }
      }

      dnIds.forEach(id => {
        if (!formData.dnIds.includes(id)) {
          handleDNToggle(id);
        }
      });
    }
  }, [mounted, challans, searchParams, customers]);

  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter((c: any) => 
    orderType === 'local' ? c.type === 'Local' || !c.type : c.type === 'Foreign'
  );

  const selectedCustomer = (Array.isArray(customers) ? customers : []).find((c: any) => c.name === formData.customerName);
  const customerPIs = (Array.isArray(exportPIs) ? exportPIs : []).filter((pi: any) => pi.customerId === selectedCustomer?.id && (pi.status === 'SENT' || pi.status === 'APPROVED' || pi.status === 'PARTIAL')) || [];
  const customerSOs = (Array.isArray(salesOrders) ? salesOrders : []).filter((so: any) => so.customerId === selectedCustomer?.id && (so.status === 'CONFIRMED' || so.status === 'FULFILLED')) || [];
  const customerDNs = (Array.isArray(challans) ? challans : []).filter((d: any) => d.salesOrder?.customerId === selectedCustomer?.id) || [];

  const selectedSOs = formData.soIds.map(id => customerSOs.find((so: any) => so.id === id)).filter(Boolean);
  const selectedPIs = formData.piIds.map(id => customerPIs.find((pi: any) => pi.id === id)).filter(Boolean);
  const selectedDNs = formData.dnIds.map(id => customerDNs.find((dn: any) => dn.id === id)).filter(Boolean);
  const treeGroups = [
    { label: 'Sales Orders', icon: ShoppingCart, documents: selectedSOs.map((so: any) => ({ id: so.id, number: so.soNumber, status: so.status, date: so.soDate, amount: so.totalAmount, currency: so.currency, href: `/company/${companyId}/sales/orders/${so.id}` })) },
    { label: 'Proforma Invoices', icon: Globe, documents: selectedPIs.map((pi: any) => ({ id: pi.id, number: pi.piNumber, status: pi.status, date: pi.piDate, amount: pi.amount, currency: pi.currency, href: `/company/${companyId}/sales/pis/${pi.id}` })) },
    { label: 'Delivery Notes', icon: Truck, documents: selectedDNs.map((dn: any) => ({ id: dn.id, number: dn.dnNumber, status: dn.status, date: dn.shipmentDate, href: `/company/${companyId}/sales/challans/${dn.id}` })) },
  ];

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };

    if (field === 'itemDescription') {
      const existingProduct = (Array.isArray(products) ? products : []).find((p: any) => p.name === value);
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
      lines: [...formData.lines, { itemDescription: '', quantity: 1, unitPrice: 0, total: 0, piId: '', soId: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length === 1) return;
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData({ ...formData, lines: newLines });
  };

  const handleSOToggle = (soId: string) => {
    const currentSOs = [...formData.soIds];
    const soIndex = currentSOs.indexOf(soId);
    if (soIndex > -1) {
      currentSOs.splice(soIndex, 1);
      setFormData({ ...formData, soIds: currentSOs });
    } else {
      currentSOs.push(soId);
      const so = (Array.isArray(salesOrders) ? salesOrders : []).find((s: any) => s.id === soId);
      if (so && so.lines) {
        const newLinesFromSO = so.lines.map((l: any) => ({
          productId: l.productId,
          itemDescription: l.itemDescription || l.description,
          quantity: l.quantity - (l.deliveredQuantity || 0),
          unitPrice: l.unitPrice,
          total: (l.quantity - (l.deliveredQuantity || 0)) * l.unitPrice,
          soId: so.id,
          returnQuantity: 0,
          damagedQuantity: 0,
        })).filter((l: any) => l.quantity > 0);
        setFormData({
          ...formData,
          soIds: currentSOs,
          lines: [...formData.lines.filter(l => l.itemDescription !== ''), ...newLinesFromSO]
        });
      }
    }
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
      const pi = (Array.isArray(customerPIs) ? customerPIs : []).find((p: any) => p.id === piId);
      if (pi && pi.lines) {
        const newLinesFromPI = pi.lines.map((l: any) => ({
          productId: l.productId,
          itemDescription: l.description || l.itemDescription,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.quantity * l.unitPrice,
          piId: pi.id,
          returnQuantity: 0,
          damagedQuantity: 0
        }));
        
        setFormData({
          ...formData,
          piIds: currentPIs,
          lines: [...formData.lines.filter(l => l.itemDescription !== ''), ...newLinesFromPI]
        });
      }
    }
  };

  const handleDNToggle = (dnId: string) => {
    const currentDNs = [...formData.dnIds];
    const dnIndex = currentDNs.indexOf(dnId);
    
    if (dnIndex > -1) {
      currentDNs.splice(dnIndex, 1);
      setFormData({
        ...formData,
        dnIds: currentDNs,
        lines: formData.lines.filter(l => l.dnId !== dnId)
      });
    } else {
      currentDNs.push(dnId);
      const dn = (Array.isArray(challans) ? challans : []).find((d: any) => d.id === dnId);
      if (dn && dn.lines) {
        const newLinesFromDN = dn.lines.map((l: any) => ({
          productId: l.productId,
          itemDescription: l.itemDescription || l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice || 0,
          total: l.quantity * (l.unitPrice || 0),
          dnId: dn.id,
          returnQuantity: 0,
          damagedQuantity: 0
        }));
        
        setFormData({
          ...formData,
          dnIds: currentDNs,
          lines: [...formData.lines.filter(l => l.itemDescription !== ''), ...newLinesFromDN]
        });
      }
    }
  };

  const calculateTotal = () => {
    const subtotal = formData.lines.reduce((sum, line) => {
      const netQty = line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0);
      return sum + (netQty * line.unitPrice);
    }, 0);
    return subtotal + (Number(formData.taxAmount) || 0) + (Number(formData.otherExpenses) || 0) - (Number(formData.discountAmount) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) { toast.error('Please select a customer'); return; }
    if (formData.lines.length === 0 || formData.lines.some(l => !l.itemDescription || l.quantity <= 0)) {
      toast.error('Please complete all item lines'); return;
    }

    // Check for new entities
    const newCustomers = !selectedCustomer ? [formData.customerName] : [];
    const newProducts = formData.lines
      .filter(l => !l.productId && !(Array.isArray(products) ? products : []).find((p: any) => p.name === l.itemDescription))
      .map(l => l.itemDescription);
    
    // De-duplicate new products
    const uniqueNewProducts = Array.from(new Set(newProducts));

    if (newCustomers.length > 0 || uniqueNewProducts.length > 0) {
      setPendingEntities({ customers: newCustomers, products: uniqueNewProducts });
      setShowConfirmModal(true);
      return;
    }

    proceedWithSubmission();
  };

  const proceedWithSubmission = async () => {
    setIsSaving(true);
    setShowConfirmModal(false);
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
          const existingProduct = (Array.isArray(products) ? products : []).find((p: any) => p.name === line.itemDescription);
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
          piId: line.piId || undefined,
          dnId: line.dnId || undefined,
          returnQuantity: line.returnQuantity || 0,
          damagedQuantity: line.damagedQuantity || 0
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
        branchId: formData.branchId || undefined,
        lines: finalLines,
        salesOrderId: formData.soIds[0] || undefined,
        piIds: formData.piIds,
        dnIds: formData.dnIds,
        taxAmount: Number(formData.taxAmount) || 0,
        otherExpenses: Number(formData.otherExpenses) || 0,
        discountAmount: Number(formData.discountAmount) || 0,
        totalAmount: total,
        totalBDT: orderType === 'local' ? total : total * companyExchangeRate
      };

      await api.post(`/company/${companyId}/invoices?type=sales`, payload);
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', companyId] });
      toast.success('Sales Invoice created successfully');
      router.push(`/company/${companyId}/sales/invoices`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
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
        {(Array.isArray(filteredCustomers) ? filteredCustomers : []).map((c: any) => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="product-list">
        {(Array.isArray(products) ? products : []).filter((p:any) => p.type === 'Sales' || !p.type).map((p: any) => <option key={p.id} value={p.name} />)}
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

          {multiBranchEnabled && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Branch</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <select 
                  required
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors appearance-none bg-white"
                >
                  <option value="">Select Branch...</option>
                  {(Array.isArray(branches) ? branches : []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} {b.isMain ? '(Main)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

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

        {/* Linked Documents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {selectedCustomer && customerSOs.length > 0 && (
            <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShoppingCart className="w-3 h-3" /> Link Sales Orders
              </h3>
              <div className="flex flex-wrap gap-2">
                {customerSOs.map((so: any) => (
                  <button key={so.id} type="button" onClick={() => handleSOToggle(so.id)}
                    className={`px-3 py-1.5 rounded-sm text-[10px] font-bold transition-all border ${
                      formData.soIds.includes(so.id) ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'
                    }`}
                  >{so.soNumber}</button>
                ))}
              </div>
            </div>
          )}

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

          {selectedCustomer && customerDNs.length > 0 && (
            <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Truck className="w-3 h-3" /> Link Delivery Notes
              </h3>
              <div className="flex flex-wrap gap-2">
                  {customerDNs.map((dn: any) => (
                  <button
                    key={dn.id}
                    type="button"
                    onClick={() => handleDNToggle(dn.id)}
                    className={`px-3 py-1.5 rounded-sm text-[10px] font-bold transition-all border ${
                      formData.dnIds.includes(dn.id) 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                      : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {dn.dnNumber}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tree View Summary */}
        <DocumentTreeView groups={treeGroups} title="Selected Documents" />

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
                <th className="px-4 py-3 text-right w-20">Ordered</th>
                <th className="px-4 py-3 text-right w-20">Return</th>
                <th className="px-4 py-3 text-right w-20">Damage</th>
                <th className="px-4 py-3 text-right w-24">Net Qty</th>
                {orderType === 'foreign' ? (
                  <>
                    <th className="px-4 py-3 text-right w-40">Price (USD)</th>
                    <th className="px-4 py-3 text-right w-40">Total (USD)</th>
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
                      <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter pl-2">Source: {(Array.isArray(customerPIs) ? customerPIs : []).find((p: any) => p.id === line.piId)?.piNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="number"
                      required min="0.01" step="any"
                      value={line.quantity || ''}
                      onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="number"
                      min="0" step="any"
                      value={line.returnQuantity || ''}
                      onChange={(e) => handleLineChange(index, 'returnQuantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none text-orange-600 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="number"
                      min="0" step="any"
                      value={line.damagedQuantity || ''}
                      onChange={(e) => handleLineChange(index, 'damagedQuantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none text-red-600 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">
                    {formatCurrency(line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0))}
                  </td>
                  {orderType === 'foreign' ? (
                    <>
                      <td className="px-4 py-2">
                        <div className="flex flex-col items-end">
                          <input 
                            type="number" step="any"
                            value={line.unitPrice || ''}
                            onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1 text-sm text-right font-mono outline-none transition-colors"
                          />
                          <span className="text-[10px] text-gray-400 font-mono pr-2">BDT {formatCurrency(line.unitPrice * companyExchangeRate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex flex-col items-end pr-2 justify-center h-full pt-1.5">
                          <span className="font-mono font-bold text-gray-900">{formatCurrency((line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)) * line.unitPrice)}</span>
                          <span className="text-[10px] text-gray-400 font-mono mt-0.5">BDT {formatCurrency((line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)) * line.unitPrice * companyExchangeRate)}</span>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2">
                        <input 
                          type="number" step="any"
                          value={line.unitPrice || ''}
                          onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-500 rounded-sm px-2 py-1.5 text-sm text-right font-mono outline-none transition-colors"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">
                        {formatCurrency((line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)) * line.unitPrice)}
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

          <div className="grid grid-cols-1 md:grid-cols-2 p-6 bg-gray-50 border-t border-gray-200">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tax Amount</label>
                  <input 
                    type="number"
                    value={formData.taxAmount || ''}
                    onChange={(e) => setFormData({ ...formData, taxAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-sm text-xs font-mono outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Other Expenses</label>
                  <input 
                    type="number"
                    value={formData.otherExpenses || ''}
                    onChange={(e) => setFormData({ ...formData, otherExpenses: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-sm text-xs font-mono outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Discount</label>
                <input 
                  type="number"
                  value={formData.discountAmount || ''}
                  onChange={(e) => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-sm text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="text-right flex flex-col justify-end">
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

      {/* Confirmation Modal for New Entities */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-md border border-gray-200 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
              <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">New Records Detected</h3>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-[10px] font-bold text-gray-500 uppercase leading-relaxed tracking-widest">
                The following entities do not exist in the system. Would you like to create them and proceed with the invoice?
              </p>
              
              {pendingEntities.customers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">New Customer</label>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-sm font-bold text-xs text-emerald-900">
                    {pendingEntities.customers[0]}
                  </div>
                </div>
              )}

              {pendingEntities.products.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">New Products ({pendingEntities.products.length})</label>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                    {pendingEntities.products.map((p, i) => (
                      <div key={i} className="p-2 bg-indigo-50 border border-indigo-100 rounded-sm font-bold text-[10px] text-indigo-900 uppercase">
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm"
                >
                  Edit Invoice
                </button>
                <button 
                  onClick={proceedWithSubmission}
                  className="flex-1 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl shadow-gray-200 hover:bg-black transition-all"
                >
                  Create & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
