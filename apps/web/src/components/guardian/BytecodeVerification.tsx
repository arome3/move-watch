'use client';

import type { GuardianBytecodeVerification } from '@movewatch/shared';

interface BytecodeVerificationProps {
  verification?: GuardianBytecodeVerification;
}

/**
 * BytecodeVerification Component
 *
 * Displays the on-chain verification status of a module/function.
 * This is critical because it shows whether the claimed function
 * actually exists on-chain - protecting against spoofing attacks.
 */
export function BytecodeVerification({ verification }: BytecodeVerificationProps) {
  if (!verification) {
    return null;
  }

  const statusConfig = getStatusConfig(verification.status);

  return (
    <div className={`rounded-lg border ${statusConfig.border} ${statusConfig.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 ${statusConfig.icon}`}>
          {statusConfig.iconSvg}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${statusConfig.title}`}>
              {statusConfig.label}
            </h3>
            {verification.verifiedOnChain && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                Verified On-Chain
              </span>
            )}
          </div>
          <p className="text-sm text-dark-400 mt-1">{getStatusDescription(verification)}</p>

          {/* Module metadata */}
          {verification.metadata && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-dark-700/50 rounded px-2 py-1.5">
                <span className="text-dark-500 block">Total Functions</span>
                <span className="text-dark-200 font-medium">{verification.metadata.totalFunctions}</span>
              </div>
              <div className="bg-dark-700/50 rounded px-2 py-1.5">
                <span className="text-dark-500 block">Entry Functions</span>
                <span className="text-dark-200 font-medium">{verification.metadata.entryFunctions}</span>
              </div>
              <div className="bg-dark-700/50 rounded px-2 py-1.5">
                <span className="text-dark-500 block">Has Resources</span>
                <span className="text-dark-200 font-medium">
                  {verification.metadata.hasResourceAbilities ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="bg-dark-700/50 rounded px-2 py-1.5">
                <span className="text-dark-500 block">Friend Modules</span>
                <span className="text-dark-200 font-medium">{verification.metadata.friendModules?.length ?? 0}</span>
              </div>
            </div>
          )}

          {/* Function info */}
          {verification.functionInfo && (
            <div className="mt-3 border-t border-dark-600 pt-3">
              <h4 className="text-xs font-medium text-dark-300 mb-2">Function Details</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-1 rounded ${
                  verification.functionInfo.isEntry
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-dark-600 text-dark-400'
                }`}>
                  {verification.functionInfo.isEntry ? 'Entry Point' : 'Internal'}
                </span>
                <span className={`px-2 py-1 rounded ${
                  verification.functionInfo.visibility === 'public'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-dark-600 text-dark-400'
                }`}>
                  {verification.functionInfo.visibility}
                </span>
                {verification.functionInfo.isView && (
                  <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    View Only
                  </span>
                )}
              </div>
              {verification.functionInfo.params.length > 0 && (
                <div className="mt-2">
                  <span className="text-dark-500 text-xs">Parameters: </span>
                  <code className="text-dark-300 text-xs">
                    ({verification.functionInfo.params.join(', ')})
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {verification.error && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
              {verification.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusConfig(status: GuardianBytecodeVerification['status']) {
  switch (status) {
    case 'verified':
      return {
        label: 'Module Verified',
        border: 'border-green-500/30',
        bg: 'bg-green-500/5',
        title: 'text-green-400',
        icon: 'text-green-400',
        iconSvg: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'module_not_found':
      return {
        label: 'Module Not Found',
        border: 'border-red-500/30',
        bg: 'bg-red-500/5',
        title: 'text-red-400',
        icon: 'text-red-400',
        iconSvg: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'function_not_found':
      return {
        label: 'Function Not Found',
        border: 'border-red-500/30',
        bg: 'bg-red-500/5',
        title: 'text-red-400',
        icon: 'text-red-400',
        iconSvg: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'skipped':
      return {
        label: 'Verification Skipped',
        border: 'border-dark-600',
        bg: 'bg-dark-700/50',
        title: 'text-dark-300',
        icon: 'text-dark-400',
        iconSvg: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        ),
      };
    case 'error':
    default:
      return {
        label: 'Verification Error',
        border: 'border-yellow-500/30',
        bg: 'bg-yellow-500/5',
        title: 'text-yellow-400',
        icon: 'text-yellow-400',
        iconSvg: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ),
      };
  }
}

function getStatusDescription(verification: GuardianBytecodeVerification): string {
  switch (verification.status) {
    case 'verified':
      return 'The module and function were found on-chain. The analysis is based on actual deployed bytecode.';
    case 'module_not_found':
      return 'This module could not be found on the blockchain. It may not be deployed, or you may be on the wrong network.';
    case 'function_not_found':
      return 'The module exists, but the specified function was not found. This could indicate a spoofing attempt or typo.';
    case 'skipped':
      return 'On-chain verification was skipped. The analysis is based on pattern matching only.';
    case 'error':
      return 'An error occurred while verifying the module on-chain. The analysis may be incomplete.';
    default:
      return 'Unknown verification status.';
  }
}
