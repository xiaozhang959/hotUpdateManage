'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Separator
} from '@/components/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Settings,
  Upload,
  Shield,
  Users,
  Save,
  RotateCcw,
  Loader2,
  Info,
  AlertCircle,
  Check,
  X,
  FileUp,
  UserPlus,
  Lock,
  Globe,
  Mail,
  Send,
  Eye,
  EyeOff
} from 'lucide-react'

interface ConfigItem {
  key: string
  value: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  category: string
  description?: string
  isDefault?: boolean
  updatedAt?: string
}

interface GroupedConfigs {
  general?: ConfigItem[]
  upload?: ConfigItem[]
  auth?: ConfigItem[]
  security?: ConfigItem[]
  email?: ConfigItem[]
}

const categoryInfo = {
  general: {
    title: '通用设置',
    description: '系统基本信息和通用配置',
    icon: Globe
  },
  upload: {
    title: '上传设置',
    description: '文件上传相关配置',
    icon: FileUp
  },
  auth: {
    title: '认证设置',
    description: '用户注册和认证相关配置',
    icon: UserPlus
  },
  security: {
    title: '安全设置',
    description: '系统安全相关配置',
    icon: Lock
  },
  email: {
    title: '邮件设置',
    description: 'SMTP邮箱服务配置',
    icon: Mail
  }
}

export default function SystemSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [groupedConfigs, setGroupedConfigs] = useState<GroupedConfigs>({})
  const [modifiedConfigs, setModifiedConfigs] = useState<Record<string, any>>({})
  const [resetCategory, setResetCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('general')
  const [showPassword, setShowPassword] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/system/config')
      if (!response.ok) {
        if (response.status === 403) {
          toast.error('您没有管理员权限')
          router.push('/dashboard')
          return
        }
        throw new Error('获取配置失败')
      }
      const data = await response.json()
      setConfigs(data.configs || [])
      setGroupedConfigs(data.groupedConfigs || {})
    } catch (error) {
      toast.error('获取系统配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigChange = async (key: string, value: any, type: string) => {
    // 特殊处理：启用邮箱验证前检查SMTP配置
    if (key === 'require_email_verification' && value === true) {
      // 检查SMTP是否已启用和配置
      const emailConfigs = groupedConfigs.email || []
      const smtpEnabled = emailConfigs.find(c => c.key === 'smtp_enabled')?.value
      const smtpHost = emailConfigs.find(c => c.key === 'smtp_host')?.value
      const smtpUser = emailConfigs.find(c => c.key === 'smtp_user')?.value
      const smtpPassword = emailConfigs.find(c => c.key === 'smtp_password')?.value
      const smtpFromEmail = emailConfigs.find(c => c.key === 'smtp_from_email')?.value
      
      // 检查修改中的配置
      const modifiedSmtpEnabled = modifiedConfigs['smtp_enabled'] !== undefined ? modifiedConfigs['smtp_enabled'] : smtpEnabled
      const modifiedSmtpHost = modifiedConfigs['smtp_host'] !== undefined ? modifiedConfigs['smtp_host'] : smtpHost
      const modifiedSmtpUser = modifiedConfigs['smtp_user'] !== undefined ? modifiedConfigs['smtp_user'] : smtpUser
      const modifiedSmtpPassword = modifiedConfigs['smtp_password'] !== undefined ? modifiedConfigs['smtp_password'] : smtpPassword
      const modifiedSmtpFromEmail = modifiedConfigs['smtp_from_email'] !== undefined ? modifiedConfigs['smtp_from_email'] : smtpFromEmail
      
      if (!modifiedSmtpEnabled) {
        toast.error('无法启用邮箱验证', {
          description: '请先启用SMTP邮件服务'
        })
        return
      }
      
      if (!modifiedSmtpHost || !modifiedSmtpUser || !modifiedSmtpPassword || !modifiedSmtpFromEmail) {
        toast.error('无法启用邮箱验证', {
          description: '请先完成SMTP配置（服务器、用户名、密码、发件人邮箱）'
        })
        return
      }
      
      // 如果配置完整，建议先测试
      toast.info('建议先测试SMTP配置是否正常工作', {
        description: '可以在邮件设置页面发送测试邮件'
      })
    }
    
    // 验证输入
    let validatedValue = value
    switch (type) {
      case 'number':
        if (value === '') {
          // 对于空值，不更新配置，让用户继续输入
          return
        } else {
          const num = parseInt(value, 10)
          if (isNaN(num)) return
          // 对于 api_rate_limit，确保最小值为 1
          if (key === 'api_rate_limit' && num < 1) {
            toast.error('API速率限制最小值为 1')
            return
          }
          validatedValue = num
        }
        break
      case 'boolean':
        validatedValue = Boolean(value)
        break
    }

    setModifiedConfigs(prev => ({
      ...prev,
      [key]: validatedValue
    }))

    // 更新本地状态
    setGroupedConfigs(prev => {
      const newGrouped = { ...prev }
      for (const category in newGrouped) {
        const categoryConfigs = newGrouped[category as keyof GroupedConfigs]
        if (categoryConfigs) {
          const configIndex = categoryConfigs.findIndex(c => c.key === key)
          if (configIndex !== -1) {
            categoryConfigs[configIndex] = {
              ...categoryConfigs[configIndex],
              value: validatedValue
            }
          }
        }
      }
      return newGrouped
    })
  }

  const handleSave = async () => {
    if (Object.keys(modifiedConfigs).length === 0) {
      toast.info('没有修改的配置')
      return
    }

    setSaving(true)
    try {
      const configsToUpdate = Object.entries(modifiedConfigs).map(([key, value]) => ({
        key,
        value
      }))

      const response = await fetch('/api/admin/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: configsToUpdate })
      })

      if (!response.ok) {
        throw new Error('保存配置失败')
      }

      const data = await response.json()
      
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error: string) => toast.error(error))
      } else {
        toast.success('配置保存成功')
        setModifiedConfigs({})
        fetchConfigs()
      }
    } catch (error) {
      toast.error('保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (category: string) => {
    try {
      const response = await fetch(`/api/admin/system/config?category=${category}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('重置失败')
      }

      toast.success(`${categoryInfo[category as keyof typeof categoryInfo]?.title || category} 已重置为默认值`)
      setModifiedConfigs({})
      fetchConfigs()
    } catch (error) {
      toast.error('重置配置失败')
    } finally {
      setResetCategory(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error('请输入测试邮箱地址')
      return
    }
    
    setTestingEmail(true)
    try {
      const response = await fetch('/api/admin/system/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: testEmailAddress })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error('测试失败')
    } finally {
      setTestingEmail(false)
    }
  }

  const renderConfigInput = (config: ConfigItem) => {
    const currentValue = modifiedConfigs[config.key] !== undefined 
      ? modifiedConfigs[config.key] 
      : config.value

    switch (config.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleConfigChange(config.key, !currentValue, config.type)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                currentValue ? 'bg-orange-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  currentValue ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium">
              {currentValue ? '启用' : '禁用'}
            </span>
          </div>
        )

      case 'number':
        // 特殊处理文件大小输入
        if (config.key === 'max_upload_size') {
          return (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={Math.floor((currentValue as number) / 1024 / 1024)}
                  onChange={(e) => {
                    const mb = parseInt(e.target.value) || 0
                    handleConfigChange(config.key, mb * 1024 * 1024, config.type)
                  }}
                  className="w-32"
                />
                <span className="text-sm text-gray-500">MB</span>
              </div>
              <p className="text-xs text-gray-500">
                当前: {formatFileSize(currentValue as number)}
              </p>
            </div>
          )
        }
        // 特殊处理 API 速率限制
        if (config.key === 'api_rate_limit') {
          return (
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={currentValue}
                  onChange={(e) => handleConfigChange(config.key, e.target.value, config.type)}
                  className="w-32"
                  min="1"
                  placeholder="100"
                />
                <span className="text-sm text-gray-500">次/分钟</span>
              </div>
              <p className="text-xs text-gray-500">
                限制每个IP每分钟的请求次数
              </p>
            </div>
          )
        }
        return (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleConfigChange(config.key, e.target.value, config.type)}
            className="w-32"
          />
        )

      case 'string':
      default:
        // 特殊处理SMTP密码字段
        if (config.key === 'smtp_password') {
          return (
            <div className="flex items-center space-x-2 max-w-md">
              <Input
                type={showPassword ? "text" : "password"}
                value={currentValue as string}
                onChange={(e) => handleConfigChange(config.key, e.target.value, config.type)}
                className="flex-1"
                placeholder="输入SMTP密码"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          )
        }
        return (
          <Input
            type="text"
            value={currentValue as string}
            onChange={(e) => handleConfigChange(config.key, e.target.value, config.type)}
            className="max-w-md"
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            系统设置
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            配置系统参数，控制平台功能和行为
          </p>
        </div>

        {/* 保存按钮栏 */}
        {Object.keys(modifiedConfigs).length > 0 && (
          <Card className="mb-6 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <p className="text-sm font-medium">
                    您有 {Object.keys(modifiedConfigs).length} 项未保存的修改
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setModifiedConfigs({})
                      fetchConfigs()
                    }}
                  >
                    <X className="mr-1 h-4 w-4" />
                    放弃修改
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-1 h-4 w-4" />
                        保存修改
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            {Object.entries(categoryInfo).map(([key, info]) => {
              const Icon = info.icon
              const categoryConfigs = groupedConfigs[key as keyof GroupedConfigs] || []
              const hasModified = categoryConfigs.some(c => modifiedConfigs[c.key] !== undefined)
              
              return (
                <TabsTrigger key={key} value={key} className="relative">
                  <Icon className="mr-2 h-4 w-4" />
                  {info.title}
                  {hasModified && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-orange-600 rounded-full" />
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {Object.entries(categoryInfo).map(([category, info]) => (
            <TabsContent key={category} value={category}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{info.title}</CardTitle>
                      <CardDescription>{info.description}</CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      {category === 'email' && (
                        <div className="flex space-x-2">
                          <Input
                            type="email"
                            placeholder="输入测试邮箱"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            className="w-48"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestEmail}
                            disabled={testingEmail}
                          >
                            {testingEmail ? (
                              <>
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                测试中...
                              </>
                            ) : (
                              <>
                                <Send className="mr-1 h-4 w-4" />
                                测试邮件
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetCategory(category)}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        重置为默认
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {category === 'auth' && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-900 dark:text-yellow-100">
                          <p className="font-semibold mb-1">邮箱验证注意事项：</p>
                          <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-200">
                            <li>启用“是否需要邮箱验证”前，请先配置SMTP邮件服务</li>
                            <li>启用后，新用户注册需要验证邮箱才能登录</li>
                            <li>已注册的未验证用户需要重新发送验证邮件</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  {category === 'email' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                      <div className="flex items-start space-x-2">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-900 dark:text-blue-100">
                          <p className="font-semibold mb-1">配置SMTP邮件服务说明：</p>
                          <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-200">
                            <li>启用SMTP后，用户注册时可以发送邮箱验证邮件</li>
                            <li>支持用户通过邮件找回密码功能</li>
                            <li>常见邮箱服务器设置：
                              <ul className="ml-4 mt-1 space-y-1">
                                <li><strong>QQ邮箱:</strong>
                                  <ul className="ml-4 text-xs">
                                    <li>服务器: smtp.qq.com</li>
                                    <li>端口: 587 或 465</li>
                                    <li>密码: 使用授权码（非登录密码）</li>
                                  </ul>
                                </li>
                                <li><strong>163邮箱:</strong>
                                  <ul className="ml-4 text-xs">
                                    <li>服务器: smtp.163.com</li>
                                    <li>端口: 25 或 465</li>
                                    <li>密码: 使用授权码</li>
                                  </ul>
                                </li>
                                <li><strong>Gmail:</strong>
                                  <ul className="ml-4 text-xs">
                                    <li>服务器: smtp.gmail.com</li>
                                    <li>端口: 587 或 465</li>
                                    <li>密码: 使用应用专用密码</li>
                                  </ul>
                                </li>
                                <li><strong>Outlook:</strong>
                                  <ul className="ml-4 text-xs">
                                    <li>服务器: smtp-mail.outlook.com</li>
                                    <li>端口: 587</li>
                                  </ul>
                                </li>
                              </ul>
                            </li>
                            <li className="font-semibold text-orange-700 dark:text-orange-400">重要：大部分邮箱需要在邮箱设置中开启SMTP服务并获取授权码</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  {(groupedConfigs[category as keyof GroupedConfigs] || []).map((config) => {
                    const isModified = modifiedConfigs[config.key] !== undefined
                    
                    return (
                      <div key={config.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={config.key} className="font-medium">
                              {config.description || config.key}
                            </Label>
                            {isModified && (
                              <Badge variant="outline" className="text-orange-600 border-orange-600">
                                已修改
                              </Badge>
                            )}
                            {config.isDefault && !isModified && (
                              <Badge variant="secondary">默认值</Badge>
                            )}
                          </div>
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {config.key}
                          </code>
                        </div>
                        <div className="pl-4">
                          {renderConfigInput(config)}
                        </div>
                        {config.updatedAt && !config.isDefault && !isModified && (
                          <p className="text-xs text-gray-500 pl-4">
                            上次修改: {new Intl.DateTimeFormat('zh-CN', { timeZone: (process.env.NEXT_PUBLIC_TZ || 'Asia/Shanghai'), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(config.updatedAt))}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* 重置确认对话框 */}
        <AlertDialog open={!!resetCategory} onOpenChange={() => setResetCategory(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认重置</AlertDialogTitle>
              <AlertDialogDescription>
                确定要将 {resetCategory && categoryInfo[resetCategory as keyof typeof categoryInfo]?.title} 
                的所有配置重置为默认值吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => resetCategory && handleReset(resetCategory)}
                className="bg-red-600 hover:bg-red-700"
              >
                确认重置
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Footer />
    </div>
  )
}
