import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@movewatch/database';
import type { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/email';
import { verifyWalletSignature } from './wallet';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      walletAddress?: string | null;
      tier: 'free' | 'pro' | 'enterprise';
    };
  }

  interface User {
    walletAddress?: string | null;
    tier: 'free' | 'pro' | 'enterprise';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    walletAddress?: string | null;
    tier: 'free' | 'pro' | 'enterprise';
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    // Email magic link provider
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM || 'noreply@movewatch.io',
    }),
    // Wallet authentication provider
    CredentialsProvider({
      id: 'wallet',
      name: 'Wallet',
      credentials: {
        address: { label: 'Wallet Address', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
        message: { label: 'Message', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.address || !credentials?.signature || !credentials?.message) {
          throw new Error('Missing wallet credentials');
        }

        // Verify the wallet signature
        const isValid = await verifyWalletSignature(
          credentials.address,
          credentials.signature,
          credentials.message
        );

        if (!isValid) {
          throw new Error('Invalid wallet signature');
        }

        // Find or create user by wallet address
        let user = await prisma.user.findFirst({
          where: { walletAddress: credentials.address },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              walletAddress: credentials.address,
              email: null,
              tier: 'free',
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          walletAddress: user.walletAddress,
          tier: user.tier as 'free' | 'pro' | 'enterprise',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.walletAddress = user.walletAddress;
        token.tier = user.tier || 'free';
      }

      // For wallet provider, ensure we have the user ID
      if (account?.provider === 'wallet' && user) {
        token.id = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.walletAddress = token.walletAddress;
        session.user.tier = token.tier;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Allow wallet sign in always
      if (account?.provider === 'wallet') {
        return true;
      }

      // For email provider, allow all verified emails
      if (account?.provider === 'email') {
        return true;
      }

      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // New user created - could send welcome email or trigger onboarding
      console.log('New user created:', user.id);
    },
  },
  debug: process.env.NODE_ENV === 'development',
};
