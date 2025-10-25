import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 在构建时忽略 ESLint 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 配置URL重写规则
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ]
  },
  // 允许外部图片
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
