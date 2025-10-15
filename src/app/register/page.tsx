'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, AlertCircle, Mail, CheckCircle, ArrowLeft } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [systemConfig, setSystemConfig] = useState<any>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    fetchSystemConfig()
  }, [])
  
  useEffect(() => {
    // 倒计时
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/system/config')
      if (response.ok) {
        const config = await response.json()
        setSystemConfig(config)
      }
    } catch (error) {
      console.error('获取系统配置失败:', error)
    } finally {
      setConfigLoading(false)
    }
  }
  
  const handleResendVerification = async () => {
    setResending(true)
    
    try {
      const response = await fetch('/api/auth/resend-verification-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('验证邮件已重新发送', {
          description: `请查看 ${registeredEmail} 收件箱`
        })
        setCountdown(60) // 60秒倒计时
      } else {
        if (response.status === 429) {
          // 频率限制
          const match = data.error.match(/\d+/)
          if (match) {
            setCountdown(parseInt(match[0], 10))
          }
        }
        toast.error('发送失败', {
          description: data.error || '请稍后重试'
        })
      }
    } catch (error) {
      toast.error('发送失败', {
        description: '请检查网络连接'
      })
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!systemConfig?.registration_enabled) {
      toast.error('系统暂时关闭注册功能')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('密码不匹配')
      return
    }

    if (formData.password.length < 6) {
      toast.error('密码至少需要6个字符')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error('注册失败', {
          description: data.error
        })
      } else {
        // 检查是否需要邮箱验证
        if (data.requireEmailVerification) {
          setRegistrationSuccess(true)
          setRegisteredEmail(formData.email)
          toast.success('注册成功', {
            description: '请查看您的邮箱并验证账号'
          })
        } else {
          toast.success('注册成功', {
            description: '请使用您的账号登录'
          })
          router.push('/login')
        }
      }
    } catch (error) {
      toast.error('注册失败', {
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
            <CardTitle className="text-2xl">注册账号</CardTitle>
            <CardDescription>
              {systemConfig?.registration_enabled === false ? (
                <span className="text-red-500">系统暂时关闭注册功能</span>
              ) : (
                '创建一个新账号开始使用'
              )}
            </CardDescription>
          </CardHeader>
        {configLoading ? (
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" />
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          </CardContent>
        ) : systemConfig?.registration_enabled === false ? (
          <CardContent className="py-8">
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-yellow-800 font-medium text-center mb-1">注册功能已关闭</p>
                <p className="text-sm text-yellow-600 text-center">系统管理员已暂时关闭新用户注册功能</p>
                <p className="text-sm text-yellow-600 text-center mt-2">如需访问系统，请联系管理员</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 text-center">已有账号？</p>
                <Link href="/login" className="block">
                  <Button className="bg-orange-600 hover:bg-orange-700 w-full">
                    返回登录
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        ) : registrationSuccess ? (
          // 邮箱验证等待页面
          <CardContent className="py-8">
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-10 w-10 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  验证您的邮箱
                </h3>
                <p className="text-center text-gray-600 dark:text-gray-400">
                  我们已向 <strong>{registeredEmail}</strong> 发送了一封验证邮件
                </p>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                  请点击邮件中的链接完成验证
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium">接下来的步骤：</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
                      <li>查看您的邮箱收件箱</li>
                      <li>打开来自“热更新管理系统”的邮件</li>
                      <li>点击邮件中的验证链接</li>
                      <li>验证成功后即可登录</li>
                    </ol>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-500">
                  没有收到邮件？请检查垃圾邮件文件夹
                </p>
                
                {/* 重新发送按钮 */}
                <Button
                  variant="default"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleResendVerification}
                  disabled={resending || countdown > 0}
                >
                  {resending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发送中...
                    </>
                  ) : countdown > 0 ? (
                    `重新发送 (${countdown}s)`
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      重新发送验证邮件
                    </>
                  )}
                </Button>
                
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setRegistrationSuccess(false)
                      setCountdown(0)
                      setFormData({
                        email: '',
                        username: '',
                        password: '',
                        confirmPassword: ''
                      })
                    }}
                  >
                    重新注册
                  </Button>
                  <Link href="/login" className="block">
                    <Button className="bg-orange-600 hover:bg-orange-700 w-full">
                      返回登录
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="yourname"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少6个字符"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-6">
            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={loading || !systemConfig?.registration_enabled}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  注册中...
                </>
              ) : (
                '注册'
              )}
            </Button>
            <div className="text-sm text-center text-gray-600 dark:text-gray-400">
              已有账号？
              <Link href="/login" className="text-orange-600 hover:underline ml-1">
                立即登录
              </Link>
            </div>
            </CardFooter>
          </form>
        )}
        </Card>
      </div>
    </div>
  )
}
