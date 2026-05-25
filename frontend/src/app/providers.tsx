'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { BASE_URL } from '@/lib/api';
import { OfflineBanner } from '@/components/OfflineBanner';
import ImpersonationBanner from '@/components/ImpersonationBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,           // Always consider data stale → refetch on invalidation
            refetchOnWindowFocus: true,   // Refetch when user returns to tab
            refetchOnMount: true,         // Refetch when component mounts
            retry: 1,                     // Single retry on network failure
          },
        },
      })
  );

  const router = useRouter();

  // Heartbeat removed as per request – no periodic health checks

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <OfflineBanner />
      <ImpersonationBanner />
      {children}
    </QueryClientProvider>
  );
}
