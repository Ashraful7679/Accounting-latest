'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { FileText, ShoppingCart, Truck, Receipt, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DocNode {
  type: string;
  number: string;
  date?: string;
  status: string;
  amount?: number;
  id: string;
}

interface DocumentFlowProps {
  companyId: string;
  type: 'sales' | 'purchase';
  entityType: string;
  entityId: string;
  maxItems?: number;
}

const DOC_CONFIG = {
  sales: [
    { key: 'SALES_ORDER', label: 'SO', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'DELIVERY_CHALLAN', label: 'DC', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { key: 'INVOICE', label: 'Invoice', icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'PAYMENT', label: 'Paid', icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
  ],
  purchase: [
    { key: 'PURCHASE_ORDER', label: 'PO', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { key: 'GRN', label: 'GRN', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { key: 'PURCHASE_INVOICE', label: 'PI', icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'PAYMENT', label: 'Paid', icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
  ],
};

export function DocumentFlow({ companyId, type, entityType, entityId, maxItems = 4 }: DocumentFlowProps) {
  const pathType = type === 'sales' ? 'sales' : 'purchase';
  
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['document-flow', type, entityId],
    queryFn: async () => {
      const res = await api.get(`/company/${companyId}/document-flow/${pathType}/${entityType}/${entityId}`);
      return (res.data.data || []) as DocNode[];
    },
    enabled: !!entityId && !!companyId,
  });

  const config = DOC_CONFIG[type];
  
  const getDoc = (key: string) => docs.find(d => d.type === key);
  
  const routes: Record<string, string> = {
    SALES_ORDER: '/sales/orders',
    DELIVERY_CHALLAN: '/sales/challans',
    INVOICE: '/sales/invoices',
    PURCHASE_ORDER: '/purchase/orders',
    GRN: '/purchase/grns',
    PURCHASE_INVOICE: '/purchase/invoices',
  };

  const getHref = (key: string, id: string) => {
    const base = routes[key];
    return base ? `/company/${companyId}${base}/${id}` : undefined;
  };

  const isDone = (key: string) => {
    const doc = getDoc(key);
    return doc && ['APPROVED', 'COMPLETED', 'PAID'].includes(doc.status);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-16 h-14 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (docs.length === 0) return null;

  const totalValue = docs.reduce((s, d) => s + (d.amount || 0), 0);
  const doneCount = docs.filter(d => ['APPROVED', 'PAID'].includes(d.status)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-gray-500 uppercase">Document Flow</span>
        <span className="text-gray-400">
          {doneCount}/{docs.length} complete
        </span>
      </div>
      
      <div className="flex items-center gap-1 overflow-x-auto">
        {config.slice(0, maxItems).map((item, idx) => {
          const doc = getDoc(item.key);
          const done = isDone(item.key);
          
          return (
            <div key={item.key} className="flex items-center">
              <div className={`flex flex-col items-center min-w-[50px] ${done ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  done ? `${item.bg} ${item.color}` : 'bg-gray-100 text-gray-300'
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <item.icon className="w-4 h-4" />}
                </div>
                <span className={`text-[9px] font-bold mt-1 ${done ? 'text-gray-600' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {doc && (
                  doc.id ? (
                    <Link 
                      href={getHref(item.key, doc.id) || '#'}
                      className="text-[8px] font-bold text-blue-600 hover:underline truncate max-w-[60px]"
                    >
                      {doc.number}
                    </Link>
                  ) : (
                    <span className="text-[8px] text-gray-500">{doc.number}</span>
                  )
                )}
              </div>
              {idx < config.length - 1 && idx < maxItems - 1 && (
                <ArrowRight className={`w-3 h-3 mx-0.5 ${done ? 'text-gray-300' : 'text-gray-100'}`} />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-3 text-[10px] text-gray-500 pt-1 border-t border-gray-100">
        <span>Total: <b className="text-gray-700">৳{totalValue.toLocaleString()}</b></span>
        <span>Pending: <b className="text-yellow-600">{docs.length - doneCount}</b></span>
      </div>
    </div>
  );
}