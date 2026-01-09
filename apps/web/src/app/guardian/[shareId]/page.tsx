'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { GuardianCheckResponse } from '@movewatch/shared';
import { getSharedGuardianCheck } from '@/lib/guardianApi';
import { GuardianResults, GuardianResultsSkeleton } from '@/components/guardian';

export default function SharedGuardianPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [result, setResult] = useState<GuardianCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;

    setLoading(true);
    getSharedGuardianCheck(shareId)
      .then((data) => {
        if (data) {
          setResult(data);
        } else {
          setError('Analysis not found or has expired');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load analysis');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [shareId]);

  return (
    <main className="min-h-screen bg-dark-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-orange-900/20 via-dark-900 to-dark-900 border-b border-dark-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/guardian"
              className="text-dark-400 hover:text-dark-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Guardian Analysis</h1>
              <p className="text-sm text-dark-400">
                Shared result: <code className="text-orange-400">{shareId}</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {loading ? (
          <GuardianResultsSkeleton />
        ) : error ? (
          <div className="bg-dark-800/50 rounded-xl border border-dark-700/50 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-dark-200 mb-2">Analysis Not Found</h2>
            <p className="text-dark-400 mb-6">{error}</p>
            <Link
              href="/guardian"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              Run New Analysis
            </Link>
          </div>
        ) : result ? (
          <GuardianResults result={result} />
        ) : null}
      </div>
    </main>
  );
}
