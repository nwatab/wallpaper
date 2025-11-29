import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'export',
  basePath: '/wallpaper',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
