'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Footer } from '@/components/layout/footer'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Clock,
  FileText,
  Link2,
  Loader2,
  ChevronLeft,
  Star,
  CheckCircle,
  AlertCircle,
  Upload,
  File,
  Copy,
  Code,
  Terminal,
  Eye,
  EyeOff,
  Key,
  Package
} from 'lucide-react'

interface Version {
  id: string
  version: string
  downloadUrl: string
  md5: string
  forceUpdate: boolean
  changelog: string
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

interface Project {
  id: string
  name: string
  apiKey: string
  currentVersion: string | null
  versions: Version[]
}

export default function ProjectVersionsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteVersion, setDeleteVersion] = useState<Version | null>(null)
  const [settingCurrent, setSettingCurrent] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState(false)
  const [activeTab, setActiveTab] = useState('versions')

  const [formData, setFormData] = useState({
    version: '',
    downloadUrl: '',
    changelog: '',
    forceUpdate: false,
    isUrl: true,
    file: null as File | null,
    uploadMethod: 'url' as 'url' | 'file'
  })

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        throw new Error('获取项目失败')
      }
      const data = await response.json()
      setProject(data)
    } catch (error) {
      toast.error('获取项目详情失败')
      router.push('/projects')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVersion = async () => {
    if (!formData.version || !formData.changelog) {
      toast.error('请填写所有必填字段')
      return
    }

    if (formData.uploadMethod === 'url' && !formData.downloadUrl) {
      toast.error('请填写下载链接')
      return
    }

    if (formData.uploadMethod === 'file' && !formData.file) {
      toast.error('请选择要上传的文件')
      return
    }

    setCreating(true)
    try {
      let downloadUrl = formData.downloadUrl
      let md5 = ''

      // 如果是文件上传
      if (formData.uploadMethod === 'file' && formData.file) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', formData.file)
        uploadFormData.append('projectId', projectId)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData
        })

        if (!uploadResponse.ok) {
          throw new Error('文件上传失败')
        }

        const uploadResult = await uploadResponse.json()
        downloadUrl = uploadResult.data.url
        md5 = uploadResult.data.md5
      }

      // 创建版本
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: formData.version,
          downloadUrl: downloadUrl,
          changelog: formData.changelog,
          forceUpdate: formData.forceUpdate,
          md5: md5
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '创建版本失败')
      }

      toast.success('版本创建成功')
      setFormData({
        version: '',
        downloadUrl: '',
        changelog: '',
        forceUpdate: false,
        isUrl: true,
        file: null,
        uploadMethod: 'url'
      })
      setDialogOpen(false)
      fetchProject()
    } catch (error: any) {
      toast.error(error.message || '创建版本失败')
    } finally {
      setCreating(false)
    }
  }

  const handleSetCurrentVersion = async (versionId: string) => {
    setSettingCurrent(versionId)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/versions/${versionId}/set-current`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new Error('设置当前版本失败')
      }

      const data = await response.json()
      toast.success(data.message)
      fetchProject()
    } catch (error) {
      toast.error('设置当前版本失败')
    } finally {
      setSettingCurrent(null)
    }
  }

  const handleDeleteVersion = async () => {
    if (!deleteVersion) return

    try {
      const response = await fetch(
        `/api/projects/${projectId}/versions/${deleteVersion.id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('删除版本失败')
      }

      toast.success('版本已删除')
      fetchProject()
    } catch (error) {
      toast.error('删除版本失败')
    } finally {
      setDeleteVersion(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCommand(true)
    toast.success('已复制到剪贴板')
    setTimeout(() => setCopiedCommand(false), 2000)
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'
  const curlCommand = `curl -X POST ${apiUrl}/api/versions/latest \\
  -H "X-API-Key: ${showApiKey ? project.apiKey : '****************'}" \\
  -H "Content-Type: application/json"`
  
  const jsExample = `fetch('${apiUrl}/api/versions/latest', {
  method: 'POST',
  headers: {
    'X-API-Key': '${showApiKey ? project.apiKey : 'your-api-key'}',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))`

  // 动画配置
  const tabContentVariants = {
    initial: { 
      opacity: 0,
      y: 10,
      scale: 0.98
    },
    animate: { 
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    exit: { 
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1]
      }
    }
  }

  const cardVariants = {
    initial: { 
      opacity: 0,
      y: 20
    },
    animate: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay: i * 0.1,
        ease: [0.4, 0, 0.2, 1]
      }
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/projects')}
            className="mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            返回项目列表
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {project.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                管理项目版本和查看API调用示例
              </p>
              {project.currentVersion && (
                <div className="mt-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    当前版本: v{project.currentVersion}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 使用自定义标签页切换实现动画效果 */}
        <div className="space-y-4">
          <motion.div 
            className="grid w-full grid-cols-2 p-1 bg-gradient-to-r from-gray-100 to-gray-100 dark:from-gray-800 dark:to-gray-800 rounded-lg shadow-inner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.button
              onClick={() => setActiveTab('versions')}
              className={`relative flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'versions'
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              whileHover={{ scale: activeTab === 'versions' ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {activeTab === 'versions' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-white to-orange-50 dark:from-gray-900 dark:to-gray-800 rounded-md shadow-md border border-orange-200 dark:border-orange-800/50"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                  }}
                />
              )}
              <motion.span 
                className="relative flex items-center gap-2 z-10"
                animate={{ 
                  x: activeTab === 'versions' ? 0 : 0,
                  rotate: activeTab === 'versions' ? [0, -2, 0] : 0
                }}
                transition={{ duration: 0.3 }}
              >
                <Package className={`h-4 w-4 transition-transform duration-300 ${activeTab === 'versions' ? 'scale-110' : 'scale-100'}`} />
                版本管理
              </motion.span>
            </motion.button>
            <motion.button
              onClick={() => setActiveTab('api')}
              className={`relative flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'api'
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              whileHover={{ scale: activeTab === 'api' ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {activeTab === 'api' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-white to-orange-50 dark:from-gray-900 dark:to-gray-800 rounded-md shadow-md border border-orange-200 dark:border-orange-800/50"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25
                  }}
                />
              )}
              <motion.span 
                className="relative flex items-center gap-2 z-10"
                animate={{ 
                  x: activeTab === 'api' ? 0 : 0,
                  rotate: activeTab === 'api' ? [0, 2, 0] : 0
                }}
                transition={{ duration: 0.3 }}
              >
                <Terminal className={`h-4 w-4 transition-transform duration-300 ${activeTab === 'api' ? 'scale-110' : 'scale-100'}`} />
                API调用示例
              </motion.span>
            </motion.button>
          </motion.div>

          {/* 标签内容区域 */}
          <AnimatePresence mode="wait">
            {activeTab === 'versions' && (
              <motion.div
                key="versions"
                variants={tabContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
            <div className="flex justify-end mb-4">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" />
                发布新版本
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>发布新版本</DialogTitle>
                <DialogDescription>
                  填写版本信息，新版本将自动设为当前活跃版本
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="version">版本号 *</Label>
                  <Input
                    id="version"
                    placeholder="1.0.0"
                    value={formData.version}
                    onChange={(e) =>
                      setFormData({ ...formData, version: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downloadUrl">下载链接 *</Label>
                  <Input
                    id="downloadUrl"
                    placeholder="https://example.com/app-v1.0.0.apk"
                    value={formData.downloadUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, downloadUrl: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    可以是文件直链或上传后的URL
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="changelog">更新日志 *</Label>
                  <textarea
                    id="changelog"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    placeholder="1. 新增功能xxx&#10;2. 修复bug xxx&#10;3. 优化性能"
                    value={formData.changelog}
                    onChange={(e) =>
                      setFormData({ ...formData, changelog: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="forceUpdate"
                    checked={formData.forceUpdate}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, forceUpdate: checked as boolean })
                    }
                  />
                  <Label htmlFor="forceUpdate" className="cursor-pointer">
                    强制更新
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateVersion}
                  disabled={creating}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发布中...
                    </>
                  ) : (
                    '发布版本'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </div>

            {project.versions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="text-center py-12">
                <CardContent>
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    该项目还没有发布任何版本
                  </p>
                  <Button
                    onClick={() => setDialogOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    发布第一个版本
                  </Button>
                </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>版本号</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>强制更新</TableHead>
                      <TableHead>更新日志</TableHead>
                      <TableHead>发布时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.versions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell className="font-medium">{version.version}</TableCell>
                        <TableCell>
                          {version.isCurrent || project.currentVersion === version.version ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              当前版本
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetCurrentVersion(version.id)}
                              disabled={settingCurrent === version.id}
                            >
                              {settingCurrent === version.id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Star className="mr-1 h-3 w-3" />
                              )}
                              设为当前
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {version.forceUpdate ? (
                            <Badge variant="destructive">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              强制
                            </Badge>
                          ) : (
                            <Badge variant="secondary">可选</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="truncate text-sm">{version.changelog}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock className="h-3 w-3" />
                            {new Date(version.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <a
                              href={version.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Link2 className="h-4 w-4" />
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteVersion(version)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </Card>
              </motion.div>
            )}
              </motion.div>
            )}

            {activeTab === 'api' && (
              <motion.div
                key="api"
                variants={tabContentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                {/* API密钥卡片 */}
                <motion.div
                  variants={cardVariants}
                  initial="initial"
                  animate="animate"
                  custom={0}
                >
                  <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API 密钥
                  </CardTitle>
                  <CardDescription>
                    使用此密钥访问项目的版本信息
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded">
                {showApiKey ? project.apiKey : '••••••••••••••••••••••••••••••••'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(project.apiKey)
                  toast.success('API密钥已复制')
                }}
              >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
                </CardContent>
                </Card>
                </motion.div>

                {/* 代码示例卡片 */}
                <motion.div
                  variants={cardVariants}
                  initial="initial"
                  animate="animate"
                  custom={1}
                >
                  <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    代码示例
                  </CardTitle>
                  <CardDescription>
                    复制以下代码快速集成到您的应用程序
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* cURL 示例 */}
                  <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">cURL 命令</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(curlCommand)}
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedCommand ? '已复制' : '复制'}
              </Button>
            </div>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{curlCommand}</code>
            </pre>
          </div>

          {/* JavaScript 示例 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">JavaScript/TypeScript</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(jsExample)}
              >
                <Copy className="h-3 w-3 mr-1" />
                复制
              </Button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{jsExample}</code>
            </pre>
          </div>

                  </CardContent>
                  </Card>
                </motion.div>

                {/* 响应示例卡片 */}
                <motion.div
                  variants={cardVariants}
                  initial="initial"
                  animate="animate"
                  custom={2}
                >
                  <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    响应格式
                  </CardTitle>
                  <CardDescription>
                    API返回的数据格式示例
                  </CardDescription>
                </CardHeader>
                <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
              <code>{JSON.stringify({
  success: true,
  data: {
    version: project.currentVersion || "1.0.0",
    downloadUrl: "https://example.com/app-v1.0.0.apk",
    md5: "a1b2c3d4e5f6...",
    forceUpdate: false,
    changelog: "更新说明...",
    createdAt: new Date().toISOString()
  }
}, null, 2)}</code>
            </pre>
                  </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AlertDialog
          open={!!deleteVersion}
          onOpenChange={() => setDeleteVersion(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除版本</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除版本 "{deleteVersion?.version}" 吗？此操作无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteVersion}
                className="bg-red-600 hover:bg-red-700"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <Footer />
    </div>
  )
}
