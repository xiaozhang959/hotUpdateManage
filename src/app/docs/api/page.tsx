import { ApiDocsClient } from '@/components/api-docs-client'
import { Footer } from '@/components/layout/footer'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, ArrowUp, ArrowDown } from 'lucide-react'

export default async function ApiDocsPage() {
  const apiEndpoints = [
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
          description: '检查最新版本（使用API Key）',
          auth: 'X-API-Key',
          headers: `{
  "X-API-Key": "your-project-api-key"
}`,
          body: `{
  "currentVersion": "1.0.0",
  "platform": "android" // 可选
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.x",
    "downloadUrl": "/api/versions/{versionId}/download?i=0",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "",
    "createdAt": "2025-11-12T00:00:00.000Z",
    "updatedAt": "2025-11-12T00:00:00.000Z",
    "timestamp": 1762954467000,
    "isCurrent": true
  }
}`
        },
        {
          method: 'POST',
          path: '/api/v1/check',
          description: '检查最新版本（使用Bearer Token）',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          body: `{
  "currentVersion": "1.0.0",
  "projectId": "clxxxxx",  // 必需，指定项目ID
  "platform": "android"    // 可选
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.x",
    "downloadUrl": "/api/versions/{versionId}/download?i=0",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "",
    "createdAt": "2025-11-12T00:00:00.000Z",
    "updatedAt": "2025-11-12T00:00:00.000Z",
    "timestamp": 1762954467000,
    "isCurrent": true
  }
}`
        },
        {
          method: 'GET',
          path: '/api/v1/check/latest',
          description: '获取最新版本（使用Bearer Token）',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          body: `// GET请求，projectId通过URL参数传递
?projectId=clxxxxx`,
          response: `{
  "success": true,
  "data": {
    "version": "1.0.x",
    "downloadUrl": "/api/versions/{versionId}/download?i=0",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "",
    "createdAt": "2025-11-12T00:00:00.000Z",
    "updatedAt": "2025-11-12T00:00:00.000Z",
    "timestamp": 1762954467000,
    "isCurrent": true
  }
}`
        },
        {
          method: 'POST',
          path: '/api/versions/latest',
          description: '获取最新版本信息（使用API Key）',
          auth: 'X-API-Key',
          headers: `{
  "X-API-Key": "your-project-api-key"
}`,
          body: `// 可选，也可以在body中传递API Key
{
  "apiKey": "your-project-api-key"
}`,
          response: `{
  "success": true,
  "data": {
    "version": "1.0.x",
    "downloadUrl": "/api/versions/{versionId}/download?i=0",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "",
    "createdAt": "2025-11-12T00:00:00.000Z",
    "updatedAt": "2025-11-12T00:00:00.000Z",
    "timestamp": 1762954467000,
    "isCurrent": true
  }
}`
        },
        {
          method: 'POST',
          path: '/api/versions/latest',
          description: '获取最新版本信息（使用Bearer Token）',
          auth: 'Bearer Token',
          headers: `{
  "Authorization": "Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}`,
          body: `{
  "projectId": "clxxxxx" // 必需，指定要查询的项目ID
}`,
          response: `{
  "success": true,
  "data": {
    "version": "1.0.x",
    "downloadUrl": "/api/versions/{versionId}/download?i=0",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "",
    "createdAt": "2025-11-12T00:00:00.000Z",
    "updatedAt": "2025-11-12T00:00:00.000Z",
    "timestamp": 1762954467000,
    "isCurrent": true
  }
}`
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
          description: '创建新项目',
          auth: 'Bearer Token',
          body: `{
  "name": "项目名称"
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
          description: '获取项目的所有版本',
          auth: 'Bearer Token',
          response: `{
  "success": true,
  "data": [
    {
      "id": "versionxxxxx",
      "version": "1.0.1",
      "downloadUrl": "/api/versions/{versionId}/download?i=0",
      "md5": "0123456789abcdef0123456789abcdef",
      "size": 123456,
      "forceUpdate": false,
      "changelog": "",
      "isCurrent": true,
      "createdAt": "2025-11-12T00:00:00.000Z",
      "updatedAt": "2025-11-12T00:00:00.000Z",
      "timestamp": 1762954467000
    }
  ]
}`
        },
        {
          method: 'POST',
          path: '/api/v1/versions',
          description: '创建新版本（支持文件上传或URL）',
          auth: 'Bearer Token',
          body: `FormData:\n- projectId: 项目ID (required)\n- version: 版本号 (required)\n- changelog: 更新日志 (optional, 可为空)\n- forceUpdate: 是否强制更新 (boolean, optional)\n- file: 上传的文件 (File, optional)\n- url: 单个下载链接 (string, optional)\n- urls: 多个下载链接 (JSON array, optional)\n\n注意：上传方式优先级为 file > urls > url`,
          response: `{
  "success": true,
  "data": {
    "id": "versionxxxxx",
    "version": "1.0.1",
    "downloadUrl": "/api/versions/{versionId}/download?i=0",
    "md5": "0123456789abcdef0123456789abcdef",
    "size": 123456,
    "forceUpdate": false,
    "changelog": "",
    "projectId": "clxxxxx",
    "isCurrent": true,
    "createdAt": "2025-11-12T00:00:00.000Z",
    "updatedAt": "2025-11-12T00:00:00.000Z",
    "timestamp": 1762954467000
  },
  "message": "Version created successfully"
}`
        }
      ]
    }
  ]

  const codeExamples = {
    javascript: `// 使用API Key检查更新\nfetch('/api/v1/check', {\n  method: 'POST',\n  headers: { 'X-API-Key': 'your-project-api-key', 'Content-Type': 'application/json' },\n  body: JSON.stringify({ currentVersion: '1.0.0', platform: 'android' })\n})\n  .then(r => r.json())\n  .then(console.log)`,
    python: `# 使用API Key检查更新\nimport requests\nresp = requests.post('http://your-domain.com/api/v1/check', json={\n  'currentVersion': '1.0.0', 'platform': 'android'\n}, headers={'X-API-Key': 'your-project-api-key'})\nprint(resp.json())`,
    curl: `curl -X POST 'http://your-domain.com/api/v1/check' \\\n  -H 'X-API-Key: your-project-api-key' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"currentVersion":"1.0.0","platform":"android"}'`
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
        <ApiDocsClient apiEndpoints={apiEndpoints as any} codeExamples={codeExamples} />
      </main>
      <div id="bottom" />
      <Footer />
    </div>
  )
}
