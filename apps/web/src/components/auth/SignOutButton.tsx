'use client';

import { signOut } from 'next-auth/react';

interface SignOutButtonProps {
  className?: string;
  variant?: 'default' | 'minimal';
}

export function SignOutButton({
  className = '',
  variant = 'default',
}: SignOutButtonProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleSignOut}
        className={`text-dark-400 hover:text-white transition-colors ${className}`}
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-dark-300 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 hover:text-white transition-colors ${className}`}
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
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      Sign Out
    </button>
  );
}
