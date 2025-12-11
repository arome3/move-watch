'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SignOutButton } from './auth/SignOutButton';

export function Header() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl font-bold text-primary-400">
              MoveWatch
            </Link>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
              beta
            </span>
          </div>

          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Simulator
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/alerts"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Alerts
            </Link>
            <a
              href="https://docs.movementlabs.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
            >
              Docs
            </a>

            {/* Auth Section */}
            <div className="ml-2 pl-4 border-l border-slate-700">
              {isLoading ? (
                <div className="w-20 h-8 bg-slate-800 rounded animate-pulse" />
              ) : session ? (
                <div className="flex items-center gap-3">
                  <UserMenu session={session} />
                  <SignOutButton variant="minimal" />
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

interface UserMenuProps {
  session: {
    user?: {
      name?: string | null;
      email?: string | null;
      walletAddress?: string | null;
      image?: string | null;
    };
  };
}

function UserMenu({ session }: UserMenuProps) {
  const displayName =
    session.user?.name ||
    session.user?.email?.split('@')[0] ||
    (session.user?.walletAddress
      ? `${session.user.walletAddress.slice(0, 6)}...${session.user.walletAddress.slice(-4)}`
      : 'User');

  return (
    <div className="flex items-center gap-2">
      {session.user?.image ? (
        <img
          src={session.user.image}
          alt=""
          className="w-8 h-8 rounded-full bg-slate-700"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <span className="text-xs font-medium text-white">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <span className="text-sm text-slate-300 hidden sm:block">{displayName}</span>
    </div>
  );
}
