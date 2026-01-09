import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add any custom middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: [
    // Protected routes
    '/simulator/:path*',
    '/dashboard/:path*',
    '/alerts-and-actions/:path*',
    '/alerts/:path*',
    '/actions/:path*',
    '/channels/:path*',
    '/settings/:path*',
  ],
};
