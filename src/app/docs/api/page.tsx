import { ApiDocsClient, type ApiCategory } from '@/components/api-docs-client'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, ArrowUp, ArrowDown } from 'lucide-react'

export default async function ApiDocsPage() {
  const apiEndpoints: ApiCategory[] = [
    {
      category: '认证',
      icon: 'Key',
      endpoints: [
        {
          method: 'GET',
          path: '/api/user/token',
          description: '获取当前用户的API Token',
          auth: 'Session',
          response: `{
  "token": "hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "createdAt": "2024-01-01T00:00:00.000Z"
}`
        },
        {
          method: 'POST',
          path: '/api/user/token',
          description: '生成或重新生成API Token',
          auth: 'Session',
          response: `{
  "token": "hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "message": "API Token已生成"
}`
        }
      ]
    },
    {
      category: '版本检查',
      icon: 'Rocket',
      endpoints: [
        {
          method: 'POST',
          path: '/api/v1/check',
          description: '检查指定架构是否有更新（使用 API Key，推荐客户端调用）',
          auth: 'X-API-Key',
          headers: `{
  "X-API-Key": "your-project-api-key"
}`,
          body: `{
  "currentVersion": "1.0.0",
  "architecture": "arm64-v8a"
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.1",
    "downloadUrl": "/api/version-artifacts/{artifactId}/download",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "1. 修复热更新失败",
    "createdAt": "2026-03-28T21:00:00.000Z",
    "updatedAt": "2026-03-28T21:10:00.000Z",
    "timestamp": 1774703400000,
    "publishState": "READY",
    "architectureKey": "arm64-v8a",
    "architectureName": "ARM64",
    "artifactId": "artifact_xxxxx"
  }
}`
        },
        {
          method: 'POST',
          path: '/api/v1/check',
          description: '检查指定架构是否有更新（使用 Bearer Token）',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          body: `{
  "projectId": "clxxxxx",
  "currentVersion": "1.0.0",
  "architecture": "arm64-v8a"
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.1",
    "downloadUrl": "/api/version-artifacts/{artifactId}/download",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "1. 修复热更新失败",
    "createdAt": "2026-03-28T21:00:00.000Z",
    "updatedAt": "2026-03-28T21:10:00.000Z",
    "timestamp": 1774703400000,
    "publishState": "READY",
    "architectureKey": "arm64-v8a",
    "architectureName": "ARM64",
    "artifactId": "artifact_xxxxx"
  }
}`
        },
        {
          method: 'GET',
          path: '/api/v1/check?projectId={projectId}&architecture=arm64-v8a',
          description: '获取指定架构的最新可用版本（使用 Bearer Token）',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          body: `// GET 请求，projectId / architecture 通过 URL 参数传递`,
          response: `{
  "success": true,
  "data": {
    "version": "1.0.3",
    "downloadUrl": "/api/version-artifacts/{artifactId}/download",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "1. 修复热更新失败",
    "createdAt": "2026-03-28T21:00:00.000Z",
    "updatedAt": "2026-03-28T21:10:00.000Z",
    "timestamp": 1774703400000,
    "publishState": "READY",
    "architectureKey": "arm64-v8a",
    "architectureName": "ARM64",
    "artifactId": "artifact_xxxxx"
  }
}`
        },
        {
          method: 'POST',
          path: '/api/versions/latest',
          description: '获取指定架构的最新可用版本（使用 API Key，兼容旧客户端）',
          auth: 'X-API-Key',
          headers: `{
  "X-API-Key": "your-project-api-key"
}`,
          body: `{
  "currentVersion": "1.0.0",
  "architecture": "arm64-v8a"
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.1",
    "downloadUrl": "/api/version-artifacts/{artifactId}/download",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "1. 修复热更新失败",
    "createdAt": "2026-03-28T21:00:00.000Z",
    "updatedAt": "2026-03-28T21:10:00.000Z",
    "timestamp": 1774703400000,
    "isCurrent": true,
    "publishState": "READY",
    "architectureKey": "arm64-v8a",
    "architectureName": "ARM64",
    "artifactId": "artifact_xxxxx"
  }
}`
        },
        {
          method: 'POST',
          path: '/api/versions/latest',
          description: '获取指定架构的最新可用版本（使用 Bearer Token）',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          body: `{
  "projectId": "clxxxxx",
  "architecture": "arm64-v8a",
  "currentVersion": "1.0.0"
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.1",
    "downloadUrl": "/api/version-artifacts/{artifactId}/download",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "1. 修复热更新失败",
    "createdAt": "2026-03-28T21:00:00.000Z",
    "updatedAt": "2026-03-28T21:10:00.000Z",
    "timestamp": 1774703400000,
    "isCurrent": true,
    "publishState": "READY",
    "architectureKey": "arm64-v8a",
    "architectureName": "ARM64",
    "artifactId": "artifact_xxxxx"
  }
}`
        },
        {
          method: 'GET',
          path: '/api/version-artifacts/{artifactId}/download',
          description: '按产物 ID 下载主程序或附件',
          auth: '公开（由服务端重定向或代理）',
          response: `302 Redirect
Location: https://storage.example.com/project/artifact.apk`
        }
      ]
    },
    {
      category: '项目管理',
      icon: 'Package',
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/projects',
          description: '获取所有项目',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          response: `{
  "success": true,
  "data": [
    {
      "id": "clxxxxx",
      "name": "我的项目",
      "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "currentVersion": "1.0.0",
      "architectures": [
        { "key": "arm64-v8a", "name": "ARM64", "isDefault": true, "enabled": true }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "versions": [...],
      "_count": { "versions": 5 }
    }
  ]
}`
        },
        {
          method: 'POST',
          path: '/api/v1/projects',
          description: '创建新项目（支持自定义 API Key）',
          auth: 'Bearer Token',
          body: `{
  "name": "项目名称",
  "apiKey": "my-stable-project-key"
}`,
          response: `{
  "success": true,
  "data": {
    "id": "clxxxxx",
    "name": "项目名称",
    "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "userId": "userxxxxx",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Project created successfully"
}`
        }
      ]
    },
    {
      category: '版本管理',
      icon: 'Rocket',
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/versions?projectId={projectId}',
          description: '获取项目的所有逻辑版本；可附带 architecture 参数查看指定架构视角',
          auth: 'Bearer Token',
          response: `{
  "success": true,
  "data": [
    {
      "id": "versionxxxxx",
      "version": "1.0.1",
      "downloadUrl": "/api/version-artifacts/{artifactId}/download",
      "md5": "0123456789abcdef0123456789abcdef",
      "size": 123456,
      "forceUpdate": false,
      "publishState": "PARTIAL",
      "defaultArchitectureKey": "arm64-v8a",
      "architectureCoverage": {
        "total": 2,
        "published": 1,
        "missingKeys": ["armeabi-v7a"]
      },
      "artifacts": [
        {
          "id": "artifact_xxxxx",
          "architectureKey": "arm64-v8a",
          "artifactType": "BINARY",
          "fileRole": "PRIMARY",
          "downloadUrl": "/api/version-artifacts/{artifactId}/download"
        }
      ],
      "changelog": "1. 修复热更新失败",
      "isCurrent": true,
      "createdAt": "2026-03-28T21:00:00.000Z",
      "updatedAt": "2026-03-28T21:10:00.000Z",
      "timestamp": 1774703400000
    }
  ]
}`
        },
        {
          method: 'POST',
          path: '/api/v1/versions',
          description: '创建新版本（支持 artifacts JSON、多架构主程序与附件）',
          auth: 'Bearer Token',
          body: `FormData:\n- projectId: 项目ID (required)\n- version: 版本号 (required)\n- changelog: 更新日志 (optional)\n- forceUpdate: 是否默认强制更新 (optional)\n- defaultArchitectureKey: 默认下载架构 (optional)\n- artifacts: JSON 数组 (recommended)\n  例如 [{"architectureKey":"arm64-v8a","artifactType":"BINARY","fileRole":"PRIMARY","displayName":"ARM64 主程序","downloadUrl":"https://cdn.example.com/app-arm64.apk","md5":"0123456789abcdef0123456789abcdef"}]\n\n兼容旧字段：file / url / urls 仍可继续使用，但新接入建议统一走 artifacts。`,
          response: `{
  "success": true,
  "data": {
    "id": "versionxxxxx",
    "version": "1.0.1",
    "downloadUrl": "/api/version-artifacts/{artifactId}/download",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "publishState": "READY",
    "defaultArchitectureKey": "arm64-v8a",
    "artifacts": [
      {
        "id": "artifact_xxxxx",
        "architectureKey": "arm64-v8a",
        "artifactType": "BINARY",
        "fileRole": "PRIMARY",
        "downloadUrl": "/api/version-artifacts/{artifactId}/download"
      }
    ],
    "changelog": "1. 修复热更新失败",
    "projectId": "clxxxxx",
    "isCurrent": true,
    "createdAt": "2026-03-28T21:00:00.000Z",
    "updatedAt": "2026-03-28T21:10:00.000Z",
    "timestamp": 1774703400000
  },
  "message": "Version created successfully"
}`
        }
      ]
    }
  ]

  const codeExamples = {
    javascript: `// 使用 API Key 检查 arm64-v8a 是否有更新\nfetch('/api/v1/check', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': 'your-project-api-key',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    currentVersion: '1.0.0',\n    architecture: 'arm64-v8a'\n  })\n})\n  .then(r => r.json())\n  .then(console.log)`,
    python: `# 使用 API Key 检查 arm64-v8a 是否有更新\nimport requests\nresp = requests.post('http://your-domain.com/api/v1/check', json={\n  'currentVersion': '1.0.0',\n  'architecture': 'arm64-v8a'\n}, headers={'X-API-Key': 'your-project-api-key'})\nprint(resp.json())`,
    curl: `curl -X POST 'http://your-domain.com/api/v1/check' \\\n  -H 'X-API-Key: your-project-api-key' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"currentVersion":"1.0.0","architecture":"arm64-v8a"}'`
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div id="top" />
      <div className="fixed top-4 left-4 z-50">
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="bg-white/80 dark:bg-gray-900/80 backdrop-blur border-orange-200 dark:border-gray-700">
            <Home className="h-4 w-4 mr-1" />
            返回主页
          </Button>
        </Link>
      </div>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <Link href="#top">
          <Button size="sm" variant="outline" className="bg-white/80 dark:bg-gray-900/80 backdrop-blur border-gray-200 dark:border-gray-700">
            <ArrowUp className="h-4 w-4 mr-1" />
            到顶部
          </Button>
        </Link>
        <Link href="#bottom">
          <Button size="sm" variant="outline" className="bg-white/80 dark:bg-gray-900/80 backdrop-blur border-gray-200 dark:border-gray-700">
            <ArrowDown className="h-4 w-4 mr-1" />
            到底部
          </Button>
        </Link>
      </div>
      <main className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-3xl font-bold mb-4">API 文档</h1>
        <ApiDocsClient apiEndpoints={apiEndpoints} codeExamples={codeExamples} />
      </main>
      <div id="bottom" />
      <Footer />
    </div>
  )
}
