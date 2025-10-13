# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述
通用项目热更新管理系统，使用 Next.js + TypeScript + Tailwind CSS + Prisma + SQLite 构建。

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

### TODO
- [ ] 文件上传功能（支持本地上传）
- [ ] 首次管理员初始化流程
- [ ] 系统统计API
- [ ] 批量操作功能
- [ ] 数据导出功能
- [ ] 动画效果优化（Framer Motion）
- [ ] 深色模式切换
- [ ] 国际化支持
- [ ] 邮件通知功能
- [ ] 操作日志记录

## 项目结构

```
src/
├── app/              # Next.js App Router
│   ├── api/         # API路由
│   │   ├── auth/    # 认证相关API
│   │   ├── projects/# 项目管理API
│   │   ├── versions/# 版本API
│   │   ├── admin/   # 管理员API
│   │   └── profile/ # 个人信息API
│   ├── (auth)/      # 认证页面组
│   │   ├── login/   # 登录页
│   │   └── register/# 注册页
│   ├── dashboard/   # 用户仪表板
│   ├── projects/    # 项目管理
│   ├── admin/       # 管理员页面
│   ├── profile/     # 个人设置
│   └── docs/        # API文档
├── components/       # React组件
│   ├── ui/          # Shadcn/ui组件
│   └── layout/      # 布局组件（导航栏等）
├── lib/             # 工具库
│   ├── auth.ts      # NextAuth配置
│   ├── prisma.ts    # Prisma客户端
│   └── crypto.ts    # 加密工具
└── types/           # TypeScript类型定义
```

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建项目
npm run build

# 启动生产服务器
npm start

# 数据库迁移
npx prisma migrate dev

# 生成Prisma客户端
npx prisma generate

# 查看数据库
npx prisma studio

# 重置数据库
npx prisma migrate reset
```

## 技术栈

- **框架**: Next.js 15 (App Router, Turbopack)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4 + Shadcn/ui
- **数据库**: SQLite + Prisma ORM
- **认证**: NextAuth v5
- **加密**: bcryptjs
- **图标**: Lucide React
- **通知**: Sonner

## 数据模型

### User
- id, email, username, password (bcrypt加密)
- role: ADMIN | USER
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

## API接口

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
- `POST /api/projects/[id]/versions` - 创建新版本
- `DELETE /api/projects/[id]/versions/[versionId]` - 删除版本
- `POST /api/projects/[id]/versions/[versionId]/set-current` - 设置当前版本

### 管理员API
- `GET /api/admin/users` - 获取所有用户（仅管理员）
- `PATCH /api/admin/users/[id]` - 更新用户信息
- `DELETE /api/admin/users/[id]` - 删除用户

### 用户API
- `POST /api/auth/register` - 用户注册
- `PATCH /api/profile` - 更新个人信息

## 页面路由

- `/` - 首页（未登录）
- `/login` - 登录页
- `/register` - 注册页
- `/dashboard` - 用户仪表板
- `/projects` - 项目列表
- `/projects/[id]` - 版本管理
- `/admin` - 管理员面板
- `/profile` - 个人设置
- `/docs` - API文档

## 安全特性

1. **密码安全**: bcrypt加密，salt rounds=10
2. **API密钥**: crypto.randomBytes(32)生成
3. **认证**: NextAuth JWT策略
4. **权限控制**: 基于角色的访问控制（RBAC）
5. **CSRF保护**: NextAuth内置
6. **环境变量**: 敏感信息存储在.env.local

## 主题配色

- 主色: 橙色 (Orange-600)
- 辅助色: 琥珀色 (Amber)
- 背景: 渐变 from-orange-50 to-amber-50
- 暗色模式: from-gray-900 to-gray-800
- 成功: 绿色
- 错误: 红色
- 警告: 黄色

## 开发注意事项

1. **版本切换**: 新版本默认为当前版本，可随时切换
2. **级联删除**: 删除用户/项目会级联删除相关数据
3. **事务处理**: 版本切换使用事务保证一致性
4. **错误处理**: 所有API都有完整的错误处理
5. **加载状态**: 所有异步操作都有加载提示
6. **响应式**: 支持移动端和桌面端