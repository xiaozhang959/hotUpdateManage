# Hot Update Manager

Hot Update Manager 是一个基于 Next.js 的应用热更新管理后台，面向
Android APK 或其他二进制产物的版本发布、架构分发、文件上传和公开更新检查场景。

当前代码库事实：

- 框架：Next.js 15 App Router + React 19 + TypeScript
- 数据库：Prisma 6，默认 SQLite，可切换 PostgreSQL / MySQL
- 认证：NextAuth v5，支持用户登录、角色和 API Token
- 存储：默认本地 `uploads/`，可通过存储配置使用 S3、OSS、WebDAV
- 上传：支持普通上传、服务端分片上传、S3 预签名/Multipart 直传

> README 只描述当前仓库中已经存在的能力；接口细节仍以 `src/app/api/**` 为准。


## 核心功能

### 用户与权限

- 首次初始化时创建第一个管理员账号。
- 支持管理员和普通用户角色。
- 支持注册、登录、邮箱验证、忘记密码和重置密码。
- 用户可生成 Bearer Token，用于公开 API 调用。

### 项目与版本

- 用户可创建多个项目，每个项目拥有独立 API Key。
- 项目支持自定义架构，例如 `arm64-v8a`、`armeabi-v7a`。
- 版本支持更新日志、MD5、文件大小、强制更新标记和发布状态。
- 支持设置当前版本，也支持按架构查找可用版本产物。

### 文件与存储

- 默认写入本地 `uploads/` 目录。
- 支持用户级和全局存储配置。
- 当前存储 Provider：`LOCAL`、`S3`、`OSS`、`WEBDAV`。
- 支持普通上传、分片上传、断点续传状态查询和中止上传。
- S3 支持预签名单文件上传和 Multipart 上传。

### 安全与运维

- 公开 API 带速率限制。
- 初始化接口可通过 `HOT_UPDATE_BOOTSTRAP_TOKEN` 保护。
- 登录、注册、初始化、重置密码等密码请求支持传输层请求体加密。
- 运行时配置支持缓存；可选 Redis。
- 提供数据库健康检查、缓存统计等管理接口。


## 技术栈

- **Web 框架**：Next.js `15.5.9`
- **UI**：React `19.0.0`、Tailwind CSS v4、Radix UI、Lucide React、Recharts
- **语言**：TypeScript 5
- **认证**：NextAuth v5 / Auth.js
- **数据库**：Prisma `6.17.1`
- **缓存**：内存缓存，可选 Redis（`ioredis`）
- **对象存储**：本地文件系统、AWS S3/兼容 S3、阿里云 OSS、WebDAV


## 快速开始

### 环境要求

- Node.js 18.18+（建议 Node.js 20 LTS 或更新的 LTS）
- npm
- Git

### 本地启动

```bash
npm install
cp .env.example .env
npm run db:setup
npm run db:migrate
npm run dev
```

启动后访问：

```text
http://localhost:3000
```

如果数据库中没有用户，系统会进入初始化流程，用于创建第一个管理员账号。

> `.env` 存放真实密钥和连接串，只应保留在本地或部署平台环境变量中。


## 环境变量

`.env.example` 是当前仓库的配置模板。常用配置如下。

### 最小本地配置

```env
DB_PROVIDER=sqlite
DATABASE_URL=file:./dev.db
SQLITE_URL=file:./dev.db
NEXTAUTH_SECRET=replace-with-random-secret
NEXTAUTH_URL=http://localhost:3000
```

生成 `NEXTAUTH_SECRET`：

```bash
openssl rand -base64 32
```

### 数据库配置

通过 `DB_PROVIDER` 选择数据库：

```env
DB_PROVIDER=sqlite       # sqlite | postgresql | mysql
```

常见连接变量：

```env
# SQLite
DATABASE_URL=file:./dev.db
SQLITE_URL=file:./dev.db

# PostgreSQL
POSTGRESQL_URL=postgresql://user:password@host:5432/db
POSTGRES_PRISMA_URL=postgresql://user:password@host:5432/db
POSTGRES_URL_NON_POOLING=postgresql://user:password@host:5432/db
DATABASE_URL_NON_POOLING=postgresql://user:password@host:5432/db

# MySQL
MYSQL_URL=mysql://user:password@host:3306/db
```

`npm run db:setup` 会根据 `DB_PROVIDER` 选择 Prisma schema 并生成客户端。

注意：该脚本在切换到 PostgreSQL 或 MySQL 时会覆盖 `prisma/schema.prisma`，
并把原文件备份为 `prisma/schema.backup.prisma`。

### 上传与缓存配置

```env
MAX_FILE_SIZE=100
RATE_LIMIT=60
REDIS_URL=

NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB=60
NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS=72
UPLOAD_SESSION_TTL_HOURS=72
UPLOAD_SESSION_SECRET=

VERSION_CACHE_TTL=60
ROTATION_BATCH_SIZE=100
INIT_CACHE_TTL=3600
INIT_CACHE_STALE=300000
```

### 初始化保护

公网部署建议配置：

```env
HOT_UPDATE_BOOTSTRAP_TOKEN=replace-with-random-token
```

配置后，初始化相关接口会要求携带正确令牌，降低未授权初始化风险。


## 登录请求加密

系统支持对包含密码的请求体进行加密，覆盖登录、注册、初始化、修改密码和重置密码等流程。

这不是 HTTPS 的替代品。生产环境仍必须启用 HTTPS/TLS。

生产环境建议配置固定 RSA 密钥对：

```env
AUTH_TRANSPORT_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
AUTH_TRANSPORT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
AUTH_REQUEST_MAX_AGE_MS=120000
```

生成密钥示例：

```bash
openssl genpkey -algorithm RSA -out auth-transport-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in auth-transport-private.pem -out auth-transport-public.pem
```

如果不配置固定密钥，系统会使用进程内临时密钥，适合本地开发，
但不适合重启频繁或多实例生产部署。


## 常用命令

### 开发与构建

```bash
npm run dev           # 启动开发服务器
npm run build         # 生产构建
npm run build:vercel  # Prisma generate + migrate deploy + Next build
npm run start         # 启动生产服务
npm run lint          # ESLint 检查
```



### 数据库

```bash
npm run db:setup           # 根据 DB_PROVIDER 准备 Prisma schema 并生成客户端
npm run db:migrate         # 开发环境创建/执行迁移
npm run db:migrate:deploy  # 生产环境应用迁移
npm run db:push            # 直接同步 schema，适合快速开发
npm run db:studio          # 打开 Prisma Studio
npm run db:seed            # 执行 prisma/seed.js
```

当前质量检查以 `npm run lint` 和 `npm run build` 为主。


## 项目结构

```text
hot-update-manager/
├── src/
│   ├── app/                  # App Router 页面和 API
│   │   ├── api/              # API 路由
│   │   ├── admin/            # 管理后台页面
│   │   ├── dashboard/        # 仪表盘页面
│   │   ├── docs/             # 前端文档页面
│   │   ├── init/             # 首次初始化页面
│   │   ├── login/            # 登录页面
│   │   ├── profile/          # 个人资料和存储配置页面
│   │   ├── projects/         # 项目管理页面
│   │   └── register/         # 注册页面
│   ├── components/           # React 组件
│   ├── lib/                  # 认证、数据库、上传、缓存、存储等服务代码
│   └── types/                # 共享类型
├── prisma/
│   ├── schema.prisma         # 当前 Prisma schema，默认 SQLite
│   ├── schema.mysql.prisma   # MySQL schema 模板
│   └── schema.postgresql.prisma
├── scripts/
│   └── setup-db.js           # 数据库 Provider 切换与 Prisma generate
├── docs/                     # 优化、安全和多架构热更新相关文档
├── public/                   # 静态资源
├── uploads/                  # 本地运行时上传目录
├── .env.example              # 环境变量模板
└── package.json
```


## API 概览

### 认证方式

公开更新接口支持两类认证方式。

项目 API Key：

```http
X-API-Key: your-project-api-key
```

用户 Bearer Token：

```http
Authorization: Bearer your-user-token
```

使用 Bearer Token 查询项目更新时，需要额外传入 `projectId`。

### 检查更新

```http
POST /api/v1/check
```

请求示例：

```json
{
  "currentVersion": "1.0.0",
  "architectureKey": "arm64-v8a"
}
```

请求头示例：

```http
X-API-Key: your-project-api-key
```

也可以使用兼容字段：`architecture` 或 `arch`。

响应示例：

```json
{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.2.0",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "file-md5",
    "size": 12345678,
    "forceUpdate": false,
    "changelog": "更新说明",
    "publishState": "READY",
    "architectureKey": "arm64-v8a",
    "architectureName": "ARM64",
    "artifactId": "artifact-id"
  }
}
```

获取最新版本信息：

```http
GET /api/v1/check?architectureKey=arm64-v8a
```

### 获取最新版本

```http
POST /api/versions/latest
```

请求体示例：

```json
{
  "apiKey": "your-project-api-key",
  "currentVersion": "1.0.0",
  "architectureKey": "arm64-v8a"
}
```

Bearer Token 方式：

```json
{
  "projectId": "project-id",
  "currentVersion": "1.0.0",
  "architectureKey": "arm64-v8a"
}
```

### 上传接口

普通上传：

```text
POST /api/upload
```

分片上传：

```text
POST /api/uploads/initiate
POST /api/uploads/chunk
POST /api/uploads/complete
POST /api/uploads/status
POST /api/uploads/abort
```

S3 直传：

```text
POST /api/uploads/s3/presign-single
POST /api/uploads/s3/complete-single
POST /api/uploads/s3/presign-part
POST /api/uploads/s3/complete
POST /api/uploads/s3/status
POST /api/uploads/s3/abort
```

更多管理后台、项目、版本、存储配置和用户接口请查看 `src/app/api/**`。


## 部署说明

### Vercel

建议使用 PostgreSQL，并至少配置：

```env
DB_PROVIDER=postgresql
POSTGRESQL_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
DATABASE_URL_NON_POOLING=postgresql://...
NEXTAUTH_SECRET=replace-with-random-secret
NEXTAUTH_URL=https://your-domain.com
```

构建命令：

```bash
npm run build:vercel
```

注意：Vercel 等无持久本地磁盘环境不适合依赖本地 `uploads/` 保存文件。
生产环境建议配置 S3/OSS/WebDAV 等外部存储。S3 直传流程不依赖服务端本地分片缓存。

### 自托管 Node.js

```bash
npm install
cp .env.example .env
npm run db:setup
npm run db:migrate:deploy
npm run build
npm run start
```

如使用 Nginx 反向代理，请确保转发 `Host`、`X-Forwarded-*` 等头，并启用 HTTPS。

当前仓库没有提供 Dockerfile 或 PM2 配置；如果需要 Docker/PM2 部署，请先补充对应配置。


## 安全建议

- 不要提交 `.env`、上传文件、数据库文件或任何密钥。
- 生产环境必须配置强随机 `NEXTAUTH_SECRET`，并建议同步配置 `AUTH_SECRET`。
- 公网初始化建议配置 `HOT_UPDATE_BOOTSTRAP_TOKEN`。
- 多实例部署建议配置固定 `AUTH_TRANSPORT_*_PEM`。
- 对象存储密钥应放在环境变量、数据库加密配置或部署平台 Secret 中。
- 生产环境建议使用 PostgreSQL/MySQL，不建议依赖本地 SQLite。
- 使用外部对象存储时，请确认下载 URL 的访问权限和有效期策略。
- 定期备份数据库和对象存储文件。


## 常见问题

### 首次管理员账号是什么？

没有固定默认账号。数据库没有用户时，首次初始化流程会创建第一个管理员账号。

### 文件默认保存在哪里？

默认保存到本地 `uploads/`。该目录属于运行时数据，不应提交到 Git。
也可以在管理端或个人资料中配置 `LOCAL`、`S3`、`OSS`、`WEBDAV` 存储。

### 为什么 Bearer Token 还要传 projectId？

Bearer Token 表示用户身份；用户可能拥有多个项目。因此用 Bearer Token 查询更新时，
需要通过 `projectId` 指定目标项目。

### 如何调整上传分片阈值？

修改环境变量后重启服务：

```env
NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB=60
NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS=72
UPLOAD_SESSION_TTL_HOURS=72
```

### 如何查看或调整缓存？

可配置 Redis 和缓存参数：

```env
REDIS_URL=redis://localhost:6379
VERSION_CACHE_TTL=60
ROTATION_BATCH_SIZE=100
INIT_CACHE_TTL=3600
INIT_CACHE_STALE=300000
```

缓存统计接口位于：

```text
GET /api/cache/stats
```


## 开发规范

- 变更前先阅读现有实现，不臆造 API、路径或配置项。
- 保持小步修改，避免无关重构。
- 使用 TypeScript，保持类型清晰。
- 提交前建议至少运行：

```bash
npm run lint
npm run build
```

提交信息可采用 Conventional Commits：

```text
feat: add version artifact management
fix: handle upload session expiration
docs: update readme
chore: update dependencies
```


## 许可证

本项目使用 MIT License 开源，详见根目录 `LICENSE` 文件。
