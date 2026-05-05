'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Building2, Users, Database, Shield, Plus, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ companies: 0, owners: 0 });
  const [companies, setCompanies] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', code: '', email: '' });
  const [newOwner, setNewOwner] = useState({ email: '', password: '', firstName: '', lastName: '', maxCompanies: 5 });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [companiesRes, ownersRes] = await Promise.all([
        api.get('/admin/companies'),
        api.get('/admin/owners')
      ]);
      setCompanies(companiesRes.data.data || []);
      setOwners(ownersRes.data.data || []);
      setStats({
        companies: (companiesRes.data.data || []).length,
        owners: (ownersRes.data.data || []).length
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/companies', newCompany);
      toast.success('Company created');
      setShowCreateCompany(false);
      setNewCompany({ name: '', code: '', email: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create company');
    }
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/owners', newOwner);
      toast.success('Owner created');
      setShowCreateOwner(false);
      setNewOwner({ email: '', password: '', firstName: '', lastName: '', maxCompanies: 5 });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create owner');
    }
  };

  const handleDelete = async (id: string, type: 'company' | 'owner') => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      await api.delete(`/admin/${type}s/${id}`);
      toast.success(`${type} deleted`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to delete ${type}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('roles');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <button onClick={handleLogout} className="text-red-600 hover:text-red-700 font-medium">
            Logout
          </button>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-8">
            <div className="flex items-center gap-2 py-4 border-b-2 border-blue-600 text-blue-600 font-medium">
              <Building2 className="w-5 h-5" />
              Companies
            </div>
            <div className="flex items-center gap-2 py-4 border-b-2 border-transparent text-gray-600 hover:text-gray-900">
              <Users className="w-5 h-5" />
              Owners
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">Total Companies</p>
            <p className="text-3xl font-bold text-gray-900">{stats.companies}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">Total Owners</p>
            <p className="text-3xl font-bold text-gray-900">{stats.owners}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Companies</h2>
            <button
              onClick={() => setShowCreateCompany(!showCreateCompany)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Company
            </button>
          </div>
          
          {showCreateCompany && (
            <form onSubmit={handleCreateCompany} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Company Name"
                  value={newCompany.name}
                  onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="Company Code"
                  value={newCompany.code}
                  onChange={e => setNewCompany({ ...newCompany, code: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                  required
                />
                <input
                  type="email"
                  placeholder="Owner Email"
                  value={newCompany.email}
                  onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <button type="submit" className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg">
                Create
              </button>
            </form>
          )}

          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3">Name</th>
                <th className="pb-3">Code</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c: any) => (
                <tr key={c.id} className="border-b">
                  <td className="py-3">{c.name}</td>
                  <td className="py-3 font-mono text-sm">{c.code}</td>
                  <td className="py-3">
                    <button onClick={() => handleDelete(c.id, 'company')} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Owners</h2>
            <button
              onClick={() => setShowCreateOwner(!showCreateOwner)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Owner
            </button>
          </div>
          
          {showCreateOwner && (
            <form onSubmit={handleCreateOwner} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={newOwner.email}
                  onChange={e => setNewOwner({ ...newOwner, email: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newOwner.password}
                  onChange={e => setNewOwner({ ...newOwner, password: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="First Name"
                  value={newOwner.firstName}
                  onChange={e => setNewOwner({ ...newOwner, firstName: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newOwner.lastName}
                  onChange={e => setNewOwner({ ...newOwner, lastName: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />
                <input
                  type="number"
                  placeholder="Max Companies"
                  value={newOwner.maxCompanies}
                  onChange={e => setNewOwner({ ...newOwner, maxCompanies: parseInt(e.target.value) })}
                  className="px-3 py-2 border rounded-lg"
                />
              </div>
              <button type="submit" className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg">
                Create
              </button>
            </form>
          )}

          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3">Email</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Max Companies</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o: any) => (
                <tr key={o.id} className="border-b">
                  <td className="py-3">{o.email}</td>
                  <td className="py-3">{o.firstName} {o.lastName}</td>
                  <td className="py-3">{o.maxCompanies}</td>
                  <td className="py-3">
                    <button onClick={() => handleDelete(o.id, 'owner')} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}