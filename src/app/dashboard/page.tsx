import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Package, Plus, Rocket, Shield, Users, Activity, Mail, BarChart3 } from 'lucide-react'
import { EmailVerificationBanner } from '@/components/email-verification-banner'
import { DashboardCharts } from '@/components/dashboard-charts'
import { ApiTokenCard } from '@/components/api-token-card'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <NavBar user={session.user} />
      <main className="container mx-auto px-4 py-8 flex-1 min-h-[calc(100vh-200px)]">
        <EmailVerificationBanner 
          emailVerified={!!session.user?.emailVerified}
          email={session.user?.email}
        />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            欢迎回来，{session.user?.name || session.user?.email}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            管理您的项目和版本更新
          </p>
        </div>

        {/* 统计数据和图表 */}
        <DashboardCharts isAdmin={session.user?.role === 'ADMIN'} />

        {/* 快捷操作卡片 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Card className="border-orange-200 dark:border-gray-700">
            <CardHeader>
              <Package className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>项目管理</CardTitle>
              <CardDescription>
                创建和管理您的项目，每个项目都有独立的API密钥
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/projects">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  <Plus className="mr-2 h-4 w-4" />
                  管理项目
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-gray-700">
            <CardHeader>
              <Rocket className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>快速开始</CardTitle>
              <CardDescription>
                查看如何集成API到您的应用程序
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/docs/api">
                <Button variant="outline" className="w-full">
                  查看文档
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* API Token 管理卡片 */}
          <ApiTokenCard />

          {session.user?.role === 'ADMIN' && (
            <Card className="border-orange-200 dark:border-gray-700">
              <CardHeader>
                <Shield className="h-10 w-10 text-orange-600 mb-2" />
                <CardTitle>管理员</CardTitle>
                <CardDescription>
                  管理所有用户和项目
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin">
                  <Button variant="outline" className="w-full">
                    进入管理面板
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
