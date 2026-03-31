'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import api from '@/lib/api';

export default function CompanyClientLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  // .htaccess rewrites real company UUIDs to 'placeholder'; read real ID from browser URL
  const [companyId, setCompanyId] = useState(params.id as string);

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

    // Extract real company UUID from browser URL (bypasses .htaccess rewrite to 'placeholder')
    const match = window.location.pathname.match(/\/company\/([^/]+)/);
    let realId = params.id as string;
    
    if (match && match[1] && !['placeholder', '[id]', '%5Bid%5D'].includes(match[1])) {
      realId = match[1];
      localStorage.setItem('active_company_id', realId);
    } else {
      const active = localStorage.getItem('active_company_id');
      if (active) realId = active;
    }
    
    if (realId !== companyId && !['placeholder', '[id]', '%5Bid%5D'].includes(realId)) {
      setCompanyId(realId);
    }

    // Try to get company name from localStorage cache
    const cached = localStorage.getItem(`company_name_${realId}`);
    if (cached) {
      setCompanyName(cached);
    } else {
      // Fetch if not cached
      api.get(`/company/${realId}`)
        .then((res: any) => {
          const name = res.data.data.name;
          setCompanyName(name);
          localStorage.setItem(`company_name_${realId}`, name);
        })
        .catch(() => setCompanyName('AccaBiz'));
    }
  }, [router]);

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
