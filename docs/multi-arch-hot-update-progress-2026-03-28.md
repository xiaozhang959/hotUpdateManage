# 多架构热更新重构计划与当前进度（2026-03-28）

## 1. 背景与目标

目标是把当前“单版本单文件”的热更新模型，升级为“**逻辑版本 + 项目自定义架构 + 多产物文件**”的模型，并满足：

- 一个项目可以自定义任意数量的架构
- 一个逻辑版本可以包含多个架构主程序文件
- 一个逻辑版本可以包含架构专属附件和通用附件
- 客户端更新检查不再只看 `project.currentVersion`
- 引入“**架构最新可用版本**”概念：
  - 客户端带 `architecture + currentVersion` 查询时
  - 服务端返回“高于当前版本的、该架构最新可用版本”
  - 避免“最新逻辑版本缺少某架构时误判无更新/未发布”的逻辑 bug

---

## 2. 最终设计决策

### 2.1 版本模型
采用：

- **Version**：逻辑版本（统一版本号、更新日志、是否当前逻辑版本）
- **ProjectArchitecture**：项目级架构定义
- **VersionArtifact**：版本下的实际产物文件

### 2.2 发布策略
采用：

- **统一逻辑版本号**
- **允许部分发布**
- 不要求一次上传齐全部架构

### 2.3 客户端查询策略
采用：

- **架构最新可用版本** 作为更新判断依据
- 而不是只看当前逻辑版本

服务端应：

1. 找出项目下所有包含该架构主产物的版本
2. 过滤出 `version > currentVersion`
3. 取其中最高版本
4. 返回对应架构的主产物

### 2.4 对缺少架构的处理
- 如果该架构历史上从未发布过任何产物：`ARCH_NOT_PUBLISHED`
- 如果该架构发布过，但没有比当前版本更高的可用版本：`hasUpdate: false`
- 不应该因为“当前逻辑版本缺少该架构”就误返回错误

---

## 3. 计划中的主要实现项

### 3.1 数据层
- 扩展 Prisma 模型：
  - `ProjectArchitecture`
  - `VersionArtifact`
  - `Version.defaultForceUpdate`
  - `Version.publishState`
  - `Version.defaultArchitectureKey`
- 保留旧字段作为兼容映射，避免一次性打爆现有页面与接口
- 新增 migration，并把老版本数据迁移成默认架构 + 默认主产物

### 3.2 后端 API
需要改造：

- `POST /api/versions/latest`
- `POST/GET /api/v1/check`
- `GET/POST/PUT/DELETE /api/projects/[id]/versions`
- 管理员对应版本 API
- 新增项目架构管理 API
- 新增 `GET /api/version-artifacts/[artifactId]/download`
- 旧下载路由兼容到默认产物

### 3.3 前端
需要改造：

- 项目详情页（重点）
- 版本创建/编辑 UI
- 增加架构管理 UI
- 版本列表展示覆盖率与发布状态
- 共享类型与接口契约同步

---

## 4. 当前已经完成的改动

### 4.1 已完成：Prisma 主 schema 扩展
已修改文件：

- `prisma/schema.prisma`

已新增/调整内容：

- `Project.architectures`
- `Version.defaultForceUpdate`
- `Version.publishState`
- `Version.defaultArchitectureKey`
- `Version.artifacts`
- 新增 `ProjectArchitecture`
- 新增 `VersionArtifact`
- `StorageConfig.versionArtifacts`

说明：
- 旧字段（如 `downloadUrl`, `md5`, `size`, `forceUpdate`）暂时保留，用于兼容旧接口/旧页面
- 新模型会在后续 API 中作为主逻辑使用

### 4.2 已完成：新增 migration 文件
已新增目录：

- `prisma/migrations/20260328204000_multi_arch_hot_update/`

已写入 `migration.sql`，内容包括：

- 创建 `ProjectArchitecture`
- 创建 `VersionArtifact`
- 扩展 `Version` 表
- 为历史项目补默认架构 `default`
- 将历史版本文件迁移为默认架构下的主产物

### 4.3 已完成：共享类型扩展
已修改文件：

- `src/types/index.ts`

已新增/调整内容：

- `ProjectArchitecture`
- `VersionArtifact`
- 扩展 `Version`
  - `artifacts`
  - `artifact`
  - `publishState`
  - `defaultArchitectureKey`
  - `architectureCoverage`

### 4.4 已完成：核心版本/产物服务层初稿
已新增文件：

- `src/lib/version-artifacts.ts`

当前已写入的能力包括：

- 版本号比较 `compareVersionStrings`
- 版本降序排序 `sortVersionsDesc`
- 默认架构保障 `ensureDefaultArchitecture`
- 兼容旧请求体的产物归一化 `normalizeArtifactsPayload`
- 主产物选择 `pickVersionArtifact`
- 发布状态计算 `calculatePublishState`
- 版本覆盖率计算 `getVersionCoverage`
- 兼容字段回填 `syncVersionCompatibilityFields`
- “按架构查询最新可用版本” `getLatestAvailableVersionForArchitecture`
- 产物序列化与下载地址映射 `serializeArtifact` / `serializeVersionDetail`

---

## 5. 尚未完成的任务

### 5.1 Prisma / 数据库验证还没做完
还没完成：

- `prisma generate`
- 将 migration 真正应用到本地 `dev.db`
- 校验 `src/lib/version-artifacts.ts` 是否与生成后的 Prisma 类型完全匹配

备注：
- 中途执行 `npx prisma generate` 时被中断，需在新对话中继续确认
- 需要先确认当前 SQLite 漂移状态，再决定使用 `migrate dev`、`db push` 或 `db execute`

### 5.2 后端路由尚未开始改造
以下文件还未按新模型落地：

- `src/app/api/projects/[id]/versions/route.ts`
- `src/app/api/projects/[id]/versions/[versionId]/route.ts`
- `src/app/api/projects/[id]/versions/[versionId]/set-current/route.ts`
- `src/app/api/admin/projects/[id]/versions/route.ts`
- `src/app/api/admin/projects/[id]/versions/[versionId]/route.ts`
- `src/app/api/versions/latest/route.ts`
- `src/app/api/v1/check/route.ts`
- `src/app/api/v1/versions/route.ts`
- `src/app/api/versions/[versionId]/download/route.ts`

以及还未新增：

- 项目架构 CRUD API
- `version-artifacts/[artifactId]/download` 路由

### 5.3 项目查询接口还未同步新结构
以下接口还未改为返回架构/产物信息：

- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/admin/projects/route.ts`
- `src/app/api/admin/projects/[id]/route.ts`

### 5.4 前端页面还未改造
尚未实施的页面改造：

- `src/app/projects/[id]/page.tsx`（重点页面）
- `src/app/projects/page.tsx`
- `src/app/admin/page.tsx`
- `src/components/admin/ProjectDetailDialog.tsx`

当前这些页面仍然基于旧的“单版本单链接”交互模型。

### 5.5 其它 schema 变体未同步
尚未同步更新：

- `prisma/schema.mysql.prisma`
- `prisma/schema.postgresql.prisma`

如果后续需要支持非 SQLite，需要补齐这两份 provider schema。

---

## 6. 当前变更文件列表

### 已修改
- `prisma/schema.prisma`
- `src/types/index.ts`

### 已新增
- `prisma/migrations/20260328204000_multi_arch_hot_update/migration.sql`
- `src/lib/version-artifacts.ts`

### 尚未提交、但工作区里原本就存在的其他修改
- `.gitignore`
- `.serena/project.yml`

这些不是本次功能实现的核心改动，但当前仍在工作区中。

---

## 7. 已创建的 git 回溯点

本轮工作中已经创建了这些回溯点：

### 分支
- `backup/pre-multi-arch-20260328-203004`
- `backup/pre-progress-note-20260328-204143`

### stash 快照
- `pre-implement-multi-arch-20260328-203004`
- `pre-write-progress-note-20260328-204143`

---

## 8. 建议你在新对话里继续的顺序

建议新对话按下面顺序继续：

1. 先检查并完成 Prisma 生成与本地数据库同步
2. 先落后端服务端 API（尤其 `versions/latest` / `v1/check` / 版本 CRUD）
3. 再改 `projects/[id]/page.tsx` 为新的多架构版本管理界面
4. 最后做 admin 页与兼容接口收尾
5. 跑 lint / build / 手动接口验证

---

## 9. 新对话可直接引用的续做提示词

你可以在新对话里直接说：

> 继续基于 `docs/multi-arch-hot-update-progress-2026-03-28.md` 实现剩余部分。先从 Prisma generate / 数据库同步和后端 API 改造开始，再推进到 `src/app/projects/[id]/page.tsx` 的多架构版本管理 UI。


## 10. 2026-03-28 本轮续做进展（本次对话已完成）

### 10.1 已完成：Prisma 生成与本地数据库同步

本轮已完成：

- 执行 `npx prisma generate`
- 新增缺失迁移：`prisma/migrations/20251025150000_add_version_size/`
  - 用于补齐历史迁移链中遗漏的 `Version.size`
  - 解决本地 `dev.db` 与 migration history 漂移问题
- 执行 `npx prisma migrate resolve --applied 20251025150000_add_version_size`
- 执行 `npx prisma migrate dev --skip-generate`
- 已成功将 `20260328204000_multi_arch_hot_update` 应用到本地 `dev.db`

结果：

- 本地 Prisma schema / migration history / SQLite `dev.db` 已对齐
- 已验证 `src/lib/version-artifacts.ts` 可通过类型检查与构建

### 10.2 已完成：数据模型细节修正

在继续落地 API 时，发现 `VersionArtifact` 上原有唯一约束：

- `@@unique([versionId, architectureId, artifactType, fileRole])`

会导致同一架构下无法保存多个额外附件/镜像产物，不满足“多附件”设计目标。

已修正为普通索引：

- `@@index([versionId, architectureId, artifactType, fileRole])`

并同步修改：

- `prisma/schema.prisma`
- `prisma/migrations/20260328204000_multi_arch_hot_update/migration.sql`

这样保留查询性能，同时把“每个架构只能有一个主二进制产物”的约束放回服务层校验处理。

### 10.3 已完成：后端版本/架构 API 改造

已完成改造或新增：

- `src/app/api/projects/[id]/versions/route.ts`
- `src/app/api/projects/[id]/versions/[versionId]/route.ts`
- `src/app/api/projects/[id]/versions/[versionId]/set-current/route.ts`
- `src/app/api/admin/projects/[id]/versions/route.ts`
- `src/app/api/admin/projects/[id]/versions/[versionId]/route.ts`
- `src/app/api/versions/latest/route.ts`
- `src/app/api/v1/check/route.ts`
- `src/app/api/v1/versions/route.ts`
- `src/app/api/versions/[versionId]/download/route.ts`
- 新增 `src/app/api/version-artifacts/[artifactId]/download/route.ts`
- 新增项目架构 CRUD：
  - `src/app/api/projects/[id]/architectures/route.ts`
  - `src/app/api/projects/[id]/architectures/[architectureId]/route.ts`
  - `src/app/api/admin/projects/[id]/architectures/route.ts`
  - `src/app/api/admin/projects/[id]/architectures/[architectureId]/route.ts`

当前后端能力已支持：

- 基于新模型创建/更新/删除版本
- 兼容旧请求体（`downloadUrl` / `downloadUrls`）自动归一化为产物
- 项目级架构创建、编辑、删除、默认架构切换
- 当前版本切换与缓存刷新
- 基于 `architecture + currentVersion` 的“架构最新可用版本”查询
- `ARCH_NOT_PUBLISHED` 语义返回
- 旧下载路由兼容到默认/指定产物
- 新产物下载路由按 `artifactId` 下载

### 10.4 已完成：项目查询接口返回新结构

已完成改造：

- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/admin/projects/route.ts`
- `src/app/api/admin/projects/[id]/route.ts`

当前返回已包含：

- `architectures`
- 新版 `versions` 序列化结果
- 兼容字段（如 `downloadUrl` / `downloadUrls` / `artifact`）

因此旧页面不会立刻完全失效，同时为后续前端改造提供新字段。

### 10.5 已完成：Provider schema 变体同步

已同步更新：

- `prisma/schema.mysql.prisma`
- `prisma/schema.postgresql.prisma`

已补齐多架构热更新相关模型与字段，避免后续切换到 MySQL / PostgreSQL 时 schema 明显落后于主 schema。

### 10.6 已完成：公共服务层抽离

本轮新增：

- `src/lib/project-version-service.ts`
- `src/lib/project-architecture-service.ts`
- `src/lib/version-download.ts`

用途：

- 统一版本 CRUD 逻辑
- 统一架构 CRUD 逻辑
- 统一下载代理逻辑
- 降低 user/admin 路由重复代码，方便后续前端对接

### 10.7 已完成：基础验证

已完成验证：

- `npm run lint` ✅
- `npm run build` ✅

说明：

- 当前代码已通过 Next.js 生产构建与类型检查

### 10.8 目前仍未完成的部分

当前剩余重点主要集中在前端：

- `src/app/projects/[id]/page.tsx` 多架构版本管理 UI
- `src/app/projects/page.tsx`
- `src/app/admin/page.tsx`
- `src/components/admin/ProjectDetailDialog.tsx`
- 可能还需要补充 API 文档页面中的多架构示例

建议下一轮优先：

1. 改 `src/app/projects/[id]/page.tsx` 为多架构版本管理界面
2. 再同步 `projects/page.tsx` 与 admin 页面展示逻辑
3. 最后补接口文档示例与手动接口联调

### 10.9 本轮新增 git 回溯点

#### 分支
- `backup/pre-continue-multi-arch-20260328-204508`

#### stash 快照
- `pre-continue-multi-arch-20260328-204508`

### 10.10 本轮续做进展（用户中断前的前端改造草稿）

本轮已经开始把前端从“单版本单链接”模型切到“逻辑版本 + 项目架构 + 多产物”模型，但**当前仍属于未验收草稿状态**。

#### 已写入/新增的前端文件

- 重写：`src/app/projects/[id]/page.tsx`
- 重写：`src/app/projects/page.tsx`
- 重写：`src/app/admin/page.tsx`
- 重写：`src/components/admin/ProjectDetailDialog.tsx`
- 新增：`src/components/projects/project-types.ts`
- 新增：`src/components/projects/ProjectWorkbench.tsx`

#### 本轮已经落下去的前端方向

1. **抽出统一工作台组件**
   - 新增 `ProjectWorkbench.tsx`
   - 目标是统一 user/admin 侧的项目详情交互，减少重复维护
   - 当前已把下面能力放进这个组件草稿：
     - 项目概览
     - API Key 展示/复制/重置或重生成
     - 架构 CRUD 对话框
     - 多架构版本创建/编辑对话框
     - 版本列表卡片化展示（主程序 / 附件 / 覆盖率 / 发布状态）
     - API 调用示例展示

2. **项目详情页开始切到新工作台**
   - `src/app/projects/[id]/page.tsx` 已改为直接承载 `ProjectWorkbench`
   - 方向上已经从旧的大而杂页面切成“页壳 + 共享工作台”结构

3. **项目列表页开始改为新摘要视图**
   - `src/app/projects/page.tsx` 已重写为更轻量的项目总览
   - 现在的方向是：
     - 列表页只看项目摘要
     - 多架构版本的详细管理统一进入项目详情页处理

4. **管理员页开始接入共享详情工作台**
   - `src/components/admin/ProjectDetailDialog.tsx` 已改成包一层 admin 版 `ProjectWorkbench`
   - `src/app/admin/page.tsx` 也已重写为：
     - 用户管理 tab
     - 项目管理 tab
     - 项目详情弹窗中进入多架构工作台

#### 当前状态说明（非常重要）

- **本轮没有跑 `npm run lint`**
- **本轮没有跑 `npm run build`**
- 用户在前端改造进行中主动中断，因此这批改动**不能视为已完成验收**
- `src/components/projects/ProjectWorkbench.tsx` 当前文件较大，极可能还需要：
  - 修类型错误
  - 修 ESLint 报警
  - 做结构拆分（例如拆分版本表单/架构表单）
  - 手动联调创建版本、编辑版本、编辑架构等交互

### 10.11 目前明确还未完成的内容（基于本轮中断时状态）

当前真正还没收尾的点包括：

1. **前端代码还未完成验证**
   - 需要先执行：
     - `npm run lint`
     - `npm run build`
   - 预计会暴露一批 TS / ESLint / JSX 结构问题，需要逐个修正

2. **多架构版本表单仍需联调**
   - 重点检查：
     - 架构主程序新增/编辑
     - 通用附件 / 架构专属附件提交
     - 本地文件上传后的 payload 是否正确
     - admin/user 两套接口路径是否都打通

3. **管理员页虽然已开始改造，但仍需确认是否完整可用**
   - 用户管理对话框
   - 项目详情弹窗
   - 删除项目 / 删除用户后的刷新逻辑

4. **项目总览页需要确认是否保留足够的旧能力**
   - 当前已经朝“列表只做摘要、详情页做管理”的方向收敛
   - 需要下一轮确认这是否符合预期，避免无意中删掉必须保留的快捷操作

5. **建议补一个服务层问题检查项**
   - 在继续前端联调时，重点验证：
     - 编辑版本且复用原有本地产物/对象存储产物时
     - 后端清理旧产物逻辑会不会误删“仍然被新版本记录复用”的文件
   - 这一点本轮已注意到有潜在风险，但**还没修也还没验证**

6. **API 文档示例页仍未补完**
   - 目前只是把示例放进了工作台草稿
   - 若项目还有独立 API 文档页，下一轮可再同步补多架构示例

### 10.12 建议你在新对话里继续的顺序（更新版）

建议新对话直接按下面顺序继续：

1. 先打开并修 `src/components/projects/ProjectWorkbench.tsx` 的编译/类型问题
2. 跑 `npm run lint`
3. 跑 `npm run build`
4. 修复前端交互联调问题（版本创建/编辑、架构 CRUD、管理员弹窗）
5. 再验证“编辑版本复用旧产物是否会误删文件”的后端风险点
6. 最后再决定是否补独立 API 文档页示例

### 10.13 本轮新增 git 回溯点

#### 分支
- `backup/pre-frontend-multi-arch-20260328-212649`
- `backup/pre-doc-update-20260328-215903`

#### stash 快照
- `pre-frontend-multi-arch-20260328-212649`
- `pre-doc-update-20260328-215903`

### 10.14 本轮收尾结果（继续完成 10.10 ~ 10.13）

本轮已对 10.10 ~ 10.13 中断后的“草稿状态”做了一次收尾：

#### 已完成

1. **前端草稿完成静态验证**
   - 已修正 `src/components/projects/project-types.ts` 中的空接口问题
   - 已执行：
     - `npm run lint` ✅
     - `npm run build` ✅
   - 说明当前多架构前端草稿至少已经通过 ESLint、TypeScript 与 Next.js 生产构建校验

2. **修正工作台内置 API 示例**
   - 已修改：`src/components/projects/ProjectWorkbench.tsx`
   - 修正内容：
     - `/api/v1/check` 示例改为使用 `X-API-Key` 请求头
     - 示例请求体改为传 `architecture + currentVersion`
     - 示例响应结构改为与当前真实接口一致（`success + hasUpdate + data`）
   - 这样避免页面内示例“能看不能用”

3. **补齐独立 API 文档页的多架构示例**
   - 已修改：
     - `src/app/docs/api/page.tsx`
     - `src/components/api-docs-client.tsx`
   - 已更新内容：
     - `/api/v1/check`
     - `/api/versions/latest`
     - `/api/v1/versions`
     - `version-artifacts/{artifactId}/download`
   - 已把示例从旧的 `platform` / 单链接模型，更新为 `architecture` / 多产物模型

4. **修复“编辑版本复用旧产物可能误删文件”的后端风险**
   - 已修改：`src/lib/project-version-service.ts`
   - 处理方式：
     - 更新版本时，先比对“旧产物集合”和“新产物集合”，只清理真正被移除的产物
     - 真正执行文件清理前，再检查数据库中该产物是否仍被当前项目里的其他版本记录引用
   - 这样可避免：
     - 编辑版本但继续复用旧对象存储文件时被误删
     - 同项目内多个版本复用同一产物引用时被误删

#### 本轮结论

- 10.10 ~ 10.13 中最明确的**代码层未完成项**已经补齐：
  - 前端草稿已通过 lint / build
  - API 示例已同步到真实多架构接口
  - 后端产物清理风险已加防护

### 10.15 当前仍建议后续继续验证的点

虽然静态校验已通过，但**仍建议后续做登录态下的真实联调**：

1. 用户侧项目详情页：
   - 创建版本
   - 编辑版本
   - 架构 CRUD
   - 本地上传 / 对象存储上传

2. 管理员侧项目详情弹窗：
   - 打开工作台后的刷新行为
   - 删除用户 / 删除项目后的列表刷新
   - 管理员替项目上传文件时的存储配置选择是否符合预期

3. 若后续要进一步降复杂度，仍可考虑把 `ProjectWorkbench.tsx` 继续拆成：
   - 项目概览卡片
   - 架构表单
   - 版本表单
   - 版本列表

但当前从 **YAGNI / KISS** 角度看，只要没有新的维护痛点，暂时不必强行继续拆。

### 10.16 本轮新增 git 回溯点

#### 分支
- `backup/pre-continue-frontend-finish-20260328-220715`

#### stash 快照
- `pre-continue-frontend-finish-20260328-220715`

### 10.17 继续完成 10.15 中“管理员侧弹窗工作台”建议

本轮继续收敛了 10.15 里管理员侧尚未落稳的两项问题：

#### 已完成

1. **修复删除用户 / 删除项目后的管理员列表刷新与弹窗同步**
   - 已修改：`src/app/admin/page.tsx`
   - 已修改：`src/components/admin/ProjectDetailDialog.tsx`
   - 处理内容：
     - 删除用户后不再只刷新用户列表，而是同时刷新项目列表与统计卡片
     - 删除项目后，若该项目详情弹窗仍开着，会自动关闭对应弹窗状态
     - 管理员弹窗工作台内对项目的修改，会直接回写父级项目列表，避免标题、摘要、统计信息滞后
   - 结果：
     - 管理员页的“用户 / 项目 / 总版本数”不再因为级联删除而出现旧数据残留
     - 项目详情弹窗与列表摘要保持一致

2. **修复管理员代操作项目时的存储配置作用域**
   - 已新增：`src/lib/project-access.ts`
   - 已修改：
     - `src/lib/storage/index.ts`
     - `src/app/api/storage-configs/available/route.ts`
     - `src/app/api/upload/route.ts`
     - `src/app/api/uploads/initiate/route.ts`
     - `src/lib/uploads/resumable.ts`
     - `src/components/projects/ProjectWorkbench.tsx`
   - 处理内容：
     - 可用存储配置列表改为基于 **目标项目 owner + 全局配置** 解析，而不再只看当前管理员自己的配置
     - 上传接口和分片上传初始化接口新增项目归属校验，禁止把不属于该项目 owner / 全局的存储配置误用于当前项目
     - 分片上传会话额外记录 `storageOwnerUserId`，确保后续续传、组装、S3 multipart 也沿用正确的 owner 存储上下文
     - 工作台里的“目标存储”选项补充了作用域标签（项目所有者 / 全局 / 本地回退），并在项目概览区明确显示默认上传作用域
   - 结果：
     - 管理员替用户维护项目时，默认上传目标与存储下拉列表会按“该项目所属用户”来解释
     - 降低了误把管理员自己的私有存储配置写进他人项目版本记录的风险

#### 本轮验证

- 已执行：
  - `npx eslint src/app/admin/page.tsx src/components/admin/ProjectDetailDialog.tsx src/components/projects/ProjectWorkbench.tsx src/app/api/storage-configs/available/route.ts src/app/api/upload/route.ts src/app/api/uploads/initiate/route.ts src/lib/uploads/resumable.ts src/lib/storage/index.ts src/lib/project-access.ts` ✅
  - `npx tsc --noEmit --pretty false` ✅
  - `npm run build` ✅

#### 当前还建议继续做的真实联调

静态校验已通过，但仍建议做最后一轮登录态手工验证：

1. **用户侧工作台**
   - 创建版本
   - 编辑版本（含复用原有产物）
   - 架构 CRUD
   - 本地上传 / 对象存储上传

2. **管理员侧工作台**
   - 以管理员身份打开“他人项目”详情弹窗
   - 确认下拉中的存储配置来自“项目 owner + 全局”
   - 各做一次小文件上传与版本保存，确认最终落库的 `storageConfigId` 符合预期

3. **删除联动**
   - 删除一个带项目的普通用户，确认：
     - 用户列表刷新
     - 项目列表同步减少
     - 打开的该用户项目弹窗自动收起

### 10.18 本轮新增 git 回溯点

#### stash 快照
- `pre-continue-multi-arch-20260328-232541`
