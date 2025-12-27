# 安全加固（部署到公网前必读）

## 1) 初始化接口保护（高危）

本项目的首次初始化会通过 `/api/init`（以及兼容的 `/api/setup`）创建第一个管理员账户。
如果将服务直接暴露到公网，而初始化接口未做额外保护，可能被扫描器抢先创建管理员导致系统被接管。

**生产环境要求：**

- 必须设置环境变量 `HOT_UPDATE_BOOTSTRAP_TOKEN`
- 初始化请求必须携带匹配的 token（Header：`x-bootstrap-token` 或 Body：`bootstrapToken` 或 Query：`?token=...`）

建议在初始化完成后，移除/更换该 token，并在反向代理层面限制 `/init` 相关路径的访问来源。

## 2) 内部接口保护（可被滥用）

`/api/internal/log-request` 属于内部使用接口，已增加环境变量保护：

- 设置 `HOT_UPDATE_INTERNAL_TOKEN`
- 调用时携带 Header：`x-internal-token`

未配置该变量时，该接口将返回 404。

## 3) 上传安全（权限 + 路径）

- 分片上传会话增加了 `userId` 绑定校验：拿到 `uploadId` 也无法跨用户读写/删除会话目录
- `uploadId` 增加格式校验与目录越界保护，避免路径穿越导致的任意目录删除/写入风险
- 上传接口增加项目归属校验（管理员放行），避免任意用户向其他项目写入文件

## 4) SSRF（服务端请求伪造）

涉及服务端 `fetch` 外部 URL 的能力已增加 SSRF 防护（仅允许解析到公网 IP 的 http(s) URL），并阻止 localhost/私网/链路本地/保留地址段。

## 5) 服务器已被植入挖矿时的处理建议

如果你的 Ubuntu 服务器已经出现挖矿进程/异常 CPU 占用，建议优先：

1. 立即下线服务并隔离主机
2. 备份日志后重装/重建镜像（比“杀进程”更可靠）
3. 全量轮换密钥（SSH、云 AK/SK、DB、SMTP、JWT 等）
4. 检查并清理 `crontab`、`systemd`、`~/.ssh/authorized_keys`、`/tmp`、`/var/tmp` 等常见持久化点

