'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';


export default function CreateSalesInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  useEffect(() => {
    // Redirect to main sales invoices page with a query param to open the modal
    router.push(`/company/${companyId}/sales/invoices?action=create`);
  }, [companyId, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Initializing Billing System...</p>
      </div>
    </div>
  );
}
