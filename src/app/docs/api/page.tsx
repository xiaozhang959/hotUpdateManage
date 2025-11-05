import { auth } from '@/lib/auth'
import { NavBar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ApiDocsClient } from '@/components/api-docs-client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, Package, Key, Rocket } from 'lucide-react'

export default async function ApiDocsPage() {
  const session = await auth()

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
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "修复已知问题",
    "createdAt": "2024-01-01T00:00:00.000Z"
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
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "修复已知问题",
    "createdAt": "2024-01-01T00:00:00.000Z"
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
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "修复已知问题",
    "createdAt": "2024-01-01T00:00:00.000Z"
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
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "size": 12345678,
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "修复已知问题",
    "createdAt": "2024-01-01T00:00:00.000Z",
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
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "size": 12345678,
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "修复已知问题",
    "createdAt": "2024-01-01T00:00:00.000Z",
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
      "downloadUrl": "https://example.com/app.apk",
      "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "forceUpdate": false,
      "changelog": "修复已知问题",
      "isCurrent": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}`
        },
        {
          method: 'POST',
          path: '/api/v1/versions',
          description: '创建新版本（支持文件上传或URL）',
          auth: 'Bearer Token',
          body: `FormData:
- projectId: 项目ID (required)
- version: 版本号 (required)
- changelog: 更新日志 (optional, 可为空)
- forceUpdate: 是否强制更新 (boolean, optional)
- file: 上传的文件 (File, optional)
- url: 单个下载链接 (string, optional)
- urls: 多个下载链接 (JSON array, optional)

注意：上传方式优先级为 file > urls > url`,
          response: `{
  "success": true,
  "data": {
    "id": "versionxxxxx",
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "修复已知问题",
    "projectId": "clxxxxx",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Version created successfully"
}`
        }
      ]
    }
  ]

  const codeExamples = {
    javascript: `// JavaScript/Node.js 示例
const axios = require('axios');

// 方式1: 使用API Key检查版本更新
async function checkUpdateWithApiKey() {
  try {
    const response = await axios.post('http://your-domain.com/api/v1/check', {
      currentVersion: '1.0.0',
      platform: 'android'
    }, {
      headers: {
        'X-API-Key': 'your-project-api-key',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.hasUpdate) {
      console.log('发现新版本:', response.data.data.version);
      console.log('下载链接:', response.data.data.downloadUrl);
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
}

// 方式2: 使用Bearer Token检查版本更新
async function checkUpdateWithToken() {
  try {
    const response = await axios.post('http://your-domain.com/api/v1/check', {
      currentVersion: '1.0.0',
      projectId: 'clxxxxx',  // 使用Token时必需
      platform: 'android'
    }, {
      headers: {
        'Authorization': 'Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.hasUpdate) {
      console.log('发现新版本:', response.data.data.version);
      console.log('下载链接:', response.data.data.downloadUrl);
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
}`,
    python: `# Python 示例
import requests

# 方式1: 使用API Key
def check_update_with_api_key():
    url = 'http://your-domain.com/api/v1/check'
    headers = {
        'X-API-Key': 'your-project-api-key',
        'Content-Type': 'application/json'
    }
    data = {
        'currentVersion': '1.0.0',
        'platform': 'android'
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        result = response.json()
        
        if result['hasUpdate']:
            print(f"发现新版本: {result['data']['version']}")
            print(f"下载链接: {result['data']['downloadUrl']}")
                
    except requests.exceptions.RequestException as e:
        print(f"检查更新失败: {e}")

# 方式2: 使用Bearer Token
def check_update_with_token():
    url = 'http://your-domain.com/api/v1/check'
    headers = {
        'Authorization': 'Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'Content-Type': 'application/json'
    }
    data = {
        'currentVersion': '1.0.0',
        'projectId': 'clxxxxx',  # 使用Token时必需
        'platform': 'android'
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        result = response.json()
        
        if result['hasUpdate']:
            print(f"发现新版本: {result['data']['version']}")
            print(f"下载链接: {result['data']['downloadUrl']}")
                
    except requests.exceptions.RequestException as e:
        print(f"检查更新失败: {e}")`,
    curl: `# cURL 命令行示例

# 方式1: 使用API Key
curl -X POST 'http://your-domain.com/api/v1/check' \\
  -H 'X-API-Key: your-project-api-key' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "currentVersion": "1.0.0",
    "platform": "android"
  }'

# 方式2: 使用Bearer Token
curl -X POST 'http://your-domain.com/api/v1/check' \\
  -H 'Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "currentVersion": "1.0.0",
    "projectId": "clxxxxx",
    "platform": "android"
  }'`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      {/* Use proper navigation bar if logged in */}
      {session ? (
        <NavBar user={session.user} />
      ) : (
        <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur dark:bg-gray-900/95">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                  <Package className="h-6 w-6 text-orange-600" />
                  <span className="text-xl font-bold">热更新管理</span>
                </Link>
                <span className="text-gray-400">/</span>
                <span className="text-lg font-medium">API 文档</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm">
                    <Home className="mr-2 h-4 w-4" />
                    首页
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                    登录
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            API 文档
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            热更新管理系统提供的完整API接口文档，帮助您快速集成版本检查和更新功能
          </p>
        </div>

        {/* Use the client component for interactive parts */}
        <ApiDocsClient apiEndpoints={apiEndpoints} codeExamples={codeExamples} />
      </main>
      
      {/* Add footer if user is logged in */}
      {session && <Footer />}
    </div>
  )
}
