import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '30mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/:path+',
        destination: '/read/:path*',
      },
    ];
  },
};

export default nextConfig;
