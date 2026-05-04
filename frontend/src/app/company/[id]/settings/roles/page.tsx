'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Shield, Users, Plus, X, Check, Settings, Loader2 } from 'lucide-react';

const MODULES = [
  { key: 'sales.orders', label: 'Sales Orders' },
  { key: 'sales.invoices', label: 'Sales Invoices' },
  { key: 'sales.customers', label: 'Customers' },
  { key: 'purchase.orders', label: 'Purchase Orders' },
  { key: 'purchase.invoices', label: 'Purchase Invoices' },
  { key: 'purchase.vendors', label: 'Vendors' },
  { key: 'finance.journals', label: 'Journals' },
  { key: 'finance.accounts', label: 'Chart of Accounts' },
  { key: 'finance.reports', label: 'Reports' },
  { key: 'inventory.warehouses', label: 'Warehouses' },
  { key: 'inventory.transfers', label: 'Stock Transfers' },
  { key: 'products', label: 'Products' },
  { key: 'hr.employees', label: 'Employees' },
  { key: 'hr.payroll', label: 'Payroll' },
];

const PERMISSIONS = [
  { key: 'canCreate', label: 'Create' },
  { key: 'canView', label: 'View' },
  { key: 'canEdit', label: 'Edit' },
  { key: 'canDelete', label: 'Delete' },
  { key: 'canVerify', label: 'Verify' },
  { key: 'canApprove', label: 'Approve' },
  { key: 'canExport', label: 'Export' },
  { key: 'canPrint', label: 'Print' },
];

interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Record<string, any>;
}

export default function RolesPage() {
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => api.get(`/company/${companyId}/roles`).then(r => r.data.data),
    enabled: !!companyId,
  });

  const updatePermissionMutation = useMutation({
    mutationFn: ({ roleId, module, permission, value }: { roleId: string; module: string; permission: string; value: boolean }) =>
      api.put(`/company/${companyId}/roles/${roleId}/permissions`, { module, permission, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
    },
  });

  const handleTogglePermission = (module: string, permission: string) => {
    if (!selectedRole) return;
    updatePermissionMutation.mutate({
      roleId: selectedRole.id,
      module,
      permission,
      value: !(selectedRole as any).permissions?.[module]?.[permission]
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">Role Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role List */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-bold text-sm">Roles</h2>
          </div>
          <div className="divide-y">
            {roles.map((role: Role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                  selectedRole?.id === role.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{role.name}</span>
                  {role.isSystem && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">System</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{role.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm">
          {selectedRole ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-bold">{selectedRole.name}</h2>
                  <p className="text-xs text-gray-500">{selectedRole.description}</p>
                </div>
                {selectedRole.isSystem && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">System Role</span>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Module</th>
                      {PERMISSIONS.map(perm => (
                        <th key={perm.key} className="px-2 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                          {perm.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {MODULES.map(module => {
                      const modulePerms = (selectedRole as any).permissions?.[module.key] || {};
                      return (
                        <tr key={module.key} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium">{module.label}</td>
                          {PERMISSIONS.map(perm => (
                            <td key={perm.key} className="px-2 py-3 text-center">
                              <button
                                onClick={() => !selectedRole.isSystem && handleTogglePermission(module.key, perm.key)}
                                disabled={selectedRole.isSystem}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                  modulePerms[perm.key]
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-300'
                                } ${!selectedRole.isSystem ? 'hover:bg-blue-600 cursor-pointer' : ''}`}
                              >
                                {modulePerms[perm.key] && <Check className="w-4 h-4" />}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a role to view and edit permissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}