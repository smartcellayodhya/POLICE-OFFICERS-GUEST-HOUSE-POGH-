/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  async rewrites() {
    return [
      {
        source: '/dashboard',
        destination: '/',
      },
      {
        source: '/matrix',
        destination: '/',
      },
      {
        source: '/bookings',
        destination: '/',
      },
      {
        source: '/monthly',
        destination: '/',
      },
      {
        source: '/monthly-collection',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
