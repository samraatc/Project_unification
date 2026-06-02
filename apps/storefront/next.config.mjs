/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Transpile workspace packages so Next can serve their TS sources directly.
  transpilePackages: [
    '@unified/design-system',
    '@unified/motion',
    '@unified/sdk',
    '@unified/shared-types',
    '@unified/ui-hooks',
  ],
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
