'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { toast } from 'sonner'
import {
  Plus,
  Download,
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
  File
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

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/projects')}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回项目列表
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {project.name} - 版本管理
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              管理项目版本，设置当前活跃版本
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
      </div>

      {project.versions.length === 0 ? (
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
      ) : (
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
      )}

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
  )
}