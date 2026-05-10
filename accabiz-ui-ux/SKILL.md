---
name: accabiz-ui-ux
description: Guidelines and patterns for the AccaBiz design system, focused on premium UI/UX, typography, and component-driven architecture. Make sure to use this skill whenever creating new UI components, pages, or forms for the AccaBiz ERP — including vendor credits, invoices, reports, settings, or any other pages. Also use when refactoring existing pages, adding buttons, forms, tables, or detail panels. This skill ensures consistency with the existing codebase patterns.
---

# AccaBiz UI/UX Skill

This skill provides comprehensive guidelines for maintaining and evolving the AccaBiz ERP design system. Use it when creating new UI components, refactoring pages, or optimizing the user experience.

## Design Philosophy

AccaBiz follows a **Clean, Professional, and High-Density** design aesthetic suitable for financial enterprise applications.

- **Typography**: Primary font is `Inter`. Base size is `13px` for high information density without sacrificing readability.
- **Palette**: Neutral grays (`#f9fafb` background, `#111827` foreground) with professional blue accents (`#2563eb`) for primary actions.
- **Layout**: Sidebar-driven navigation with a fluid content area. Use `DetailPanel` for side-sheet interactions to maintain context.

## Component Patterns

### 1. Page Structure

Every page in `src/app/company/[id]/` follows this exact pattern:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function PageName() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
  }, [router]);

  if (!mounted) return null;

  return ( /* page content */ );
}
```

### 2. Buttons

Use standardized button classes from `globals.css` or inline styles that match:

```tsx
// Primary action (main buttons like "Add", "Create")
<button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">

// Secondary action (cancel, lesser actions)
<button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50">

// Form submit
<button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">

// Danger action (delete)
<button className="bg-red-600 text-white ...">
```

For loading states, use `useMutation` with `isPending`:
```tsx
const createMutation = useMutation({
  mutationFn: async (data) => api.post(endpoint, data),
  onSuccess: () => toast.success('Created successfully'),
  onError: (error: any) => toast.error(error.response?.data?.error?.message || 'Failed'),
});

// Button
<button disabled={createMutation.isPending}>
  {createMutation.isPending ? 'Creating...' : 'Create'}
</button>
```

### 3. Form Inputs

Standard inputs use these classes:
```tsx
<input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
<select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
<textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg min-h-[80px]" />
```

Labels follow this pattern:
```tsx
<label className="text-[10px] font-bold text-slate-400 uppercase">Field Name</label>
```

### 4. Tables

For list views with data tables:

```tsx
<table className="w-full">
  <thead className="bg-slate-50">
    <tr>
      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Header</th>
      {/* Right-align currency/numeric columns */}
      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Amount</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100">
    <tr className="hover:bg-slate-50 cursor-pointer">
      <td className="px-4 py-3">Text content</td>
      {/* Right-align and use font-mono for currency */}
      <td className="px-4 py-3 text-right font-mono font-medium">1,234.56</td>
    </tr>
  </tbody>
</table>
```

Key points:
- **Always use `<thead>` and `<tbody>`** for semantic HTML
- **Right-align currency columns** with `text-right` and `font-mono`
- **Use `divide-y`** for row separators instead of borders on cells
- **Currency formatting**: `getCurrencySymbol()` + `.toLocaleString()` or `.toFixed(2)`

### 5. Loading States

```tsx
{isLoading ? (
  <div className="p-20 text-center">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
  </div>
) : items.length === 0 ? (
  <div className="p-20 text-center">
    <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
    <p className="text-slate-900 font-bold">No items found</p>
  </div>
) : (
  /* content */
)}
```

### 6. Status Badges

```tsx
const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    PAID: 'bg-blue-100 text-blue-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return styles[status] || 'bg-gray-100 text-gray-800';
};

// Usage
<span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(status)}`}>
  {status}
</span>
```

### 7. Search Input

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
  <input
    type="text"
    placeholder="Search..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl"
  />
</div>
```

### 8. DetailPanel

The `DetailPanel` component is the standard pattern for viewing/editing entities without leaving the list view.

**Import:**
```tsx
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';
```

**State management:**
```tsx
const [showDetailPanel, setShowDetailPanel] = useState(false);
const [selectedItem, setSelectedItem] = useState<ItemType | null>(null);
const [viewMode, setViewMode] = useState<'view' | 'edit' | 'create'>('view');
```

**DetailField types:** `'text' | 'number' | 'currency' | 'date' | 'status' | 'quantity' | 'select' | 'link'`

**DetailAction variants:** `'primary' | 'secondary' | 'danger' | 'success'`

**Full usage:**
```tsx
<DetailPanel
  isOpen={showDetailPanel}
  onClose={handleClose}
  title={viewMode === 'create' ? 'New Item' : (selectedItem?.name || 'Item')}
  subtitle={selectedItem?.code}
  fields={getDetailFields()}
  actions={getDetailActions()}
  tabs={selectedItem 
    ? [getLinesTab(), getNotesTab()]  // View mode tabs
    : (showDetailPanel && !selectedItem) 
      ? [getCreateTab()]  // Create mode
      : []}
  status={selectedItem ? { 
    value: selectedItem.status?.toLowerCase(), 
    type: selectedItem.status?.toLowerCase() 
  } : undefined}
  size="lg"
/>
```

### 9. TanStack Query Patterns

**Queries:**
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['entity-name', companyId],
  queryFn: async () => {
    const response = await api.get(`/company/${companyId}/entity`);
    return response.data.data;
  },
  enabled: !!companyId,
});
```

**Mutations:**
```tsx
const mutation = useMutation({
  mutationFn: async (data: PayloadType) => {
    const response = await api.post(`/company/${companyId}/entity`, data);
    return response.data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['entity-name', companyId] });
    toast.success('Action completed');
  },
  onError: (error: any) => {
    toast.error(error.response?.data?.error?.message || 'Failed');
  },
});
```

### 10. Filtering Data

```tsx
const filteredItems = (Array.isArray(items) ? items : []).filter(item =>
  !searchTerm ||
  item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.code?.toLowerCase().includes(searchTerm.toLowerCase())
) || [];
```

## TypeScript Best Practices

1. **Define interfaces** for all data types:
```tsx
interface VendorCredit {
  id: string;
  vendorCreditNumber: string;
  vendorId: string;
  vendor?: { name: string } | null;
  status: string;
  lines: VendorCreditLine[];
}

interface VendorCreditLine {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}
```

2. **Type callback parameters** in array methods:
```tsx
// Good
formData.lines.filter((line: VendorCreditLine) => line.quantity > 0)
formData.lines.reduce((sum: number, line: VendorCreditLine) => sum + line.amount, 0)

// Avoid implicit any
// (idx: number) => ... // Good
// (idx) => ...         // Avoid
```

3. **Handle null/undefined** data from API:
```tsx
// Safe access
const vendors = Array.isArray(data) ? data : [];
const vendorName = selectedItem?.vendor?.name || '-';
```

## UX Best Practices

1. **Information Density**: Financial users prefer seeing more data at once. Avoid excessive whitespace but maintain clear hierarchy.

2. **Optimistic Updates**: Use TanStack Query's mutation patterns to provide "instant" feedback on status changes.

3. **Draft-First Workflow**: All documents (Invoices, Orders) should start in `DRAFT` status and require explicit `VERIFY` or `APPROVE` actions.

4. **Context Preservation**: Never navigate away from a complex task if a side-sheet or modal can suffice.

5. **Error Handling**: Always show toast notifications for success/failure. Include specific error messages from the API when available.

## Common Component Patterns

### Empty State
```tsx
<div className="p-20 text-center">
  <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
  <p className="text-slate-900 font-bold">No items found</p>
  <p className="text-slate-500 text-sm mt-1">Create a new item to get started</p>
</div>
```

### Card Container
```tsx
<div className="bg-white rounded-2xl shadow-sm border border-slate-100">
  {/* content */}
</div>
```

### Page Header
```tsx
<div className="flex justify-between items-center mb-8">
  <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
    <Icon className="w-8 h-8 text-blue-600" />
    Page Title
  </h1>
  <button className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2">
    <Plus className="w-5 h-5" /> New Item
  </button>
</div>
```

### Action Row in Tables
```tsx
<div className="flex items-center gap-4">
  <span className="font-bold text-slate-900">{item.name}</span>
  <span className="text-sm text-slate-500">{item.code}</span>
  <span className="ml-auto font-mono">{formatCurrency(item.amount)}</span>
  {getStatusBadge(item.status)}
  <Eye className="w-4 h-4 text-slate-400" />
</div>
```

## Checklist Before Finishing

- [ ] Page follows the standard page structure with `mounted` guard
- [ ] All buttons use the correct styling (blue for primary, white/border for secondary)
- [ ] Tables use proper `<thead>`/`<tbody>`, right-aligned currency columns, and `divide-y`
- [ ] DetailPanel is used for view/edit/create operations
- [ ] Mutations show loading states and toast notifications
- [ ] Loading and empty states are implemented
- [ ] Search filtering works correctly
- [ ] TypeScript interfaces are defined for all data types
- [ ] Array methods have typed parameters (no implicit any)
- [ ] API responses handle null/undefined cases

---
*Created for the AccaBiz ERP Project*