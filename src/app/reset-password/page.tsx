'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Loader2, Lock, CheckCircle, XCircle, Eye, EyeOff, AlertTriangle } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenEmail, setTokenEmail] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: ''
  })

  useEffect(() => {
    if (token) {
      verifyToken()
    } else {
      setVerifying(false)
    }
  }, [token])

  useEffect(() => {
    checkPasswordStrength(formData.password)
  }, [formData.password])

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/auth/reset-password?token=${token}`)
      const data = await response.json()
      
      if (response.ok && data.valid) {
        setTokenValid(true)
        setTokenEmail(data.email || '')
      } else {
        setTokenValid(false)
        toast.error('链接无效或已过期', {
          description: data.error || '请重新申请密码重置'
        })
      }
    } catch (error) {
      setTokenValid(false)
      toast.error('验证失败', {
        description: '请检查网络连接'
      })
    } finally {
      setVerifying(false)
    }
  }

  const checkPasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength({ score: 0, message: '' })
      return
    }

    let score = 0
    let message = '弱'

    // 长度检查
    if (password.length >= 6) score += 1
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1

    // 复杂度检查
    if (/[a-z]/.test(password)) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^a-zA-Z0-9]/.test(password)) score += 1

    if (score <= 2) {
      message = '弱'
    } else if (score <= 4) {
      message = '中等'
    } else if (score <= 6) {
      message = '强'
    } else {
      message = '非常强'
    }

    setPasswordStrength({ score: Math.min(score, 7), message })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('密码不匹配', {
        description: '请确保两次输入的密码相同'
      })
      return
    }

    if (formData.password.length < 6) {
      toast.error('密码太短', {
        description: '密码长度至少为6个字符'
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password
        })
      })

      const data = await response.json()

      if (response.ok) {
        setResetSuccess(true)
        toast.success('密码重置成功', {
          description: '您现在可以使用新密码登录了'
        })
      } else {
        toast.error('重置失败', {
          description: data.error || '请稍后重试'
        })
      }
    } catch (error) {
      toast.error('请求失败', {
        description: '请检查网络连接'
      })
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              <span className="ml-2">验证链接中...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl">链接无效</CardTitle>
            <CardDescription>
              密码重置链接无效或已过期
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                可能的原因：
                <ul className="mt-2 list-disc list-inside">
                  <li>链接已过期（超过1小时）</li>
                  <li>链接已被使用</li>
                  <li>链接格式不正确</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Link href="/forgot-password" className="w-full">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                重新申请密码重置
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">密码重置成功</CardTitle>
            <CardDescription>
              您的密码已成功重置，现在可以使用新密码登录
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                前往登录
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">重置密码</CardTitle>
            <CardDescription>
              {tokenEmail && (
                <span>
                  为账号 <strong>{tokenEmail}</strong> 设置新密码
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">新密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={loading}
                    placeholder="输入新密码"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            passwordStrength.score <= 2 ? 'bg-red-500' :
                            passwordStrength.score <= 4 ? 'bg-yellow-500' :
                            passwordStrength.score <= 6 ? 'bg-green-500' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${(passwordStrength.score / 7) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs ${
                        passwordStrength.score <= 2 ? 'text-red-500' :
                        passwordStrength.score <= 4 ? 'text-yellow-500' :
                        'text-green-500'
                      }`}>
                        {passwordStrength.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    disabled={loading}
                    placeholder="再次输入新密码"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-sm text-red-500">密码不匹配</p>
                )}
              </div>

              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  密码要求：
                  <ul className="mt-1 list-disc list-inside text-xs">
                    <li>至少6个字符</li>
                    <li>建议包含大小写字母、数字和特殊字符</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={
                  loading || 
                  !formData.password || 
                  !formData.confirmPassword || 
                  formData.password !== formData.confirmPassword
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    重置中...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    重置密码
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}