'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { WalletConnect } from '@/components/auth/WalletConnect';
import { EmailSignIn } from '@/components/auth/EmailSignIn';
import { OAuthSignIn } from '@/components/auth/OAuthSignIn';
import Link from 'next/link';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">
              Move<span className="text-primary-400">Watch</span>
            </h1>
          </Link>
          <p className="mt-2 text-dark-400">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400 text-center">
              {getErrorMessage(error)}
            </p>
          </div>
        )}

        {/* Sign In Card */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 space-y-6">
          {/* Wallet Connect - Primary Option for Web3 users */}
          <div>
            <h2 className="text-sm font-medium text-dark-300 mb-3">
              Connect with Wallet
            </h2>
            <WalletConnect callbackUrl={callbackUrl} />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-dark-800 text-dark-500">or continue with</span>
            </div>
          </div>

          {/* OAuth Providers */}
          <div>
            <OAuthSignIn callbackUrl={callbackUrl} />
          </div>

          {/* Second Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-dark-800 text-dark-500">or</span>
            </div>
          </div>

          {/* Email Sign In */}
          <div>
            <h2 className="text-sm font-medium text-dark-300 mb-3">
              Continue with Email
            </h2>
            <EmailSignIn callbackUrl={callbackUrl} />
          </div>
        </div>

        {/* Terms */}
        <p className="mt-6 text-xs text-dark-500 text-center">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-primary-400 hover:text-primary-300">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary-400 hover:text-primary-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'Signin':
      return 'Try signing in with a different account.';
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCreateAccount':
    case 'EmailCreateAccount':
      return 'There was an error with the authentication provider.';
    case 'Callback':
      return 'There was an error during authentication.';
    case 'OAuthAccountNotLinked':
      return 'To confirm your identity, sign in with the same account you used originally.';
    case 'EmailSignin':
      return 'The email could not be sent. Please try again.';
    case 'CredentialsSignin':
      return 'Sign in failed. Check the details you provided are correct.';
    case 'SessionRequired':
      return 'Please sign in to access this page.';
    default:
      return 'An error occurred during sign in. Please try again.';
  }
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-dark-900 flex items-center justify-center">
          <div className="animate-pulse text-dark-400">Loading...</div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
