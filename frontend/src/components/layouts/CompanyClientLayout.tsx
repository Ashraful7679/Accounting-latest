'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { CompanyProvider, useCompany } from '@/lib/CompanyContext';

function CompanyLayoutContent({ children }: { children: React.ReactNode }) {
  const { companyId, companyName, role, isLoading } = useCompany();
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .filter(s => s !== 'company' && s !== companyId);
    return segments.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')).join(' / ') || 'Dashboard';
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <Sidebar companyName={companyName || 'Loading...'} role={role} />
      <main className="lg:pl-64 min-h-screen">
        <Header companyId={companyId} breadcrumbs={getBreadcrumbs()} role={role} />
        {children}
      </main>
    </div>
  );
}

export default function CompanyClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <CompanyLayoutContent>{children}</CompanyLayoutContent>
    </CompanyProvider>
  );
}
