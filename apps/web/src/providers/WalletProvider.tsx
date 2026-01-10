'use client';

import type { ReactNode } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={false}
      dappConfig={{
        network: Network.TESTNET,
        aptosConnect: undefined,
      }}
      onError={(error) => {
        // Silently handle wallet initialization errors
        // These are expected when using Movement Network instead of Aptos
        console.debug('Wallet error (suppressed):', error?.message);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}
