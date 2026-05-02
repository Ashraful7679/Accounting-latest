'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import api from '@/lib/api';

export interface Permission {
  module: string;
  canCreate: boolean;
  canView: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPost: boolean;
}

interface CompanyContextType {
  companyId: string;
  companyName: string;
  role: string;
  permissions: Permission[];
  hasPermission: (module: string, action: keyof Permission) => boolean;
  isLoading: boolean;
  exchangeRate: number;
  baseCurrency: string;
  updateExchangeRate: (rate: number) => Promise<void>;
  setExchangeRate: (rate: number) => void;
  setBaseCurrency: (currency: string) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();

  const [companyId, setCompanyId] = useState(params.id as string);
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('User');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [baseCurrency, setBaseCurrency] = useState('USD');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    setRole(roles[0] || 'User');
    
    const storedPerms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    setPermissions(storedPerms);

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

    const cached = localStorage.getItem(`company_name_${realId}`);
    if (cached) {
      setCompanyName(cached);
      setIsLoading(false);
    } else if (realId && !['placeholder', '[id]', '%5Bid%5D'].includes(realId)) {
      api.get(`/company/${realId}`)
        .then((res: any) => {
          const name = res.data.data.name;
          setCompanyName(name);
          setExchangeRate(res.data.data.settings?.lastUsedRate || 1);
          setBaseCurrency(res.data.data.baseCurrency || 'USD');
          localStorage.setItem(`company_name_${realId}`, name);
        })
        .catch(() => setCompanyName('AccaBiz'))
        .finally(() => setIsLoading(false));
    } else {
       setIsLoading(false);
    }
  }, [router, params.id, companyId]);

  const hasPermission = (module: string, action: keyof Permission) => {
    if (role === 'Owner' || role === 'Admin') return true;
    const perm = permissions.find(p => p.module === module);
    if (!perm) return false;
    return !!perm[action];
  };

  const updateExchangeRate = async (rate: number) => {
    try {
      await api.put(`/company/${companyId}/settings`, { lastUsedRate: rate });
      setExchangeRate(rate);
    } catch (error) {
      console.error('Failed to update global exchange rate', error);
      throw error;
    }
  };

  return (
    <CompanyContext.Provider value={{ 
      companyId, companyName, role, permissions, hasPermission, isLoading,
      exchangeRate, baseCurrency, updateExchangeRate, setExchangeRate, setBaseCurrency
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
