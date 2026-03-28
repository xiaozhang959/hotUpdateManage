'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Copy, Edit, Eye, EyeOff, FolderTree, Loader2, Package, Plus, Trash2 } from 'lucide-react'
import { Footer } from '@/components/layout/footer'
import { EmailVerificationBanner } from '@/components/email-verification-banner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
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
  Separator,
} from '@/components/ui'
import { formatDateTime } from '@/lib/timezone'
import type { ProjectSummaryItem } from '@/components/projects/project-types'

function generateClientApiKey() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export default function ProjectsPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [requireEmailVerification, setRequireEmailVerification] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectApiKey, setNewProjectApiKey] = useState('')
  const [editingProject, setEditingProject] = useState<ProjectSummaryItem | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingApiKey, setEditingApiKey] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState<ProjectSummaryItem | null>(null)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void fetchProjects()
    void fetchSystemConfig()
  }, [])

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch('/api/system/config')
      if (!response.ok) return
      const data = await response.json()
      setRequireEmailVerification(Boolean(data.require_email_verification))
    } catch {
      // ignore
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('获取项目失败')
      const data = await response.json()
      setProjects(data)
    } catch {
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
    if (requireEmailVerification && session?.user && !session.user.emailVerified) {
      toast.error('请先验证您的邮箱')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          apiKey: newProjectApiKey.trim() || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '创建项目失败')
      setProjects((current) => [data, ...current])
      setNewProjectName('')
      setNewProjectApiKey('')
      setCreateOpen(false)
      toast.success('项目创建成功')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveProject = async () => {
    if (!editingProject) return
    if (!editingName.trim()) {
      toast.error('项目名称不能为空')
      return
    }
    if (!editingApiKey.trim()) {
      toast.error('API Key 不能为空')
      return
    }

    setSavingProject(true)
    try {
      const updateResponse = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingName.trim(),
          apiKey: editingApiKey.trim(),
        }),
      })
      const updateData = await updateResponse.json()
      if (!updateResponse.ok) throw new Error(updateData?.error || '更新项目失败')

      toast.success('项目信息已更新')
      setEditingProject(null)
      setEditingApiKey('')
      await fetchProjects()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新项目失败')
    } finally {
      setSavingProject(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deletingProject) return
    try {
      const response = await fetch(`/api/projects/${deletingProject.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '删除项目失败')
      setProjects((current) => current.filter((item) => item.id !== deletingProject.id))
      setDeletingProject(null)
      toast.success('项目已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除项目失败')
    }
  }

  const projectCards = useMemo(() => projects.map((project) => {
    const latestVersion = project.versions?.[0]
    return {
      project,
      latestVersion,
      publishedText: latestVersion?.architectureCoverage
        ? `${latestVersion.architectureCoverage.published}/${latestVersion.architectureCoverage.total}`
        : '—',
    }
  }), [projects])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto flex-1 px-4 py-8">
        <EmailVerificationBanner emailVerified={!!session?.user?.emailVerified} email={session?.user?.email} />

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">项目管理</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">在列表页关注项目状态与 API Key，在详情页集中维护多架构版本。</p>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> 创建项目</Button>
        </div>

        {projectCards.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
              <Package className="h-12 w-12 text-slate-300" />
              <div>
                <p className="text-lg font-semibold text-slate-900">还没有任何项目</p>
                <p className="text-sm text-slate-500">先创建一个项目，再进入详情页维护多架构版本。</p>
              </div>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> 创建第一个项目</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {projectCards.map(({ project, latestVersion, publishedText }) => (
              <Card key={project.id} className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl">{project.name}</CardTitle>
                      <CardDescription className="mt-2">当前版本：{project.currentVersion || '未设置'} · 最近更新时间：{formatDateTime(project.updatedAt)}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => { setEditingProject(project); setEditingName(project.name); setEditingApiKey(project.apiKey) }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeletingProject(project)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 text-xs text-slate-500">API Key</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-slate-900 px-3 py-2 font-mono text-xs text-orange-200">{showApiKeys[project.id] ? project.apiKey : '••••••••••••••••••••••••••••••••'}</code>
                      <Button variant="ghost" size="icon" onClick={() => setShowApiKeys((current) => ({ ...current, [project.id]: !current[project.id] }))}>{showApiKeys[project.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                      <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(project.apiKey); toast.success('API Key 已复制') }}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">架构数量</div><div className="mt-1 text-sm font-semibold text-slate-900">{project.architectures?.length || 0}</div></div>
                    <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">版本数量</div><div className="mt-1 text-sm font-semibold text-slate-900">{project._count?.versions ?? project.versions?.length ?? 0}</div></div>
                    <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">最新覆盖率</div><div className="mt-1 text-sm font-semibold text-slate-900">{publishedText}</div></div>
                  </div>

                  {latestVersion ? (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-white text-orange-700 border border-orange-200">{latestVersion.version}</Badge>
                        {latestVersion.publishState && <Badge variant="outline">{latestVersion.publishState}</Badge>}
                        {latestVersion.defaultArchitectureKey && <Badge variant="outline"><FolderTree className="mr-1 h-3 w-3" /> {latestVersion.defaultArchitectureKey}</Badge>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{latestVersion.changelog || '暂无更新日志'}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">该项目还没有版本。</div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/projects/${project.id}`} className="flex-1">
                      <Button className="w-full bg-orange-600 hover:bg-orange-700">进入多架构工作台</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建新项目</DialogTitle><DialogDescription>输入项目名称，可选自定义 API Key；留空时系统会自动生成。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="project-name-create">项目名称</Label><Input id="project-name-create" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="我的 Android 应用" disabled={creating} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="project-api-key-create">API Key（可选）</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewProjectApiKey(generateClientApiKey())} disabled={creating}>生成随机值</Button>
              </div>
              <Input id="project-api-key-create" value={newProjectApiKey} onChange={(event) => setNewProjectApiKey(event.target.value)} placeholder="留空则自动生成，或输入旧服务器上的 API Key" disabled={creating} />
              <p className="text-xs text-slate-500">若与现有项目重复，系统会拒绝创建并提示冲突。</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setCreateOpen(false); setNewProjectApiKey('') }} disabled={creating}>取消</Button><Button onClick={handleCreateProject} disabled={creating || !newProjectName.trim()} className="bg-orange-600 hover:bg-orange-700">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : '创建项目'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProject} onOpenChange={() => { setEditingProject(null); setEditingApiKey('') }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑项目</DialogTitle><DialogDescription>修改项目名称与 API Key，便于迁移服务器后继续沿用原有标识。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="project-name-edit">项目名称</Label><Input id="project-name-edit" value={editingName} onChange={(event) => setEditingName(event.target.value)} disabled={savingProject} /></div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="project-api-key-edit">API Key</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingApiKey(generateClientApiKey())} disabled={savingProject}>生成随机值</Button>
              </div>
              <Input id="project-api-key-edit" value={editingApiKey} onChange={(event) => setEditingApiKey(event.target.value)} disabled={savingProject} />
              <p className="text-xs text-slate-500">保存时会校验唯一性；如果与其他项目重复，将直接拒绝。</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setEditingProject(null); setEditingApiKey('') }} disabled={savingProject}>取消</Button><Button onClick={handleSaveProject} disabled={savingProject || !editingName.trim() || !editingApiKey.trim()} className="bg-orange-600 hover:bg-orange-700">{savingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存修改'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除项目</AlertDialogTitle><AlertDialogDescription>删除项目后，该项目下的所有逻辑版本、架构产物与附件都会一起移除，且无法恢复。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteProject}>删除项目</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
