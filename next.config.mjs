/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['nodemailer', 'node-cron'],
  },
};

export default nextConfig;
