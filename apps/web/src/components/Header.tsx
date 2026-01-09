'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from './auth/SignOutButton';

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isLoading = status === 'loading';

  // Detect if on landing page
  const isLandingPage = pathname === '/';

  // Navigation items for app pages
  const appNavItems = [
    { href: '/simulator', label: 'Simulator' },
    { href: '/guardian', label: 'Guardian' },
    { href: '/alerts-and-actions', label: 'Alerts & Actions' },
  ];

  // Navigation items for landing page
  const landingNavItems = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How It Works' },
  ];

  // Only show app nav items if user is signed in
  const navItems = isLandingPage ? landingNavItems : (session ? appNavItems : []);

  return (
    <header
      className={`border-b border-dark-800 sticky top-0 z-50 ${
        isLandingPage
          ? 'bg-dark-900/50 backdrop-blur-md'
          : 'bg-dark-900/50 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link
              href={session ? '/dashboard' : '/'}
              className="text-xl font-display font-semibold text-primary-400 hover:text-primary-300 transition-colors tracking-tight"
            >
              MoveWatch
            </Link>
            <span className="text-xs text-dark-500 bg-dark-800 px-2 py-0.5 rounded">
              beta
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) =>
              'external' in item && item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-dark-400 hover:text-dark-300 transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'text-white'
                      : 'text-dark-300 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}

            {/* Auth Section */}
            <div className="ml-2 pl-4 border-l border-dark-700">
              {isLoading ? (
                <div className="w-20 h-8 bg-dark-800 rounded animate-pulse" />
              ) : session ? (
                isLandingPage ? (
                  // On landing page when signed in - show Go to Dashboard
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  // On app pages when signed in - show user menu
                  <div className="flex items-center gap-3">
                    <UserMenu session={session} />
                    <Link
                      href="/settings"
                      className="p-1.5 text-dark-400 hover:text-dark-300 transition-colors"
                      title="Settings"
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
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </Link>
                    <SignOutButton variant="minimal" />
                  </div>
                )
              ) : (
                // Not signed in - show Sign In and Get Started
                <div className="flex items-center gap-3">
                  <Link
                    href="/auth/signin"
                    className="text-sm font-medium text-dark-300 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signin"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg hover:from-primary-400 hover:to-primary-500 transition-all shadow-lg shadow-primary-500/25"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            {isLoading ? (
              <div className="w-8 h-8 bg-dark-800 rounded animate-pulse" />
            ) : session ? (
              <Link
                href={isLandingPage ? '/dashboard' : '/settings'}
                className="p-2 text-dark-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
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
          className="w-8 h-8 rounded-full bg-dark-700"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <span className="text-xs font-medium text-white">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <span className="text-sm text-dark-300 hidden sm:block">{displayName}</span>
    </div>
  );
}
