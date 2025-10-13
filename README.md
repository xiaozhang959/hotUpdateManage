# 🚀 Hot Update Manager - 通用项目热更新管理系统

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15.0.0-black?logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/Prisma-6.0-2D3748?logo=prisma" alt="Prisma"/>
  <img src="https://img.shields.io/badge/NextAuth-5.0-purple?logo=next.js" alt="NextAuth"/>
</div>

## 📋 项目简介

Hot Update Manager 是一个功能强大的通用项目热更新管理系统，为您的应用程序提供版本控制、自动更新检测和安全的更新分发服务。

### ✨ 核心特性

- 🔐 **完整的认证系统** - 基于 NextAuth v5 的安全认证，支持管理员和用户角色
- 📦 **项目管理** - 创建和管理多个项目，每个项目独立的 API 密钥
- 🔄 **版本控制** - 灵活的版本管理，支持强制更新和更新日志
- 🌐 **RESTful API** - 提供标准化的 API 接口供客户端集成
- 🎨 **优雅的界面** - 采用暖色调设计，流畅的动画效果
- 📱 **响应式设计** - 完美适配各种设备屏幕

## 🛠 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/) + [Shadcn/ui](https://ui.shadcn.com/)
- **数据库**: SQLite + [Prisma ORM](https://www.prisma.io/)
- **认证**: [NextAuth v5](https://authjs.dev/)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **加密**: bcryptjs

## 📦 快速开始

### 环境要求

- Node.js 18.17 或更高版本
- npm 或 yarn 或 pnpm

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/yourusername/hot-update-manager.git
cd hot-update-manager
```

2. **安装依赖**
```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. **环境配置**

创建 `.env.local` 文件：
```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# NextAuth 配置
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

⚠️ **重要**: 生产环境请生成安全的 `NEXTAUTH_SECRET`：
```bash
openssl rand -base64 32
```

4. **初始化数据库**
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. **启动开发服务器**
```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🚀 Vercel 部署指南

### 方法一：一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/hot-update-manager)

### 方法二：手动部署

#### 1. 准备工作

1. 注册 [Vercel 账号](https://vercel.com/signup)
2. 安装 Vercel CLI（可选）：
```bash
npm i -g vercel
```

#### 2. 配置数据库

Vercel 部署需要使用云数据库，推荐以下方案：

**选项 A：使用 Vercel Postgres（推荐）**

1. 在 Vercel Dashboard 中创建项目
2. 进入 Storage 标签页
3. 创建 Postgres 数据库
4. 更新 `prisma/schema.prisma`：
```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}
```

**选项 B：使用 PlanetScale**

1. 注册 [PlanetScale](https://planetscale.com/)
2. 创建数据库
3. 获取连接字符串
4. 更新 `prisma/schema.prisma`：
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  relationMode = "prisma"
}
```

**选项 C：使用 Supabase**

1. 注册 [Supabase](https://supabase.com/)
2. 创建项目
3. 获取数据库 URL
4. 更新配置文件

#### 3. 部署步骤

**使用 Vercel CLI：**

```bash
# 登录 Vercel
vercel login

# 部署项目
vercel

# 生产环境部署
vercel --prod
```

**使用 Git 集成：**

1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 在 [Vercel Dashboard](https://vercel.com/dashboard) 导入项目
3. 选择仓库和分支
4. 配置环境变量（见下方）
5. 点击 Deploy

#### 4. 环境变量配置

在 Vercel Dashboard > Settings > Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | 数据库连接字符串 | Vercel Postgres 会自动设置 |
| `NEXTAUTH_SECRET` | 生成的密钥 | 使用 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | https://your-domain.vercel.app | 您的生产环境 URL |

#### 5. 数据库迁移

部署后执行数据库迁移：

**方法 A：使用 Vercel CLI**
```bash
vercel env pull .env.local
npx prisma migrate deploy
```

**方法 B：在构建命令中包含迁移**

修改 `package.json`：
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

### 部署后配置

1. **验证部署**
   - 访问您的 Vercel URL
   - 检查所有页面是否正常加载
   - 测试登录功能

2. **监控和日志**
   - 在 Vercel Dashboard 查看函数日志
   - 设置错误通知
   - 配置性能监控

3. **自定义域名**（可选）
   - 在 Settings > Domains 添加自定义域名
   - 配置 DNS 记录
   - 等待 SSL 证书生成

## 📁 项目结构

```
hot-update-manager/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API 路由
│   │   ├── (auth)/       # 认证页面
│   │   ├── dashboard/    # 用户仪表板
│   │   └── admin/        # 管理员页面
│   ├── components/       # React 组件
│   │   ├── ui/           # UI 组件库
│   │   ├── auth/         # 认证组件
│   │   ├── projects/     # 项目管理组件
│   │   └── layout/       # 布局组件
│   ├── lib/              # 工具函数
│   │   ├── auth.ts       # NextAuth 配置
│   │   ├── prisma.ts     # Prisma 客户端
│   │   └── crypto.ts     # 加密工具
│   └── types/            # TypeScript 类型定义
├── prisma/
│   └── schema.prisma     # 数据库模型
├── public/               # 静态资源
└── package.json          # 项目配置
```

## 🔧 开发命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm start            # 启动生产服务器

# 数据库
npx prisma migrate dev     # 创建迁移
npx prisma generate        # 生成 Prisma 客户端
npx prisma studio          # 打开数据库管理界面
npx prisma db push         # 同步数据库架构

# 代码质量
npm run lint          # 运行 ESLint
npm run type-check    # TypeScript 类型检查
```

## 📡 API 文档

### 公开接口

#### 获取最新版本
```http
POST /api/versions/latest
Headers:
  X-API-Key: your-project-api-key
  # 或
  Content-Type: application/json

Body:
{
  "apiKey": "your-project-api-key"  // 如果不使用 header
}

Response:
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "downloadUrl": "https://...",
    "md5": "...",
    "forceUpdate": false,
    "changelog": "更新说明",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

## 🔒 安全建议

1. **生产环境密钥**
   - 使用强密码策略
   - 定期轮换 API 密钥
   - 启用速率限制

2. **数据库安全**
   - 使用连接池
   - 启用 SSL/TLS
   - 定期备份

3. **文件上传**
   - 限制文件大小
   - 验证文件类型
   - 使用对象存储（如 AWS S3）

## 🤝 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md)。

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

## 🆘 问题反馈

如果您在部署或使用过程中遇到问题：

1. 查看 [常见问题](https://github.com/yourusername/hot-update-manager/wiki/FAQ)
2. 搜索 [Issues](https://github.com/yourusername/hot-update-manager/issues)
3. 创建新的 Issue

## 📞 联系方式

- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your-email@example.com

---

<div align="center">
  Made with ❤️ using Next.js and TypeScript
</div>
