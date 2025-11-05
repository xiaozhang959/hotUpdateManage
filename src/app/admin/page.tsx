'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileUpload } from '@/components/ui/file-upload'
import { toast } from 'sonner'
import {
  Users,
  Package,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Key,
  Clock,
  FolderOpen,
  GitBranch,
  Eye,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Hash,
  ArrowUpDown,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/timezone'

interface User {
  id: string
  email: string
  username: string
  role: string
  createdAt: string
  _count: {
    projects: number
  }
}

interface Version {
  id: string
  version: string
  downloadUrl: string
  size?: number | string | null
  md5: string
  forceUpdate: boolean
  changelog: string
  isCurrent: boolean
  createdAt: string
}

interface Project {
  id: string
  name: string
  apiKey: string
  currentVersion: string | null
  userId: string
  user: {
    id: string
    username: string
    email: string
  }
  versions: Version[]
  _count: {
    versions: number
  }
  createdAt: string
  updatedAt: string
}

interface Stats {
  totalUsers: number
  totalProjects: number
  totalVersions: number
  adminCount: number
}

export default function AdminPage() {
  const formatSizeKB = (v: number | string | null | undefined) => {
    if (v === null || v === undefined) return '未知大小'
    const n = typeof v === 'string' ? parseInt(v, 10) : v
    if (!Number.isFinite(n)) return '未知大小'
    const kb = Math.ceil((n as number) / 1024)
    return `${kb} KB`
  }
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    username: '',
    password: '',
    role: ''
  })
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    currentVersion: '',
    regenerateApiKey: false
  })
  const [viewProject, setViewProject] = useState<Project | null>(null)
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null)
  
  // 新增：搜索和筛选状态
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [userFilter, setUserFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [resetApiKeyProject, setResetApiKeyProject] = useState<Project | null>(null)
  const [resettingApiKey, setResettingApiKey] = useState(false)
  const [managingVersions, setManagingVersions] = useState<Project | null>(null)
  const [addVersionForm, setAddVersionForm] = useState({
    version: '',
    downloadUrl: '',
    changelog: '',
    forceUpdate: false,
    uploadMethod: 'url' as 'url' | 'file',
    file: null as File | null
  })
  const [addingVersion, setAddingVersion] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [systemConfig, setSystemConfig] = useState<any>(null)

  useEffect(() => {
    fetchUsers()
    fetchProjects()
    fetchSystemConfig()
  }, [])

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/system/config')
      if (response.ok) {
        const config = await response.json()
        setSystemConfig(config)
        // 如果文件上传被禁用，默认选择URL方式
        if (!config.upload_enabled && addVersionForm.uploadMethod === 'file') {
          setAddVersionForm(prev => ({ ...prev, uploadMethod: 'url' }))
        }
      }
    } catch (error) {
      console.error('获取系统配置失败:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        if (response.status === 403) {
          toast.error('您没有管理员权限')
          return
        }
        throw new Error('获取用户列表失败')
      }
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      toast.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/admin/projects')
      if (!response.ok) {
        if (response.status === 403) {
          toast.error('您没有管理员权限')
          return
        }
        throw new Error('获取项目列表失败')
      }
      const data = await response.json()
      setProjects(data)
    } catch (error) {
      toast.error('获取项目列表失败')
    }
  }

  const handleEditUser = async () => {
    if (!editUser) return

    try {
      const response = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editForm.username || undefined,
          password: editForm.password || undefined,
          role: editForm.role || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast.success('用户信息已更新')
      fetchUsers()
      setEditUser(null)
      setEditForm({ username: '', password: '', role: '' })
    } catch (error: any) {
      toast.error(error.message || '更新用户失败')
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteUser) return

    try {
      const response = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast.success('用户已删除')
      setUsers(users.filter(u => u.id !== deleteUser.id))
      setDeleteUser(null)
    } catch (error: any) {
      toast.error(error.message || '删除用户失败')
    }
  }

  const handleEditProject = async () => {
    if (!editProject) return

    try {
      // 先更新项目基本信息
      const response = await fetch(`/api/admin/projects/${editProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectForm.name || undefined,
          currentVersion: editProjectForm.currentVersion || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      // 如果需要重新生成API密钥
      if (editProjectForm.regenerateApiKey) {
        const resetResponse = await fetch(`/api/admin/projects/${editProject.id}/reset-api-key`, {
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
      setEditProjectForm({ name: '', currentVersion: '', regenerateApiKey: false })
    } catch (error: any) {
      toast.error(error.message || '更新项目失败')
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteProject) return

    try {
      const response = await fetch(`/api/admin/projects/${deleteProject.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast.success('项目已删除')
      setProjects(projects.filter(p => p.id !== deleteProject.id))
      setDeleteProject(null)
    } catch (error: any) {
      toast.error(error.message || '删除项目失败')
    }
  }

  const copyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopiedApiKey(apiKey)
      toast.success('API Key 已复制到剪贴板')
      setTimeout(() => setCopiedApiKey(null), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
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

  const handleResetApiKey = async () => {
    if (!resetApiKeyProject) return

    setResettingApiKey(true)
    try {
      const response = await fetch(`/api/admin/projects/${resetApiKeyProject.id}/reset-api-key`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('重置API密钥失败')
      }

      const data = await response.json()
      toast.success('API密钥已重置成功')
      fetchProjects()
      setResetApiKeyProject(null)
    } catch (error: any) {
      toast.error(error.message || '重置API密钥失败')
    } finally {
      setResettingApiKey(false)
    }
  }

  const handleAddVersion = async (projectId: string) => {
    if (!addVersionForm.version) {
      toast.error('请填写版本号')
      return
    }

    if (addVersionForm.uploadMethod === 'url' && !addVersionForm.downloadUrl) {
      toast.error('请填写下载链接')
      return
    }

    if (addVersionForm.uploadMethod === 'file' && !addVersionForm.file) {
      toast.error('请选择要上传的文件')
      return
    }

    setAddingVersion(true)
    try {
      let downloadUrl = addVersionForm.downloadUrl
      let md5 = ''

      // 如果是文件上传
      if (addVersionForm.uploadMethod === 'file' && addVersionForm.file) {
        setUploading(true)
        const uploadFormData = new FormData()
        uploadFormData.append('file', addVersionForm.file)
        uploadFormData.append('projectId', projectId)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData
        })

        if (!uploadResponse.ok) {
          throw new Error('文件上传失败')
        }

        const uploadResult = await uploadResponse.json()
        // 仅存储相对路径，避免绑定到本机域名/IP
        downloadUrl = uploadResult.data.url
        md5 = uploadResult.data.md5
        var uploadedSize = uploadResult.data.size as number | undefined
        setUploading(false)
      }

      const response = await fetch(`/api/admin/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: addVersionForm.version,
          downloadUrl: downloadUrl,
          changelog: addVersionForm.changelog || '',
          forceUpdate: addVersionForm.forceUpdate,
          md5: md5,
          size: typeof uploadedSize === 'number' ? uploadedSize : undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }

      toast.success('版本添加成功')
      fetchProjects()
      setManagingVersions(null)
      setAddVersionForm({ version: '', downloadUrl: '', changelog: '', forceUpdate: false, uploadMethod: 'url', file: null })
    } catch (error: any) {
      toast.error(error.message || '添加版本失败')
    } finally {
      setAddingVersion(false)
    }
  }

  const handleDeleteVersion = async (projectId: string, versionId: string) => {
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/versions/${versionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('删除版本失败')
      }

      toast.success('版本已删除')
      fetchProjects()
    } catch (error: any) {
      toast.error(error.message || '删除版本失败')
    }
  }

  // 过滤和排序逻辑
  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.user.username.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (projectFilter === 'active') {
        return matchesSearch && project._count.versions > 0
      } else if (projectFilter === 'inactive') {
        return matchesSearch && project._count.versions === 0
      }
      return matchesSearch
    })
    .sort((a, b) => {
      if (sortOrder === 'desc') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    })

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (userFilter === 'admin') {
      return matchesSearch && user.role === 'ADMIN'
    } else if (userFilter === 'user') {
      return matchesSearch && user.role === 'USER'
    }
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  const stats: Stats = {
    totalUsers: users.length,
    totalProjects: projects.length,
    totalVersions: projects.reduce((acc, project) => acc + (project._count?.versions || 0), 0),
    adminCount: users.filter(u => u.role === 'ADMIN').length
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 flex-1">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          管理员控制台
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          管理系统用户和项目
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              总用户数
            </CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-gray-500">
              {stats.adminCount} 个管理员
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              总项目数
            </CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-gray-500">
              所有用户项目
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              活跃用户
            </CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => (u._count?.projects || 0) > 0).length}
            </div>
            <p className="text-xs text-gray-500">
              有项目的用户
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              空闲用户
            </CardTitle>
            <UserX className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => (u._count?.projects || 0) === 0).length}
            </div>
            <p className="text-xs text-gray-500">
              无项目的用户
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs 切换 */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="projects">
            <Package className="mr-2 h-4 w-4" />
            项目管理
          </TabsTrigger>
        </TabsList>

        {/* 用户管理 Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>用户管理</CardTitle>
              <CardDescription>
                查看和管理所有注册用户
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>项目数</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === 'ADMIN' ? (
                          <Badge className="bg-orange-100 text-orange-800">
                            <Shield className="mr-1 h-3 w-3" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge variant="secondary">用户</Badge>
                        )}
                      </TableCell>
                      <TableCell>{user._count?.projects || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate($1)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setEditUser(user)
                                setEditForm({
                                  username: user.username,
                                  password: '',
                                  role: user.role
                                })
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteUser(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 项目管理 Tab */}
        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>项目管理</CardTitle>
                    <CardDescription className="mt-1">
                      查看和管理所有用户的项目
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchProjects}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    刷新
                  </Button>
                </div>
                
                {/* 搜索和筛选栏 */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="搜索项目名称或所有者..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="px-3 py-2 border rounded-md text-sm"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value as any)}
                    >
                      <option value="all">所有项目</option>
                      <option value="active">有版本</option>
                      <option value="inactive">无版本</option>
                    </select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* 统计信息 */}
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>共 {filteredProjects.length} 个项目</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{projects.filter(p => p._count.versions > 0).length} 个活跃项目</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{projects.reduce((acc, p) => acc + p._count.versions, 0)} 个版本总数</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目名称</TableHead>
                    <TableHead>所有者</TableHead>
                    <TableHead>当前版本</TableHead>
                    <TableHead>版本数</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          <FolderOpen className="h-4 w-4 text-orange-600" />
                          {project.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{project.user.username}</span>
                          <span className="text-xs text-gray-500">{project.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {project.currentVersion ? (
                          <Badge variant="outline">
                            <GitBranch className="mr-1 h-3 w-3" />
                            {project.currentVersion}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">未设置</span>
                        )}
                      </TableCell>
                      <TableCell>{project._count?.versions || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                            {project.apiKey.substring(0, 8)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyApiKey(project.apiKey)}
                          >
                            {copiedApiKey === project.apiKey ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDate($1)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setViewProject(project)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setManagingVersions(project)
                                // 自动填充下一个版本号
                                const nextVersion = generateNextVersion(project)
                                setAddVersionForm(prev => ({ ...prev, version: nextVersion }))
                              }}
                            >
                              <Package className="mr-2 h-4 w-4" />
                              管理版本
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditProject(project)
                                setEditProjectForm({
                                  name: project.name,
                                  currentVersion: project.currentVersion || '',
                                  regenerateApiKey: false
                                })
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              编辑信息
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setResetApiKeyProject(project)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              重置API密钥
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteProject(project)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除项目
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 编辑用户对话框 */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>
              修改用户信息（留空则不修改）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">用户名</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">新密码（可选）</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="留空则不修改"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">角色</Label>
              <select
                id="edit-role"
                className="w-full px-3 py-2 border rounded-md"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="USER">用户</option>
                <option value="ADMIN">管理员</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              取消
            </Button>
            <Button onClick={handleEditUser} className="bg-orange-600 hover:bg-orange-700">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除用户对话框 */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户 {deleteUser?.username} 吗？
              此操作将同时删除该用户的所有项目和版本，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑项目对话框 */}
      <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
        <DialogContent className="max-w-lg">
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-current-version">当前版本</Label>
              <select
                id="edit-current-version"
                className="w-full px-3 py-2 border rounded-md"
                value={editProjectForm.currentVersion}
                onChange={(e) => setEditProjectForm({ ...editProjectForm, currentVersion: e.target.value })}
              >
                <option value="">未设置</option>
                {editProject?.versions?.map((version) => (
                  <option key={version.id} value={version.version}>
                    {version.version} {version.isCurrent && '(当前)'}
                  </option>
                ))}
              </select>
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
            <Button variant="outline" onClick={() => {
              setEditProject(null)
              setEditProjectForm({ name: '', currentVersion: '', regenerateApiKey: false })
            }}>
              取消
            </Button>
            <Button onClick={handleEditProject} className="bg-orange-600 hover:bg-orange-700">
              {editProjectForm.regenerateApiKey ? '保存并重新生成密钥' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除项目对话框 */}
      <AlertDialog open={!!deleteProject} onOpenChange={() => setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除项目 {deleteProject?.name} 吗？
              此操作将同时删除该项目的所有版本，且无法恢复。
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

      {/* 查看项目详情对话框 - 增强版 */}
      <Dialog open={!!viewProject} onOpenChange={() => setViewProject(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-orange-600" />
              项目详情
            </DialogTitle>
            <DialogDescription>
              {viewProject?.name} 的完整信息
            </DialogDescription>
          </DialogHeader>
          {viewProject && (
            <div className="space-y-6 py-4">
              {/* 基本信息卡片 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">基本信息</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">项目名称</Label>
                      <p className="font-medium">{viewProject.name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">所有者</Label>
                      <div>
                        <p className="font-medium">{viewProject.user.username}</p>
                        <p className="text-xs text-gray-400">{viewProject.user.email}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">当前版本</Label>
                      <div>
                        {viewProject.currentVersion ? (
                          <Badge className="bg-green-100 text-green-800">
                            <GitBranch className="mr-1 h-3 w-3" />
                            {viewProject.currentVersion}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">未设置</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">版本总数</Label>
                      <p className="font-medium">{viewProject._count.versions} 个</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">创建时间</Label>
                      <p className="text-sm">{formatDateTime($1)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">更新时间</Label>
                      <p className="text-sm">{formatDateTime($1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API密钥卡片 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    API 配置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-500">API密钥</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-gray-100 px-3 py-2 rounded flex-1 font-mono">
                          {viewProject.apiKey}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyApiKey(viewProject.apiKey)}
                        >
                          {copiedApiKey === viewProject.apiKey ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      <p>API端点: <code className="bg-gray-100 px-1 py-0.5 rounded">/api/versions/latest</code></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 版本列表卡片 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      版本列表
                    </span>
                    <Badge variant="secondary">{viewProject._count.versions} 个版本</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {viewProject.versions.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>版本号</TableHead>
                            <TableHead>状态</TableHead>
                          <TableHead>强制更新</TableHead>
                          <TableHead>大小</TableHead>
                          <TableHead>更新说明</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewProject.versions.map((version) => (
                            <TableRow key={version.id}>
                              <TableCell className="font-medium">
                                {version.version}
                              </TableCell>
                              <TableCell>
                                {version.isCurrent ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    当前版本
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">历史版本</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {version.forceUpdate ? (
                                  <Badge className="bg-red-100 text-red-800">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    强制
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">可选</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">{formatSizeKB(version.size ?? null)}</span>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="truncate text-sm" title={version.changelog}>
                                {version.changelog}
                              </p>
                            </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-500">
                                  {formatDate($1)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a href={version.downloadUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">暂无版本信息</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetApiKeyProject(viewProject)}
              className="mr-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              重置API密钥
            </Button>
            <Button onClick={() => setViewProject(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置API密钥确认对话框 */}
      <AlertDialog open={!!resetApiKeyProject} onOpenChange={() => setResetApiKeyProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置API密钥</AlertDialogTitle>
            <AlertDialogDescription>
              确定要重置项目 {resetApiKeyProject?.name} 的API密钥吗？
              重置后，所有使用当前密钥的客户端将无法访问，需要更新为新密钥。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetApiKey}
              disabled={resettingApiKey}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {resettingApiKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                '确认重置'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 版本管理对话框 */}
      <Dialog open={!!managingVersions} onOpenChange={(open) => {
        if (!open) {
          setManagingVersions(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              版本管理
            </DialogTitle>
            <DialogDescription>
              管理项目 {managingVersions?.name} 的所有版本
            </DialogDescription>
          </DialogHeader>
          
          {managingVersions && (
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {/* 添加新版本表单 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">添加新版本</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="mv-version">版本号 *</Label>
                      <Input
                        id="mv-version"
                        placeholder="1.0.0"
                        value={addVersionForm.version}
                        onChange={(e) => setAddVersionForm({ ...addVersionForm, version: e.target.value })}
                      />
                    </div>
                    
                    {/* 上传方式选择 */}
                    <div className="space-y-2 col-span-2">
                      <Label>上传方式</Label>
                      {systemConfig?.upload_enabled === false && (
                        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            文件上传功能已在系统设置中禁用，请使用下载链接方式
                          </p>
                        </div>
                      )}
                      <RadioGroup
                        value={addVersionForm.uploadMethod}
                        onValueChange={(value: 'url' | 'file') => {
                          if (value === 'file' && systemConfig?.upload_enabled === false) {
                            toast.error('文件上传功能已在系统设置中禁用')
                            return
                          }
                          setAddVersionForm({ ...addVersionForm, uploadMethod: value })
                        }}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="url" id="mv-url-method" />
                            <Label htmlFor="mv-url-method" className="cursor-pointer">
                              使用下载链接
                            </Label>
                          </div>
                          <div className={`flex items-center space-x-2 ${systemConfig?.upload_enabled === false ? 'opacity-50' : ''}`}>
                            <RadioGroupItem 
                              value="file" 
                              id="mv-file-method"
                              disabled={systemConfig?.upload_enabled === false}
                            />
                            <Label 
                              htmlFor="mv-file-method" 
                              className={`${systemConfig?.upload_enabled === false ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              上传本地文件
                              {systemConfig?.upload_enabled === false && (
                                <span className="text-xs text-red-500 ml-1">(已禁用)</span>
                              )}
                            </Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* 根据选择显示不同的输入 */}
                    {addVersionForm.uploadMethod === 'url' ? (
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="mv-url">下载链接 *</Label>
                        <Input
                          id="mv-url"
                          placeholder="https://example.com/app.apk"
                          value={addVersionForm.downloadUrl}
                          onChange={(e) => setAddVersionForm({ ...addVersionForm, downloadUrl: e.target.value })}
                        />
                        <p className="text-xs text-gray-500">
                          输入APK文件的直接下载链接
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 col-span-2">
                        <Label>选择文件 *</Label>
                        <FileUpload
                          onFileSelect={(file) => setAddVersionForm({ ...addVersionForm, file })}
                          onFileRemove={() => setAddVersionForm({ ...addVersionForm, file: null })}
                          selectedFile={addVersionForm.file}
                          maxSize={systemConfig?.max_upload_size || 100 * 1024 * 1024}
                          uploading={uploading}
                          disabled={addingVersion}
                        />
                      </div>
                    )}

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="mv-changelog">
                        更新日志
                        <span className="text-xs text-gray-500 ml-1">（可选）</span>
                      </Label>
                      <textarea
                        id="mv-changelog"
                        className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                        placeholder="1. 新增功能...&#10;2. 修复bug..."
                        value={addVersionForm.changelog}
                        onChange={(e) => setAddVersionForm({ ...addVersionForm, changelog: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mv-force"
                        checked={addVersionForm.forceUpdate}
                        onCheckedChange={(checked) => 
                          setAddVersionForm({ ...addVersionForm, forceUpdate: checked as boolean })
                        }
                      />
                      <Label htmlFor="mv-force" className="cursor-pointer">
                        强制更新
                      </Label>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => handleAddVersion(managingVersions.id)}
                      disabled={addingVersion || uploading}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {addingVersion || uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {uploading ? '上传中...' : '添加中...'}
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          添加版本
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 现有版本列表 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>现有版本</span>
                    <Badge variant="secondary">{managingVersions._count.versions} 个</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {managingVersions.versions.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>版本号</TableHead>
                            <TableHead>状态</TableHead>
                          <TableHead>强制更新</TableHead>
                          <TableHead>大小</TableHead>
                          <TableHead>更新说明</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {managingVersions.versions.map((version) => (
                            <TableRow key={version.id}>
                              <TableCell className="font-medium">{version.version}</TableCell>
                              <TableCell>
                                {version.isCurrent ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    当前版本
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">历史版本</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {version.forceUpdate ? (
                                  <Badge className="bg-red-100 text-red-800">强制</Badge>
                                ) : (
                                  <Badge variant="outline">可选</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">{formatSizeKB(version.size ?? null)}</span>
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <p className="truncate text-sm">{version.changelog}</p>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-500">
                                  {formatDate($1)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    asChild
                                  >
                                    <a href={version.downloadUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                  {!version.isCurrent && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600"
                                      onClick={() => handleDeleteVersion(managingVersions.id, version.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">暂无版本</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagingVersions(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      <Footer />
    </div>
  )
}
