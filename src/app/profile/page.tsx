'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
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
import { Loader2, User, Mail, Shield, Key } from 'lucide-react'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: session?.user?.name || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
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
    </div>
  )
}