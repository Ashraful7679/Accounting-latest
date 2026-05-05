'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const adminToken = sessionStorage.getItem('admin_token');
    setIsImpersonating(Boolean(adminToken));
  }, []);

  const handleReturnToAdmin = () => {
    const adminToken = sessionStorage.getItem('admin_token');
    if (!adminToken) return;

    localStorage.setItem('token', adminToken);
    sessionStorage.removeItem('admin_token');
    window.location.href = '/admin/dashboard';
  };

  if (!isImpersonating) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 text-slate-900 border-b border-amber-700 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-sm font-medium">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span>You are impersonating another account. Actions will be performed as the active user.</span>
        </div>
        <button
          type="button"
          onClick={handleReturnToAdmin}
          className="rounded-md bg-slate-900 px-3 py-1 text-white hover:bg-slate-800"
        >
          Return to Admin
        </button>
      </div>
    </div>
  );
}
