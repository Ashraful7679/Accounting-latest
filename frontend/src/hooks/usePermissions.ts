'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '@/lib/api';
import { jwtDecode } from 'jwt-decode';

export type PermissionAction = 'create' | 'view' | 'edit' | 'delete' | 'verify' | 'approve' | 'export' | 'print';

interface Permission {
  canCreate: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canVerify: boolean;
  canApprove: boolean;
  canExport: boolean;
  canPrint: boolean;
}

interface JWTToken {
  sub: string;
  id?: string;
  role?: string;
  roles?: string[];
  isAdmin?: boolean;
  companyId?: string;
  exp: number;
}

export interface UsePermissionsResult extends Permission {
  isLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  hasAny: (actions: PermissionAction[]) => boolean;
  hasAll: (actions: PermissionAction[]) => boolean;
}

const FULL_ACCESS: Permission = {
  canCreate: true, canView: true, canEdit: true, canDelete: true,
  canVerify: true, canApprove: true, canExport: true, canPrint: true,
};

const VIEW_ONLY: Permission = {
  canCreate: false, canView: true, canEdit: false, canDelete: false,
  canVerify: false, canApprove: false, canExport: false, canPrint: false,
};

const NO_ACCESS: Permission = {
  canCreate: false, canView: false, canEdit: false, canDelete: false,
  canVerify: false, canApprove: false, canExport: false, canPrint: false,
};

function parseJWT(token: string): JWTToken | null {
  try {
    return jwtDecode<JWTToken>(token);
  } catch {
    return null;
  }
}

function isPrivilegedRole(roles: string[]): boolean {
  return roles.some(r => r === 'Owner' || r === 'Admin' || r === 'OWNER' || r === 'ADMIN');
}

export function usePermissions(
  module: string,
  companyId?: string
): UsePermissionsResult {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const decoded = useMemo(() => parseJWT(token || ''), [token]);

  // Fetch the current user's resolved permissions from the server.
  // The /my-permissions endpoint merges role defaults + user-specific overrides.
  const { data: serverPermissions, isLoading } = useQuery({
    queryKey: ['my-permissions', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await api.get(`/company/${companyId}/my-permissions`);
      // Returns: Record<module, Permission>
      return res.data?.data as Record<string, Permission> | null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const allRoles = useMemo((): string[] => {
    if (!decoded) return [];
    const r: string[] = [];
    if (decoded.role) r.push(decoded.role);
    if (decoded.roles) r.push(...decoded.roles);
    return r;
  }, [decoded]);

  const isOwner = allRoles.some(r => r === 'Owner' || r === 'OWNER');
  const isAdmin = allRoles.some(r => ['Owner', 'Admin', 'OWNER', 'ADMIN'].includes(r)) || !!decoded?.isAdmin;

  const permissions = useMemo((): Permission => {
    if (!decoded) return NO_ACCESS;

    // Full access for privileged JWT roles — no server call needed
    if (isPrivilegedRole(allRoles)) return FULL_ACCESS;

    // Use server-side resolved permissions for this module
    if (serverPermissions && serverPermissions[module]) {
      return serverPermissions[module];
    }

    // Server hasn't responded yet or no data — fall back to safe defaults
    // Accountant/Manager/Controller get view access by default while loading
    const hasElevatedRole = allRoles.some(r =>
      ['Accountant', 'Manager', 'Controller', 'accountant', 'manager', 'controller'].includes(r)
    );
    return hasElevatedRole ? VIEW_ONLY : VIEW_ONLY;
  }, [decoded, module, serverPermissions, allRoles]);

  const hasAny = (actions: PermissionAction[]): boolean => {
    return actions.some(action => {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Permission;
      return permissions[key];
    });
  };

  const hasAll = (actions: PermissionAction[]): boolean => {
    return actions.every(action => {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Permission;
      return permissions[key];
    });
  };

  return {
    ...permissions,
    isLoading,
    isOwner,
    isAdmin,
    hasAny,
    hasAll,
  };
}

export function useCurrentUser() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return useMemo(() => parseJWT(token || ''), [token]);
}