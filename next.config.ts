import type { NextConfig } from "next";

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

function normalizeTimeZone(value?: string) {
  const candidate = value?.trim().replace(/^:/, '')

  if (!candidate) {
    return DEFAULT_TIME_ZONE
  }

  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: candidate })
    return candidate
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
]

const nextConfig: NextConfig = {
  // 避免 Vercel/Next 文件追踪把运行期上传文件或构建缓存打进 Serverless Function。
  // 本地存储在运行时按路径读取，不应该作为部署产物随函数一起上传。
  outputFileTracingExcludes: {
    '/**': [
      './.git/**/*',
      './.next/cache/**/*',
      './.env*',
      './uploads/**/*',
      './public/uploads/**/*',
      './upd/**/*',
      './*.zip',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  // 向浏览器暴露统一时区（默认上海）
  env: {
    NEXT_PUBLIC_TZ: normalizeTimeZone(process.env.NEXT_PUBLIC_TZ || process.env.TZ),
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
