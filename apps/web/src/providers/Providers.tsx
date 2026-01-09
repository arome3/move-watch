'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { WalletProvider } from './WalletProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <WalletProvider>
        <QueryProvider>{children}</QueryProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
