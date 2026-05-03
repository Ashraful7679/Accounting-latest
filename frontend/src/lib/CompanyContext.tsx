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
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [baseCurrency, setBaseCurrency] = useState('USD');

  // Load initial state from localStorage to prevent flash of '1' on reset
  useEffect(() => {
    const activeId = localStorage.getItem('active_company_id');
    if (activeId) {
      const cachedRate = localStorage.getItem(`company_rate_${activeId}`);
      const cachedCurrency = localStorage.getItem(`company_currency_${activeId}`);
      if (cachedRate) setExchangeRate(Number(cachedRate));
      if (cachedCurrency) setBaseCurrency(cachedCurrency);
    }
  }, []);

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
      // Even if name is cached, we might want to refresh settings or at least not block the initial fetch if settings are missing
      const cachedRate = localStorage.getItem(`company_rate_${realId}`);
      if (!cachedRate) {
        // Force a fetch if we don't have settings cached
        fetchCompanyDetails(realId);
      } else {
        setIsLoading(false);
      }
    } else if (realId && !['placeholder', '[id]', '%5Bid%5D'].includes(realId)) {
      fetchCompanyDetails(realId);
    } else {
       setIsLoading(false);
    }
  }, [router, params.id, companyId]);

  const fetchCompanyDetails = (id: string) => {
    api.get(`/company/${id}`)
      .then((res: any) => {
        const name = res.data.data.name;
        const rate = res.data.data.settings?.lastUsedRate || 1;
        const currency = res.data.data.baseCurrency || 'USD';
        
        setCompanyName(name);
        setExchangeRate(rate);
        setBaseCurrency(currency);
        
        localStorage.setItem(`company_name_${id}`, name);
        localStorage.setItem(`company_rate_${id}`, rate.toString());
        localStorage.setItem(`company_currency_${id}`, currency);
      })
      .catch(() => setCompanyName('AccaBiz'))
      .finally(() => setIsLoading(false));
  };

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
      localStorage.setItem(`company_rate_${companyId}`, rate.toString());
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
