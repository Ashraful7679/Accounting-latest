'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import { Building2, Users, LogOut, Settings, ChevronRight, User } from 'lucide-react';

interface Company {
  id: string;
  code: string;
  name: string;
  logoUrl: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  isActive: boolean;
  isDefault: boolean;
  ownersCount?: number;
  employeesCount?: number;
}

export default function OwnerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ companies: 0, employees: 0 });
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [companyFinancials, setCompanyFinancials] = useState<Record<string, any>>({});
  const [loadingOverview, setLoadingOverview] = useState<string | null>(null);

  const { data: companiesData, isLoading } = useQuery({
    queryKey: ['owner-companies'],
    queryFn: async () => {
      const response = await api.get('/owner/companies');
      return response.data.data as Company[];
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ['owner-employees'],
    queryFn: async () => {
      const response = await api.get('/owner/employees');
      return response.data.data;
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const form = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) form.append(key, value as string);
      });
      if (logoFile) {
        form.append('logo', logoFile);
      }
      const response = await api.post('/owner/companies', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-companies'] });
      queryClient.invalidateQueries({ queryKey: ['owner-employees'] });
      toast.success('Company created successfully');
      setFormData({
        name: '',
        code: '',
        address: '',
        city: '',
        country: '',
        phone: '',
        email: '',
        website: '',
      });
      setLogoFile(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create company');
    },
    onSettled: () => {
      setShowCreateModal(false);
    }
  });

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    createCompanyMutation.mutate(formData);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = storedUser.roles || [];

    if (!token || !roles.includes('Owner')) {
      router.push('/login');
    } else {
      setUser(storedUser);
      setMounted(true);
      // Ensure all modal/blocking states are reset on mount
      setShowCreateModal(false);
    }
  }, [router]);

  useEffect(() => {
    if (companiesData) {
      companiesData.forEach(company => {
        if (!companyFinancials[company.id]) {
          fetchFinancialStats(company.id);
        }
      });
    }
  }, [companiesData]);

  const fetchFinancialStats = async (companyId: string) => {
    if (loadingOverview === companyId) return;

    setLoadingOverview(companyId);
    try {
      const response = await api.get(`/company/${companyId}/dashboard-stats`);
      setCompanyFinancials(prev => ({
        ...prev,
        [companyId]: response.data.data.accountingEquation
      }));
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoadingOverview(null);
    }
  };

  if (!mounted || !user) return null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-900 font-semibold">
              Welcome, {user.firstName} {user.lastName}
            </span>
            <div className="h-6 w-px bg-gray-200"></div>
            <Link href="/owner/profile" className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors font-medium">
              <User className="w-5 h-5" />
              Profile
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-900 hover:text-red-600 transition-colors font-medium">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            <Link href="/owner/dashboard" className="flex items-center gap-2 py-4 border-b-2 border-blue-500 text-blue-600 font-semibold">
              Dashboard
            </Link>
            <Link href="/owner/companies" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-gray-900 hover:border-gray-300 font-medium">
              <Building2 className="w-5 h-5" />
              Companies
            </Link>
            <Link href="/owner/employees" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-gray-900 hover:border-gray-300 font-medium">
              <Users className="w-5 h-5" />
              Employees
            </Link>
            <Link href="/owner/owners" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-gray-900 hover:border-gray-300 font-medium">
              <Settings className="w-5 h-5" />
              Owners
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Dashboard Overview</h2>
          <button 
             onClick={() => setShowCreateModal(true)}
             className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Create New Company
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-700">My Companies</p>
                <p className="text-2xl font-bold">{stats.companies}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-700">Employees</p>
                <p className="text-2xl font-bold">{stats.employees}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-700">Active Companies</p>
                <p className="text-2xl font-bold">
                  {companiesData?.filter((c) => c.isActive).length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">My Companies</h2>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companiesData?.map((company) => (
                <div
                  key={company.id}
                  className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {company.logoUrl ? (
                          <img src={`${BASE_URL}${company.logoUrl}`} alt={company.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {company.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 leading-tight">{company.name}</h3>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{company.code}</p>
                        </div>
                      </div>
                    </div>
                    {!company.isActive && (
                      <span className="px-2 py-0.5 text-[9px] rounded-full bg-red-50 text-red-600 border border-red-100 font-bold uppercase">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Financial Overview (Always Visible) */}
                  <div className="flex-1">
                    {companyFinancials[company.id] ? (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Assets</p>
                              <p className="text-xs font-bold text-gray-900">৳{companyFinancials[company.id].assets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Liabilities</p>
                              <p className="text-xs font-bold text-red-500">৳{companyFinancials[company.id].liabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Equity</p>
                              <p className="text-xs font-bold text-blue-600">৳{companyFinancials[company.id].equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Revenue</p>
                              <p className="text-xs font-bold text-gray-900">৳{companyFinancials[company.id].revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Expense</p>
                              <p className="text-xs font-bold text-orange-500">৳{companyFinancials[company.id].expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Net profit(loss)</p>
                              <p className={`text-xs font-bold ${companyFinancials[company.id].netIncome < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ৳{companyFinancials[company.id].netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 animate-pulse flex items-center justify-center h-[120px]">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Loading Stats...</div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3 text-[11px]">
                      <div className="flex gap-3 text-gray-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {company.employeesCount || 0} Staff
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {company.ownersCount || 0} Owners
                        </span>
                      </div>
                      <button
                        onClick={() => router.push(`/owner/companies`)}
                        className="text-blue-600 hover:text-blue-700 font-bold uppercase tracking-wider"
                      >
                        Edit Details
                      </button>
                    </div>

                    <button
                      onClick={() => router.push(`/company/${company.id}/dashboard`)}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all font-bold text-xs flex items-center justify-center gap-2"
                    >
                      Enter Dashboard
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {companiesData?.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No companies assigned yet
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Company Modal */}
      {showCreateModal && (
        <div id="company-create-modal-overlay" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold">Create New Company</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <LogOut className="w-6 h-6 rotate-180" />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. ACME-001"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Bangladesh"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCompanyMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createCompanyMutation.isPending ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
