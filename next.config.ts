import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 配置允许的开发源，解决跨域警告
  // 使用包含端口的完整来源（不带协议）
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '198.18.0.1:3000',
  ]
};

export default nextConfig;
