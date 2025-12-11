'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient instance for each session
  // This prevents data sharing between users/requests in SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 30 seconds
            staleTime: 30 * 1000,
            // Refetch data every 30 seconds for real-time updates
            refetchInterval: 30 * 1000,
            // Don't refetch on window focus (user controls refresh)
            refetchOnWindowFocus: false,
            // Retry failed requests 2 times
            retry: 2,
            // Keep previous data while fetching new data
            placeholderData: (previousData: unknown) => previousData,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
