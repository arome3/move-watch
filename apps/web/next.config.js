/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@movewatch/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

module.exports = nextConfig;
