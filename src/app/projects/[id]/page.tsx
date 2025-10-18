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
import { FileUpload } from '@/components/ui/file-upload'
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
  Package,
  X
} from 'lucide-react'

interface Version {
  id: string
  version: string
  downloadUrl: string
  downloadUrls?: string // JSON字符串，存储多个链接
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
  const [systemConfig, setSystemConfig] = useState<any>(null)

  const [formData, setFormData] = useState({
    version: '',
    downloadUrl: '',
    downloadUrls: [''] as string[], // 多链接数组
    changelog: '',
    forceUpdate: false,
    file: null as File | null,
    uploadMethod: 'url' as 'url' | 'file'
  })
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchProject()
    fetchSystemConfig()
  }, [projectId])

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/system/config')
      if (response.ok) {
        const config = await response.json()
        setSystemConfig(config)
        // 如果文件上传被禁用，默认选择URL方式
        if (!config.upload_enabled && formData.uploadMethod === 'file') {
          setFormData(prev => ({ ...prev, uploadMethod: 'url' }))
        }
      }
    } catch (error) {
      console.error('获取系统配置失败:', error)
    }
  }

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
    if (!formData.version) {
      toast.error('请填写版本号')
      return
    }

    if (formData.uploadMethod === 'url') {
      // 过滤空链接并检查是否至少有一个有效链接
      const validUrls = formData.downloadUrls.filter(url => url.trim() !== '')
      if (validUrls.length === 0) {
        toast.error('请至少填写一个下载链接')
        return
      }
    }

    if (formData.uploadMethod === 'file' && !formData.file) {
      toast.error('请选择要上传的文件')
      return
    }

    setCreating(true)
    try {
      let downloadUrls: string[] = []
      let downloadUrl = ''
      let md5 = ''

      // 如果是文件上传
      if (formData.uploadMethod === 'file' && formData.file) {
        setUploading(true)
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
        downloadUrl = window.location.origin + uploadResult.data.url
        downloadUrls = [downloadUrl]
        md5 = uploadResult.data.md5
        setUploading(false)
      } else {
        // URL方式，过滤有效链接
        downloadUrls = formData.downloadUrls.filter(url => url.trim() !== '')
        downloadUrl = downloadUrls[0] // 向后兼容，第一个链接作为主链接
      }

      // 创建版本
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: formData.version,
          downloadUrl: downloadUrl,
          downloadUrls: downloadUrls,
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
        downloadUrls: [''],
        changelog: '',
        forceUpdate: false,
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

  // 智能生成下一个版本号
  const generateNextVersion = (): string => {
    if (!project || !project.versions || project.versions.length === 0) {
      return '1.0.0' // 如果没有版本，返回初始版本
    }

    // 找到最新的版本（按创建时间排序）
    const latestVersion = project.versions.reduce((latest, current) => {
      return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
    })

    const versionStr = latestVersion.version
    
    // 处理语义化版本号 (如 1.0.1, 2.3.4)
    const parts = versionStr.split('.')
    
    if (parts.length === 3) {
      // 标准三段式版本号 major.minor.patch
      const patch = parseInt(parts[2]) || 0
      return `${parts[0]}.${parts[1]}.${patch + 1}`
    } else if (parts.length === 2) {
      // 两段式版本号 major.minor
      const minor = parseInt(parts[1]) || 0
      return `${parts[0]}.${minor + 1}`
    } else if (parts.length === 1) {
      // 单段版本号
      const version = parseInt(parts[0]) || 0
      return `${version + 1}`
    } else {
      // 更复杂的版本号，增加最后一段
      const lastPart = parts[parts.length - 1]
      const lastNum = parseInt(lastPart) || 0
      parts[parts.length - 1] = `${lastNum + 1}`
      return parts.join('.')
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
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
      }
    },
    exit: { 
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1] as [number, number, number, number]
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
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
      }
    })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8 flex-1 min-h-[calc(100vh-200px)]">
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
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (open) {
                // 对话框打开时自动填充下一个版本号
                const nextVersion = generateNextVersion()
                setFormData(prev => ({ ...prev, version: nextVersion }))
              }
            }}>
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
                
                {/* 上传方式选择 */}
                <div className="space-y-2">
                  <Label>上传方式</Label>
                  {systemConfig?.upload_enabled === false && (
                    <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        系统管理员已禁用文件上传功能，请使用下载链接方式
                      </p>
                    </div>
                  )}
                  <RadioGroup
                    value={formData.uploadMethod}
                    onValueChange={(value: 'url' | 'file') => {
                      if (value === 'file' && systemConfig?.upload_enabled === false) {
                        toast.error('文件上传功能已被系统管理员禁用')
                        return
                      }
                      setFormData({ ...formData, uploadMethod: value })
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="url" id="url" />
                      <Label htmlFor="url" className="cursor-pointer">
                        使用下载链接
                      </Label>
                    </div>
                    <div className={`flex items-center space-x-2 ${systemConfig?.upload_enabled === false ? 'opacity-50' : ''}`}>
                      <RadioGroupItem 
                        value="file" 
                        id="file" 
                        disabled={systemConfig?.upload_enabled === false}
                      />
                      <Label 
                        htmlFor="file" 
                        className={`${systemConfig?.upload_enabled === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        上传本地文件
                        {systemConfig?.upload_enabled === false && (
                          <span className="text-xs text-red-500 ml-1">(已禁用)</span>
                        )}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                {/* 根据选择显示不同的输入 */}
                {formData.uploadMethod === 'url' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>下载链接 *</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            downloadUrls: [...formData.downloadUrls, '']
                          })
                        }}
                        className="h-7 px-2"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        添加链接
                      </Button>
                    </div>
                    {formData.downloadUrls.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`链接 ${index + 1}: https://example.com/app-v1.0.0.apk`}
                          value={url}
                          onChange={(e) => {
                            const newUrls = [...formData.downloadUrls]
                            newUrls[index] = e.target.value
                            setFormData({ ...formData, downloadUrls: newUrls })
                          }}
                        />
                        {formData.downloadUrls.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newUrls = formData.downloadUrls.filter(
                                (_, i) => i !== index
                              )
                              setFormData({ ...formData, downloadUrls: newUrls })
                            }}
                            className="h-10 w-10 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">
                      支持多个APK文件下载链接，API将随机返回其中一个链接
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>选择文件 *</Label>
                    <FileUpload
                      onFileSelect={(file) => setFormData({ ...formData, file })}
                      onFileRemove={() => setFormData({ ...formData, file: null })}
                      selectedFile={formData.file}
                      maxSize={systemConfig?.max_upload_size || 100 * 1024 * 1024}
                      uploading={uploading}
                      disabled={creating}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="changelog">
                    更新日志
                    <span className="text-xs text-gray-500 ml-1">（可选）</span>
                  </Label>
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
                  disabled={creating || uploading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {creating || uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploading ? '上传中...' : '发布中...'}
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
                    onClick={() => {
                      setDialogOpen(true)
                      // 第一个版本时设置为1.0.0
                      setFormData(prev => ({ ...prev, version: '1.0.0' }))
                    }}
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
                            {(() => {
                              // 解析多链接
                              let urls = [version.downloadUrl]
                              if (version.downloadUrls) {
                                try {
                                  const parsedUrls = JSON.parse(version.downloadUrls)
                                  if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
                                    urls = parsedUrls
                                  }
                                } catch (e) {
                                  console.error('解析downloadUrls失败:', e)
                                }
                              }
                              
                              // 如果只有一个链接，显示原始样式
                              if (urls.length === 1) {
                                return (
                                  <a
                                    href={urls[0]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700"
                                    title="下载链接"
                                  >
                                    <Link2 className="h-4 w-4" />
                                  </a>
                                )
                              }
                              
                              // 多个链接时显示下拉菜单
                              return (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-blue-600 hover:text-blue-700"
                                      title={`${urls.length} 个下载链接`}
                                    >
                                      <Link2 className="h-4 w-4 mr-1" />
                                      <span className="text-xs">{urls.length}</span>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle>下载链接列表</DialogTitle>
                                      <DialogDescription>
                                        版本 {version.version} 的所有下载链接
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                      {urls.map((url, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-700 text-sm truncate flex-1"
                                            title={url}
                                          >
                                            链接 {index + 1}: {url}
                                          </a>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              navigator.clipboard.writeText(url)
                                              toast.success('链接已复制')
                                            }}
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )
                            })()}
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
                确定要删除版本 {deleteVersion?.version} 吗？此操作无法恢复。
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
      </main>
      <Footer />
    </div>
  )
}
