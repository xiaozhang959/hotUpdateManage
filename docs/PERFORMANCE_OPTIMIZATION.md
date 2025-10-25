# 性能优化指南

本文档记录了系统的性能优化方案和配置说明。

## 主要优化措施

### 1. 版本API缓存优化

**问题：** `/api/versions/latest` 接口响应缓慢（100-500ms）

**解决方案：**
- 实现多层缓存机制（内存 + Redis）
- 版本信息缓存60秒
- 轮询索引从数据库移到内存/Redis
- 批量更新策略（每100次请求更新一次数据库）

**效果：**
- 缓存命中时响应时间 < 10ms
- 减少90%以上的数据库查询

### 2. 初始化检查优化

**问题：** `/api/init/check` 在每个请求时都被调用（300ms+）

**解决方案：**
- API层面：实现内存缓存，5分钟刷新一次
- 中间件层面：缓存初始化状态1分钟
- API路由不再检查初始化状态

**效果：**
- 减少99%的初始化检查调用
- 页面加载速度提升50%+

## 缓存配置

### 环境变量配置

```env
# 版本缓存配置
VERSION_CACHE_TTL=60              # 版本信息缓存时间（秒）
ROTATION_BATCH_SIZE=100           # 轮询索引批量更新阈值

# 初始化状态缓存
INIT_CACHE_TTL=3600              # 初始化状态缓存时间（秒）
INIT_CACHE_STALE=300000          # 缓存过期时间（毫秒）

# Redis配置（可选）
REDIS_URL=redis://localhost:6379  # Redis连接字符串

# 监控配置
CACHE_MONITORING_ENABLED=false    # 是否启用缓存监控
CACHE_LOG_LEVEL=info             # 日志级别
```

### Redis部署（推荐）

#### Docker部署
```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:alpine \
  redis-server --appendonly yes
```

#### Redis Cloud
1. 注册 [Redis Cloud](https://redis.com/cloud/)
2. 创建免费数据库实例
3. 获取连接字符串配置到 `REDIS_URL`

## 性能监控

### 查看缓存统计
```bash
curl http://localhost:3000/api/cache/stats
```

响应示例：
```json
{
  "memoryCache": {
    "keys": 5,
    "hits": 450,
    "misses": 50,
    "hitRate": 0.9
  },
  "rotationIndexes": 3,
  "redisConnected": true
}
```

### 性能测试

使用提供的测试脚本：
```bash
# 修改 test-performance.js 中的 API_KEY
node test-performance.js
```

## 缓存策略

### 缓存失效场景

以下操作会清除相关缓存：
- 创建新版本
- 删除版本
- 设置当前版本
- 用户注册（清除初始化状态缓存）
- 系统初始化（清除初始化状态缓存）

### 缓存预热

系统支持缓存预热，在以下场景自动执行：
- 创建新版本后
- 设置当前版本后

## 进一步优化建议

### 1. 数据库优化
```sql
-- 添加复合索引
CREATE INDEX idx_version_project_version ON Version(projectId, version);
CREATE INDEX idx_version_project_current ON Version(projectId, isCurrent);
```

### 2. CDN配置
对于文件下载URL，建议使用CDN加速：
- 国内：阿里云OSS、腾讯云COS
- 国际：Cloudflare、AWS CloudFront

### 3. 负载均衡
多实例部署时：
- 必须配置Redis确保缓存一致性
- 使用Nginx或云负载均衡器
- Session使用Redis存储

### 4. 监控告警
建议监控指标：
- API响应时间P95 < 100ms
- 缓存命中率 > 80%
- 数据库查询时间 < 50ms
- Redis连接池使用率 < 80%

## 故障排查

### 缓存未生效
1. 检查环境变量配置
2. 查看控制台日志
3. 访问 `/api/cache/stats` 查看统计

### Redis连接失败
1. 确认Redis服务运行
2. 检查网络连接
3. 验证认证信息
4. 查看连接超时设置

### 性能下降
1. 检查缓存命中率
2. 分析慢查询日志
3. 检查数据库连接池
4. 监控内存使用情况

## 版本记录

- v1.0.0: 初始性能优化实现
  - 版本API缓存机制
  - 初始化检查优化
  - Redis支持
  - 性能监控工具