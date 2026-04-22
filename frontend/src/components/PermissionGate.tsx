'use client';

import React from 'react';
import { useCompany, Permission } from '@/lib/CompanyContext';

interface PermissionGateProps {
  module: string;
  action: keyof Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const { hasPermission, isLoading } = useCompany();

  if (isLoading) return null; // or a skeleton

  if (!hasPermission(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
