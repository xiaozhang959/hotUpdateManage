'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Edit, FolderTree, Loader2, Package, Shield, Trash2, User as UserIcon, Users } from 'lucide-react'
import { Footer } from '@/components/layout/footer'
import { ProjectDetailDialog } from '@/components/admin/ProjectDetailDialog'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { formatDateTime } from '@/lib/timezone'
import type { ProjectSummaryItem } from '@/components/projects/project-types'

interface UserItem {
  id: string
  email: string
  username: string
  role: string
  createdAt: string
  _count: { projects: number }
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'USER' })
  const [savingUser, setSavingUser] = useState(false)
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)
  const [deletingProject, setDeletingProject] = useState<ProjectSummaryItem | null>(null)
  const [projectDetail, setProjectDetail] = useState<ProjectSummaryItem | null>(null)

  const syncProjectDetail = useCallback((items: ProjectSummaryItem[]) => {
    setProjectDetail((current) => {
      if (!current) return null
      return items.find((item) => item.id === current.id) || null
    })
  }, [])

  const fetchUsers = useCallback(async () => {
    const response = await fetch('/api/admin/users')
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || '获取用户失败')
    setUsers(data)
  }, [])

  const fetchProjects = useCallback(async () => {
    const response = await fetch('/api/admin/projects')
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || '获取项目失败')
    setProjects(data)
    syncProjectDetail(data)
  }, [syncProjectDetail])

  const handleProjectMutated = useCallback((updatedProject: ProjectSummaryItem) => {
    setProjectDetail(updatedProject)
    setProjects((current) => {
      const exists = current.some((item) => item.id === updatedProject.id)
      const next = exists
        ? current.map((item) => (item.id === updatedProject.id ? updatedProject : item))
        : [updatedProject, ...current]
      return [...next].sort((left, right) => (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ))
    })
  }, [])

  useEffect(() => {
    Promise.all([fetchUsers(), fetchProjects()])
      .catch((error) => toast.error(error instanceof Error ? error.message : '加载数据失败'))
      .finally(() => setLoading(false))
  }, [fetchUsers, fetchProjects])

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalProjects: projects.length,
    totalVersions: projects.reduce((sum, item) => sum + (item._count?.versions ?? item.versions?.length ?? 0), 0),
    adminCount: users.filter((item) => item.role === 'ADMIN').length,
  }), [users, projects])

  const filteredUsers = useMemo(() => users.filter((item) => (
    item.username.toLowerCase().includes(search.toLowerCase()) || item.email.toLowerCase().includes(search.toLowerCase())
  )), [users, search])

  const filteredProjects = useMemo(() => projects.filter((item) => (
    item.name.toLowerCase().includes(search.toLowerCase()) || item.user?.username?.toLowerCase().includes(search.toLowerCase())
  )), [projects, search])

  const handleSaveUser = async () => {
    if (!editingUser) return
    setSavingUser(true)
    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userForm.username || undefined,
          password: userForm.password || undefined,
          role: userForm.role || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '更新用户失败')
      toast.success('用户信息已更新')
      setEditingUser(null)
      await fetchUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新用户失败')
    } finally {
      setSavingUser(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    try {
      const response = await fetch(`/api/admin/users/${deletingUser.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '删除用户失败')
      toast.success('用户已删除')
      setDeletingUser(null)
      await Promise.all([fetchUsers(), fetchProjects()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除用户失败')
    }
  }

  const handleDeleteProject = async () => {
    if (!deletingProject) return
    try {
      const response = await fetch(`/api/admin/projects/${deletingProject.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || '删除项目失败')
      toast.success('项目已删除')
      setProjectDetail((current) => (current?.id === deletingProject.id ? null : current))
      setDeletingProject(null)
      await fetchProjects()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除项目失败')
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">管理员控制台</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">统一管理系统用户、项目 API Key 与多架构版本发布状态。</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">总用户数</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2 text-2xl font-bold"><Users className="h-5 w-5 text-orange-600" />{stats.totalUsers}</div><p className="text-xs text-slate-500">管理员 {stats.adminCount} 人</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">总项目数</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2 text-2xl font-bold"><Package className="h-5 w-5 text-orange-600" />{stats.totalProjects}</div><p className="text-xs text-slate-500">含多架构项目</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">总版本数</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2 text-2xl font-bold"><FolderTree className="h-5 w-5 text-orange-600" />{stats.totalVersions}</div><p className="text-xs text-slate-500">逻辑版本总量</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">安全权限</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2 text-2xl font-bold"><Shield className="h-5 w-5 text-orange-600" />ADMIN</div><p className="text-xs text-slate-500">拥有全局管理能力</p></CardContent></Card>
        </div>

        <div className="mb-6 flex gap-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索用户、邮箱、项目名或所有者" />
          <Button variant="outline" onClick={() => { void fetchUsers(); void fetchProjects() }}>刷新</Button>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">用户管理</TabsTrigger>
            <TabsTrigger value="projects">项目管理</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="grid gap-4">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="border-slate-200">
                  <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><UserIcon className="h-4 w-4 text-orange-600" /><span className="font-semibold text-slate-900">{user.username}</span><Badge variant="outline">{user.role}</Badge></div>
                      <div className="text-sm text-slate-600">{user.email}</div>
                      <div className="text-xs text-slate-500">创建于 {formatDateTime(user.createdAt)} · 项目数 {user._count.projects}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => { setEditingUser(user); setUserForm({ username: user.username, password: '', role: user.role }) }}><Edit className="mr-2 h-4 w-4" /> 编辑</Button>
                      <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeletingUser(user)}><Trash2 className="mr-2 h-4 w-4" /> 删除</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredUsers.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-slate-500">没有匹配的用户。</CardContent></Card>}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProjects.map((project) => {
                const latest = project.versions?.[0]
                return (
                  <Card key={project.id} className="border-slate-200">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>{project.name}</CardTitle>
                          <CardDescription className="mt-2">所有者：{project.user?.username || '未知'} · 当前版本：{project.currentVersion || '未设置'}</CardDescription>
                        </div>
                        <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeletingProject(project)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">架构数量</div><div className="mt-1 text-sm font-semibold text-slate-900">{project.architectures?.length || 0}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">版本数量</div><div className="mt-1 text-sm font-semibold text-slate-900">{project._count?.versions ?? project.versions?.length ?? 0}</div></div>
                        <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs text-slate-500">最近状态</div><div className="mt-1 text-sm font-semibold text-slate-900">{latest?.publishState || '—'}</div></div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-700">
                        {latest ? (
                          <>
                            <div className="font-medium text-slate-900">最新版本 {latest.version}</div>
                            <div className="mt-1">默认架构：{latest.defaultArchitectureKey || '未设置'} · 覆盖 {latest.architectureCoverage?.published ?? 0}/{latest.architectureCoverage?.total ?? project.architectures.length}</div>
                          </>
                        ) : '该项目还没有版本。'}
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={() => setProjectDetail(project)}>打开详情工作台</Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {filteredProjects.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-slate-500">没有匹配的项目。</CardContent></Card>}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑用户</DialogTitle><DialogDescription>可修改用户名、重置密码或调整角色。</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="admin-user-name">用户名</Label><Input id="admin-user-name" value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="admin-user-password">新密码（可选）</Label><Input id="admin-user-password" type="password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="admin-user-role">角色</Label><select id="admin-user-role" className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingUser(null)} disabled={savingUser}>取消</Button><Button onClick={handleSaveUser} disabled={savingUser} className="bg-orange-600 hover:bg-orange-700">{savingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存用户'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除用户</AlertDialogTitle><AlertDialogDescription>删除后无法恢复，请确保该用户不再需要访问系统。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteUser}>删除用户</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>确认删除项目</AlertDialogTitle><AlertDialogDescription>删除项目后，其下所有逻辑版本、架构主程序与附件都会一并移除。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteProject}>删除项目</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectDetailDialog project={projectDetail} open={!!projectDetail} onOpenChange={(open) => { if (!open) setProjectDetail(null) }} onUpdate={handleProjectMutated} />
    </div>
  )
}
