'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [systemConfig, setSystemConfig] = useState<any>(null)
  const [formData, setFormData] = useState({
    account: '', // 可以是邮箱或用户名
    password: ''
  })

  useEffect(() => {
    fetchSystemConfig()
  }, [])

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/system/config')
      if (response.ok) {
        const config = await response.json()
        setSystemConfig(config)
      }
    } catch (error) {
      console.error('获取系统配置失败:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 先进行预检查
      const preCheckResponse = await fetch('/api/auth/pre-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: formData.account,
          password: formData.password
        })
      })
      
      const preCheckResult = await preCheckResponse.json()
      
      if (!preCheckResult.success) {
        if (preCheckResult.error === 'email_not_verified') {
          toast.error('邮箱未验证', {
            description: preCheckResult.message,
            action: {
              label: '重新发送验证邮件',
              onClick: () => {
                // 可以跳转到重新发送验证邮件页面
                router.push(`/resend-verification?email=${encodeURIComponent(preCheckResult.email)}`)
              }
            }
          })
          setLoading(false)
          return
        } else {
          toast.error('登录失败', {
            description: preCheckResult.error || '用户名/邮箱或密码错误'
          })
          setLoading(false)
          return
        }
      }
      
      // 预检查通过，进行正式登录
      const result = await signIn('credentials', {
        email: formData.account, // NextAuth 仍使用 email 字段，但我们传入 account（可能是用户名或邮箱）
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        toast.error('登录失败', {
          description: '用户名/邮箱或密码错误'
        })
      } else {
        toast.success('登录成功')
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast.error('登录失败', {
        description: '请稍后重试'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 relative">
      {/* 返回按钮 */}
      <Link 
        href="/" 
        className="absolute top-4 left-4 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow duration-200 flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm font-medium">返回</span>
      </Link>
      
      <div className="w-full max-w-md space-y-4">
        {/* 系统信息显示 */}
        {systemConfig && (
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {systemConfig.site_name || '热更新管理系统'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {systemConfig.site_description || '专业的应用热更新管理平台'}
            </p>
          </div>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">登录</CardTitle>
            <CardDescription>
              输入您的用户名或邮箱登录系统
            </CardDescription>
          </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account">用户名 / 邮箱</Label>
              <Input
                id="account"
                type="text"
                placeholder="用户名或邮箱"
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-orange-600 hover:text-orange-700 hover:underline"
                >
                  忘记密码？
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
            <div className="text-sm text-center text-gray-600 dark:text-gray-400">
              还没有账号？
              <Link href="/register" className="text-orange-600 hover:underline ml-1">
                立即注册
              </Link>
            </div>
          </CardFooter>
        </form>
        </Card>
      </div>
    </div>
  )
}
