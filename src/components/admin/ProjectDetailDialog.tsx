'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator
} from '@/components/ui'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  GitBranch,
  Clock,
  User,
  Calendar,
  Package,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit,
  Plus,
  Loader2,
  Download,
  ExternalLink,
  FileText,
  Upload
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
  updatedAt?: string
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

interface ProjectDetailDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function ProjectDetailDialog({
  project,
  open,
  onOpenChange,
  onUpdate
}: ProjectDetailDialogProps) {
  const [copiedApiKey, setCopiedApiKey] = useState(false)
  const [resettingApiKey, setResettingApiKey] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [deletingVersion, setDeletingVersion] = useState<string | null>(null)
  const [settingCurrent, setSettingCurrent] = useState<string | null>(null)
  const [addingVersion, setAddingVersion] = useState(false)
  const [versionForm, setVersionForm] = useState({
    version: '',
    downloadUrl: '',
    changelog: '',
    forceUpdate: false
  })
  const [showVersionForm, setShowVersionForm] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Version | null>(null)
  const [editVersionForm, setEditVersionForm] = useState({
    version: '',
    downloadUrl: '',
    changelog: '',
    forceUpdate: false,
    isCurrent: false
  })
  const [updatingVersion, setUpdatingVersion] = useState(false)

  if (!project) return null

  const copyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(project.apiKey)
      setCopiedApiKey(true)
      toast.success('API Key 已复制到剪贴板')
      setTimeout(() => setCopiedApiKey(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  const handleResetApiKey = async () => {
    setResettingApiKey(true)
    try {
      const response = await fetch(`/api/admin/projects/${project.id}/reset-api-key`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('重置API密钥失败')
      }

      const data = await response.json()
      toast.success('API密钥已重置')
      setShowResetConfirm(false)
      onUpdate()
    } catch (error) {
      toast.error('重置API密钥失败')
    } finally {
      setResettingApiKey(false)
    }
  }

  const handleSetCurrentVersion = async (versionId: string) => {
    setSettingCurrent(versionId)
    try {
      const version = project.versions.find(v => v.id === versionId)
      if (!version) return

      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentVersion: version.version })
      })

      if (!response.ok) {
        throw new Error('设置当前版本失败')
      }

      toast.success('当前版本已更新')
      onUpdate()
    } catch (error) {
      toast.error('设置当前版本失败')
    } finally {
      setSettingCurrent(null)
    }
  }

  const handleDeleteVersion = async (versionId: string) => {
    setDeletingVersion(versionId)
    try {
      const response = await fetch(
        `/api/admin/projects/${project.id}/versions/${versionId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('删除版本失败')
      }

      toast.success('版本已删除')
      onUpdate()
    } catch (error) {
      toast.error('删除版本失败')
    } finally {
      setDeletingVersion(null)
    }
  }

  const handleAddVersion = async () => {
    if (!versionForm.version || !versionForm.downloadUrl || !versionForm.changelog) {
      toast.error('请填写所有必填字段')
      return
    }

    setAddingVersion(true)
    try {
      const response = await fetch(`/api/admin/projects/${project.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(versionForm)
      })

      if (!response.ok) {
        throw new Error('添加版本失败')
      }

      toast.success('版本已添加')
      setVersionForm({ version: '', downloadUrl: '', changelog: '', forceUpdate: false })
      setShowVersionForm(false)
      onUpdate()
    } catch (error) {
      toast.error('添加版本失败')
    } finally {
      setAddingVersion(false)
    }
  }

  const handleEditVersion = (version: Version) => {
    setEditingVersion(version)
    setEditVersionForm({
      version: version.version,
      downloadUrl: version.downloadUrl, // 保留原有URL但不修改
      changelog: version.changelog,
      forceUpdate: version.forceUpdate,
      isCurrent: version.isCurrent
    })
  }

  // 检查是否为本地上传的文件链接
  const isLocalUploadUrl = (url: string): boolean => {
    if (!url) return false
    // 检查是否包含 /uploads/ 路径
    return url.includes('/uploads/') || 
           (typeof window !== 'undefined' && url.startsWith(window.location.origin) && url.includes('/uploads/'))
  }

  const handleUpdateVersion = async () => {
    if (!editingVersion) return
    if (!editVersionForm.version || !editVersionForm.changelog) {
      toast.error('请填写所有必填字段')
      return
    }

    setUpdatingVersion(true)
    try {
      const response = await fetch(
        `/api/admin/projects/${project.id}/versions/${editingVersion.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: editVersionForm.version,
            // 不发送downloadUrl，保持原有链接不变
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
      onUpdate()
    } catch (error: any) {
      toast.error(error.message || '更新版本失败')
    } finally {
      setUpdatingVersion(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>项目详情管理</DialogTitle>
            <DialogDescription>
              查看和管理项目 {project.name} 的所有信息
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="versions">版本管理</TabsTrigger>
              <TabsTrigger value="settings">设置</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="overview" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">基本信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">项目ID</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{project.id}</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">项目名称</span>
                        <span className="font-medium">{project.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">当前版本</span>
                        {project.currentVersion ? (
                          <Badge className="bg-green-100 text-green-800">
                            <GitBranch className="mr-1 h-3 w-3" />
                            {project.currentVersion}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">未设置</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">版本总数</span>
                        <Badge variant="secondary">{project._count.versions} 个</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">所有者信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">用户名</span>
                        <span className="font-medium">{project.user.username}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">邮箱</span>
                        <span className="text-sm">{project.user.email}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">创建时间</span>
                        <span className="text-sm">{new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">更新时间</span>
                        <span className="text-sm">{new Date(project.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">API 配置</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm text-gray-500">API密钥</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded font-mono">
                            {project.apiKey}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={copyApiKey}
                          >
                            {copiedApiKey ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowResetConfirm(true)}
                            title="重置API密钥"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        API端点: <code className="bg-gray-100 px-1 py-0.5 rounded">/api/versions/latest</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="versions" className="space-y-4 mt-0">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">
                      共 {project.versions.length} 个版本
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setShowVersionForm(true)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    添加版本
                  </Button>
                </div>

                {project.versions.length === 0 ? (
                  <Card className="text-center py-8">
                    <CardContent>
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">暂无版本信息</p>
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
                          <TableHead>更新说明</TableHead>
                          <TableHead>创建时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {project.versions.map((version) => (
                          <TableRow key={version.id}>
                            <TableCell className="font-medium">{version.version}</TableCell>
                            <TableCell>
                              {version.isCurrent || version.version === project.currentVersion ? (
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
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    '设为当前'
                                  )}
                                </Button>
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
                            <TableCell className="max-w-xs">
                              <p className="truncate text-sm">{version.changelog}</p>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-500">
                                {new Date(version.createdAt).toLocaleDateString()}
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditVersion(version)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteVersion(version.id)}
                                  disabled={deletingVersion === version.id}
                                >
                                  {deletingVersion === version.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-red-600">危险操作</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">重置API密钥</Label>
                      <p className="text-sm text-gray-500 mt-1 mb-2">
                        重置后，使用旧密钥的请求将失败，请谨慎操作
                      </p>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setShowResetConfirm(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重置API密钥
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置API密钥确认对话框 */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置API密钥</AlertDialogTitle>
            <AlertDialogDescription>
              重置API密钥后，所有使用当前密钥的请求将失败。
              请确保已通知相关使用方更新密钥。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetApiKey}
              disabled={resettingApiKey}
              className="bg-red-600 hover:bg-red-700"
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

      {/* 添加版本对话框 */}
      <Dialog open={showVersionForm} onOpenChange={setShowVersionForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新版本</DialogTitle>
            <DialogDescription>
              为项目 {project.name} 添加新版本
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="version">版本号 *</Label>
              <Input
                id="version"
                placeholder="1.0.0"
                value={versionForm.version}
                onChange={(e) => setVersionForm({ ...versionForm, version: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downloadUrl">下载链接 *</Label>
              <Input
                id="downloadUrl"
                placeholder="https://example.com/app-v1.0.0.apk"
                value={versionForm.downloadUrl}
                onChange={(e) => setVersionForm({ ...versionForm, downloadUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="changelog">更新日志 *</Label>
              <textarea
                id="changelog"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                placeholder="1. 新增功能xxx&#10;2. 修复bug xxx"
                value={versionForm.changelog}
                onChange={(e) => setVersionForm({ ...versionForm, changelog: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="forceUpdate"
                checked={versionForm.forceUpdate}
                onCheckedChange={(checked) =>
                  setVersionForm({ ...versionForm, forceUpdate: checked as boolean })
                }
              />
              <Label htmlFor="forceUpdate" className="cursor-pointer">
                强制更新
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionForm(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddVersion}
              disabled={addingVersion}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {addingVersion ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                '添加版本'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑版本对话框 */}
      <Dialog open={!!editingVersion} onOpenChange={(open) => !open && setEditingVersion(null)}>
        <DialogContent>
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
              <Label htmlFor="edit-downloadUrl">下载链接（不可修改）</Label>
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-blue-800">
                      下载链接不支持修改。如需更改文件，请删除此版本并创建新版本。
                    </p>
                    {editingVersion && isLocalUploadUrl(editingVersion.downloadUrl) && (
                      <p className="text-xs text-blue-700 mt-1">
                        <Upload className="inline h-3 w-3 mr-1" />
                        此版本包含上传的文件
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  id="edit-downloadUrl"
                  value={editVersionForm.downloadUrl}
                  readOnly
                  disabled
                  className="bg-gray-50 font-mono text-sm flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(editVersionForm.downloadUrl)
                    toast.success('链接已复制')
                  }}
                  className="h-10 w-10 p-0"
                  title="复制链接"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-changelog">更新日志 *</Label>
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
    </>
  )
}
