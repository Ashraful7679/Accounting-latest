'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Users, Plus, Trash2, ArrowLeft, LogOut, Key, Shield, Edit, User } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  role: string;
  companies: { id: string; name: string; code: string }[];
  manager: { id: string; name: string } | null;
  permissions: {
    module: string;
    canCreate: boolean; canView: boolean; canEdit: boolean; canDelete: boolean;
    canVerify: boolean; canApprove: boolean; canExport: boolean; canPrint: boolean;
  }[];
}

interface Company {
  id: string;
  name: string;
  code: string;
}

interface Role {
  id: string;
  name: string;
}

  const ROLE_PERMISSIONS_DEFAULTS: Record<string, any> = {
    'User': { canCreate: false, canView: true, canEdit: false, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: false },
    'DataEntry': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: false, canApprove: false, canExport: false, canPrint: true },
    'Accountant': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: true, canApprove: false, canExport: true, canPrint: true },
    'Co-Owner': { canCreate: true, canView: true, canEdit: true, canDelete: true, canVerify: true, canApprove: true, canExport: true, canPrint: true },
    'Manager': { canCreate: true, canView: true, canEdit: true, canDelete: false, canVerify: true, canApprove: true, canExport: true, canPrint: true },
    'Owner': { canCreate: true, canView: true, canEdit: true, canDelete: true, canVerify: true, canApprove: true, canExport: true, canPrint: true },
  };

const MODULES = [
  'sales.orders', 'sales.invoices', 'sales.customers', 'sales.credit-notes', 'sales.challans',
  'purchase.orders', 'purchase.invoices', 'purchase.vendors', 'purchase.debit-notes', 'purchase.grn',
  'finance.journals', 'finance.accounts', 'finance.reports', 'finance.bank-reconciliation', 'finance.fixed-assets',
  'inventory.products', 'inventory.warehouses', 'inventory.transfers',
  'hr.employees', 'hr.payroll', 'company.settings', 'company.branches',
];

export default function OwnerUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [managerId, setManagerId] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleId: '',
    companyIds: [] as string[],
  });
  const [permissions, setPermissions] = useState<{
    [key: string]: {
      canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean;
      canVerify: boolean; canApprove: boolean; canExport: boolean; canPrint: boolean;
    }
  }>({});

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['owner-employees'],
    queryFn: async () => {
      const response = await api.get('/owner/employees');
      return response.data.data as Employee[];
    },
  });

  const { data: companiesData } = useQuery({
    queryKey: ['owner-companies'],
    queryFn: async () => {
      const response = await api.get('/owner/companies');
      return response.data.data as Company[];
    },
  });

  const DEFAULT_ROLES: Role[] = [
    { id: 'role-manager', name: 'Manager' },
    { id: 'role-co-owner', name: 'Co-Owner' },
    { id: 'role-accountant', name: 'Accountant' },
    { id: 'role-data-entry', name: 'DataEntry' },
    { id: 'role-normal-user', name: 'User' },
  ];

  const { data: rolesData, error: rolesError } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        const response = await api.get('/auth/roles');
        const apiRoles = response.data.data as Role[] | undefined;
        const usableRoles = apiRoles?.filter(r => !['admin', 'owner'].includes(r.name.toLowerCase())) || [];
        if (usableRoles.length > 0) return apiRoles;
      } catch (err) {
        console.error('Failed to fetch auth roles:', err);
      }
      if (companiesData && companiesData.length > 0) {
        try {
          const companyId = companiesData[0].id;
          const companyResponse = await api.get(`/company/${companyId}/roles`);
          const companyRoles = companyResponse.data.data as Role[] | undefined;
          const usableCompanyRoles = companyRoles?.filter(r => !['admin', 'owner'].includes(r.name.toLowerCase())) || [];
          if (usableCompanyRoles.length > 0) return companyRoles;
        } catch (err) {
          console.error('Failed to fetch company roles:', err);
        }
      }
      return DEFAULT_ROLES;
    },
    staleTime: 300000,
  });

  useEffect(() => {
    if (rolesError) {
      console.error('Roles fetch error:', rolesError);
    }
  }, [rolesError]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/owner/employees', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('User created successfully');
      closeCreateModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await api.put(`/owner/employees/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('User updated successfully');
      closeCreateModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update user');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await api.put(`/owner/employees/${id}/activate`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('User status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissions: perms }: { id: string; permissions: any[] }) => {
      await api.put(`/owner/employees/${id}/permissions/bulk`, { permissions: perms });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('Permissions updated successfully');
      closePermissionsModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update permissions');
    },
  });

  const setManagerMutation = useMutation({
    mutationFn: async ({ id, managerId }: { id: string; managerId: string | null }) => {
      const response = await api.put(`/owner/employees/${id}/manager`, { managerId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('Manager updated successfully');
      closeManagerModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update manager');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/owner/employees/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete user');
    },
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = user.roles || [];

    if (!token || !roles.includes('Owner')) {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  const openCreateModal = (employee?: Employee) => {
    if (employee) {
      setSelectedEmployee(employee);
      setIsEditing(true);
      setFormData({
        email: employee.email,
        password: '',
        firstName: employee.firstName,
        lastName: employee.lastName,
        roleId: rolesData?.find(r => r.name === employee.role)?.id || '',
        companyIds: employee.companies.map(c => c.id),
      });
    } else {
      setSelectedEmployee(null);
      setIsEditing(false);

      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        roleId: '',
        companyIds: [],
      });
    }
    setShowCreateModal(true);
  };

  const handleRoleChange = (roleId: string) => {
    setFormData({ ...formData, roleId });

    if (!isEditing) {
      const roleName = rolesData?.find(r => r.id === roleId)?.name || 'User';
      const defaults = ROLE_PERMISSIONS_DEFAULTS[roleName] || ROLE_PERMISSIONS_DEFAULTS['User'];

      const newPermissions: typeof permissions = {};

      MODULES.forEach(module => {
        newPermissions[module] = {
          canView: true,
          ...defaults
        };
      });
      setPermissions(newPermissions);
    }
  };

  const openPermissionsModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    const perms: typeof permissions = {};
    MODULES.forEach((module) => {
      const existing = (employee.permissions as any[] || []).find((p) => p.module === module);
      perms[module] = {
        canView: existing?.canView ?? true,
        canCreate: existing?.canCreate || false,
        canEdit: existing?.canEdit || false,
        canDelete: existing?.canDelete || false,
        canVerify: existing?.canVerify || false,
        canApprove: existing?.canApprove || false,
        canExport: existing?.canExport || false,
        canPrint: existing?.canPrint || false,
      };
    });
    setPermissions(perms);
    setShowPermissionsModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedEmployee(null);
    setIsEditing(false);
  };

  const handlePermissionChange = (module: string, field: string, value: boolean) => {
    setPermissions(prev => {
      const current = prev[module] || {
        canView: true, canCreate: false, canEdit: false, canDelete: false,
        canVerify: false, canApprove: false, canExport: false, canPrint: false
      };
      let updated = { ...current, [field]: value };

      if (field === 'canView' && value === false) {
        updated.canCreate = false;
        updated.canEdit = false;
        updated.canDelete = false;
        updated.canVerify = false;
        updated.canApprove = false;
        updated.canExport = false;
        updated.canPrint = false;
      }

      if (field !== 'canView' && value === true) {
        updated.canView = true;
      }

      return { ...prev, [module]: updated };
    });
  };

  const closePermissionsModal = () => {
    setShowPermissionsModal(false);
    setSelectedEmployee(null);
  };

  const openManagerModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setManagerId(employee.manager?.id || '');
    setShowManagerModal(true);
  };

  const closeManagerModal = () => {
    setShowManagerModal(false);
    setSelectedEmployee(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && selectedEmployee) {
      updateMutation.mutate({ id: selectedEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePermissionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee) {
      const perms = Object.entries(permissions).map(([module, p]) => ({
        module,
        ...p,
      }));
      updatePermissionsMutation.mutate({ id: selectedEmployee.id, permissions: perms });
    }
  };

  const handleSetManager = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee) {
      setManagerMutation.mutate({ id: selectedEmployee.id, managerId: managerId || null });
    }
  };

  const nonManagerEmployees = (Array.isArray(employeesData) ? employeesData : [])?.filter((e) => e.role !== 'Manager') || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/owner/dashboard" className="text-gray-900 hover:text-blue-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Users</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/owner/profile" className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-blue-600 transition-colors">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Profile</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-red-600 transition-colors">
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
            <Link href="/owner/dashboard" className="flex items-center gap-1 sm:gap-2 py-3 sm:py-4 border-b-2 border-transparent hover:border-gray-300 whitespace-nowrap text-sm sm:text-base">
              Dashboard
            </Link>
            <Link href="/owner/companies" className="flex items-center gap-1 sm:gap-2 py-3 sm:py-4 border-b-2 border-transparent hover:border-gray-300 whitespace-nowrap text-sm sm:text-base">
              Companies
            </Link>
            <Link href="/owner/users" className="flex items-center gap-1 sm:gap-2 py-3 sm:py-4 border-b-2 border-blue-500 text-blue-600 whitespace-nowrap text-sm sm:text-base">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              Users
            </Link>
            <Link href="/owner/owners" className="flex items-center gap-1 sm:gap-2 py-3 sm:py-4 border-b-2 border-transparent hover:border-gray-300 whitespace-nowrap text-sm sm:text-base">
              Owners
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold">All Users</h2>
          <button onClick={() => openCreateModal()} className="w-full sm:w-auto btn btn-primary flex items-center justify-center gap-2">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add User
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="table-scroll">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Email</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Role</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Companies</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Manager</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(Array.isArray(employeesData) ? employeesData : [])?.filter(e => e.role !== 'Owner').map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">{employee.email}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium">{employee.role}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 max-w-[150px] truncate">
                        {employee.companies.map((c) => c.name).join(', ')}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">{employee.manager?.name || '-'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        {employee.isActive ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-900 font-medium">Active</span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-900 border border-red-200 font-medium">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => openPermissionsModal(employee)}
                            className="p-1.5 text-purple-600 hover:text-purple-800 touch-target"
                            title="Permissions"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openManagerModal(employee)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 touch-target"
                            title="Set Manager"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openCreateModal(employee)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-800 touch-target"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(employee.id);
                            setShowDeleteModal(true);
                          }}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {employeesData?.length === 0 && (
              <div className="text-center py-8 text-gray-500">No users found</div>
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="text-lg sm:text-xl font-semibold">{isEditing ? 'Edit User' : 'Create User'}</h3>
              <button onClick={closeCreateModal} className="p-2 text-gray-400 hover:text-gray-600 touch-target">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isEditing ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  required={!isEditing}
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.roleId}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="input"
                >
                  <option value="">Select Role</option>
                  {(rolesData && rolesData.length > 0 ? rolesData : DEFAULT_ROLES)
                    .filter(r => !['admin', 'owner'].includes(r.name.toLowerCase()))
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Companies *</label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, companyIds: companiesData?.map(c => c.id) || [] })}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, companyIds: [] })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto p-2 border rounded-md bg-gray-50">
                  {companiesData?.map((company) => (
                    <label key={company.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.companyIds.includes(company.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, companyIds: [...formData.companyIds, company.id] });
                          } else {
                            setFormData({
                              ...formData,
                              companyIds: formData.companyIds.filter((id) => id !== company.id),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{company.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeCreateModal} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn btn-primary flex-1">
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (isEditing ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Permissions - {selectedEmployee?.firstName} {selectedEmployee?.lastName}</h3>
            <form onSubmit={handlePermissionsSubmit} className="space-y-4">
              {MODULES.map((module) => (
                <div key={module} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 capitalize flex items-center justify-between">
                    {module.replace('_', ' ').replace('.', ' - ')}
                    <span className="text-xs text-gray-500 font-normal">Module Settings</span>
                  </h4>
                  <div className="grid grid-cols-4 gap-y-3 gap-x-2">
                    {[
                      { key: 'canView', label: 'View' },
                      { key: 'canCreate', label: 'Create' },
                      { key: 'canEdit', label: 'Edit' },
                      { key: 'canDelete', label: 'Delete' },
                      { key: 'canVerify', label: 'Verify' },
                      { key: 'canApprove', label: 'Approve' },
                      { key: 'canExport', label: 'Export' },
                      { key: 'canPrint', label: 'Print' },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={(permissions[module] as any)?.[opt.key] || false}
                          onChange={(e) => handlePermissionChange(module, opt.key, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closePermissionsModal} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={updatePermissionsMutation.isPending} className="btn btn-primary flex-1">
                  {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManagerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Set Manager - {selectedEmployee?.firstName} {selectedEmployee?.lastName}</h3>
            <form onSubmit={handleSetManager} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="input"
                >
                  <option value="">No Manager</option>
                  {(Array.isArray(employeesData) ? employeesData : [])?.filter((emp) => {
                    if (!selectedEmployee) return false;
                    if (emp.id === selectedEmployee.id) return false;

                    const hasSharedCompany = emp.companies.some(c =>
                      selectedEmployee.companies.some(sc => sc.id === c.id)
                    );
                    if (!hasSharedCompany) return false;

                    const targetRole = selectedEmployee.role;
                    if (targetRole === 'Accountant') {
                      return emp.role === 'Manager' || emp.role === 'Accountant' || emp.role === 'Co-Owner';
                    }
                    if (targetRole === 'Manager') {
                      return emp.role === 'Manager' || emp.role === 'Co-Owner' || emp.role === 'Owner';
                    }

                    return emp.role === 'Manager' || emp.role === 'Co-Owner' || emp.role === 'Owner';
                  }).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeManagerModal} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={setManagerMutation.isPending} className="btn btn-primary flex-1">
                  {setManagerMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
      />
    </div>
  );
}