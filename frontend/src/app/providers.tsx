'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    const HEARTBEAT_INTERVAL = 14 * 60 * 1000; // 14 minutes
    
    const heartbeat = async () => {
      try {
        await fetch('/api/health', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true 
        });
      } catch (error) {
        console.log('Heartbeat ping failed', error);
      }
    };

    // Initial ping
    heartbeat();

    const intervalId = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      {children}
    </QueryClientProvider>
  );
}
