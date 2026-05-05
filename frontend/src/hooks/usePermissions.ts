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
  role?: string;
  roles?: string[];
  permissions?: Record<string, Permission>;
  companyId?: string;
  exp: number;
}

export interface UsePermissionsResult {
  canCreate: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canVerify: boolean;
  canApprove: boolean;
  canExport: boolean;
  canPrint: boolean;
  isLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  hasAny: (actions: PermissionAction[]) => boolean;
  hasAll: (actions: PermissionAction[]) => boolean;
}

function parseJWT(token: string): JWTToken | null {
  try {
    return jwtDecode<JWTToken>(token);
  } catch {
    return null;
  }
}

export function usePermissions(
  module: string,
  companyId?: string
): UsePermissionsResult {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const decoded = useMemo(() => parseJWT(token || ''), [token]);
  
  const { data: roleData, isLoading } = useQuery({
    queryKey: ['user-permissions', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const response = await api.get(`/company/${companyId}/roles`);
      return response.data.data;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const permissions = useMemo(() => {
    if (!decoded) {
      return {
        canCreate: false, canView: false, canEdit: false, canDelete: false,
        canVerify: false, canApprove: false, canExport: false, canPrint: false
      };
    }

    if (decoded.permissions && decoded.permissions[module]) {
      return decoded.permissions[module];
    }

    if (decoded.role === 'OWNER' || decoded.role === 'ADMIN') {
      return {
        canCreate: true, canView: true, canEdit: true, canDelete: true,
        canVerify: true, canApprove: true, canExport: true, canPrint: true
      };
    }

    if (decoded.roles?.includes('OWNER') || decoded.roles?.includes('ADMIN')) {
      return {
        canCreate: true, canView: true, canEdit: true, canDelete: true,
        canVerify: true, canApprove: true, canExport: true, canPrint: true
      };
    }

    return {
      canCreate: false, canView: true, canEdit: false, canDelete: false,
      canVerify: false, canApprove: false, canExport: false, canPrint: false
    };
  }, [decoded, module]);

  useMemo(() => {
    if (!roleData) return;

    const userPermissions: Record<string, Permission> = {};
    
    roleData?.forEach((role: { permissions: Record<string, Permission> }) => {
      Object.entries(role.permissions || {}).forEach(([mod, perms]) => {
        if (!userPermissions[mod]) {
          userPermissions[mod] = {
            canCreate: false, canView: false, canEdit: false, canDelete: false,
            canVerify: false, canApprove: false, canExport: false, canPrint: false
          };
        }
        userPermissions[mod].canCreate ||= perms.canCreate;
        userPermissions[mod].canView ||= perms.canView;
        userPermissions[mod].canEdit ||= perms.canEdit;
        userPermissions[mod].canDelete ||= perms.canDelete;
        userPermissions[mod].canVerify ||= perms.canVerify;
        userPermissions[mod].canApprove ||= perms.canApprove;
        userPermissions[mod].canExport ||= perms.canExport;
        userPermissions[mod].canPrint ||= perms.canPrint;
      });
    });

    const modulePermissions = userPermissions[module];
    if (modulePermissions) {
      Object.assign(permissions, modulePermissions);
    }
  }, [roleData, module]);

  const hasAny = (actions: PermissionAction[]) => {
    return actions.some(action => {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Permission;
      return (permissions as any)[key];
    });
  };

  const hasAll = (actions: PermissionAction[]) => {
    return actions.every(action => {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Permission;
      return (permissions as any)[key];
    });
  };

  const isOwner = decoded?.role === 'OWNER' || decoded?.roles?.includes('OWNER') || false;
  const isAdmin = decoded?.role === 'OWNER' || decoded?.role === 'ADMIN' || decoded?.roles?.includes('OWNER') || decoded?.roles?.includes('ADMIN') || false;

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
  const decoded = useMemo(() => parseJWT(token || ''), [token]);
  
  return decoded;
}