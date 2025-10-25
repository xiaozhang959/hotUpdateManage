'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitted(true)
        toast.success('邮件已发送', {
          description: '如果该邮箱已注册，您将收到密码重置邮件'
        })
      } else {
        if (response.status === 503) {
          toast.error('邮件服务未启用', {
            description: '请联系系统管理员'
          })
        } else {
          toast.error('发送失败', {
            description: data.error || '请稍后重试'
          })
        }
      }
    } catch (error) {
      toast.error('请求失败', {
        description: '请检查网络连接'
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">邮件已发送</CardTitle>
              <CardDescription>
                请查看您的邮箱并按照邮件中的说明重置密码
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  我们已向 <strong>{email}</strong> 发送了密码重置邮件。
                  如果您没有收到邮件，请检查垃圾邮件文件夹。
                </AlertDescription>
              </Alert>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <p>• 邮件中的链接有效期为1小时</p>
                <p>• 如果邮箱未注册，您不会收到邮件</p>
                <p>• 请勿分享重置链接给他人</p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSubmitted(false)
                  setEmail('')
                }}
              >
                重新发送
              </Button>
              <Link href="/login" className="w-full">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  返回登录
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">忘记密码</CardTitle>
            <CardDescription>
              输入您的注册邮箱，我们将发送密码重置链接
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  请确保输入的邮箱地址与您注册时使用的邮箱一致
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700"
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    发送中...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    发送重置邮件
                  </>
                )}
              </Button>
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回登录
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}