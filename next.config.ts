import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 配置允许的开发源，解决跨域警告
  // 使用包含端口的完整来源（不带协议）
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '198.18.0.1:3000',
  ],
  // 在构建时忽略 ESLint 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 配置静态文件服务
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
