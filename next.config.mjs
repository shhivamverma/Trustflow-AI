/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;

