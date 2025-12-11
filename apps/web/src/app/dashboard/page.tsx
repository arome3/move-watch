'use client';

import { useState } from 'react';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { TransactionHistory } from '@/components/dashboard/TransactionHistory';
import { EventStream } from '@/components/dashboard/EventStream';
import { GasAnalytics } from '@/components/dashboard/GasAnalytics';
import { WatchedContracts } from '@/components/dashboard/WatchedContracts';
import type { DashboardPeriod, Network } from '@movewatch/shared';

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('24h');
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('testnet');
  const [selectedModule, setSelectedModule] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Monitoring Dashboard</h1>
          <p className="mt-2 text-slate-400">
            Real-time visibility into your contracts on Movement Network
          </p>
        </div>

        {/* Network Selector */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-slate-300">Network:</label>
          <div className="flex gap-2">
            {(['testnet', 'mainnet', 'devnet'] as Network[]).map((network) => (
              <button
                key={network}
                onClick={() => setSelectedNetwork(network)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  selectedNetwork === network
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {network.charAt(0).toUpperCase() + network.slice(1)}
              </button>
            ))}
          </div>
          {selectedModule && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-slate-400">Filtering:</span>
              <code className="px-2 py-1 bg-slate-800 rounded text-xs text-primary-400 font-mono">
                {selectedModule}
              </code>
              <button
                onClick={() => setSelectedModule(undefined)}
                className="text-slate-400 hover:text-white"
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
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Transaction History (2/3 width) */}
          <div className="lg:col-span-2">
            <TransactionHistory
              network={selectedNetwork}
              moduleAddress={selectedModule}
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
          />
        </div>

        {/* Gas Analytics - Full Width */}
        <div className="mb-8">
          <GasAnalytics
            period={period}
            network={selectedNetwork}
            moduleAddress={selectedModule}
          />
        </div>
      </div>
    </div>
  );
}
