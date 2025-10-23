# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## 项目概述
企业级应用热更新管理平台，支持多项目管理、版本控制、自动更新检测等功能。使用 Next.js 15 + TypeScript + Tailwind CSS + Prisma + SQLite 构建。

## 架构概览

### 技术架构
- **前端：** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- **后端：** Next.js API Routes + NextAuth v5
- **数据库：** Prisma ORM + SQLite/PostgreSQL/MySQL
- **认证：** NextAuth v5 with JWT + 角色权限管理
- **缓存：** 内存缓存 + Redis（可选）
- **邮件：** Nodemailer + SMTP
- **文件存储：** 本地文件系统 + CDN支持

### 核心概念
1. **项目（Project）**：每个项目有独立的API密钥和版本管理
2. **版本（Version）**：支持多版本并存，可设置当前活跃版本
3. **热更新：** 客户端通过API获取最新版本信息
4. **角色管理：** ADMIN（管理员）和 USER（普通用户）
5. **系统配置：** 可动态配置注册、上传、邮件等功能

## 核心功能

### 已实现功能
- ✅ Next.js + TypeScript 项目初始化
- ✅ Tailwind CSS + Shadcn/ui 配置
- ✅ 暖色调主题系统（橙色/琥珀色主题）
- ✅ Prisma 数据库模型（User, Project, Version）
- ✅ NextAuth v5 完整鉴权系统
- ✅ 用户注册/登录系统（密码加密）
- ✅ 管理员和用户角色权限控制
- ✅ 项目管理（CRUD操作）
- ✅ 版本管理（创建、删除、切换当前版本）
- ✅ API接口（获取当前版本、密钥验证）
- ✅ 管理员面板（用户管理）
- ✅ 个人设置页面
- ✅ API文档页面
- ✅ 响应式导航栏
- ✅ SessionProvider集成
- ✅ 版本管理页面优化（Tab切换动画）
- ✅ API集成示例代码展示（cURL、JavaScript）
- ✅ API密钥显示/隐藏功能
- ✅ 一键复制功能（API密钥、代码示例）
- ✅ Framer Motion动画效果集成
- ✅ 文件上传功能（支持本地上传）
- ✅ 删除版本/项目时自动清理关联文件
- ✅ 管理员控制台增强（搜索、筛选、排序）
- ✅ 项目详情管理（查看完整信息、管理版本、重置API密钥）
- ✅ 版本管理对话框（管理员可管理任意项目版本）
- ✅ 现代化文件上传组件（支持拖放、点击、粘贴）
- ✅ 系统配置管理（动态控制系统行为）
- ✅ 配置化的注册和上传控制
- ✅ 简化页脚（保留版本信息、项目简介、开发者信息）
- ✅ 优化页面布局（主内容最小高度，确保页脚位置）
- ✅ 登录支持用户名/邮箱（用户可使用用户名或邮箱登录）
- ✅ 登录/注册页面显示系统名称和描述（从通用设置获取）
- ✅ SMTP邮箱配置功能（管理员可配置邮件服务）
- ✅ 邮箱验证功能（用户注册后需验证邮箱）
- ✅ 密码找回功能（通过邮件重置密码）

### TODO
- [ ] 首次管理员初始化流程
- [ ] 批量操作功能
- [ ] 数据导出功能
- [ ] 深色模式切换
- [ ] 国际化支持
- [ ] 操作日志记录
- [ ] WebSocket实时通知
- [ ] 版本对比功能
- [ ] 回滚机制

## 项目结构

```
src/
├── app/              # Next.js App Router
│   ├── api/         # API路由
│   │   ├── auth/    # 认证相关API
│   │   ├── projects/# 项目管理API
│   │   ├── versions/# 版本API
│   │   ├── admin/   # 管理员API
│   │   ├── profile/ # 个人信息API
│   │   ├── upload/  # 文件上传API
│   │   └── system/  # 系统配置API
│   ├── (auth)/      # 认证页面组
│   │   ├── login/   # 登录页
│   │   └── register/# 注册页
│   ├── dashboard/   # 用户仪表板
│   ├── projects/    # 项目管理
│   ├── admin/       # 管理员页面
│   │   └── settings/# 系统设置页面
│   ├── profile/     # 个人设置
│   └── docs/        # API文档
├── components/       # React组件
│   ├── ui/          # Shadcn/ui组件
│   │   └── file-upload.tsx # 现代化文件上传组件
│   ├── admin/       # 管理员组件
│   └── layout/      # 布局组件
│       ├── navbar.tsx   # 导航栏
│       └── footer.tsx   # 页脚（简化版）
├── lib/             # 工具库
│   ├── auth.ts      # NextAuth配置
│   ├── prisma.ts    # Prisma客户端
│   ├── crypto.ts    # 加密工具
│   ├── upload.ts    # 文件上传工具
│   ├── fileUtils.ts # 文件管理工具
│   ├── system-config.ts # 系统配置管理
│   └── email.ts     # 邮件服务模块
└── types/           # TypeScript类型定义
```

## 开发命令

### 基本开发流程
```bash
# 安装依赖
npm install

# 启动开发服务器（使用Turbopack）
npm run dev

# 构建项目
npm run build

# 构建用于Vercel部署
npm run build:vercel

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

### 数据库管理
```bash
# 自动配置数据库（根据DB_PROVIDER环境变量）
npm run db:setup

# 运行数据库迁移（开发环境）
npm run db:migrate

# 部署迁移（生产环境）
npm run db:migrate:deploy

# 推送模式变化到数据库
npm run db:push

# 打开数据库管理界面
npm run db:studio

# 填充测试数据
npm run db:seed

# 生成Prisma客户端
npx prisma generate

# 重置数据库
npx prisma migrate reset
```

### 测试和调试
```bash
# 性能测试（需要先修改test-performance.js中的API_KEY）
node test-performance.js

# 查看缓存统计
curl http://localhost:3000/api/cache/stats

# 数据库健康检查（管理员权限）
curl http://localhost:3000/api/admin/db-health
```

## 环境配置

### 必需环境变量
创建 `.env.local` 文件（可从 `.env.example` 复制）：

```env
# 数据库配置
DB_PROVIDER=sqlite              # sqlite | postgresql | mysql
SQLITE_URL=file:./dev.db        # SQLite 文件路径

# NextAuth 配置
NEXTAUTH_SECRET="your-secret-key-here"  # 使用 openssl rand -base64 32 生成
NEXTAUTH_URL="http://localhost:3000"

# 缓存配置（可选）
REDIS_URL=redis://localhost:6379
VERSION_CACHE_TTL=60
INIT_CACHE_TTL=300

# 邮件配置（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 默认管理员账号
首次启动后，使用以下账号登录：
- **用户名**: admin
- **密码**: admin123

⚠️ **请立即修改默认密码！**

## 技术栈

- **框架**: Next.js 15 (App Router, Turbopack)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4 + Shadcn/ui
- **数据库**: SQLite/PostgreSQL/MySQL + Prisma ORM
- **认证**: NextAuth v5
- **加密**: bcryptjs
- **图标**: Lucide React
- **通知**: Sonner
- **邮件**: Nodemailer
- **动画**: Framer Motion
- **缓存**: NodeCache + Redis
- **文件处理**: Formidable + fs-extra

## 架构模式与最佳实践

### 多层缓存架构
系统实现了多层缓存机制：
1. **版本API缓存**：`/api/versions/latest` 缓存60秒，响应时间 < 10ms
2. **初始化状态缓存**：减少99%的初始化检查调用
3. **轮询索引管理**：每100次请求批量更新一次数据库

### 数据库优化
- **索引优化**：针对高频查询添加复合索引，提升50-80%性能
- **SQLite优化**：WAL模式 + 64MB缓存 + 内存临时存储
- **查询优化**：解决N+1问题，使用`select`代替`include`
- **慢查询监控**：自动监控和警告 > 100ms的查询

### 文件安全管理
- **上传安全**：文件类型白名单、大小限制、可执行文件处理
- **文件管理**：级联删除，自动清理关联文件
- **多种上传方式**：拖拽、点击、Ctrl+V粘贴上传
- **存储结构**：`public/uploads/[projectId]/` 目录结构

### 系统配置管理
支持动态配置系统行为：
- 注册开关、文件上传开关、SMTP邮件配置
- 配置实时生效，支持重置为默认值
- 分类管理：general/upload/auth/security/email

## 数据模型

### User
- id, email, username, password (bcrypt加密)
- role: ADMIN | USER
- emailVerified: 邮箱是否验证
- verificationToken: 邮箱验证令牌
- verificationExpiry: 验证令牌过期时间
- resetToken: 密码重置令牌
- resetTokenExpiry: 重置令牌过期时间
- 关联: projects[]
- createdAt, updatedAt

### Project
- id, name, apiKey (唯一密钥)
- currentVersion (当前活跃版本)
- userId (所属用户)
- 关联: user, versions[]
- createdAt, updatedAt

### Version
- id, version, downloadUrl, md5
- forceUpdate, changelog
- isCurrent (是否为当前版本)
- projectId (所属项目)
- 唯一约束: [projectId, version]
- createdAt, updatedAt

### SystemConfig
- id, key (唯一), value, type
- category (general/upload/auth/security/email)
- description
- createdAt, updatedAt
- 新增邮件配置项:
  - smtp_enabled: 是否启用SMTP
  - smtp_host: SMTP服务器
  - smtp_port: SMTP端口
  - smtp_secure: 是否使用SSL/TLS
  - smtp_user: SMTP用户名
  - smtp_password: SMTP密码
  - smtp_from_email: 发件人邮箱
  - smtp_from_name: 发件人名称
  - email_verify_expire: 验证链接有效期
  - password_reset_expire: 重置链接有效期

## API接口

### 文件上传API
- `POST /api/upload` - 上传文件
  - 认证: 需要登录
  - 参数: file (File), projectId (string)
  - 返回: url, md5, fileName, originalName, size, uploadedAt
  - 限制: 100MB, 安全文件类型检查

### 公开API
- `POST /api/versions/latest` - 获取项目当前版本
  - 认证: X-API-Key header 或 body.apiKey
  - 返回: version, downloadUrl, md5, forceUpdate, changelog, isCurrent

### 项目管理API
- `GET /api/projects` - 获取用户项目列表
- `POST /api/projects` - 创建新项目
- `GET /api/projects/[id]` - 获取项目详情
- `PATCH /api/projects/[id]` - 更新项目
- `DELETE /api/projects/[id]` - 删除项目

### 版本管理API
- `GET /api/projects/[id]/versions` - 获取版本列表
- `POST /api/projects/[id]/versions` - 创建新版本（支持文件上传或URL）
- `DELETE /api/projects/[id]/versions/[versionId]` - 删除版本（自动清理文件）
- `POST /api/projects/[id]/versions/[versionId]/set-current` - 设置当前版本

### 管理员API
- `GET /api/admin/users` - 获取所有用户（仅管理员）
- `PATCH /api/admin/users/[id]` - 更新用户信息
- `DELETE /api/admin/users/[id]` - 删除用户
- `GET /api/admin/projects` - 获取所有项目（支持搜索筛选）
- `PATCH /api/admin/projects/[id]` - 更新项目信息
- `DELETE /api/admin/projects/[id]` - 删除项目（自动清理文件）
- `POST /api/admin/projects/[id]/reset-api-key` - 重置API密钥
- `POST /api/admin/projects/[id]/versions` - 为任意项目创建版本
- `DELETE /api/admin/projects/[id]/versions/[versionId]` - 删除版本
- `GET /api/admin/system/config` - 获取系统配置
- `POST /api/admin/system/config` - 更新系统配置
- `DELETE /api/admin/system/config` - 重置配置为默认值
- `POST /api/admin/system/smtp-test` - 测试SMTP配置

### 用户API
- `POST /api/auth/register` - 用户注册（支持配置控制、邮箱验证）
- `GET /api/auth/verify-email` - 邮箱验证
- `POST /api/auth/forgot-password` - 申请密码重置
- `GET /api/auth/reset-password` - 验证重置令牌
- `POST /api/auth/reset-password` - 重置密码
- `PATCH /api/profile` - 更新个人信息

### 系统API
- `GET /api/system/config` - 获取公开的系统配置

## 页面路由

- `/` - 首页（未登录）
- `/login` - 登录页
- `/register` - 注册页
- `/dashboard` - 用户仪表板
- `/projects` - 项目列表
- `/projects/[id]` - 版本管理
- `/admin` - 管理员面板
- `/admin/settings` - 系统设置
- `/profile` - 个人设置
- `/docs` - API文档

## 安全特性

1. **密码安全**: bcrypt加密，salt rounds=10
2. **API密钥**: crypto.randomBytes(32)生成
3. **认证**: NextAuth JWT策略
4. **权限控制**: 基于角色的访问控制（RBAC）
5. **CSRF保护**: NextAuth内置
6. **环境变量**: 敏感信息存储在.env.local
7. **文件上传安全**: 
   - 文件大小限制（可配置，默认100MB）
   - 危险文件类型检查和处理
   - 文件名安全处理（防止目录遍历）
   - 自动为可执行文件添加.txt后缀
   - 支持系统级禁用文件上传
8. **文件管理**: 删除版本/项目时自动清理关联文件
9. **系统配置**: 动态配置系统行为
   - 注册控制（开启/关闭）
   - 文件上传控制（开启/关闭）
   - 文件大小限制配置
   - 安全参数配置
   - 邮件服务配置（SMTP）
10. **邮件功能**: 
   - 邮箱验证（注册后发送验证邮件）
   - 密码找回（通过邮件重置密码）
   - SMTP配置测试（管理员可测试邮件发送）

## 主题配色

- 主色: 橙色 (Orange-600)
- 辅助色: 琥珀色 (Amber)
- 背景: 渐变 from-orange-50 to-amber-50
- 暗色模式: from-gray-900 to-gray-800
- 成功: 绿色
- 错误: 红色
- 警告: 黄色

## 重要API模式

### 公开API设计
核心热更新API采用双重认证：
```typescript
// Header认证（推荐）
headers: { 'X-API-Key': 'your-project-api-key' }

// Body认证
body: { "apiKey": "your-project-api-key" }
```

### 高频API优化
- `POST /api/versions/latest`：缓存60秒，减少90%数据库查询
- `GET /api/init/check`：缓存5分钟，减少99%调用次数
- 支持轮询索引管理，均衡负载

### 文件上传流程
1. **上传**: `POST /api/upload` - 返回url, md5, 大小
2. **创建版本**: `POST /api/projects/[id]/versions` - 支持文件或URL
3. **设置当前**: `POST /api/projects/[id]/versions/[versionId]/set-current`
4. **缓存预热**: 自动预热新版本缓存

## 常见问题与解决方案

### 数据库问题
```bash
# 数据库锁定问题
# 原因：长时间运行的事务
npx prisma migrate reset  # 重置数据库

# 慢查询问题
# 检查数据库健康
curl http://localhost:3000/api/admin/db-health
```

### 性能问题
```bash
# 检查缓存状态
curl http://localhost:3000/api/cache/stats

# 性能测试
# 先修改 test-performance.js 中的 API_KEY
node test-performance.js

# 启动Redis（推荐）
docker run -d --name redis -p 6379:6379 redis:alpine
```

### 邮件功能问题
```bash
# 测试SMTP配置（需要管理员登录）
curl -X POST http://localhost:3000/api/admin/system/smtp-test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com"}'
```

### 初始化问题
如果系统初始化失败，访问 `/init` 页面手动创建管理员账号。

## 开发注意事项

1. **版本切换**: 新版本默认为当前版本，可随时切换
2. **级联删除**: 删除用户/项目会级联删除相关数据
3. **事务处理**: 版本切换使用事务保证一致性
4. **错误处理**: 所有API都有完整的错误处理
5. **加载状态**: 所有异步操作都有加载提示
6. **响应式**: 支持移动端和桌面端
7. **文件存储**: 文件保存在 `public/uploads/[projectId]/` 目录
8. **文件清理**: 
   - 删除版本时自动删除对应文件
   - 删除项目时清理整个项目上传目录
   - 支持外部URL和本地文件的混合使用
9. **上传方式**: 版本创建支持多种方式
   - URL方式：直接输入下载链接
   - 文件上传：支持拖放、点击、粘贴上传
   - 系统级控制：管理员可禁用文件上传功能
10. **现代化文件上传组件特性**:
    - 拖放上传支持
    - 点击选择文件
    - Ctrl+V粘贴上传
    - 实时上传进度
    - 文件类型图标
    - 文件大小格式化
    - 错误提示友好
11. **系统配置管理**:
    - 通用设置（站点名称、描述）
    - 上传设置（开关、大小限制）
    - 认证设置（注册开关、角色、邮箱验证）
    - 安全设置（速率限制、会话）
    - 邮件设置（SMTP服务器配置）
    - 配置实时生效
    - 支持重置为默认值
    - SMTP配置测试功能
12. **页面布局优化**:
    - 简化页脚组件（仅保留核心信息）
    - 主内容区域设置最小高度 min-h-[calc(100vh-200px)]
    - 确保页脚始终在底部
    - 响应式布局适配
