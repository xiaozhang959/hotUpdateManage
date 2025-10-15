import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { redirect } from 'next/navigation'
import { Package2, Rocket, Shield, Zap, Users, FolderOpen } from 'lucide-react'
import HomeStats from '@/components/home-stats'

export default async function Home() {
  const session = await auth()

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            热更新管理系统
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            为您的应用程序提供安全、可靠的版本控制和自动更新服务
          </p>
          <div className="flex gap-4 justify-center mb-8">
            <Link href="/login">
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700">
                立即登录
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline">
                注册账号
              </Button>
            </Link>
          </div>
          
          {/* 统计数据展示 */}
          <HomeStats />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-orange-200 dark:border-gray-700">
            <CardHeader>
              <Package2 className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>项目管理</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                轻松创建和管理多个项目，每个项目都有独立的API密钥和版本控制
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-gray-700">
            <CardHeader>
              <Rocket className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>版本发布</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                支持文件上传或URL链接，自动计算MD5，管理更新日志和强制更新策略
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-gray-700">
            <CardHeader>
              <Shield className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>安全认证</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                基于NextAuth的完整认证系统，支持管理员和用户角色权限控制
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-gray-700">
            <CardHeader>
              <Zap className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>API接口</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                提供标准化的RESTful API，轻松集成到您的应用程序中
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-4xl mx-auto border-orange-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl">快速集成</CardTitle>
            <CardDescription>只需简单的API调用即可实现版本检测和自动更新</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg">
              <code className="text-green-400 text-sm">
                <div>POST /api/versions/latest</div>
                <div>Headers: X-API-Key: your-project-key</div>
                <div className="mt-2">Response:</div>
                <div className="text-gray-400">{"{"}</div>
                <div className="text-gray-400 pl-4">"version": "1.0.0",</div>
                <div className="text-gray-400 pl-4">"downloadUrl": "https://...",</div>
                <div className="text-gray-400 pl-4">"forceUpdate": false,</div>
                <div className="text-gray-400 pl-4">"changelog": "更新说明"</div>
                <div className="text-gray-400">{"}"}</div>
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}