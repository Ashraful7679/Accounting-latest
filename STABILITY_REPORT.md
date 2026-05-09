# AccaBiz Stability Report & Hardening Guide

This document outlines common runtime issues identified during the AccaBiz ERP stability audit and provides standardized solutions.

## 1. TypeError: .filter (or .map) is not a function

### Issue
Occurs when the frontend expects an array from an API response but receives an object (e.g., an error message, null, or a single entity instead of a list).

### Solution
Always wrap API data-processing logic in `Array.isArray()` checks.

**Standard Pattern:**
```typescript
const filteredData = (Array.isArray(data) ? data : []).filter(item => ...);
```

**Affected Modules Hardened:**
- Sales: Invoices, Proforma Invoices (PIs), Delivery Notes (Challans), Orders
- Purchase: Invoices, Proforma Invoices (PIs), Orders
- Management: Employees, Vendors

---

## 2. Recharts: Width/Height -1 or Negative Dimensions

### Issue
Recharts components crashing or showing warnings because they attempt to render before the container layout is stable or during SSR (Server Side Rendering).

### Solution
1. **Hydration Guard**: Use a `mounted` state to delay rendering until the component is fully loaded in the browser.
2. **Flexbox Fix**: Add `min-w-0` to flex containers wrapping ResponsiveContainer to prevent layout collapse.

**Standard Pattern:**
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

if (!mounted) return <div className="h-[300px] bg-slate-50 animate-pulse" />;

return (
  <div className="flex-1 min-w-0">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>...</BarChart>
    </ResponsiveContainer>
  </div>
);
```

---

## 3. Sidebar Navigation: 404 Errors

### Issue
Deprecated routes or typos in the Sidebar links leading to broken navigation.

### Solution
Audit `Sidebar.tsx` and ensure all links match the latest `app` directory structure.

**Key Correction Made:**
- "Delivery Notes" path updated from `/deliveries` to `/sales/challans`.

---

## 4. API Resilience

### Issue
Backend errors (500, 401, 404) returning JSON objects instead of arrays, causing cascading failures in the UI.

### Solution
1. **Defensive Filtering** (See Item 1).
2. **Toast Notifications**: Ensure every `useMutation` and `useQuery` has an `onError` handler.
3. **Optional Chaining**: Use `?.` extensively when accessing nested properties like `order.customer?.name`.

---

## 5. Performance & Data Fetching

### Issue
Frequent re-fetching intervals causing backend pressure.

### Solution
Monitor `refetchInterval` in `useQuery`. Default is often 60s for dashboard stats; ensure this is appropriate for the module's sensitivity.
