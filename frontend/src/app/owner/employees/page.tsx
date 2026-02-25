'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
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
  permissions: { module: string; canCreate: boolean; canView: boolean; canVerify: boolean; canApprove: boolean }[];
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

const MODULES = ['invoices', 'journals', 'customers', 'vendors', 'accounts', 'reports'];

export default function OwnerEmployeesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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
  const [permissions, setPermissions] = useState<{ [key: string]: { canCreate: boolean; canView: boolean; canVerify: boolean; canApprove: boolean } }>({});

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

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/auth/roles');
      return response.data.data as Role[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/owner/employees', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('Employee created successfully');
      closeCreateModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create employee');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await api.put(`/owner/employees/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('Employee updated successfully');
      closeCreateModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update employee');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await api.put(`/owner/employees/${id}/activate`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('Employee status updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ id, permissions: perms }: { id: string; permissions: { module: string; canCreate: boolean; canView: boolean; canVerify: boolean; canApprove: boolean }[] }) => {
      const promises = perms.map((p) =>
        api.put(`/owner/employees/${id}/permissions`, {
          module: p.module,
          canCreate: p.canCreate,
          canView: p.canView,
          canVerify: p.canVerify,
          canApprove: p.canApprove,
        })
      );
      await Promise.all(promises);
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
      toast.success('Employee deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete employee');
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
      
      // Default permissions based on role might be set during role selection
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
    
    // Set default permissions when creating new employee
    if (!isEditing) {
      const roleName = rolesData?.find(r => r.id === roleId)?.name;
      const newPermissions: typeof permissions = {};
      
      MODULES.forEach(module => {
        newPermissions[module] = {
          canView: true, // "Show" is default true
          canCreate: roleName === 'Accountant',
          canVerify: roleName === 'Manager',
          canApprove: false,
        };
      });
      setPermissions(newPermissions);
    }
  };
  const openPermissionsModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    const perms: typeof permissions = {};
    MODULES.forEach((module) => {
      const existing = employee.permissions.find((p) => p.module === module);
      perms[module] = {
        canCreate: existing?.canCreate || false,
        canView: existing?.canView ?? true,
        canVerify: existing?.canVerify || false,
        canApprove: existing?.canApprove || false,
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
      const current = prev[module] || { canView: true, canCreate: false, canVerify: false, canApprove: false };
      let updated = { ...current, [field]: value };
      
      // Dependency Logic:
      // 1. If 'Show' (canView) is deselected, auto-deselect others
      if (field === 'canView' && value === false) {
        updated.canCreate = false;
        updated.canVerify = false;
        updated.canApprove = false;
      }
      
      // 2. If 'Create', 'Verify', or 'Approve' is selected, auto-select 'Show'
      if ((field === 'canCreate' || field === 'canVerify' || field === 'canApprove') && value === true) {
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

  const nonManagerEmployees = employeesData?.filter((e) => e.role !== 'Manager') || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/owner/dashboard" className="text-gray-900 hover:text-blue-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/owner/profile" className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors">
              <User className="w-5 h-5" />
              Profile
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-700 hover:text-red-600 transition-colors">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            <Link href="/owner/dashboard" className="flex items-center gap-2 py-4 border-b-2 border-transparent hover:border-gray-300">
              Dashboard
            </Link>
            <Link href="/owner/companies" className="flex items-center gap-2 py-4 border-b-2 border-transparent hover:border-gray-300">
              Companies
            </Link>
            <Link href="/owner/employees" className="flex items-center gap-2 py-4 border-b-2 border-blue-500 text-blue-600">
              <Users className="w-5 h-5" />
              Employees
            </Link>
            <Link href="/owner/owners" className="flex items-center gap-2 py-4 border-b-2 border-transparent hover:border-gray-300">
              Owners
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">All Employees</h2>
          <button onClick={() => openCreateModal()} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Employee
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Companies</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Manager</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {employeesData?.filter(e => e.role !== 'Owner').map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{employee.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{employee.role}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {employee.companies.map((c) => c.name).join(', ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {employee.manager?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {!employee.isActive && (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-900 border border-red-200 font-medium">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPermissionsModal(employee)}
                          className="p-1 text-purple-600 hover:text-purple-800"
                          title="Permissions"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openManagerModal(employee)}
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="Set Manager"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openCreateModal(employee)}
                          className="p-1 text-yellow-600 hover:text-yellow-800"
                          title="Edit Employee"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
                              deleteMutation.mutate(employee.id);
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employeesData?.length === 0 && (
              <div className="text-center py-8 text-gray-500">No employees found</div>
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Employee' : 'Create Employee'}</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  {rolesData?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Companies *</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
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
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (isEditing ? 'Update Employee' : 'Create Employee')}
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
                  <h4 className="font-medium mb-2 capitalize">{module}</h4>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions[module]?.canView ?? true}
                        onChange={(e) => handlePermissionChange(module, 'canView', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">Show</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions[module]?.canCreate || false}
                        onChange={(e) => handlePermissionChange(module, 'canCreate', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">Create</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions[module]?.canVerify || false}
                        onChange={(e) => handlePermissionChange(module, 'canVerify', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">Verify</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={permissions[module]?.canApprove || false}
                        onChange={(e) => handlePermissionChange(module, 'canApprove', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">Approve</span>
                    </label>
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
                  {employeesData?.filter((emp) => {
                    if (!selectedEmployee) return false;
                    if (emp.id === selectedEmployee.id) return false;

                    // Check shared companies
                    const hasSharedCompany = emp.companies.some(c => 
                      selectedEmployee.companies.some(sc => sc.id === c.id)
                    );
                    if (!hasSharedCompany) return false;

                    const targetRole = selectedEmployee.role;
                    if (targetRole === 'Accountant') {
                      return emp.role === 'Manager' || emp.role === 'Accountant';
                    }
                    if (targetRole === 'Manager') {
                      return emp.role === 'Manager' || emp.role === 'Owner';
                    }
                    
                    // Default behavior for other roles
                    return emp.role === 'Manager' || emp.role === 'Owner';
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
    </div>
  );
}
