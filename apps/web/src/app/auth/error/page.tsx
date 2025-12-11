'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Error Icon */}
        <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-red-400"
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

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Authentication Error
        </h1>
        <p className="text-slate-400 mb-6">{getErrorMessage(error)}</p>

        {/* Error Details */}
        {error && (
          <div className="mb-6 p-3 bg-slate-800 border border-slate-700 rounded-lg">
            <p className="text-xs font-mono text-slate-500">
              Error code: {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block w-full px-4 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            Go Home
          </Link>
        </div>

        {/* Help */}
        <p className="mt-8 text-sm text-slate-500">
          Need help?{' '}
          <a
            href="mailto:support@movewatch.io"
            className="text-primary-400 hover:text-primary-300"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}

function getErrorMessage(error: string | null): string {
  switch (error) {
    case 'Configuration':
      return 'There is a problem with the server configuration. Please try again later.';
    case 'AccessDenied':
      return 'Access was denied. You may not have permission to sign in.';
    case 'Verification':
      return 'The verification link has expired or has already been used.';
    case 'Default':
    default:
      return 'An unexpected error occurred during authentication.';
  }
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="animate-pulse text-slate-400">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
