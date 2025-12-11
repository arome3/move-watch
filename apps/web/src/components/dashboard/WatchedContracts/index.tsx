'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AddContractModal } from './AddContractModal';
import {
  fetchWatchedContracts,
  removeWatchedContract,
} from '@/lib/monitoringApi';
import type { WatchedContractResponse } from '@movewatch/shared';

export function WatchedContracts() {
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['watched-contracts'],
    queryFn: fetchWatchedContracts,
  });

  const removeMutation = useMutation({
    mutationFn: removeWatchedContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watched-contracts'] });
    },
  });

  const handleRemove = (id: string) => {
    if (confirm('Remove this contract from your watch list?')) {
      removeMutation.mutate(id);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Watched Contracts</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Contract
        </button>
      </div>

      <div className="p-4">
        {isLoading ? (
          <ContractListSkeleton />
        ) : !contracts?.length ? (
          <EmptyState onAdd={() => setShowAddModal(true)} />
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onRemove={() => handleRemove(contract.id)}
                isRemoving={removeMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <AddContractModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}

interface ContractCardProps {
  contract: WatchedContractResponse;
  onRemove: () => void;
  isRemoving: boolean;
}

function ContractCard({ contract, onRemove, isRemoving }: ContractCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {contract.name && (
            <span className="text-sm font-medium text-white">
              {contract.name}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 text-xs rounded ${
              contract.network === 'mainnet'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {contract.network}
          </span>
        </div>
        <code className="text-xs text-slate-400 font-mono truncate block mt-1">
          {contract.moduleAddress}
        </code>
      </div>
      <button
        onClick={onRemove}
        disabled={isRemoving}
        className="ml-4 p-2 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}

function ContractListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 bg-slate-900 rounded-lg border border-slate-700 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-8">
      <svg
        className="w-12 h-12 mx-auto text-slate-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <h4 className="mt-4 text-lg font-medium text-slate-300">
        No contracts watched
      </h4>
      <p className="mt-2 text-sm text-slate-500">
        Add contracts to monitor their transactions and events
      </p>
      <button
        onClick={onAdd}
        className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
      >
        Add Your First Contract
      </button>
    </div>
  );
}

export { AddContractModal } from './AddContractModal';
