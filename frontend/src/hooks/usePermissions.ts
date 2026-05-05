'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

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
  hasAny: (actions: PermissionAction[]) => boolean;
  hasAll: (actions: PermissionAction[]) => boolean;
}

export function usePermissions(
  module: string,
  companyId?: string
): UsePermissionsResult {
  const { data: roleData, isLoading } = useQuery({
    queryKey: ['user-permissions', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const response = await api.get(`/company/${companyId}/roles`);
      return response.data.data;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const userPermissions: Record<string, Permission> = {};
  
  // Aggregate permissions from all roles
  roleData?.forEach((role: { permissions: Record<string, Permission> }) => {
    Object.entries(role.permissions || {}).forEach(([mod, perms]) => {
      if (!userPermissions[mod]) {
        userPermissions[mod] = {
          canCreate: false, canView: false, canEdit: false, canDelete: false,
          canVerify: false, canApprove: false, canExport: false, canPrint: false
        };
      }
      // OR permissions from all roles (any role with permission grants access)
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

  const modulePermissions = userPermissions[module] || {
    canCreate: false, canView: true, canEdit: false, canDelete: false,
    canVerify: false, canApprove: false, canExport: false, canPrint: false
  };

  const hasAny = (actions: PermissionAction[]) => 
    actions.some(action => {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Permission;
      return modulePermissions[key];
    });

  const hasAll = (actions: PermissionAction[]) => 
    actions.every(action => {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof Permission;
      return modulePermissions[key];
    });

  return {
    ...modulePermissions,
    isLoading,
    isOwner: false, // Would come from userCompany.isMainOwner
    hasAny,
    hasAll,
  };
}

// Helper to filter actions based on permissions
export function filterActionsByPermission<T extends { label?: string }>(
  actions: T[],
  permissions: UsePermissionsResult,
  requiredAction: PermissionAction
): T[] {
  if (permissions.isOwner) return actions;
  
  const key = `can${requiredAction.charAt(0).toUpperCase()}${requiredAction.slice(1)}` as keyof UsePermissionsResult;
  const hasPermission = permissions[key];
  return hasPermission ? actions : [];
}