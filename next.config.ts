import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      }
    ]
  },
  transpilePackages: ['geist'],

  // Proxy /api/* requests to the backend API server
  // This ensures consistent behavior between dev and prod
  async rewrites() {
    const apiTarget = process.env.API_URL || 'http://localhost:8090';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
