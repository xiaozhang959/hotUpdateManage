'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Mail, X, Loader2, CheckCircle } from 'lucide-react'

interface EmailVerificationBannerProps {
  emailVerified: boolean
  email?: string | null
}

export function EmailVerificationBanner({ emailVerified, email }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [requireVerification, setRequireVerification] = useState(false)
  
  useEffect(() => {
    // 检查是否需要邮箱验证
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data.require_email_verification) {
          setRequireVerification(true)
        }
      })
      .catch(() => {})
  }, [])
  
  useEffect(() => {
    // 从localStorage读取关闭状态
    const dismissedUntil = localStorage.getItem('email-verification-dismissed')
    if (dismissedUntil) {
      const until = parseInt(dismissedUntil, 10)
      if (Date.now() < until) {
        setDismissed(true)
      } else {
        localStorage.removeItem('email-verification-dismissed')
      }
    }
  }, [])
  
  useEffect(() => {
    // 倒计时
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])
  
  const handleResend = async () => {
    setSending(true)
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSent(true)
        setCountdown(60) // 60秒倒计时
        toast.success('验证邮件已发送', {
          description: `请查看 ${data.email || email} 收件箱`
        })
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
      setSending(false)
    }
  }
  
  const handleDismiss = () => {
    setDismissed(true)
    // 24小时内不再显示
    const until = Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem('email-verification-dismissed', until.toString())
  }
  
  // 如果已验证、已关闭或不需要验证，不显示横幅
  if (emailVerified || dismissed || !requireVerification) {
    return null
  }
  
  return (
    <Alert className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
      <Mail className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-medium text-orange-900 dark:text-orange-100">
            您的邮箱尚未验证
          </p>
          <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">
            验证邮箱后可解锁所有功能。我们已发送验证邮件到 {email}
          </p>
          <div className="flex items-center gap-3 mt-3">
            {sent ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">邮件已发送，请查看收件箱</span>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleResend}
                disabled={sending || countdown > 0}
                className="border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    发送中...
                  </>
                ) : countdown > 0 ? (
                  `重新发送 (${countdown}s)`
                ) : (
                  '重新发送验证邮件'
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/40"
            >
              <X className="h-3 w-3" />
              <span className="ml-1">暂时关闭</span>
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}