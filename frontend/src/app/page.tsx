'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const roles = user.roles || [];
      
      // Priority: Admin > Owner > Company User
      if (roles.includes('Admin')) {
        router.push('/admin/dashboard');
      } else if (roles.includes('Owner')) {
        router.push('/owner/dashboard');
      } else if (user.userCompanies && user.userCompanies.length > 0) {
        // Company user - redirect to their default or first company
        const defaultCompany = user.userCompanies.find((uc: any) => uc.isDefault) || user.userCompanies[0];
        router.push(`/company/${defaultCompany.companyId}/dashboard`);
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) return null;

  return null;
}