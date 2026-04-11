/** @type {import('next').NextConfig} */
const isCpanel = process.env.DEPLOY_TARGET === 'cpanel';

const nextConfig = {
  // Static export only for cPanel shared hosting (set DEPLOY_TARGET=cpanel).
  // On Render/Vercel, omit output so next start works normally.
  ...(isCpanel ? { output: 'export' } : {}),
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
