'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  Building2, 
  Users, 
  LogOut, 
  Settings, 
  UserPlus, 
  Trash2, 
  Shield, 
  Percent,
  ChevronDown,
  LayoutDashboard,
  User,
  CreditCard,
  Briefcase,
  MapPin,
  Phone
} from 'lucide-react';

interface CoOwner {
  id: string;
  userId: string;
  companyId: string;
  ownershipPercentage: number;
  isMainOwner: boolean;
  canEditCompany: boolean;
  canDeleteCompany: boolean;
  canManageOwners: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  fatherMotherName?: string;
  nidPassport?: string;
  mobile?: string;
  permanentAddress?: string;
  ownershipType?: string;
  joiningDate?: string;
  openingCapital?: number;
  tin?: string;
  din?: string;
}

interface Company {
  id: string;
  name: string;
  code: string;
}

export default function OwnerOwnersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<'permissions' | 'profile'>('permissions');
  const [selectedOwner, setSelectedOwner] = useState<CoOwner | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    companyId: '',
    ownershipPercentage: 0,
    canEditCompany: false,
    canDeleteCompany: false,
    canManageOwners: false,
    fatherMotherName: '',
    nidPassport: '',
    mobile: '',
    permanentAddress: '',
    ownershipType: 'Director',
    joiningDate: '',
    openingCapital: 0,
    tin: '',
    din: '',
  });

  const { data: companiesData } = useQuery({
    queryKey: ['owner-companies'],
    queryFn: async () => {
      const response = await api.get('/owner/companies');
      return response.data.data as Company[];
    },
  });

  const { data: ownersData, refetch: refetchOwners } = useQuery({
    queryKey: ['company-owners', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const response = await api.get(`/owner/companies/${selectedCompanyId}/owners`);
      return response.data.data as CoOwner[];
    },
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = storedUser.roles || [];

    if (!token || !roles.includes('Owner')) {
      router.push('/login');
    } else {
      setMounted(true);
    }
  }, [router]);

  useEffect(() => {
    if (companiesData && companiesData.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companiesData[0].id);
    }
  }, [companiesData, selectedCompanyId]);

  const addOwnerMutation = useMutation({
    mutationFn: async (data: any) => {
      const { companyId, ...ownerData } = data;
      const targetCompanyId = companyId || selectedCompanyId;
      return api.post(`/owner/companies/${targetCompanyId}/owners`, ownerData);
    },
    onSuccess: () => {
      toast.success('Owner added successfully');
      setShowAddModal(false);
      setFormData({ 
        email: '', 
        firstName: '',
        lastName: '',
        password: '',
        companyId: '',
        ownershipPercentage: 0, 
        canEditCompany: false, 
        canDeleteCompany: false, 
        canManageOwners: false,
        fatherMotherName: '',
        nidPassport: '',
        mobile: '',
        permanentAddress: '',
        ownershipType: 'Director',
        joiningDate: '',
        openingCapital: 0,
        tin: '',
        din: '',
      });
      refetchOwners();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to add owner');
    },
  });

  const updateOwnerMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.put(`/owner/companies/${selectedCompanyId}/owners/${selectedOwner?.userId}`, data);
    },
    onSuccess: () => {
      toast.success('Owner updated successfully');
      setShowEditModal(false);
      refetchOwners();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to update owner');
    },
  });

  const deleteOwnerMutation = useMutation({
    mutationFn: async (ownerId: string) => {
      return api.delete(`/owner/companies/${selectedCompanyId}/owners/${ownerId}`);
    },
    onSuccess: () => {
      toast.success('Owner removed successfully');
      refetchOwners();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove owner');
    },
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Co-Owner Management</h1>
          <div className="flex items-center gap-4">
            <Link href="/owner/dashboard" className="text-gray-900 hover:text-blue-600 flex items-center gap-2 transition-colors">
              <LayoutDashboard className="w-5 h-5" />
              Main Dashboard
            </Link>
            <div className="h-6 w-px bg-gray-200"></div>
            <Link href="/owner/profile" className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors">
              <User className="w-5 h-5" />
              Profile
            </Link>
            <button onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              router.push('/login');
            }} className="flex items-center gap-2 text-gray-900 hover:text-red-600 transition-colors">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b sticky top-[65px] z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            <Link href="/owner/dashboard" className="flex items-center gap-2 py-4 border-b-2 border-transparent text-gray-900 hover:border-gray-300 font-medium">
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
            <Link href="/owner/owners" className="flex items-center gap-2 py-4 border-b-2 border-blue-500 text-blue-600">
              <Settings className="w-5 h-5" />
              Owners
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="w-full md:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Company</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {companiesData?.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.code})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full md:w-auto justify-center"
            >
              <UserPlus className="w-5 h-5" />
              Register Co-Owner
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-center">Owner</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-center">Share (%)</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-center">Permissions</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ownersData?.map((owner) => (
                  <tr key={owner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          {owner.user.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 flex items-center gap-2">
                            {owner.user.firstName} {owner.user.lastName}
                            {owner.isMainOwner && (
                              <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                                Main Owner
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">{owner.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg font-bold border border-green-100">
                        <Percent className="w-3 h-3" />
                        {owner.ownershipPercentage}%
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {owner.canEditCompany && (
                          <span className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md border border-blue-100">Edit Co</span>
                        )}
                        {owner.canDeleteCompany && (
                          <span className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded-md border border-red-100">Delete Co</span>
                        )}
                        {owner.canManageOwners && (
                          <span className="px-2 py-1 text-xs bg-amber-50 text-amber-600 rounded-md border border-amber-100">Manage Owners</span>
                        )}
                        {!owner.canEditCompany && !owner.canDeleteCompany && !owner.canManageOwners && (
                          <span className="text-xs text-gray-400 italic">No special permissions</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedOwner(owner);
                            setFormData({
                              email: owner.user.email,
                              firstName: owner.user.firstName,
                              lastName: owner.user.lastName,
                              password: '',
                              companyId: owner.companyId,
                              ownershipPercentage: owner.ownershipPercentage,
                              canEditCompany: owner.canEditCompany,
                              canDeleteCompany: owner.canDeleteCompany,
                              canManageOwners: owner.canManageOwners,
                              fatherMotherName: owner.fatherMotherName || '',
                              nidPassport: owner.nidPassport || '',
                              mobile: owner.mobile || '',
                              permanentAddress: owner.permanentAddress || '',
                              ownershipType: owner.ownershipType || 'Director',
                              joiningDate: owner.joiningDate ? new Date(owner.joiningDate).toISOString().split('T')[0] : '',
                              openingCapital: owner.openingCapital || 0,
                              tin: owner.tin || '',
                              din: owner.din || '',
                            });
                            setShowEditModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Permissions"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        {!owner.isMainOwner && (
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to remove this co-owner?')) {
                                deleteOwnerMutation.mutate(owner.userId);
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove Owner"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {ownersData?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No co-owners registered for this company.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Owner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">Register Co-Owner</h3>
              <div className="space-y-6">
                {/* Section 1: Basic & Company */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign Company *</label>
                      <select
                        value={formData.companyId || selectedCompanyId}
                        onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        required
                      >
                        <option value="">Select Company</option>
                        {companiesData?.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name} ({company.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Password (if new user)"
                    />
                  </div>
                </div>

                {/* Section 2: Identity Profile */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2">Identity Profile (Compliance)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Father/Mother Name</label>
                      <input
                        type="text"
                        value={formData.fatherMotherName}
                        onChange={(e) => setFormData({ ...formData, fatherMotherName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                      <input
                        type="text"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">NID / Passport</label>
                      <input
                        type="text"
                        value={formData.nidPassport}
                        onChange={(e) => setFormData({ ...formData, nidPassport: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TIN</label>
                      <input
                        type="text"
                        value={formData.tin}
                        onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permanent Address</label>
                    <textarea
                      value={formData.permanentAddress}
                      onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Section 3: Ownership & Capital */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-semibold text-gray-900 border-b pb-2">Ownership & Capital</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Type</label>
                      <select
                        value={formData.ownershipType}
                        onChange={(e) => setFormData({ ...formData, ownershipType: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        <option value="Proprietor">Proprietor</option>
                        <option value="Partner">Partner</option>
                        <option value="Director">Director</option>
                        <option value="Shareholder">Shareholder</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                      <input
                        type="date"
                        value={formData.joiningDate}
                        onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ownership %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.ownershipPercentage}
                        onChange={(e) => setFormData({ ...formData, ownershipPercentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Capital (BDT)</label>
                      <input
                        type="number"
                        value={formData.openingCapital}
                        onChange={(e) => setFormData({ ...formData, openingCapital: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button 
                    onClick={() => addOwnerMutation.mutate({ 
                      ...formData,
                      companyId: formData.companyId || selectedCompanyId 
                    })}
                    disabled={addOwnerMutation.isPending || !formData.email}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-all"
                  >
                    {addOwnerMutation.isPending ? 'Processing...' : 'Register Owner'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Update Co-Owner Policy</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <LogOut className="w-5 h-5 rotate-180" />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-6">
                Managing settings for <span className="font-semibold text-gray-900">{selectedOwner?.user.firstName} {selectedOwner?.user.lastName}</span>
              </p>

              {/* Tabs */}
              <div className="flex border-b mb-6">
                <button
                  onClick={() => setActiveEditTab('permissions')}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeEditTab === 'permissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Permissions
                  </div>
                </button>
                <button
                  onClick={() => setActiveEditTab('profile')}
                  className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                    activeEditTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profile & Compliance
                  </div>
                </button>
              </div>
              
              <div className="space-y-6">
                {activeEditTab === 'permissions' ? (
                  <div className="space-y-6">
                    <div>
                      <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                        Ownership Percentage
                        <span className="text-blue-600 font-bold">{formData.ownershipPercentage}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.ownershipPercentage}
                        onChange={(e) => setFormData({ ...formData, ownershipPercentage: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 border-b pb-2">Administrative Actions</label>
                      
                      <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Edit Company</p>
                            <p className="text-xs text-gray-500">Allow updating company profile & logo</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.canEditCompany}
                          onChange={(e) => setFormData({ ...formData, canEditCompany: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-600 group-hover:bg-red-100 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Delete Company</p>
                            <p className="text-xs text-gray-500">Allow permanent deletion of company</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.canDeleteCompany}
                          onChange={(e) => setFormData({ ...formData, canDeleteCompany: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                            <Settings className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Manage Co-Owners</p>
                            <p className="text-xs text-gray-500">Allow adding/removing co-owners</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.canManageOwners}
                          onChange={(e) => setFormData({ ...formData, canManageOwners: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Father/Mother Name</label>
                        <input
                          type="text"
                          value={formData.fatherMotherName}
                          onChange={(e) => setFormData({ ...formData, fatherMotherName: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                        <input
                          type="text"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">NID / Passport</label>
                        <input
                          type="text"
                          value={formData.nidPassport}
                          onChange={(e) => setFormData({ ...formData, nidPassport: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Type</label>
                        <select
                          value={formData.ownershipType}
                          onChange={(e) => setFormData({ ...formData, ownershipType: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="Proprietor">Proprietor</option>
                          <option value="Partner">Partner</option>
                          <option value="Director">Director</option>
                          <option value="Shareholder">Shareholder</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">TIN</label>
                        <input
                          type="text"
                          value={formData.tin}
                          onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date</label>
                        <input
                          type="date"
                          value={formData.joiningDate}
                          onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Permanent Address</label>
                      <textarea
                        value={formData.permanentAddress}
                        onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                  <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button 
                    onClick={() => updateOwnerMutation.mutate({
                      ...formData
                    })}
                    disabled={updateOwnerMutation.isPending}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-all"
                  >
                    {updateOwnerMutation.isPending ? 'Saving...' : 'Update Settings'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
