'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import { NavBar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Copy, ChevronRight, Key, Package, Rocket, Shield, FileText, Code2, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export default function DocsPage() {
  const { data: session, status } = useSession()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showScrollButtons, setShowScrollButtons] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollButtons(window.scrollY > 200)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    toast.success('代码已复制到剪贴板')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  const apiEndpoints = [
    {
      category: '认证',
      icon: Key,
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
        },
        {
          method: 'POST',
          path: '/api/user/token/delete',
          description: '删除API Token',
          auth: 'Session',
          response: `{
  "success": true,
  "message": "API Token已删除"
}`
        }
      ]
    },
    {
      category: '项目管理',
      icon: Package,
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/projects',
          description: '获取所有项目',
          auth: 'Bearer Token',
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
        },
        {
          method: 'POST',
          path: '/api/v1/projects/delete',
          description: '删除项目',
          auth: 'Bearer Token',
          body: `{
  "projectId": "项目ID"
}`,
          response: `{
  "success": true,
  "message": "Project deleted successfully"
}`
        }
      ]
    },
    {
      category: '版本管理',
      icon: Rocket,
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
- changelog: 更新日志 (required)
- forceUpdate: 是否强制更新 (boolean)
- file: 上传的文件 (File, optional)
- url: 单个下载链接 (string, optional)
- urls: 多个下载链接 (JSON array, optional)`,
          response: `{
  "success": true,
  "data": {
    "id": "versionxxxxx",
    "projectId": "projectxxxxx",
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "更新内容",
    "isCurrent": true
  },
  "message": "Version created successfully"
}`
        },
        {
          method: 'POST',
          path: '/api/v1/versions/delete',
          description: '删除版本',
          auth: 'Bearer Token',
          body: `{
  "versionId": "版本ID"
}`,
          response: `{
  "success": true,
  "message": "Version deleted successfully"
}`
        }
      ]
    },
    {
      category: '版本检查',
      icon: Shield,
      endpoints: [
        {
          method: 'POST',
          path: '/api/v1/check',
          description: '检查更新（使用项目API Key）',
          auth: 'X-API-Key',
          body: `{
  "currentVersion": "1.0.0"
}`,
          response: `{
  "success": true,
  "hasUpdate": true,
  "data": {
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "更新内容",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}`
        },
        {
          method: 'GET',
          path: '/api/v1/check/latest',
          description: '获取最新版本信息（使用项目API Key）',
          auth: 'X-API-Key',
          response: `{
  "success": true,
  "data": {
    "version": "1.0.1",
    "downloadUrl": "https://example.com/app.apk",
    "md5": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "forceUpdate": false,
    "changelog": "更新内容",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}`
        }
      ]
    }
  ]

  const codeExamples = {
    javascript: `// 使用 fetch API
const API_TOKEN = 'hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const BASE_URL = '${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}';

// 获取所有项目
async function getProjects() {
  const response = await fetch(\`\${BASE_URL}/api/v1/projects\`, {
    headers: {
      'Authorization': \`Bearer \${API_TOKEN}\`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }
  
  return response.json();
}

// 创建新项目
async function createProject(name) {
  const response = await fetch(\`\${BASE_URL}/api/v1/projects\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_TOKEN}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  
  if (!response.ok) {
    throw new Error('Failed to create project');
  }
  
  return response.json();
}

// 检查更新（使用项目 API Key）
async function checkUpdate(apiKey, currentVersion) {
  const response = await fetch(\`\${BASE_URL}/api/v1/check\`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ currentVersion })
  });
  
  if (!response.ok) {
    throw new Error('Failed to check update');
  }
  
  return response.json();
}

// 删除项目
async function deleteProject(projectId) {
  const response = await fetch(\`\${BASE_URL}/api/v1/projects/delete\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_TOKEN}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ projectId })
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete project');
  }
  
  return response.json();
}`,
    python: `import requests

API_TOKEN = 'hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
BASE_URL = '${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}'

# 获取所有项目
def get_projects():
    headers = {
        'Authorization': f'Bearer {API_TOKEN}'
    }
    response = requests.get(f'{BASE_URL}/api/v1/projects', headers=headers)
    response.raise_for_status()
    return response.json()

# 创建新项目
def create_project(name):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    data = {'name': name}
    response = requests.post(f'{BASE_URL}/api/v1/projects', 
                            json=data, headers=headers)
    response.raise_for_status()
    return response.json()

# 检查更新（使用项目 API Key）
def check_update(api_key, current_version):
    headers = {
        'X-API-Key': api_key,
        'Content-Type': 'application/json'
    }
    data = {'currentVersion': current_version}
    response = requests.post(f'{BASE_URL}/api/v1/check', 
                            json=data, headers=headers)
    response.raise_for_status()
    return response.json()

# 上传新版本
def upload_version(project_id, version, file_path, changelog, force_update=False):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}'
    }
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        data = {
            'projectId': project_id,
            'version': version,
            'changelog': changelog,
            'forceUpdate': str(force_update).lower()
        }
        response = requests.post(f'{BASE_URL}/api/v1/versions', 
                                data=data, files=files, headers=headers)
    
    response.raise_for_status()
    return response.json()

# 删除项目
def delete_project(project_id):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    data = {'projectId': project_id}
    response = requests.post(f'{BASE_URL}/api/v1/projects/delete', 
                            json=data, headers=headers)
    response.raise_for_status()
    return response.json()

# 删除版本
def delete_version(version_id):
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    data = {'versionId': version_id}
    response = requests.post(f'{BASE_URL}/api/v1/versions/delete', 
                            json=data, headers=headers)
    response.raise_for_status()
    return response.json()`,
    curl: `# 获取 API Token
curl -X GET ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/user/token \\
  -H "Cookie: your-session-cookie"

# 获取所有项目
curl -X GET ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/projects \\
  -H "Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 创建新项目
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/projects \\
  -H "Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "我的新项目"}'

# 检查更新（使用项目 API Key）
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/check \\
  -H "X-API-Key: your-project-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{"currentVersion": "1.0.0"}'

# 上传新版本（文件）
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/versions \\
  -H "Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -F "projectId=project_id" \\
  -F "version=1.0.1" \\
  -F "changelog=修复已知问题" \\
  -F "forceUpdate=false" \\
  -F "file=@/path/to/app.apk"

# 上传新版本（URL）
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/versions \\
  -H "Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -F "projectId=project_id" \\
  -F "version=1.0.1" \\
  -F "changelog=修复已知问题" \\
  -F "forceUpdate=false" \\
  -F "url=https://example.com/app.apk"

# 删除项目
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/projects/delete \\
  -H "Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "project_id"}'

# 删除版本
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/v1/versions/delete \\
  -H "Authorization: Bearer hot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"versionId": "version_id"}'

# 删除 API Token
curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/user/token/delete \\
  -H "Cookie: your-session-cookie"`
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <NavBar user={session.user} />
      
      {/* 滚动按钮 */}
      {showScrollButtons && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={scrollToTop}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg"
            title="回到顶部"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={scrollToBottom}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg"
            title="到底部"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              API 文档
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              使用我们的 RESTful API 来集成热更新功能到您的应用程序
            </p>
          </div>

          {/* 快速开始 */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                快速开始
              </CardTitle>
              <CardDescription>
                按照以下步骤开始使用 API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">生成 API Token</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      在个人设置页面生成您的 Bearer Token
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">创建项目</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      通过 API 创建项目并获取项目 API Key
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">发布版本</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      上传新版本文件或提供下载链接
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  认证方式说明
                </h4>
                <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Bearer Token:</strong> 用于管理项目和版本的 API，在 Authorization header 中使用
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>X-API-Key:</strong> 用于检查更新的 API，使用项目的 API Key
                    </span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* API 端点 */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                API 端点
              </CardTitle>
              <CardDescription>
                所有可用的 API 端点及其说明
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {apiEndpoints.map((category, idx) => (
                  <div key={idx}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <category.icon className="h-5 w-5 text-orange-600" />
                      {category.category}
                    </h3>
                    <div className="space-y-4">
                      {category.endpoints.map((endpoint: any, endpointIdx: number) => (
                        <div key={endpointIdx} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                endpoint.method === 'GET' ? 'default' : 'secondary'
                              }>
                                {endpoint.method}
                              </Badge>
                              <code className="text-sm font-mono">{endpoint.path}</code>
                            </div>
                            <Badge variant="outline">{endpoint.auth}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {endpoint.description}
                          </p>
                          
                          {endpoint.body && (
                            <div className="mb-3">
                              <h5 className="text-sm font-semibold mb-1">Request Body:</h5>
                              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">
                                <code>{endpoint.body}</code>
                              </pre>
                            </div>
                          )}
                          
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Response:</h5>
                            <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">
                              <code>{endpoint.response}</code>
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 代码示例 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                代码示例
              </CardTitle>
              <CardDescription>
                不同编程语言的集成示例
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="javascript">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                </TabsList>
                
                {Object.entries(codeExamples).map(([lang, code]) => (
                  <TabsContent key={lang} value={lang}>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => copyCode(code, lang)}
                      >
                        <Copy className="h-4 w-4" />
                        {copiedCode === lang ? '已复制' : '复制'}
                      </Button>
                      <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code className="text-sm">{code}</code>
                      </pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* 错误码说明 */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>错误码说明</CardTitle>
              <CardDescription>
                API 可能返回的错误状态码
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">400</Badge>
                  <span className="text-sm">Bad Request - 请求参数错误</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">401</Badge>
                  <span className="text-sm">Unauthorized - 未授权或 Token 无效</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">404</Badge>
                  <span className="text-sm">Not Found - 资源不存在</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">409</Badge>
                  <span className="text-sm">Conflict - 资源冲突（如版本已存在）</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">500</Badge>
                  <span className="text-sm">Internal Server Error - 服务器内部错误</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}