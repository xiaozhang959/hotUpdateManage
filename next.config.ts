import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 在构建时忽略 ESLint 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 向浏览器暴露统一时区（默认上海）
  env: {
    NEXT_PUBLIC_TZ: process.env.TZ || 'Asia/Shanghai',
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
