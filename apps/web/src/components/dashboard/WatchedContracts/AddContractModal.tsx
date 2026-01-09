'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addWatchedContract } from '@/lib/monitoringApi';
import type { Network } from '@movewatch/shared';

interface AddContractModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddContractModal({ isOpen, onClose }: AddContractModalProps) {
  const [moduleAddress, setModuleAddress] = useState('');
  const [name, setName] = useState('');
  const [network, setNetwork] = useState<Network>('testnet');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: addWatchedContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watched-contracts'] });
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to add contract');
    },
  });

  const handleClose = () => {
    setModuleAddress('');
    setName('');
    setNetwork('testnet');
    setError('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!moduleAddress.match(/^0x[a-fA-F0-9]+::\w+$/)) {
      setError('Invalid module address format. Expected: 0x...::module_name');
      return;
    }

    mutation.mutate({
      moduleAddress,
      name: name || undefined,
      network,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-800 rounded-lg border border-dark-700 w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Add Contract</h3>
          <button
            onClick={handleClose}
            className="text-dark-400 hover:text-white"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Module Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={moduleAddress}
              onChange={(e) => setModuleAddress(e.target.value)}
              placeholder="0x1::coin"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <p className="text-xs text-dark-500 mt-1">
              Format: 0x...::module_name
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Token"
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as Network)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="testnet">Testnet (Bardock)</option>
              <option value="mainnet">Mainnet</option>
              <option value="devnet">Devnet</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-dark-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Adding...' : 'Add Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
