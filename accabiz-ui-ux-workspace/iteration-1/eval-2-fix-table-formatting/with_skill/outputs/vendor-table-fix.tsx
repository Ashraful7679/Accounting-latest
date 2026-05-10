// Fixed vendor list table - matches design system table-hd pattern
// Issues fixed:
// 1. Added proper table structure with <thead> and <tbody>
// 2. Currency column (opening balance) now right-aligned with font-mono
// 3. Table header uses consistent styling: bg-slate-50/50, uppercase tracking-wider
// 4. Proper border-collapse and consistent padding

import { Building2, Search, Eye } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/decimalUtils';
import { cn } from '@/lib/utils';

interface Vendor {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  preferredCurrency?: string;
  openingBalance?: number;
}

<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
  <div className="p-4 border-b border-slate-100">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input
        type="text"
        placeholder="Search vendors..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl"
      />
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-slate-50/50 border-b border-slate-100">
          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Opening Balance</th>
          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {filteredVendors.map((vendor) => (
          <tr
            key={vendor.id}
            onClick={() => handleRowClick(vendor)}
            className="hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <td className="px-6 py-4">
              <div className="font-bold text-slate-900">{vendor.name}</div>
              <div className="text-sm text-slate-500 font-mono">{vendor.code}</div>
            </td>
            <td className="px-6 py-4 text-slate-600">{vendor.email || '-'}</td>
            <td className="px-6 py-4 text-right">
              <span className="font-mono font-bold text-slate-900">
                {getCurrencySymbol(vendor.preferredCurrency)}{vendor.openingBalance?.toLocaleString()}
              </span>
            </td>
            <td className="px-6 py-4">
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold",
                vendor.isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}>
                {vendor.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className="px-6 py-4 text-right">
              <Eye className="w-4 h-4 text-slate-400 inline" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
