'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Copy, Key, Package, Rocket, Shield, Code2, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface ApiEndpoint {
  method: string
  path: string
  description: string
  auth: string
  headers?: string
  body?: string
  response: string
}

interface ApiCategory {
  category: string
  icon: string
  endpoints: ApiEndpoint[]
}

interface ApiDocsClientProps {
  apiEndpoints: ApiCategory[]
  codeExamples: Record<string, string>
}

const iconMap: Record<string, any> = {
  Key,
  Package,
  Rocket,
  Shield,
  Code2
}

export function ApiDocsClient({ apiEndpoints, codeExamples }: ApiDocsClientProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['认证', '版本检查'])

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    toast.success('代码已复制到剪贴板')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  return (
    <>
      {/* 快速开始卡片 */}
      <Card className="mb-8 border-orange-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-orange-600" />
            快速开始
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. 获取API密钥</h3>
            <p className="text-gray-600 dark:text-gray-400">
              登录系统后，在项目管理页面创建项目，每个项目都会生成独立的API密钥。
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. 配置请求头</h3>
            <p className="text-gray-600 dark:text-gray-400">
              在所有API请求中，需要在请求头中添加 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">X-API-Key</code> 字段。
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. 调用接口</h3>
            <p className="text-gray-600 dark:text-gray-400">
              使用下方的API端点进行版本检查、项目管理等操作。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 代码示例 */}
      <Card className="mb-8 border-orange-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-orange-600" />
            代码示例
          </CardTitle>
          <CardDescription>
            不同编程语言的集成示例
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="javascript" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            {Object.entries(codeExamples).map(([lang, code]) => (
              <TabsContent key={lang} value={lang} className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-2 z-10"
                  onClick={() => copyCode(code, `example-${lang}`)}
                >
                  {copiedCode === `example-${lang}` ? (
                    <span className="text-green-600">已复制!</span>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      复制
                    </>
                  )}
                </Button>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm">{code}</code>
                </pre>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* API端点列表 */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          API 端点
        </h2>
        
        {apiEndpoints.map((category) => {
          const Icon = iconMap[category.icon] || Package
          const isExpanded = expandedCategories.includes(category.category)
          
          return (
            <Card key={category.category} className="border-gray-200 dark:border-gray-700">
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleCategory(category.category)}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-orange-600" />
                    {category.category}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </CardTitle>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="space-y-6">
                  {category.endpoints.map((endpoint, index) => (
                    <div key={index} className="border-l-2 border-orange-500 pl-4 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={endpoint.method === 'GET' ? 'default' : 'secondary'}
                            className={endpoint.method === 'GET' ? 'bg-green-600' : 'bg-blue-600'}
                          >
                            {endpoint.method}
                          </Badge>
                          <code className="text-sm font-mono">{endpoint.path}</code>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                          {endpoint.description}
                        </p>
                        <div className="mt-2">
                          <Badge variant="outline">
                            认证方式: {endpoint.auth}
                          </Badge>
                        </div>
                      </div>

                      {endpoint.headers && (
                        <div>
                          <h4 className="font-semibold mb-2">请求头</h4>
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute right-2 top-2"
                              onClick={() => copyCode(endpoint.headers!, `headers-${category.category}-${index}`)}
                            >
                              {copiedCode === `headers-${category.category}-${index}` ? (
                                <span className="text-green-600 text-xs">已复制!</span>
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                              <code className="text-sm">{endpoint.headers}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      {endpoint.body && (
                        <div>
                          <h4 className="font-semibold mb-2">请求体</h4>
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute right-2 top-2"
                              onClick={() => copyCode(endpoint.body!, `body-${category.category}-${index}`)}
                            >
                              {copiedCode === `body-${category.category}-${index}` ? (
                                <span className="text-green-600 text-xs">已复制!</span>
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                              <code className="text-sm">{endpoint.body}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold mb-2">响应示例</h4>
                        <div className="relative">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute right-2 top-2"
                            onClick={() => copyCode(endpoint.response, `response-${category.category}-${index}`)}
                          >
                            {copiedCode === `response-${category.category}-${index}` ? (
                              <span className="text-green-600 text-xs">已复制!</span>
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                            <code className="text-sm">{endpoint.response}</code>
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* 底部说明 */}
      <Card className="mt-8 border-orange-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            安全说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-gray-600 dark:text-gray-400">
          <p>• API密钥应妥善保管，避免泄露到公开代码库中</p>
          <p>• 建议在服务端调用API，避免在客户端直接暴露密钥</p>
          <p>• 定期更新API密钥以确保安全性</p>
          <p>• 所有API请求都通过HTTPS加密传输</p>
        </CardContent>
      </Card>
    </>
  )
}