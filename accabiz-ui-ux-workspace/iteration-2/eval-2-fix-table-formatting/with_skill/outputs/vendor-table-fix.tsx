{/* Corrected vendor list table - matches design system table-hd pattern */}
<table className="w-full">
  <thead className="bg-slate-50">
    <tr>
      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Code</th>
      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Name</th>
      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Email</th>
      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Opening Balance</th>
      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100">
    {filteredVendors.map((vendor) => (
      <tr
        key={vendor.id}
        onClick={() => handleRowClick(vendor)}
        className="hover:bg-slate-50 cursor-pointer"
      >
        <td className="px-4 py-3 font-medium text-slate-900">{vendor.code}</td>
        <td className="px-4 py-3 font-bold text-slate-900">{vendor.name}</td>
        <td className="px-4 py-3 text-slate-500">{vendor.email || '-'}</td>
        <td className="px-4 py-3 text-right font-mono font-medium">
          {getCurrencySymbol(vendor.preferredCurrency)}{vendor.openingBalance?.toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <span className={cn(
            "text-xs px-2 py-1 rounded",
            vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
          )}>
            {vendor.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <Eye className="w-4 h-4 text-slate-400" />
        </td>
      </tr>
    ))}
  </tbody>
</table>