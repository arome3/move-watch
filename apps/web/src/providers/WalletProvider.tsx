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
      // Only allow standard wallets (Petra, Pontem, etc) - no SDK wallets
      // SDK wallets like AptosConnectGoogleWallet try to fetch chain info on init
      // which fails because we're using Movement Network, not Aptos
      plugins={[]}
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
