import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@mendable/firecrawl-js'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
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
