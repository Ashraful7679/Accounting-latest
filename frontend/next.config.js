/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Static HTML export for cPanel/shared hosting
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
