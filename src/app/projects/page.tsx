'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
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
  Separator
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
  Hash
} from 'lucide-react'

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
  const [requireEmailVerification, setRequireEmailVerification] = useState(false)

  useEffect(() => {
    fetchProjects()
    // 检查是否需要邮箱验证
    fetch('/api/system/config')
      .then(res => res.json())
      .then(data => {
        if (data.require_email_verification) {
          setRequireEmailVerification(true)
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
        emailVerified={session?.user?.emailVerified || false} 
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
                    <CardTitle className="text-xl">{project.name}</CardTitle>
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
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="outline" size="sm">
                        管理版本
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
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
              确定要删除项目 "{deleteProject?.name}" 吗？
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
      </main>
      <Footer />
    </div>
  )
}
