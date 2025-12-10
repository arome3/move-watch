'use client';

import { useSimulatorStore } from '@/stores/simulator';
import { NETWORK_CONFIGS, type Network } from '@movewatch/shared';

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'testnet', label: NETWORK_CONFIGS.testnet.name },
  { value: 'mainnet', label: NETWORK_CONFIGS.mainnet.name },
  { value: 'devnet', label: NETWORK_CONFIGS.devnet.name },
];

export function NetworkSelector() {
  const { network, setNetwork } = useSimulatorStore();

  return (
    <div className="space-y-2">
      <label htmlFor="network" className="block text-sm font-medium text-slate-300">
        Network
      </label>
      <select
        id="network"
        value={network}
        onChange={(e) => setNetwork(e.target.value as Network)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
                   focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                   transition-colors"
      >
        {NETWORKS.map((n) => (
          <option key={n.value} value={n.value}>
            {n.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">
        Select the Movement Network to simulate against
      </p>
    </div>
  );
}
