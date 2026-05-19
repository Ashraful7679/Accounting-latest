'use client';


import AuditClient from './AuditClient';
import { useParams } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';

export default function AuditTrailPage() {
  const params = useParams();
  const companyId = params.id as string;
  const { canView, isLoading: permsLoading } = usePermissions('company.audit', companyId);

  if (!permsLoading && !canView) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return <AuditClient />;
}
