'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <QueryProvider>{children}</QueryProvider>
    </AuthProvider>
  );
}
