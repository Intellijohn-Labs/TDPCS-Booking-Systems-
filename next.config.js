/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node:sqlite'],
  },
  allowedDevOrigins: [
    'chatting-specked-cassette.ngrok-free.dev',
    'localhost:3002',
    '127.0.0.1:3002',
  ],
  async redirects() {
    return [
      {
        source: '/admin/login',
        destination: '/login',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
