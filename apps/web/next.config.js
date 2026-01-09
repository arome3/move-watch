/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@movewatch/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
  eslint: {
    // Skip ESLint during builds (run separately via pnpm lint)
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      // Redirect old /alerts routes to /alerts-and-actions
      {
        source: '/alerts',
        destination: '/alerts-and-actions?tab=alerts',
        permanent: true,
      },
      {
        source: '/alerts/:path*',
        destination: '/alerts-and-actions/alerts/:path*',
        permanent: true,
      },
      // Redirect old /actions routes to /alerts-and-actions
      {
        source: '/actions',
        destination: '/alerts-and-actions?tab=actions',
        permanent: true,
      },
      {
        source: '/actions/:path*',
        destination: '/alerts-and-actions/actions/:path*',
        permanent: true,
      },
      // Redirect old /automations routes to /alerts-and-actions
      {
        source: '/automations',
        destination: '/alerts-and-actions',
        permanent: true,
      },
      {
        source: '/automations/:path*',
        destination: '/alerts-and-actions/:path*',
        permanent: true,
      },
      // Redirect old /channels routes to /alerts-and-actions
      {
        source: '/channels',
        destination: '/alerts-and-actions?tab=channels',
        permanent: true,
      },
      {
        source: '/channels/:path*',
        destination: '/alerts-and-actions/channels/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
