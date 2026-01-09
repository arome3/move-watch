import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@movewatch/database';
import type { NextAuthOptions, User } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/email';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import * as jose from 'jose';
import { verifyWalletSignature } from './wallet';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      walletAddress?: string | null;
      tier: string;
    };
    accessToken?: string;
  }

  interface User {
    walletAddress?: string | null;
    tier: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    walletAddress?: string | null;
    tier: string;
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
    // GitHub OAuth provider
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),

    // Google OAuth provider
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // Email magic link provider (using Resend)
    ...(process.env.RESEND_API_KEY
      ? [
          EmailProvider({
            server: {
              host: 'smtp.resend.com',
              port: 465,
              secure: true,
              auth: {
                user: 'resend',
                pass: process.env.RESEND_API_KEY,
              },
            },
            from: process.env.EMAIL_FROM || 'MoveWatch <noreply@movewatch.io>',
          }),
        ]
      : []),

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
              tier: 'FREE',
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          walletAddress: user.walletAddress,
          tier: user.tier.toLowerCase(),
        } as unknown as User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.walletAddress = user.walletAddress;
        token.tier = (user.tier || 'free').toLowerCase();
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

      // Create a JWS-signed JWT for API authentication
      // This is compatible with jose.jwtVerify() on the API side
      if (token && process.env.NEXTAUTH_SECRET) {
        try {
          const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
          session.accessToken = await new jose.SignJWT({
            sub: token.id,
            id: token.id,
            email: token.email,
            walletAddress: token.walletAddress,
            tier: token.tier,
          })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d')
            .sign(secret);
        } catch (e) {
          console.error('Failed to sign JWT for session:', e);
        }
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

      // For OAuth providers (GitHub, Google), allow sign in
      if (account?.provider === 'github' || account?.provider === 'google') {
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
