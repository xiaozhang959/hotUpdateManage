import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code, Key, Package, Rocket, FileText, BookOpen } from 'lucide-react'

export default async function DocsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <NavBar user={session.user} />
      <div className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            API 文档
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            了解如何将热更新系统集成到您的应用程序
          </p>
        </div>

        <Tabs defaultValue="quick-start" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quick-start">快速开始</TabsTrigger>
            <TabsTrigger value="api">API接口</TabsTrigger>
            <TabsTrigger value="examples">示例代码</TabsTrigger>
            <TabsTrigger value="faq">常见问题</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-start" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  快速开始
                </CardTitle>
                <CardDescription>
                  三步完成接入热更新系统
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">1. 创建项目</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    在项目管理页面创建新项目，系统会自动生成API密钥。
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">2. 发布版本</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    上传应用文件或提供下载链接，填写版本号和更新日志。
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">3. 集成API</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    在您的应用中调用API获取最新版本信息。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  获取当前版本
                </CardTitle>
                <CardDescription>
                  获取项目的当前活跃版本信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">请求方式</p>
                  <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    POST /api/versions/latest
                  </code>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">认证方式</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    支持两种认证方式，任选其一：
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium">方式1: Headers</p>
                      <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm">
                        X-API-Key: your-project-api-key
                      </code>
                    </div>
                    <div>
                      <p className="text-sm font-medium">方式2: Body</p>
                      <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm">
                        {JSON.stringify({ apiKey: "your-project-api-key" }, null, 2)}
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">响应示例</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "data": {
    "version": "1.0.0",
    "downloadUrl": "https://example.com/app-v1.0.0.apk",
    "md5": "a1b2c3d4e5f6...",
    "forceUpdate": false,
    "changelog": "1. 新增功能xxx\\n2. 修复bug xxx",
    "createdAt": "2024-01-01T00:00:00Z",
    "isCurrent": true
  }
}`}
                  </pre>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">错误响应</p>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
{`{
  "error": "API密钥无效"
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  JavaScript/TypeScript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`async function checkUpdate() {
  const response = await fetch('https://your-domain.com/api/versions/latest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-project-api-key'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to check update');
  }

  const result = await response.json();

  if (result.success) {
    const { version, downloadUrl, forceUpdate, changelog } = result.data;

    // 比较版本号
    if (version !== currentVersion) {
      if (forceUpdate) {
        // 强制更新
        showForceUpdateDialog(downloadUrl, changelog);
      } else {
        // 可选更新
        showUpdateDialog(downloadUrl, changelog);
      }
    }
  }
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Python
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import requests

def check_update():
    url = 'https://your-domain.com/api/versions/latest'
    headers = {
        'X-API-Key': 'your-project-api-key'
    }

    response = requests.post(url, headers=headers)

    if response.status_code == 200:
        result = response.json()
        if result['success']:
            data = result['data']
            version = data['version']
            download_url = data['downloadUrl']
            force_update = data['forceUpdate']
            changelog = data['changelog']

            # 处理更新逻辑
            if version != current_version:
                if force_update:
                    show_force_update(download_url, changelog)
                else:
                    show_update(download_url, changelog)
    else:
        print('Failed to check update')`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faq" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>常见问题</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Q: 如何切换当前版本？</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    A: 在项目的版本管理页面，点击任意版本旁的"设为当前"按钮即可切换。新上传的版本会自动设为当前版本。
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Q: 强制更新和可选更新有什么区别？</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    A: 强制更新要求用户必须更新才能继续使用应用，适用于重要的安全更新或不兼容的版本。可选更新允许用户选择是否更新。
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Q: API密钥丢失了怎么办？</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    A: API密钥在项目管理页面可以查看和复制。为了安全，系统不提供重置API密钥的功能，如需更换密钥，请创建新项目。
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Q: 可以回退版本吗？</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    A: 可以。在版本管理页面将任意历史版本设为当前版本即可实现版本回退。
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Q: 如何删除错误发布的版本？</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    A: 在版本管理页面，每个版本后都有删除按钮。删除当前版本后，系统会自动将最新的版本设为当前版本。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  )
}
