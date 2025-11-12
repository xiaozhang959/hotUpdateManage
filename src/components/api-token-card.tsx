'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Key, Copy, Eye, EyeOff, RefreshCw, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export function ApiTokenCard() {
  const [loading, setLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [apiToken, setApiToken] = useState<string | null>(null)
  const [tokenCreatedAt, setTokenCreatedAt] = useState<Date | null>(null)
  const [isLoadingToken, setIsLoadingToken] = useState(true)

  // Load API token on component mount
  useEffect(() => {
    loadApiToken()
  }, [])

  const loadApiToken = async () => {
    try {
      setIsLoadingToken(true)
      const response = await fetch('/api/user/token')
      if (response.ok) {
        const data = await response.json()
        setApiToken(data.token)
        setTokenCreatedAt(data.createdAt ? new Date(data.createdAt) : null)
      }
    } catch (error) {
      console.error('Failed to load API token:', error)
    } finally {
      setIsLoadingToken(false)
    }
  }

  const generateToken = async () => {
    setLoading(true)
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
      setLoading(false)
    }
  }

  const copyToken = () => {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken)
      toast.success('Token已复制到剪贴板')
    }
  }

  if (isLoadingToken) {
    return (
      <Card className="border-orange-200 dark:border-gray-700">
        <CardHeader>
          <Key className="h-10 w-10 text-orange-600 mb-2" />
          <CardTitle>API 密钥</CardTitle>
          <CardDescription>
            加载中...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-orange-200 dark:border-gray-700">
      <CardHeader>
        <Key className="h-10 w-10 text-orange-600 mb-2" />
        <CardTitle>API 密钥</CardTitle>
        <CardDescription>
          {apiToken ? '管理您的API密钥' : '生成API密钥以使用接口'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {apiToken ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={apiToken}
                    readOnly
                    className="pr-20 font-mono text-xs"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowToken(!showToken)}
                      className="h-7 w-7 p-0"
                    >
                      {showToken ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyToken}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              {tokenCreatedAt && (
                <p className="text-xs text-gray-500">
                  创建于: {tokenCreatedAt.toLocaleDateString('zh-CN')}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={generateToken}
                disabled={loading}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    重置中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    重置密钥
                  </>
                )}
              </Button>
              <Link href="/docs/api" target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <FileText className="mr-2 h-3 w-3" />
                  API文档
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              生成API密钥后，您可以通过编程方式管理项目和版本
            </p>
            <Button
              onClick={generateToken}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  生成API密钥
                </>
              )}
            </Button>
          </div>
        )}
        
        <div className="pt-2 border-t">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              前往个人设置查看更多选项
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}