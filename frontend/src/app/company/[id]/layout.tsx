'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import api from '@/lib/api';

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const companyId = params.id as string;

  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('User');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setRole(roles[0] || 'User');

    // Try to get company name from localStorage cache
    const cached = localStorage.getItem(`company_name_${companyId}`);
    if (cached) {
      setCompanyName(cached);
    } else {
      // Fetch if not cached
      api.get(`/company/${companyId}`)
        .then((res: any) => {
          const name = res.data.data.name;
          setCompanyName(name);
          localStorage.setItem(`company_name_${companyId}`, name);
        })
        .catch(() => setCompanyName('Accounting Pro'));
    }
  }, [router, companyId]);

  // Derive breadcrumbs from pathname
  const getBreadcrumbs = () => {
    const segments = pathname
      .split('/')
      .filter(Boolean)
      .filter(s => s !== 'company' && s !== companyId);
    return segments.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')).join(' / ') || 'Dashboard';
  };

  if (!mounted) return null;

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
