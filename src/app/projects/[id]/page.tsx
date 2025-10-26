'use client'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  X,
  Edit,
  RefreshCw
} from 'lucide-react'

interface Version {
  id: string
  version: string
  downloadUrl: string
  downloadUrls?: string // JSON字符串，存储多个链接
  md5: string
  md5Source?: string
  storageProvider?: string | null
  storageProviders?: string | null
  storageConfigId?: string | null
  objectKey?: string | null
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
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    regenerateApiKey: false
  })
  const [editingProject, setEditingProject] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Version | null>(null)
  const [editVersionForm, setEditVersionForm] = useState({
    version: '',
    downloadUrl: '',
    downloadUrls: [''] as string[],
    changelog: '',
    forceUpdate: false,
    isCurrent: false
  })
  const [updatingVersion, setUpdatingVersion] = useState(false)

  const [formData, setFormData] = useState({
    version: '',
    downloadUrl: '',
    downloadUrls: [''] as string[], // 多链接数组
    changelog: '',
    forceUpdate: false,
    file: null as File | null,
    uploadMethod: 'url' as 'url' | 'file',
    md5: ''
  })
  const [uploading, setUploading] = useState(false)
  const [resolvingMd5, setResolvingMd5] = useState(false)
  // 记住用户上次使用的上传方式（本地存储）
  const LAST_UPLOAD_METHOD_KEY = 'hum:lastUploadMethod'
  const loadPreferredUploadMethod = () => {
    try {
      const v = typeof window !== 'undefined' ? localStorage.getItem(LAST_UPLOAD_METHOD_KEY) : null
      const enabled = systemConfig?.upload_enabled !== false
      if (v === 'file' && !enabled) return 'url'
      return v === 'file' || v === 'url' ? v : 'url'
    } catch { return 'url' }
  }
  const savePreferredUploadMethod = (v: 'url'|'file') => {
    try { if (typeof window !== 'undefined') localStorage.setItem(LAST_UPLOAD_METHOD_KEY, v) } catch {}
  }
  // 版本筛选
  const [filterVersion, setFilterVersion] = useState('')
  const [filterStart, setFilterStart] = useState('') // YYYY-MM-DD
  const [filterEnd, setFilterEnd] = useState('') // YYYY-MM-DD

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
        if (!config.upload_enabled && formData.uploadMethod === 'file') {
          setFormData(prev => ({ ...prev, uploadMethod: 'url' }))
        }
      }
    } catch (error) {
      console.error('获取系统配置失败:', error)
    }
  }

  // 可用存储
  const [availableStorages, setAvailableStorages] = useState<{id:string|null,name:string,provider:string,isDefault:boolean,scope:string}[]>([])
  const [selectedStorageIds, setSelectedStorageIds] = useState<string[]>([])
  const fetchAvailableStorages = async () => {
    try {
      const res = await fetch('/api/storage-configs/available')
      if (res.ok) {
        const data = await res.json()
        setAvailableStorages(data.items || [])
        const defaults = (data.items || []).filter((x:any)=>x.isDefault).map((x:any)=> x.id ?? 'local')
        setSelectedStorageIds(defaults.length>0? defaults: ['local'])
      }
    } catch(e){
      console.error('获取可用存储失败', e)
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
        // 目标存储集合（至少一个）
        const targets = selectedStorageIds.length ? selectedStorageIds : ['local']
        const uploadResults: any[] = []
        for (const t of targets) {
          const fd = new FormData()
          fd.append('file', formData.file)
          fd.append('projectId', projectId)
          if (t !== 'local') fd.append('storageConfigId', t)
          const resp = await fetch('/api/upload', { method: 'POST', body: fd })
          if (!resp.ok) throw new Error('文件上传失败')
          const json = await resp.json()
          uploadResults.push(json.data)
        }
        // 汇总链接与MD5
        downloadUrls = uploadResults.map(r => (r.url.startsWith('http') ? r.url : (window.location.origin + r.url)))
        downloadUrl = downloadUrls[0]
        md5 = uploadResults[0]?.md5 || ''
        // 取第一条作为向后兼容单字段
        var storageProvider = uploadResults[0]?.storageProvider
        var objectKey = uploadResults[0]?.objectKey
        var storageConfigId = uploadResults[0]?.storageConfigId
        // 记录每条链接的“类型+名称”用于 UI 展示
        var storageProviders = uploadResults.map(r => {
          const type = r.storageProvider as string | undefined
          const cfgId = r.storageConfigId ?? null
          const found = availableStorages.find(s => String(s.id ?? 'local') === String(cfgId ?? 'local'))
          const name = found?.name || (type === 'LOCAL' ? '本地存储(内置)' : (type || '链接'))
          return { type, name, configId: cfgId, objectKey: r.objectKey }
        })
        setUploading(false)
      } else {
        // URL方式，过滤有效链接并进行URL编码
        const validUrls = formData.downloadUrls.filter(url => url.trim() !== '')
        // Keep user-provided URLs as-is (no encoding)
        downloadUrls = validUrls
        downloadUrl = downloadUrls[0] // 向后兼容，第一个链接作为主链接
        md5 = (formData.md5 || '').trim()
        // URL 方式：据链接类型填充“名称+类型”数组，便于展示
        var storageProviders = downloadUrls.map(u => ({
          type: isLocalUploadUrl(u) ? 'LOCAL' : 'LINK',
          name: isLocalUploadUrl(u) ? '本地存储(内置)' : '链接',
          configId: null,
          objectKey: null
        }))
      }

      // 创建版本（携带存储关联信息，非对象存储则为 null）
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: formData.version,
          downloadUrl: downloadUrl,
          downloadUrls: downloadUrls,
          changelog: formData.changelog,
          forceUpdate: formData.forceUpdate,
          md5: md5,
          storageProvider: typeof storageProvider !== 'undefined' ? storageProvider : null,
          objectKey: typeof objectKey !== 'undefined' ? objectKey : null,
          storageConfigId: typeof storageConfigId !== 'undefined' ? storageConfigId : null,
          storageProviders: typeof storageProviders !== 'undefined' ? storageProviders : []
        })
      });

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
        uploadMethod: 'url',
        md5: ''
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

  const handleEditVersion = (version: Version) => {
    setEditingVersion(version)
    // 解析downloadUrls用于显示
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
    
    setEditVersionForm({
      version: version.version,
      downloadUrl: version.downloadUrl,
      downloadUrls: urls, // 保留原有链接用于显示
      changelog: version.changelog,
      forceUpdate: version.forceUpdate,
      isCurrent: version.isCurrent
    })
  }

  // 检查是否为本地上传的文件链接
  const isLocalUploadUrl = (url: string): boolean => {
    if (!url) return false
    // 检查是否包含 /uploads/ 路径或是相对于当前域名的链接
    return url.includes('/uploads/') || 
           (typeof window !== 'undefined' && url.startsWith(window.location.origin) && url.includes('/uploads/'))
  }

  const providerColorClass = (type?: string) => {
    switch ((type || '').toUpperCase()) {
      case 'S3':
        return 'bg-blue-50 text-blue-700 border-blue-300'
      case 'OSS':
        return 'bg-orange-50 text-orange-700 border-orange-300'
      case 'LOCAL':
        return 'bg-gray-50 text-gray-700 border-gray-300'
      case 'WEBDAV':
        return 'bg-purple-50 text-purple-700 border-purple-300'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-300'
    }
  }

  const parseProviders = (raw: string | null | undefined): any[] => {
    try {
      if (!raw) return []
      const parsed = JSON.parse(raw as any)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }

  const handleUpdateVersion = async () => {
    if (!editingVersion) return
    if (!editVersionForm.version) {
      toast.error('请填写版本号')
      return
    }

    setUpdatingVersion(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/versions/${editingVersion.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: editVersionForm.version,
            // 不再发送downloadUrl和downloadUrls，保持原有链接不变
            changelog: editVersionForm.changelog,
            forceUpdate: editVersionForm.forceUpdate,
            isCurrent: editVersionForm.isCurrent
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '更新版本失败')
      }

      toast.success('版本已更新')
      setEditingVersion(null)
      fetchProject()
    } catch (error: any) {
      toast.error(error.message || '更新版本失败')
    } finally {
      setUpdatingVersion(false)
    }
  }

  const handleEditProject = async () => {
    if (!project) return

    setEditingProject(true)
    try {
      // 更新项目名称
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectForm.name
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '更新项目失败')
      }

      // 如果需要重新生成API密钥
      if (editProjectForm.regenerateApiKey) {
        const resetResponse = await fetch(`/api/projects/${project.id}/regenerate-key`, {
          method: 'POST'
        })

        if (!resetResponse.ok) {
          throw new Error('重置API密钥失败')
        }
        
        toast.success('项目信息已更新，API密钥已重新生成')
      } else {
        toast.success('项目信息已更新')
      }

      fetchProject()
      setEditDialogOpen(false)
      setEditProjectForm({ name: '', regenerateApiKey: false })
    } catch (error: any) {
      toast.error(error.message || '更新项目失败')
    } finally {
      setEditingProject(false)
    }
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

  // 过滤后的版本列表（按版本号与日期范围）
  const filteredVersions = (project?.versions || []).filter((v) => {
    const byVersion = filterVersion
      ? (v.version || '').toLowerCase().includes(filterVersion.toLowerCase())
      : true
    const created = new Date(v.createdAt).getTime()
    const afterStart = filterStart
      ? created >= new Date(`${filterStart}T00:00:00`).getTime()
      : true
    const beforeEnd = filterEnd
      ? created <= new Date(`${filterEnd}T23:59:59.999`).getTime()
      : true
    return byVersion && afterStart && beforeEnd
  })

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
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(true)
                setEditProjectForm({
                  name: project.name,
                  regenerateApiKey: false
                })
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑项目
            </Button>
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
                const preferred = loadPreferredUploadMethod()
                setFormData(prev => ({ ...prev, version: nextVersion, uploadMethod: preferred }))
              }
            }}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" />
                发布新版本
              </Button>
            </DialogTrigger>
            <DialogContent onInteractOutside={() => {}} onOpenAutoFocus={fetchAvailableStorages} className="max-w-3xl sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>发布新版本</DialogTitle>
                <DialogDescription>
                  填写版本信息，新版本将自动设为当前活跃版本
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
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
                  <SegmentedToggle
                    value={formData.uploadMethod}
                    onChange={(v)=>{ if (v==='file' && systemConfig?.upload_enabled===false) { toast.error('文件上传功能已被系统管理员禁用'); return } savePreferredUploadMethod(v as any); setFormData({ ...formData, uploadMethod: v as any }) }}
                    left={{ value: 'url', label: '使用下载链接' }}
                    right={{ value: 'file', label: '上传本地文件' }}
                    disableRight={systemConfig?.upload_enabled === false}
                    className="w-full sm:w-[380px]"
                  />
                </div>
                {/* 根据选择显示不同的输入 */}
                {formData.uploadMethod === 'url' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>下载链接 *</Label>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setFormData({ ...formData, downloadUrls: [...formData.downloadUrls, ''] }) }} className="h-7 px-2">
                        <Plus className="h-3 w-3 mr-1" /> 添加链接
                      </Button>
                    </div>
                    {systemConfig?.require_md5_for_link_uploads === true && (
                      <div className="mb-1 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800">系统已开启“链接上传必须提供有效 MD5”。请点击下方“自动获取 MD5”或手动填写。</div>
                    )}
                    {formData.downloadUrls.map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <Input placeholder={`链接 ${index + 1}: https://example.com/app-v1.0.0.apk`} value={url} onChange={(e) => {
                          const newUrls = [...formData.downloadUrls]; newUrls[index] = e.target.value; setFormData({ ...formData, downloadUrls: newUrls })
                        }} />
                        {formData.downloadUrls.length > 1 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => {
                            const newUrls = formData.downloadUrls.filter((_, i) => i !== index); setFormData({ ...formData, downloadUrls: newUrls })
                          }} className="h-10 w-10 p-0"><X className="h-4 w-4" /></Button>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Label htmlFor="md5" className="text-sm">MD5（可选）</Label>
                        <Input id="md5" placeholder="如未填写，系统将尝试从ETag获取或自动计算" value={formData.md5} onChange={(e) => setFormData({ ...formData, md5: e.target.value })} />
                      </div>
                      <Button type="button" size="sm" variant="outline" disabled={resolvingMd5 || formData.downloadUrls.filter(u => u.trim()).length === 0} onClick={async () => {
                        const primary = formData.downloadUrls.find(u => u.trim()) || ''; if (!primary) { toast.error('请先填写下载链接'); return }
                        setResolvingMd5(true)
                        try { const resp = await fetch('/api/utils/resolve-md5', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: primary }) }); const data = await resp.json(); if (data?.success && data?.md5) { setFormData(prev => ({ ...prev, md5: data.md5 })); toast.success(`已获取MD5（来源：${data.from}）`) } else { toast.error(data?.message || '无法自动获取MD5，请手动填写') } } catch { toast.error('获取MD5失败') } finally { setResolvingMd5(false) }
                      }} className="h-10 mt-6">{resolvingMd5 ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 获取中</>) : (<><RefreshCw className="h-4 w-4 mr-1" /> 自动获取MD5</>)}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">支持多个链接；很多 OSS/S3 的 ETag 即为 MD5；分片上传可能无法解析。</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>选择文件 *</Label>
                    <FileUpload onFileSelect={(file) => setFormData({ ...formData, file })} onFileRemove={() => setFormData({ ...formData, file: null })} selectedFile={formData.file} maxSize={systemConfig?.max_upload_size || 100 * 1024 * 1024} uploading={uploading} disabled={creating} />
                    <div className="space-y-2">
                      <Label>选择存储（可多选）</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {availableStorages.map((s) => (
                          <label key={String(s.id ?? 'local')} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={selectedStorageIds.includes(String(s.id ?? 'local'))} onChange={(e)=>{
                                const key = String(s.id ?? 'local');
                                setSelectedStorageIds(prev => e.target.checked ? Array.from(new Set([...prev, key])) : prev.filter(x=>x!==key))
                              }} />
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-gray-500">({s.provider}{s.isDefault?'·默认':''})</span>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              s.scope === 'user'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                : s.scope === 'global'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-gray-50 text-gray-700 border-gray-300'
                            }`}>
                              {s.scope === 'user' ? '我的' : s.scope === 'global' ? '全局' : '内置'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* 更新日志 */}
                <div className="space-y-2">
                  <Label htmlFor="changelog">更新日志</Label>
                  <textarea
                    id="changelog"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    placeholder={"1. 新增功能xxx&#10;2. 修复bug xxx"}
                    value={formData.changelog}
                    onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
                  />
                </div>
                {/* 强制更新 */}
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
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={creating}
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreateVersion}
                  disabled={creating}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    '创建'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>

          {/* 版本列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                版本列表
              </CardTitle>
              <CardDescription>
                共 {project.versions?.length || 0} 个版本，按创建时间倒序显示
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* 筛选工具栏 */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Input
                  placeholder="按版本号搜索"
                  value={filterVersion}
                  onChange={(e) => setFilterVersion(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="w-40"
                />
                <span className="text-gray-400">至</span>
                <Input
                  type="date"
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className="w-40"
                />
                <Button
                  variant="ghost"
                  onClick={() => { setFilterVersion(''); setFilterStart(''); setFilterEnd('') }}
                >清空</Button>
              </div>

              {filteredVersions.length === 0 ? (
                <div className="text-sm text-gray-500">暂无版本，请先发布新版本。</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>版本</TableHead>
                      <TableHead>下载</TableHead>
                      <TableHead>MD5</TableHead>
                      <TableHead>强制</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVersions
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">
                            v{v.version}
                            {v.isCurrent && (
                              <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">当前</Badge>
                            )}
                            {v.forceUpdate && (
                              <Badge variant="secondary" className="ml-2">强制</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              let urls: string[] = []
                              try {
                                if (v.downloadUrls) {
                                  const parsed = JSON.parse(v.downloadUrls)
                                  if (Array.isArray(parsed)) urls = parsed.filter(Boolean)
                                }
                              } catch {}
                              if (urls.length === 0 && v.downloadUrl) urls = [v.downloadUrl]
                              if (urls.length === 0) return <span className="text-gray-400">-</span>

                              // 解析与链接一一对应的“名称+类型”，与创建时顺序一致
                              const providersAny = parseProviders(v.storageProviders as any)
                              const providerInfoFor = (index: number, url: string) => {
                                const it = providersAny[index]
                                let type = '', name = ''
                                if (it && typeof it === 'object') {
                                  type = (it.type || '').toString()
                                  name = (it.name || '').toString()
                                } else if (typeof it === 'string') {
                                  type = it
                                  name = it
                                }
                                if (!type) {
                                  type = isLocalUploadUrl(url) ? 'LOCAL' : (v.objectKey ? (v.storageProvider || '') : 'LINK')
                                }
                                if (!name) {
                                  name = type === 'LOCAL' ? '本地存储(内置)' : (type || '链接')
                                }
                                return { type, name, badgeClass: providerColorClass(type) }
                              }

                              const proxied = v.objectKey ? `/api/versions/${v.id}/download` : null
                              const [first, ...rest] = urls
                              const firstMeta = providerInfoFor(0, first)
                              return (
                                <div className="flex items-center gap-2">
                                  <a href={proxied || first} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline">主链接</a>
                                  <Badge variant="outline" className={`text-[10px] ${firstMeta.badgeClass}`}>{firstMeta.name}</Badge>
                                  {rest.length > 0 && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline">更多({rest.length})</Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start">
                                        {rest.map((u, i) => {
                                          const meta = providerInfoFor(i + 1, u)
                                          return (
                                            <DropdownMenuItem key={i} asChild>
                                              <a href={u} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                                                <Link2 className="h-3 w-3" /> 链接 {i + 2}
                                                <Badge variant="outline" className={`text-[10px] ${meta.badgeClass}`}>{meta.name}</Badge>
                                              </a>
                                            </DropdownMenuItem>
                                          )
                                        })}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {v.md5 || <span className="text-gray-400">-</span>}
                          </TableCell>
                          <TableCell>
                            {v.forceUpdate ? '是' : '否'}
                          </TableCell>
                          <TableCell>
                            {new Date(v.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={v.isCurrent || settingCurrent === v.id}
                              onClick={() => handleSetCurrentVersion(v.id)}
                              title={v.isCurrent ? '已是当前版本' : '设为当前版本'}
                            >
                              {settingCurrent === v.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Star className="h-4 w-4" />
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEditVersion(v)} title="编辑">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteVersion(v)} title="删除">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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

        {/* 编辑版本对话框 */}
        <Dialog open={!!editingVersion} onOpenChange={(open) => !open && setEditingVersion(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>编辑版本详情</DialogTitle>
              <DialogDescription>
                修改版本 {editingVersion?.version} 的信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-version">版本号 *</Label>
                <Input
                  id="edit-version"
                  placeholder="1.0.0"
                  value={editVersionForm.version}
                  onChange={(e) => setEditVersionForm({ ...editVersionForm, version: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>下载链接（不可修改）</Label>
                
                {/* 显示说明信息 */}
                <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">
                        下载链接不支持修改。如需更改文件，请删除此版本并创建新版本。
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 显示所有下载链接 */}
                {editVersionForm.downloadUrls.map((url, index) => {
                  const isLocal = isLocalUploadUrl(url)
                  const providersAny = parseProviders(editingVersion?.storageProviders as any)
                  const it = providersAny[index]
                  let type = '', name = ''
                  if (it && typeof it === 'object') {
                    type = (it.type || '').toString()
                    name = (it.name || '').toString()
                  } else if (typeof it === 'string') {
                    type = it
                    name = it
                  }
                  if (!type) type = isLocal ? 'LOCAL' : 'LINK'
                  if (!name) name = type === 'LOCAL' ? '本地存储(内置)' : (type || '链接')
                  const badgeClass = providerColorClass(type)
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">链接 {index + 1}:</span>
                        <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{name}</Badge>
                        {isLocal && (
                          <Badge variant="secondary" className="text-xs">
                            <Upload className="h-3 w-3 mr-1" />
                            上传文件
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={url}
                          readOnly
                          disabled
                          className="bg-gray-50 font-mono text-sm"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(url)
                            toast.success('链接已复制')
                          }}
                          className="h-10 w-10 p-0"
                          title="复制链接"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-changelog">更新日志</Label>
                <textarea
                  id="edit-changelog"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  placeholder="1. 新增功能xxx&#10;2. 修复bug xxx"
                  value={editVersionForm.changelog}
                  onChange={(e) => setEditVersionForm({ ...editVersionForm, changelog: e.target.value })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-forceUpdate"
                  checked={editVersionForm.forceUpdate}
                  onCheckedChange={(checked) =>
                    setEditVersionForm({ ...editVersionForm, forceUpdate: checked as boolean })
                  }
                />
                <Label htmlFor="edit-forceUpdate" className="cursor-pointer">
                  强制更新
                </Label>
              </div>
              
              <Separator />
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-isCurrent"
                  checked={editVersionForm.isCurrent}
                  onCheckedChange={(checked) =>
                    setEditVersionForm({ ...editVersionForm, isCurrent: checked as boolean })
                  }
                />
                <Label htmlFor="edit-isCurrent" className="cursor-pointer">
                  设置为当前版本
                </Label>
              </div>
              
              {editingVersion && (
                <div className="text-xs text-gray-500 space-y-1">
                  <p>创建时间: {new Date(editingVersion.createdAt).toLocaleString()}</p>
                  {editingVersion.updatedAt && (
                    <p>最后更新: {new Date(editingVersion.updatedAt).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingVersion(null)}>
                取消
              </Button>
              <Button
                onClick={handleUpdateVersion}
                disabled={updatingVersion}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {updatingVersion ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '保存修改'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑项目对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>编辑项目</DialogTitle>
              <DialogDescription>
                修改项目信息和管理API密钥
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project-name">项目名称</Label>
                <Input
                  id="edit-project-name"
                  value={editProjectForm.name}
                  onChange={(e) => setEditProjectForm({ ...editProjectForm, name: e.target.value })}
                  disabled={editingProject}
                />
              </div>
              
              {/* API密钥管理 */}
              <Separator />
              <div className="space-y-3">
                <Label>API密钥管理</Label>
                <Card className="bg-gray-50 dark:bg-gray-900">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <p className="font-medium">当前API密钥</p>
                          <code className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-1 block">
                            {project?.apiKey.substring(0, 12)}...
                          </code>
                        </div>
                        <Key className="h-4 w-4 text-gray-400" />
                      </div>
                      
                      <div className="flex items-center space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                        <Checkbox
                          id="regenerate-api-key"
                          checked={editProjectForm.regenerateApiKey}
                          onCheckedChange={(checked) => 
                            setEditProjectForm({ ...editProjectForm, regenerateApiKey: checked as boolean })
                          }
                          disabled={editingProject}
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor="regenerate-api-key" 
                            className="text-sm font-medium cursor-pointer"
                          >
                            重新生成API密钥
                          </Label>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            <AlertCircle className="inline h-3 w-3 mr-1" />
                            警告：重新生成将使旧密钥立即失效
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false)
                  setEditProjectForm({ name: '', regenerateApiKey: false })
                }}
                disabled={editingProject}
              >
                取消
              </Button>
              <Button
                onClick={handleEditProject}
                disabled={editingProject || !editProjectForm.name.trim()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {editingProject ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  editProjectForm.regenerateApiKey ? '保存并重新生成密钥' : '保存'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  )
}
