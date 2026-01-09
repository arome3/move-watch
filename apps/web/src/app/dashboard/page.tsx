'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { TransactionHistory } from '@/components/dashboard/TransactionHistory';
import { EventStream } from '@/components/dashboard/EventStream';
import { GasAnalytics } from '@/components/dashboard/GasAnalytics';
import { WatchedContracts } from '@/components/dashboard/WatchedContracts';
import type { DashboardPeriod, Network } from '@movewatch/shared';

type ViewMode = 'network' | 'wallet';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<DashboardPeriod>('24h');
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('testnet');
  const [selectedModule, setSelectedModule] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('network');

  // Get wallet address from session (stored during wallet auth)
  const walletAddress = session?.user?.walletAddress as string | undefined;

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Monitoring Dashboard</h1>
          <p className="mt-2 text-dark-400">
            Real-time visibility into your contracts on Movement Network
          </p>
        </div>

        {/* Network Selector & View Mode Toggle */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Network Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-dark-300">Network:</label>
            <div className="flex gap-2">
              {(['testnet', 'mainnet', 'devnet'] as Network[]).map((network) => (
                <button
                  key={network}
                  onClick={() => setSelectedNetwork(network)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    selectedNetwork === network
                      ? 'bg-primary-500 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white border border-dark-700'
                  }`}
                >
                  {network.charAt(0).toUpperCase() + network.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-4 sm:ml-6 sm:pl-6 sm:border-l sm:border-dark-700">
            <label className="text-sm font-medium text-dark-300">View:</label>
            <div className="flex rounded-lg border border-dark-700 overflow-hidden">
              <button
                onClick={() => setViewMode('network')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'network'
                    ? 'bg-dark-700 text-white'
                    : 'bg-dark-800 text-dark-400 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Network
                </span>
              </button>
              <button
                onClick={() => setViewMode('wallet')}
                disabled={!walletAddress}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'wallet'
                    ? 'bg-dark-700 text-white'
                    : 'bg-dark-800 text-dark-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
                title={!walletAddress ? 'Connect wallet to view your transactions' : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  My Wallet
                </span>
              </button>
            </div>
          </div>

          {/* Active Filter Display */}
          {selectedModule && (
            <div className="flex items-center gap-2 sm:ml-4">
              <span className="text-sm text-dark-400">Filtering:</span>
              <code className="px-2 py-1 bg-dark-800 rounded text-xs text-primary-400 font-mono">
                {selectedModule}
              </code>
              <button
                onClick={() => setSelectedModule(undefined)}
                className="text-dark-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Dashboard Overview - Top Section */}
        <div className="mb-8">
          <DashboardOverview
            period={period}
            onPeriodChange={setPeriod}
            network={selectedNetwork}
            moduleAddress={selectedModule}
            sender={viewMode === 'wallet' ? walletAddress : undefined}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Transaction History (2/3 width) */}
          <div className="lg:col-span-2">
            <TransactionHistory
              network={selectedNetwork}
              moduleAddress={selectedModule}
              sender={viewMode === 'wallet' ? walletAddress : undefined}
            />
          </div>

          {/* Right Column - Watched Contracts (1/3 width) */}
          <div className="lg:col-span-1">
            <WatchedContracts />
          </div>
        </div>

        {/* Event Stream - Full Width */}
        <div className="mb-8">
          <EventStream
            network={selectedNetwork}
            moduleAddress={selectedModule}
            sender={viewMode === 'wallet' ? walletAddress : undefined}
          />
        </div>

        {/* Gas Analytics - Full Width */}
        <div className="mb-8">
          <GasAnalytics
            period={period}
            network={selectedNetwork}
            moduleAddress={selectedModule}
            sender={viewMode === 'wallet' ? walletAddress : undefined}
          />
        </div>
      </div>
    </div>
  );
}
