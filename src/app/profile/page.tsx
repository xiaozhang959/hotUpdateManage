'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Footer } from '@/components/layout/footer'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator
} from '@/components/ui'
import { toast } from 'sonner'
import { Loader2, User, Mail, Shield, Key, Copy, Eye, EyeOff, RefreshCw, FileText } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [apiToken, setApiToken] = useState<string | null>(null)
  const [tokenCreatedAt, setTokenCreatedAt] = useState<Date | null>(null)
  const [formData, setFormData] = useState({
    username: session?.user?.name || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Load API token on component mount
  useEffect(() => {
    loadApiToken()
  }, [])

  const loadApiToken = async () => {
    try {
      const response = await fetch('/api/user/token')
      if (response.ok) {
        const data = await response.json()
        setApiToken(data.token)
        setTokenCreatedAt(data.createdAt ? new Date(data.createdAt) : null)
      }
    } catch (error) {
      console.error('Failed to load API token:', error)
    }
  }

  const generateToken = async () => {
    setTokenLoading(true)
    try {
      const response = await fetch('/api/user/token', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to generate token')
      }

      const data = await response.json()
      setApiToken(data.token)
      setTokenCreatedAt(new Date(data.createdAt))
      setShowToken(true)
      toast.success('API Token已生成')
    } catch (error: any) {
      toast.error(error.message || '生成Token失败')
    } finally {
      setTokenLoading(false)
    }
  }

  const copyToken = () => {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken)
      toast.success('Token已复制到剪贴板')
    }
  }

  const handleUpdateProfile = async () => {
    // 验证新密码
    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        toast.error('新密码至少需要6个字符')
        return
      }
      if (formData.newPassword !== formData.confirmPassword) {
        toast.error('两次输入的密码不一致')
        return
      }
      if (!formData.currentPassword) {
        toast.error('请输入当前密码')
        return
      }
    }

    setLoading(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username !== session?.user?.name ? formData.username : undefined,
          currentPassword: formData.currentPassword || undefined,
          newPassword: formData.newPassword || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success('个人信息已更新')

      // 更新session
      if (formData.username !== session?.user?.name) {
        await update({ name: formData.username })
      }

      // 清空密码字段
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error: any) {
      toast.error(error.message || '更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8 max-w-2xl flex-1 min-h-[calc(100vh-200px)]">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        个人设置
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>账号信息</CardTitle>
          <CardDescription>
            查看和修改您的个人信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex-1">
                <Label className="text-sm text-gray-500">邮箱</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{session?.user?.email}</span>
                </div>
              </div>
              <div className="flex-1">
                <Label className="text-sm text-gray-500">角色</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">
                    {session?.user?.role === 'ADMIN' ? '管理员' : '用户'}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* 修改用户名 */}
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="输入新用户名"
                  disabled={loading}
                />
              </div>
            </div>

            <Separator />

            {/* 修改密码 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Key className="h-5 w-5" />
                修改密码
              </h3>

              <div className="space-y-2">
                <Label htmlFor="currentPassword">当前密码</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  placeholder="输入当前密码"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="至少6个字符"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="再次输入新密码"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUpdateProfile}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存修改'
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* API Token管理 */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API 密钥管理
              </CardTitle>
              <CardDescription>
                使用API密钥通过Bearer Token方式调用API接口
              </CardDescription>
            </div>
            <Link href="/docs/api">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                查看文档
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {apiToken ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>您的 API 密钥</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={apiToken}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowToken(!showToken)}
                        className="h-7 w-7 p-0"
                      >
                        {showToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={copyToken}
                        className="h-7 w-7 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                {tokenCreatedAt && (
                  <p className="text-sm text-gray-500">
                    创建时间: {tokenCreatedAt.toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ 请妥善保管您的API密钥，不要分享给他人。如果密钥泄露，请立即重新生成。
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={generateToken}
                  disabled={tokenLoading}
                  variant="outline"
                  className="flex-1"
                >
                  {tokenLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      重新生成密钥
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  您还没有生成API密钥
                </p>
                <Button
                  onClick={generateToken}
                  disabled={tokenLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {tokenLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    '生成API密钥'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            通过API密钥，您可以在应用程序中直接调用我们的API来管理项目和版本。
            <Link href="/docs/api" className="text-orange-600 hover:underline ml-1">
              查看API文档
            </Link>
          </p>
        </CardFooter>
      </Card>
      </main>
      <Footer />
    </div>
  )
}
