import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 在构建时忽略 ESLint 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 向浏览器暴露统一时区（默认上海）
  env: {
    NEXT_PUBLIC_TZ: process.env.TZ || 'Asia/Shanghai',
    // 智能分片阈值（MB），默认 60，可按需覆盖
    NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB: process.env.NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB || '60',
    // 断点续传有效期（小时），默认 72 小时
    NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS: process.env.NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS || '72',
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
