# 🚀 Hot Update Manager

<div align="center">
  <h3>企业级应用热更新管理平台</h3>
  <p>为您的应用提供安全、可靠、高效的版本管理和自动更新服务</p>
  <br/>
  <img src="https://img.shields.io/badge/Next.js-15.0-black?style=flat-square&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/Prisma-6.0-2D3748?style=flat-square&logo=prisma" alt="Prisma"/>
  <img src="https://img.shields.io/badge/NextAuth-5.0-purple?style=flat-square&logo=next.js" alt="NextAuth"/>
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License"/>
</div>

## 📋 项目介绍

Hot Update Manager 是一个专为现代应用设计的热更新管理系统，支持多项目管理、版本控制、自动更新检测等功能。无论是移动应用、桌面软件还是嵌入式系统，都可以通过本系统实现平滑的版本升级。

### 🎯 适用场景

- **移动应用** - iOS/Android 应用的热更新和资源包管理
- **桌面软件** - Windows/Mac/Linux 客户端的自动更新
- **游戏更新** - 游戏资源包和补丁的分发管理
- **IoT 设备** - 嵌入式设备的固件升级管理
- **Web 应用** - PWA 应用的版本控制

## ✨ 核心功能

### 🔐 安全认证
- 基于 NextAuth v5 的企业级认证系统
- 支持多角色权限管理（管理员/用户）
- API Token 认证机制
- 邮箱验证和密码重置功能

### 📦 项目管理
- 多项目独立管理
- 每个项目独立的 API 密钥
- 项目级别的访问控制
- 详细的项目统计信息

### 🔄 版本控制
- 语义化版本管理
- 强制更新策略配置
- 增量更新支持
- 多下载链接轮询分发
- MD5 文件完整性校验
- 详细的更新日志

### 📊 数据分析
- API 调用统计
- 版本下载追踪
- 用户行为分析
- 可视化数据报表

### 🎨 用户界面
- 现代化的管理后台
- 响应式设计，支持移动端
- 暗色/亮色主题切换
- 流畅的动画效果

## 🛠 技术栈

### 前端技术
- **框架**: [Next.js 15](https://nextjs.org/) - React 全栈框架
- **语言**: [TypeScript 5](https://www.typescriptlang.org/) - 类型安全
- **UI 框架**: [Shadcn/ui](https://ui.shadcn.com/) - 组件库
- **样式**: [Tailwind CSS v4](https://tailwindcss.com/) - 原子化 CSS
- **动画**: [Framer Motion](https://www.framer.com/motion/) - 动效库
- **图表**: [Recharts](https://recharts.org/) - 数据可视化

### 后端技术
- **ORM**: [Prisma 6](https://www.prisma.io/) - 数据库 ORM
- **认证**: [NextAuth v5](https://authjs.dev/) - 身份认证
- **加密**: [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - 密码加密
- **验证**: [Zod](https://zod.dev/) - Schema 验证

### 数据库支持
- **SQLite** - 本地开发（默认）
- **PostgreSQL** - Vercel Postgres / Supabase
- **MySQL** - PlanetScale / AWS RDS

## 📦 快速开始

### 系统要求

- Node.js 18.17 或更高版本
- npm / yarn / pnpm 包管理器
- Git 版本控制

### 一键安装

```bash
# 克隆项目
git clone https://github.com/yourusername/hot-update-manager.git
cd hot-update-manager

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env.local

# 配置数据库（默认使用 SQLite）
npm run db:setup
npm run db:migrate

# 启动开发服务器
npm run dev
```

🎆 访问 [http://localhost:3000](http://localhost:3000) 即可使用！

### 详细安装步骤

#### 1️⃣ 环境配置

编辑 `.env.local` 文件：

```env
# 数据库类型选择：sqlite | postgresql | mysql
DB_PROVIDER=sqlite

# SQLite配置（本地开发）
SQLITE_URL=file:./dev.db

# NextAuth 配置
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

⚠️ **安全提示**：生产环境请使用以下命令生成密钥：
```bash
openssl rand -base64 32
```

#### 2️⃣ 数据库初始化

```bash
# 根据 DB_PROVIDER 自动配置数据库
npm run db:setup

# 运行数据库迁移
npm run db:migrate

# (可选) 打开数据库管理工具
npm run db:studio
```

#### 3️⃣ 默认管理员账号

首次启动后，使用以下账号登录：
- **用户名**: admin
- **密码**: admin123

🔒 请立即修改默认密码！

## 🚀 部署指南

### 🌐 Vercel 部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/hot-update-manager)

#### 快速部署步骤

1. **点击上方按钮** 或访问 [Vercel](https://vercel.com)
2. **导入项目** 从 GitHub/GitLab/Bitbucket
3. **配置环境变量**：
   ```
   DB_PROVIDER=postgresql
   NEXTAUTH_SECRET=<生成的密钥>
   NEXTAUTH_URL=https://your-app.vercel.app
   ```
4. **点击 Deploy** 等待部署完成

#### 数据库选项

| 提供商 | 特点 | 价格 |
|---------|------|------|
| **Vercel Postgres** | 一键集成，无需配置 | 免费套餐 |
| **Supabase** | 功能强大，完全免费 | 永久免费 |
| **PlanetScale** | MySQL兼容，高性能 | 免费套餐 |

### 📦 Docker 部署

```bash
# 构建镜像
docker build -t hot-update-manager .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e DB_PROVIDER=postgresql \
  -e DATABASE_URL="your-database-url" \
  -e NEXTAUTH_SECRET="your-secret" \
  --name hot-update \
  hot-update-manager
```

#### Docker Compose 配置

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_PROVIDER=postgresql
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=hotupdate
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 🖥 VPS/云服务器部署

#### 方案一：PM2 部署

```bash
# 安装依赖
npm install --production

# 构建项目
npm run build

# 使用 PM2 启动
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

**ecosystem.config.js**：
```javascript
module.exports = {
  apps: [{
    name: 'hot-update-manager',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster'
  }]
}
```

#### 方案二：Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### ☁️ 其他云平台

| 平台 | 特点 | 部署方式 |
|------|------|----------|
| **Railway** | 简单快速 | Git 自动部署 |
| **Render** | 免费套餐 | Docker/Git |
| **Fly.io** | 全球边缘节点 | Dockerfile |
| **AWS** | 企业级 | EC2/ECS/Lambda |
| **阿里云** | 国内访问快 | ECS/函数计算 |

## 📁 项目结构

```
hot-update-manager/
├── src/                      # 源代码目录
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # RESTful API 路由
│   │   │   ├── auth/         # 认证 API
│   │   │   ├── projects/     # 项目 API
│   │   │   └── versions/     # 版本 API
│   │   ├── (auth)/           # 认证页面
│   │   ├── dashboard/        # 用户控制台
│   │   └── admin/            # 管理员后台
│   ├── components/           # React 组件
│   │   ├── ui/               # 基础 UI 组件
│   │   ├── auth/             # 认证相关组件
│   │   ├── projects/         # 项目管理组件
│   │   └── layout/           # 布局组件
│   ├── lib/                  # 核心库
│   │   ├── auth.ts           # NextAuth 配置
│   │   ├── prisma.ts         # 数据库客户端
│   │   ├── crypto.ts         # 加密工具
│   │   └── utils.ts          # 工具函数
│   └── types/                # TypeScript 类型定义
├── prisma/                   # 数据库配置
│   ├── schema.prisma         # SQLite 模型（默认）
│   ├── schema.postgresql.prisma  # PostgreSQL 模型
│   └── schema.mysql.prisma   # MySQL 模型
├── scripts/                  # 脚本文件
│   └── setup-db.js           # 数据库配置脚本
├── public/                   # 静态资源
├── .env.example              # 环境变量模板
├── DEPLOYMENT.md             # 部署文档
└── package.json              # 项目配置
```

## 🔧 开发命令

### 基础命令

```bash
# 开发环境
npm run dev              # 启动开发服务器 (Turbopack)
npm run build            # 构建生产版本
npm run build:vercel    # Vercel 专用构建
npm start                # 启动生产服务器
npm run lint             # 代码检查
```

### 数据库命令

```bash
# 配置与初始化
npm run db:setup         # 根据 DB_PROVIDER 配置数据库
npm run db:migrate       # 创建/运行迁移（开发）
npm run db:migrate:deploy # 应用迁移（生产）
npm run db:push          # 直接同步架构
npm run db:studio        # 打开可视化管理工具
npm run db:seed          # 填充测试数据
```

### 其他命令

```bash
# Prisma
npx prisma generate      # 生成客户端代码
npx prisma format        # 格式化 schema 文件
npx prisma validate      # 验证 schema 文件

# 类型检查
npx tsc --noEmit         # TypeScript 类型检查
```

## 📡 API 文档

### 🔓 认证方式

所有 API 请求需要通过以下方式之一进行认证：

1. **Header 认证**（推荐）
   ```
   X-API-Key: your-project-api-key
   ```

2. **Body 认证**
   ```json
   {
     "apiKey": "your-project-api-key"
   }
   ```

### 📚 核心 API

#### 1. 获取最新版本

```http
POST /api/versions/latest
```

**请求示例：**
```javascript
fetch('https://your-domain.com/api/versions/latest', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-project-api-key',
    'Content-Type': 'application/json'
  }
})
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "version": "1.2.0",
    "downloadUrl": "https://cdn.example.com/app-v1.2.0.apk",
    "downloadUrls": [
      "https://cdn1.example.com/app-v1.2.0.apk",
      "https://cdn2.example.com/app-v1.2.0.apk"
    ],
    "md5": "5d41402abc4b2a76b9719d911017c592",
    "forceUpdate": false,
    "changelog": "1. 修复已知问题\n2. 性能优化\n3. 新增功能",
    "createdAt": "2024-01-15T08:00:00Z"
  }
}
```

#### 2. 检查版本更新

```http
POST /api/versions/check
```

**请求体：**
```json
{
  "currentVersion": "1.0.0",
  "platform": "android"  // android, ios, windows, mac, linux
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "hasUpdate": true,
    "latestVersion": "1.2.0",
    "forceUpdate": false,
    "updateInfo": {
      "version": "1.2.0",
      "downloadUrl": "https://...",
      "md5": "...",
      "size": 52428800,  // 字节
      "changelog": "..."
    }
  }
}
```

#### 3. 获取版本历史

```http
GET /api/versions/history?limit=10&offset=0
```

**响应：**
```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "version": "1.2.0",
        "releaseDate": "2024-01-15T08:00:00Z",
        "changelog": "...",
        "downloads": 1250
      }
    ],
    "total": 25,
    "hasMore": true
  }
}
```

### 🔄 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权，API Key 无效 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 📦 SDK 集成

#### JavaScript/TypeScript

```typescript
import { HotUpdateClient } from '@hotupdate/client';

const client = new HotUpdateClient({
  apiKey: 'your-project-api-key',
  baseUrl: 'https://your-domain.com'
});

// 检查更新
const update = await client.checkUpdate('1.0.0');
if (update.hasUpdate) {
  await client.downloadUpdate(update.downloadUrl);
}
```

#### Android (Kotlin)

```kotlin
val client = HotUpdateClient(
    apiKey = "your-project-api-key",
    baseUrl = "https://your-domain.com"
)

client.checkUpdate(currentVersion) { result ->
    if (result.hasUpdate) {
        client.downloadAndInstall(result.updateInfo)
    }
}
```

#### iOS (Swift)

```swift
let client = HotUpdateClient(
    apiKey: "your-project-api-key",
    baseURL: "https://your-domain.com"
)

client.checkUpdate(currentVersion: "1.0.0") { result in
    if result.hasUpdate {
        client.downloadUpdate(result.updateInfo)
    }
}
```

## 🔒 安全最佳实践

### 🔐 认证与授权

- **密钥管理**
  - ✅ 使用环境变量存储敏感信息
  - ✅ 定期轮换 API 密钥（建议 90 天）
  - ✅ 使用强密码：至少 12 位，包含大小写、数字和特殊字符
  - ❌ 不要在代码中硬编码密钥

- **API 安全**
  - ✅ 启用 HTTPS/TLS 加密传输
  - ✅ 实施速率限制（默认 60 次/分钟）
  - ✅ 验证所有输入参数
  - ✅ 使用 CORS 策略限制跨域访问

### 🗓 数据库安全

- **连接安全**
  - ✅ 使用 SSL/TLS 连接
  - ✅ 限制数据库访问 IP
  - ✅ 使用连接池防止连接泄漏
  - ✅ 分离开发和生产数据库

- **数据保护**
  - ✅ 定期备份（建议每日）
  - ✅ 加密敏感数据
  - ✅ 实施数据访问审计
  - ✅ 遵循 GDPR/CCPA 等隐私法规

### 📁 文件上传安全

- **验证策略**
  - ✅ 限制文件大小（默认 100MB）
  - ✅ 白名单文件类型验证
  - ✅ 文件内容扫描（病毒检测）
  - ✅ 重命名上传文件避免路径注入

- **存储安全**
  - ✅ 启用版本控制
  - ✅ 设置访问权限

## ❓ 常见问题 (FAQ)

### Q: 如何修改默认管理员密码？
A: 登录后进入【设置】→【修改密码】，输入原密码和新密码即可。

### Q: 支持哪些文件类型的热更新？
A: 支持所有文件类型，包括：
- 移动应用：APK, IPA, AAB
- 桌面程序：EXE, MSI, DMG, DEB, RPM
- 资源文件：ZIP, TAR, 7Z
- 补丁文件：PATCH, DIFF

### Q: 如何备份数据？
A: 
```bash
# SQLite 备份
cp prisma/dev.db prisma/backup-$(date +%Y%m%d).db

# PostgreSQL/MySQL 备份
pg_dump database_name > backup.sql
mysqldump database_name > backup.sql
```

### Q: 如何监控系统运行状态？
A: 
- 使用 PM2: `pm2 monit`
- 查看日志: `pm2 logs`
- 使用 Vercel: Dashboard 中的 Analytics 面板

### Q: API 调用频率限制如何调整？
A: 修改 `.env.local` 中的 `RATE_LIMIT` 参数，默认 60 次/分钟。

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是新功能、Bug 修复还是文档改进。

### 如何贡献

1. **Fork 项目**
   ```bash
   git clone https://github.com/yourusername/hot-update-manager.git
   cd hot-update-manager
   git checkout -b feature/your-feature-name
   ```

2. **开发和测试**
   ```bash
   npm install
   npm run dev
   # 做出修改
   npm run lint
   npm run build
   ```

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/your-feature-name
   ```

4. **创建 Pull Request**

### 代码规范

- 遵循 TypeScript 类型安全
- 使用有意义的变量名
- 添加必要的注释
- 编写单元测试

### Commit 规范

使用语义化版本控制：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `chore`: 构建/工具

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

---

<div align="center">
  <sub>Built with ❤️ by developers, for developers</sub>
  <br>
  <sub>Powered by Next.js • TypeScript • Prisma</sub>
</div>
