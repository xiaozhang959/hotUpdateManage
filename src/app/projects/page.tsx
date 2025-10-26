'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
import { motion, AnimatePresence } from 'framer-motion'
import { EmailVerificationBanner } from '@/components/email-verification-banner'
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
  Separator,
  SegmentedToggle
} from '@/components/ui'
import { toast } from 'sonner'
import {
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Loader2,
  ChevronRight,
  Key,
  Calendar,
  Hash,
  Upload,
  AlertCircle,
  X,
  Edit,
  RefreshCw
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileUpload } from '@/components/ui/file-upload'

interface Project {
  id: string
  name: string
  apiKey: string
  currentVersion: string | null
  createdAt: string
  updatedAt: string
  _count: {
    versions: number
  }
  versions: Array<{
    version: string
    createdAt: string
  }>
}

export default function ProjectsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({})
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    regenerateApiKey: false
  })
  const [editingProject, setEditingProject] = useState(false)
  const [requireEmailVerification, setRequireEmailVerification] = useState(false)
  const [uploadVersionDialog, setUploadVersionDialog] = useState<Project | null>(null)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [systemConfig, setSystemConfig] = useState<any>(null)
  const [uploadForm, setUploadForm] = useState({
    version: '',
    downloadUrl: '',
    downloadUrls: [''] as string[],
    changelog: '',
    forceUpdate: false,
    file: null as File | null,
    uploadMethod: 'url' as 'url' | 'file'
  })
  // 可用存储（项目总览页上传版本时使用）
  const [availableStorages, setAvailableStorages] = useState<{id:string|null,name:string,provider:string,isDefault:boolean,scope:string}[]>([])
  const [selectedStorageIds, setSelectedStorageIds] = useState<string[]>([])
  const fetchAvailableStorages = async () => {
    try { const res = await fetch('/api/storage-configs/available'); if (res.ok){ const data = await res.json(); setAvailableStorages(data.items||[]); const defaults = (data.items||[]).filter((x:any)=>x.isDefault).map((x:any)=> x.id ?? 'local'); setSelectedStorageIds(defaults.length? defaults:['local']) } } catch(e){ console.error('获取可用存储失败', e) }
  }
  const [uploading, setUploading] = useState(false)

  // 记住用户上次使用的上传方式（本地存储）
  const LAST_UPLOAD_METHOD_KEY = 'hum:lastUploadMethod'
  const loadPreferredUploadMethod = () => {
    try {
      const v = typeof window !== 'undefined' ? localStorage.getItem(LAST_UPLOAD_METHOD_KEY) : null
      const enabled = systemConfig?.upload_enabled !== false
      if (v === 'file' && !enabled) return 'url'
      return v === 'file' || v === 'url' ? v : 'url'
    } catch {
      return 'url'
    }
  }
  const savePreferredUploadMethod = (v: 'url'|'file') => {
    try { if (typeof window !== 'undefined') localStorage.setItem(LAST_UPLOAD_METHOD_KEY, v) } catch {}
  }

  // 打开上传模态时应用上次选择
  useEffect(() => {
    if (uploadVersionDialog) {
      const preferred = loadPreferredUploadMethod()
      setUploadForm(prev => ({ ...prev, uploadMethod: preferred }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadVersionDialog])

  useEffect(() => {
    fetchProjects()
    // 检查是否需要邮箱验证和系统配置
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data.require_email_verification) {
          setRequireEmailVerification(true)
        }
        setSystemConfig(data)
        // 如果文件上传被禁用，默认选择URL方式
        if (!data.upload_enabled && uploadForm.uploadMethod === 'file') {
          setUploadForm(prev => ({ ...prev, uploadMethod: 'url' }))
        }
      })
      .catch(() => {})
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) {
        throw new Error('获取项目失败')
      }
      const data = await response.json()
      setProjects(data)
    } catch (error) {
      toast.error('获取项目失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('项目名称不能为空')
      return
    }
    
    // 检查邮箱验证状态
    if (requireEmailVerification && session?.user && !session.user.emailVerified) {
      toast.error('请先验证您的邮箱', {
        description: '验证邮箱后才能创建项目'
      })
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      })

      const data = await response.json()
      
      if (!response.ok) {
        // 使用后端返回的错误消息
        toast.error(data.error || '创建项目失败')
        return
      }

      setProjects([data, ...projects])
      setNewProjectName('')
      setDialogOpen(false)
      toast.success('项目创建成功')
    } catch (error) {
      toast.error('创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteProject) return

    try {
      const response = await fetch(`/api/projects/${deleteProject.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('删除项目失败')
      }

      setProjects(projects.filter(p => p.id !== deleteProject.id))
      toast.success('项目已删除')
    } catch (error) {
      toast.error('删除项目失败')
    } finally {
      setDeleteProject(null)
    }
  }

  const handleEditProject = async () => {
    if (!editProject) return

    setEditingProject(true)
    try {
      // 更新项目名称
      const response = await fetch(`/api/projects/${editProject.id}`, {
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
        const resetResponse = await fetch(`/api/projects/${editProject.id}/regenerate-key`, {
          method: 'POST'
        })

        if (!resetResponse.ok) {
          throw new Error('重置API密钥失败')
        }
        
        toast.success('项目信息已更新，API密钥已重新生成')
      } else {
        toast.success('项目信息已更新')
      }

      fetchProjects()
      setEditProject(null)
      setEditProjectForm({ name: '', regenerateApiKey: false })
    } catch (error: any) {
      toast.error(error.message || '更新项目失败')
    } finally {
      setEditingProject(false)
    }
  }

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey)
    toast.success('API密钥已复制')
  }

  const toggleApiKey = (projectId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  // 智能生成下一个版本号
  const generateNextVersion = (project: Project): string => {
    if (!project.versions || project.versions.length === 0) {
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

  const handleUploadVersion = async () => {
    if (!uploadVersionDialog) return
    
    if (!uploadForm.version) {
      toast.error('请填写版本号')
      return
    }

    if (uploadForm.uploadMethod === 'url') {
      // 过滤空链接并检查是否至少有一个有效链接
      const validUrls = uploadForm.downloadUrls.filter(url => url.trim() !== '')
      if (validUrls.length === 0) {
        toast.error('请至少填写一个下载链接')
        return
      }
    }

    if (uploadForm.uploadMethod === 'file' && !uploadForm.file) {
      toast.error('请选择要上传的文件')
      return
    }

    setUploadingVersion(true)
    try {
      let downloadUrls: string[] = []
      let downloadUrl = ''
      let md5 = ''

      // 如果是文件上传
      if (uploadForm.uploadMethod === 'file' && uploadForm.file) {
        setUploading(true)
        const targets = selectedStorageIds.length ? selectedStorageIds : ['local']
        const uploadResults: any[] = []
        for (const t of targets) {
          const fd = new FormData()
          fd.append('file', uploadForm.file)
          fd.append('projectId', uploadVersionDialog.id)
          if (t !== 'local') fd.append('storageConfigId', t)
          const uploadResponse = await fetch('/api/upload', { method: 'POST', body: fd })
          if (!uploadResponse.ok) throw new Error('文件上传失败')
          const json = await uploadResponse.json()
          uploadResults.push(json.data)
        }
        downloadUrls = uploadResults.map(r => (r.url.startsWith('http') ? r.url : (window.location.origin + r.url)))
        downloadUrl = downloadUrls[0]
        md5 = uploadResults[0]?.md5 || ''
        var storageProvider = uploadResults[0]?.storageProvider
        var objectKey = uploadResults[0]?.objectKey
        var storageConfigId = uploadResults[0]?.storageConfigId
        var storageProviders = uploadResults.map(r => {
          const type = r.storageProvider as string | undefined
          const cfgId = r.storageConfigId ?? null
          const found = availableStorages.find((s:any) => String(s.id ?? 'local') === String(cfgId ?? 'local'))
          const name = found?.name || (type === 'LOCAL' ? '本地存储(内置)' : (type || '链接'))
          return { type, name, configId: cfgId, objectKey: r.objectKey }
        })
        setUploading(false)
      } else {
        // URL方式，过滤有效链接并进行URL编码
        const validUrls = uploadForm.downloadUrls.filter(url => url.trim() !== '')
        // Keep user-provided URLs as-is (no encoding)
        downloadUrls = validUrls
        downloadUrl = downloadUrls[0] // 向后兼容，第一个链接作为主链接
        var storageProviders = downloadUrls.map(u => ({
          type: (u.includes('/uploads/') ? 'LOCAL' : 'LINK'),
          name: (u.includes('/uploads/') ? '本地存储(内置)' : '链接'),
          configId: null,
          objectKey: null
        }))
      }

      // 创建版本
      const response = await fetch(`/api/projects/${uploadVersionDialog.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: uploadForm.version,
          downloadUrl: downloadUrl,
          downloadUrls: downloadUrls,
          changelog: uploadForm.changelog || '',
          forceUpdate: uploadForm.forceUpdate,
          md5: md5,
          storageProvider: typeof storageProvider !== 'undefined' ? storageProvider : null,
          objectKey: typeof objectKey !== 'undefined' ? objectKey : null,
          storageConfigId: typeof storageConfigId !== 'undefined' ? storageConfigId : null,
          storageProviders: typeof storageProviders !== 'undefined' ? storageProviders : []
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '创建版本失败')
      }

      toast.success('版本上传成功')
      setUploadForm({
        version: '',
        downloadUrl: '',
        downloadUrls: [''],
        changelog: '',
        forceUpdate: false,
        file: null,
        uploadMethod: 'url'
      })
      setUploadVersionDialog(null)
      fetchProjects()
    } catch (error: any) {
      toast.error(error.message || '上传版本失败')
    } finally {
      setUploadingVersion(false)
      setUploading(false)
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
      <main className="container mx-auto px-4 py-8 flex-1 min-h-[calc(100vh-200px)]">
      <EmailVerificationBanner 
        emailVerified={!!session?.user?.emailVerified}
        email={session?.user?.email}
      />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            项目管理
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            管理您的所有项目和API密钥
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="mr-2 h-4 w-4" />
              创建项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新项目</DialogTitle>
              <DialogDescription>
                输入项目名称，系统将自动生成API密钥
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">项目名称</Label>
                <Input
                  id="name"
                  placeholder="我的项目"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateProject}
                disabled={creating || !newProjectName.trim()}
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

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              您还没有创建任何项目
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              创建第一个项目
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      <Link 
                        href={`/projects/${project.id}`}
                        className="hover:text-orange-600 transition-colors duration-200 hover:underline"
                      >
                        {project.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          创建于 {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {project._count?.versions || 0} 个版本
                        </span>
                        {project.currentVersion && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            当前: v{project.currentVersion}
                          </Badge>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadVersionDialog(project)
                        // 自动填充下一个版本号
                        const nextVersion = generateNextVersion(project)
                        setUploadForm(prev => ({ ...prev, version: nextVersion }))
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      上传版本
                    </Button>
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="outline" size="sm">
                        管理版本
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditProject(project)
                        setEditProjectForm({
                          name: project.name,
                          regenerateApiKey: false
                        })
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteProject(project)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-500">API密钥</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded">
                        {showApiKeys[project.id]
                          ? project.apiKey
                          : '••••••••••••••••••••••••••••••••'}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleApiKey(project.id)}
                      >
                        {showApiKeys[project.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyApiKey(project.apiKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {project.versions && project.versions.length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      最新版本: {project.versions[0].version}
                      <span className="ml-2 text-xs">
                        ({new Date(project.versions[0].createdAt).toLocaleDateString()})
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteProject} onOpenChange={() => setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除项目 {deleteProject?.name} 吗？
              此操作将同时删除该项目下的所有版本，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑项目对话框 */}
      <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
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
                          {editProject?.apiKey.substring(0, 12)}...
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
                setEditProject(null)
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

      {/* 上传版本对话框 */}
      <Dialog open={!!uploadVersionDialog} onOpenChange={() => setUploadVersionDialog(null)}>
        <DialogContent onOpenAutoFocus={fetchAvailableStorages} className="max-w-3xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>上传新版本</DialogTitle>
            <DialogDescription>
              为项目 {uploadVersionDialog?.name} 上传新版本
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="version">版本号 *</Label>
              <Input
                id="version"
                placeholder="1.0.0"
                value={uploadForm.version}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, version: e.target.value })
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
                value={uploadForm.uploadMethod}
                onChange={(v)=>{ if (v==='file' && systemConfig?.upload_enabled===false) { toast.error('文件上传功能已被系统管理员禁用'); return } savePreferredUploadMethod(v as any); setUploadForm({ ...uploadForm, uploadMethod: v as any }) }}
                left={{ value: 'url', label: '使用下载链接' }}
                right={{ value: 'file', label: '上传本地文件' }}
                disableRight={systemConfig?.upload_enabled === false}
                className="w-full sm:w-[380px]"
              />
            </div>
            {/* 根据选择显示不同的输入（平滑过渡，避免抖动） */}
            <div className="relative overflow-hidden min-h-[180px]">
              <AnimatePresence mode="wait">
              {uploadForm.uploadMethod === 'url' ? (
                <motion.div key="url" initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} transition={{duration:0.18}} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>下载链接 *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUploadForm({
                        ...uploadForm,
                        downloadUrls: [...uploadForm.downloadUrls, '']
                      })
                    }}
                    className="h-7 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加链接
                  </Button>
                </div>
                {uploadForm.downloadUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`链接 ${index + 1}: https://example.com/app-v1.0.0.apk`}
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...uploadForm.downloadUrls]
                        newUrls[index] = e.target.value
                        setUploadForm({ ...uploadForm, downloadUrls: newUrls })
                      }}
                    />
                    {uploadForm.downloadUrls.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newUrls = uploadForm.downloadUrls.filter(
                            (_, i) => i !== index
                          )
                          setUploadForm({ ...uploadForm, downloadUrls: newUrls })
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
                </motion.div>
              ) : (
                <motion.div key="file" initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} transition={{duration:0.18}} className="space-y-2">
                <Label>选择文件 *</Label>
                <FileUpload onFileSelect={(file) => setUploadForm({ ...uploadForm, file })} onFileRemove={() => setUploadForm({ ...uploadForm, file: null })} selectedFile={uploadForm.file} maxSize={systemConfig?.max_upload_size || 100 * 1024 * 1024} uploading={uploading} disabled={uploadingVersion} />
                      <div className="space-y-2 mt-2">
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
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-changelog">
                更新日志
                <span className="text-xs text-gray-500 ml-1">（可选）</span>
              </Label>
              <textarea
                id="upload-changelog"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                placeholder="1. 新增功能xxx&#10;2. 修复bug xxx&#10;3. 优化性能"
                value={uploadForm.changelog}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, changelog: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="upload-forceUpdate"
                checked={uploadForm.forceUpdate}
                onCheckedChange={(checked) =>
                  setUploadForm({ ...uploadForm, forceUpdate: checked as boolean })
                }
              />
              <Label htmlFor="upload-forceUpdate" className="cursor-pointer">
                强制更新
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadVersionDialog(null)}
              disabled={uploadingVersion || uploading}
            >
              取消
            </Button>
            <Button
              onClick={handleUploadVersion}
              disabled={uploadingVersion || uploading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {uploadingVersion || uploading ? (
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
      </main>
      <Footer />
    </div>
  )
}
