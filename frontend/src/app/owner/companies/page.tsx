'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { BASE_URL } from '@/lib/api';
import toast from 'react-hot-toast';
import { Building2, ArrowLeft, LogOut, Edit, ChevronRight, User } from 'lucide-react';

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
  website: string;
  isActive: boolean;
  isDefault: boolean;
}

export default function OwnerCompaniesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const { data: companiesData, isLoading } = useQuery({
    queryKey: ['owner-companies'],
    queryFn: async () => {
      const response = await api.get('/owner/companies');
      return response.data.data as Company[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const form = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value) form.append(key, value as string);
      });
      if (logoFile) {
        form.append('logo', logoFile);
      }
      const response = await api.put(`/owner/companies/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-companies'] });
      toast.success('Company updated successfully');
      closeModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update company');
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

  const openEditModal = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      address: company.address || '',
      city: company.city || '',
      country: company.country || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      logoUrl: company.logoUrl || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCompany(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCompany) {
      updateMutation.mutate({ id: selectedCompany.id, data: formData });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/owner/dashboard" className="text-gray-900 hover:text-blue-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          </div>
          <div className="flex items-center gap-4">
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
            <Link href="/owner/dashboard" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-gray-900 hover:border-gray-300 font-medium">
              Dashboard
            </Link>
            <Link href="/owner/companies" className="flex items-center gap-2 py-4 border-b-2 border-blue-500 text-blue-600">
              <Building2 className="w-5 h-5" />
              Companies
            </Link>
            <Link href="/owner/employees" className="flex items-center gap-2 py-4 border-b-2 border-transparent hover:border-gray-300">
              Employees
            </Link>
            <Link href="/owner/owners" className="flex items-center gap-2 py-4 border-b-2 border-transparent hover:border-gray-300">
              Owners
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">My Companies</h2>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companiesData?.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <Link 
                  href={`/company/${company.id}/dashboard`}
                  className="flex-1 p-6 flex flex-col"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden border">
                      {company.logoUrl ? (
                        <img src={`${BASE_URL}${company.logoUrl}`} alt={company.name} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{company.name}</h3>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{company.code}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-1">
                    <p className="text-sm text-gray-700 flex items-center gap-1">
                      {company.city && company.country ? `${company.city}, ${company.country}` : 'Location not set'}
                    </p>
                    {company.email && <p className="text-sm text-gray-700 truncate">{company.email}</p>}
                  </div>
                </Link>

                <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                  {!company.isActive && (
                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-900 border border-red-200 font-medium">
                      Inactive
                    </span>
                  )}
                  <div /> {/* Spacer if not inactive */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditModal(company);
                    }}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Details
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
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Edit Company</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {selectedCompany?.logoUrl && !logoFile && (
                  <p className="text-xs text-gray-500 mt-1">Current: {selectedCompany.logoUrl.split('/').pop()}</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary flex-1">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
