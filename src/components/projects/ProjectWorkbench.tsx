'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { FileUpload } from '@/components/ui/file-upload'
import { uploadFileResumable } from '@/lib/client/resumable-upload'
import { formatDate, formatDateTime } from '@/lib/timezone'
import type { ArtifactFileRole, ArtifactType } from '@/lib/version-artifacts'
import {
  AlertCircle,
  Copy,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  FolderTree,
  Key,
  Link2,
  Loader2,
  Package,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import type {
  ProjectArchitectureItem,
  ProjectDetailItem,
  ProjectVersionItem,
  StorageOptionItem,
} from './project-types'

type UploadMethod = 'url' | 'file'
type ProjectScope = 'user' | 'admin'

interface ProjectWorkbenchProps {
  projectId: string
  apiBase: string
  apiScope: ProjectScope
  resetKeyActionPath: string
  showOwnerInfo?: boolean
  showApiExamples?: boolean
  onProjectMutated?: (project: ProjectDetailItem) => void
}

interface ArchitectureFormState {
  key: string
  name: string
  sortOrder: string
  enabled: boolean
  isDefault: boolean
}

interface PrimaryArtifactDraft {
  architectureKey: string
  architectureName: string
  enabled: boolean
  displayName: string
  uploadMethod: UploadMethod
  downloadUrl: string
  file: File | null
  md5: string
  size: number | string | null
  storageProvider: string | null
  objectKey: string | null
  storageConfigId: string | null
}

interface VersionFormState {
  version: string
  changelog: string
  defaultForceUpdate: boolean
  isCurrent: boolean
  defaultArchitectureKey: string
  primaryArtifacts: PrimaryArtifactDraft[]
}

interface VersionDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  projectId: string
  projectName: string
  apiBase: string
  apiScope: ProjectScope
  architectures: ProjectArchitectureItem[]
  initialVersion: ProjectVersionItem | null
  suggestedVersion: string
  availableStorages: StorageOptionItem[]
  onSaved: () => Promise<void>
  onOpenChange: (open: boolean) => void
}

interface ArchitectureDialogProps {
  open: boolean
  apiBase: string
  projectId: string
  mode: 'create' | 'edit'
  architecture: ProjectArchitectureItem | null
  onSaved: () => Promise<void>
  onOpenChange: (open: boolean) => void
}

function formatFileSize(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '未知大小'
  const numeric = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(numeric)) return '未知大小'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let current = Number(numeric)
  let unitIndex = 0
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }
  return `${current % 1 === 0 ? current : current.toFixed(1)} ${units[unitIndex]}`
}

function buildNextVersion(versions: ProjectVersionItem[]) {
  if (versions.length === 0) return '1.0.0'
  const latest = versions[0]?.version || '1.0.0'
  const segments = latest.split('.')
  const tail = Number(segments[segments.length - 1])
  if (Number.isFinite(tail)) {
    segments[segments.length - 1] = String(tail + 1)
    return segments.join('.')
  }
  return `${latest}.1`
}

function storageValueOf(id?: string | null) {
  return id ?? 'local'
}

function storageIdFromValue(value: string) {
  return value === 'local' ? null : value
}

function defaultStorageValue(options: StorageOptionItem[]) {
  const preferred = options.find((item) => item.isDefault)
  return storageValueOf(preferred?.id ?? null)
}

function storageScopeLabel(scope: string, apiScope: ProjectScope) {
  switch (scope) {
    case 'user':
      return apiScope === 'admin' ? '项目所有者' : '我的'
    case 'global':
      return '全局'
    case 'fallback':
      return '本地回退'
    default:
      return scope
  }
}

function formatStorageOptionLabel(storage: StorageOptionItem, apiScope: ProjectScope) {
  const labels = [storage.name, storage.provider, storageScopeLabel(storage.scope, apiScope)]
  if (storage.isDefault) {
    labels.push('默认')
  }
  return labels.join(' · ')
}

function publishStateMeta(state?: ProjectVersionItem['publishState']) {
  switch (state) {
    case 'READY':
      return { label: '已就绪', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    case 'PARTIAL':
      return { label: '部分发布', className: 'bg-amber-100 text-amber-800 border-amber-200' }
    default:
      return { label: '草稿', className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

function buildVersionFormState(
  architectures: ProjectArchitectureItem[],
  suggestedVersion: string,
  availableStorages: StorageOptionItem[],
  version?: ProjectVersionItem | null,
): VersionFormState {
  const defaultStorage = defaultStorageValue(availableStorages)
  const primaryArtifacts = architectures.map((architecture) => {
    const artifact = version?.artifacts.find(
      (item) => item.fileRole === 'PRIMARY' && item.architectureKey === architecture.key,
    )

    return {
      architectureKey: architecture.key,
      architectureName: architecture.name,
      enabled: Boolean(artifact),
      displayName: artifact?.displayName || '',
      uploadMethod: 'url' as UploadMethod,
      downloadUrl: artifact?.rawDownloadUrl || artifact?.downloadUrl || '',
      file: null,
      md5: artifact?.md5 || '',
      size: artifact?.size ?? null,
      storageProvider: artifact?.storageProvider || null,
      objectKey: artifact?.objectKey || null,
      storageConfigId: artifact?.storageConfigId || storageIdFromValue(defaultStorage),
    }
  })

  return {
    version: version?.version || suggestedVersion,
    changelog: version?.changelog || '',
    defaultForceUpdate: version?.defaultForceUpdate ?? version?.forceUpdate ?? false,
    isCurrent: version?.isCurrent ?? (version ? false : true),
    defaultArchitectureKey:
      version?.defaultArchitectureKey
      || primaryArtifacts.find((item) => item.enabled)?.architectureKey
      || architectures.find((item) => item.isDefault)?.key
      || architectures[0]?.key
      || '',
    primaryArtifacts,
  }
}

function buildApiExamples(project: ProjectDetailItem | null) {
  if (!project) return { curl: '', javascript: '', response: '' }
  const apiKey = project.apiKey
  const sampleArchitecture = project.architectures.find((item) => item.enabled)?.key || 'arm64-v8a'
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://example.com'
  const curl = `curl -X POST "${baseUrl}/api/v1/check" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{\n    "architecture": "${sampleArchitecture}",\n    "currentVersion": "1.0.0"\n  }'`

  const javascript = `const response = await fetch('/api/v1/check', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'X-API-Key': '${apiKey}',\n  },\n  body: JSON.stringify({\n    architecture: '${sampleArchitecture}',\n    currentVersion: '1.0.0',\n  }),\n})\n\nconst result = await response.json()\nconsole.log(result)`

  const response = JSON.stringify({
    success: true,
    hasUpdate: true,
    data: {
      version: project.currentVersion || '1.0.1',
      publishState: 'READY',
      downloadUrl: '/api/version-artifacts/{artifactId}/download',
      md5: '0123456789abcdef0123456789abcdef',
      size: 12345678,
      forceUpdate: false,
      changelog: '1. 修复增量补丁加载失败',
      createdAt: '2026-03-28T21:00:00.000Z',
      updatedAt: '2026-03-28T21:10:00.000Z',
      timestamp: 1774703400000,
      architectureKey: sampleArchitecture,
      architectureName: project.architectures.find((item) => item.key === sampleArchitecture)?.name || sampleArchitecture,
      artifactId: 'artifact_xxxxx',
    },
  }, null, 2)

  return { curl, javascript, response }
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

interface ArtifactRequestPayload {
  architectureKey: string | null
  artifactType: ArtifactType
  fileRole: ArtifactFileRole
  displayName: string
  downloadUrl: string
  size: number | string | null
  md5: string
  storageProvider: string | null
  objectKey: string | null
  storageConfigId: string | null
}

function UploadMethodSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: UploadMethod
  onChange: (value: UploadMethod) => void
  disabled?: boolean
}) {
  const options: Array<{
    value: UploadMethod
    title: string
    icon: typeof Link2
  }> = [
    {
      value: 'url',
      title: '链接',
      icon: Link2,
    },
    {
      value: 'file',
      title: '上传文件',
      icon: Upload,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
      {options.map((option) => {
        const selected = value === option.value
        const Icon = option.icon

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all ${selected
              ? 'border-orange-200 bg-white text-orange-700 shadow-sm'
              : 'border-transparent bg-transparent text-slate-600 hover:bg-white/80'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            aria-pressed={selected}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{option.title}</span>
          </button>
        )
      })}
    </div>
  )
}

function ArchitectureDialogForm({
  open,
  apiBase,
  projectId,
  mode,
  architecture,
  onSaved,
  onOpenChange,
}: ArchitectureDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<ArchitectureFormState>({
    key: '',
    name: '',
    sortOrder: '0',
    enabled: true,
    isDefault: false,
  })

  useEffect(() => {
    if (!open) return
    setForm({
      key: architecture?.key || '',
      name: architecture?.name || '',
      sortOrder: String(architecture?.sortOrder ?? 0),
      enabled: architecture?.enabled ?? true,
      isDefault: architecture?.isDefault ?? false,
    })
  }, [open, architecture])

  const handleSubmit = async () => {
    if (!form.key.trim()) {
      toast.error('请填写架构 key')
      return
    }
    if (!form.name.trim()) {
      toast.error('请填写架构名称')
      return
    }

    setSubmitting(true)
    try {
      const url = mode === 'create'
        ? `${apiBase}/${projectId}/architectures`
        : `${apiBase}/${projectId}/architectures/${architecture?.id}`
      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key,
          name: form.name,
          sortOrder: Number(form.sortOrder || '0'),
          enabled: form.enabled,
          isDefault: form.isDefault,
        }),
      })
      const data = await readJson<any>(response)
      if (!response.ok) {
        throw new Error(data?.error || '保存架构失败')
      }
      toast.success(mode === 'create' ? '架构已创建' : '架构已更新')
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存架构失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增项目架构' : '编辑项目架构'}</DialogTitle>
          <DialogDescription>
            使用稳定的 key 标识客户端架构，例如 arm64-v8a、armeabi-v7a、universal。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="architecture-key">架构 Key</Label>
            <Input id="architecture-key" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value.toLowerCase() }))} placeholder="arm64-v8a" disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="architecture-name">显示名称</Label>
            <Input id="architecture-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="ARM64" disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="architecture-sort">排序值</Label>
            <Input id="architecture-sort" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} disabled={submitting} />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Checkbox checked={form.enabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: Boolean(checked) }))} disabled={submitting} />
              启用该架构
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: Boolean(checked) }))} disabled={submitting} />
              设为默认架构
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-orange-600 hover:bg-orange-700">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? '创建架构' : '保存变更'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VersionDialog({
  open,
  mode,
  projectId,
  projectName,
  apiBase,
  apiScope,
  architectures,
  initialVersion,
  suggestedVersion,
  availableStorages,
  onSaved,
  onOpenChange,
}: VersionDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null)
  const [form, setForm] = useState<VersionFormState>(() =>
    buildVersionFormState(architectures, suggestedVersion, availableStorages, initialVersion),
  )

  useEffect(() => {
    if (!open) return
    setForm(buildVersionFormState(architectures, suggestedVersion, availableStorages, initialVersion))
    setUploadingLabel(null)
  }, [open, architectures, suggestedVersion, availableStorages, initialVersion])

  const activeArchitectures = useMemo(() => architectures.filter((item) => item.enabled), [architectures])
  const enabledPrimaryCount = form.primaryArtifacts.filter((item) => item.enabled).length
  const legacyAttachmentCount = useMemo(
    () => initialVersion?.artifacts.filter((item) => item.fileRole === 'EXTRA').length ?? 0,
    [initialVersion],
  )

  const patchPrimary = (architectureKey: string, patch: Partial<PrimaryArtifactDraft>) => {
    setForm((current) => ({
      ...current,
      primaryArtifacts: current.primaryArtifacts.map((item) => item.architectureKey === architectureKey ? { ...item, ...patch } : item),
    }))
  }

  const resolveArtifactPayload = async (draft: PrimaryArtifactDraft, label: string) => {
    if (draft.uploadMethod === 'file') {
      if (!draft.file) {
        throw new Error(`${label} 还没有选择文件`)
      }
      setUploadingLabel(label)
      const uploaded = await uploadFileResumable({ file: draft.file, projectId, storageConfigId: draft.storageConfigId })
      return {
        downloadUrl: uploaded.url,
        size: uploaded.size,
        md5: uploaded.md5,
        storageProvider: uploaded.storageProvider,
        objectKey: uploaded.objectKey,
        storageConfigId: uploaded.storageConfigId,
      }
    }

    if (!draft.downloadUrl.trim()) {
      throw new Error(`${label} 缺少下载地址`)
    }

    return {
      downloadUrl: draft.downloadUrl.trim(),
      size: draft.size ?? null,
      md5: draft.md5.trim(),
      storageProvider: draft.storageProvider,
      objectKey: draft.objectKey,
      storageConfigId: draft.storageConfigId,
    }
  }

  const handleSubmit = async () => {
    if (!form.version.trim()) {
      toast.error('请填写版本号')
      return
    }

    const enabledPrimary = form.primaryArtifacts.filter((item) => item.enabled)
    if (enabledPrimary.length === 0) {
      toast.error('至少发布一个架构主程序')
      return
    }

    if (!enabledPrimary.some((item) => item.architectureKey === form.defaultArchitectureKey)) {
      toast.error('默认架构必须是本次已发布的主程序架构')
      return
    }

    setSubmitting(true)
    try {
      const artifacts: ArtifactRequestPayload[] = []

      for (const draft of enabledPrimary) {
        const payload = await resolveArtifactPayload(draft, `${draft.architectureName} 主程序`)
        artifacts.push({
          architectureKey: draft.architectureKey,
          artifactType: 'BINARY',
          fileRole: 'PRIMARY',
          displayName: draft.displayName.trim() || `${form.version} ${draft.architectureName} 主程序`,
          downloadUrl: payload.downloadUrl,
          size: payload.size,
          md5: payload.md5,
          storageProvider: payload.storageProvider,
          objectKey: payload.objectKey,
          storageConfigId: payload.storageConfigId,
        })
      }

      const response = await fetch(
        mode === 'create' ? `${apiBase}/${projectId}/versions` : `${apiBase}/${projectId}/versions/${initialVersion?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: form.version.trim(),
            changelog: form.changelog.trim(),
            defaultForceUpdate: form.defaultForceUpdate,
            defaultArchitectureKey: form.defaultArchitectureKey,
            isCurrent: form.isCurrent,
            artifacts,
          }),
        },
      )

      const data = await readJson<any>(response)
      if (!response.ok) {
        throw new Error(data?.error || '保存版本失败')
      }

      toast.success(mode === 'create' ? '版本已创建' : '版本已更新')
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存版本失败')
    } finally {
      setSubmitting(false)
      setUploadingLabel(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden border border-orange-100 bg-white p-0 shadow-[0_28px_90px_-42px_rgba(15,23,42,0.55)]">
        <DialogHeader className="border-b border-orange-100 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_36%),linear-gradient(135deg,_#fff7ed_0%,_#ffffff_58%,_#fff1f2_100%)] px-6 pb-6 pt-7 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">
                {mode === 'create' ? '创建多架构版本' : `编辑版本 ${initialVersion?.version}`}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                为项目 {projectName} 维护逻辑版本、默认架构与各架构主程序。附件配置已移除，弹窗只保留核心发布流程。
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-orange-200 bg-white/90 px-3 py-1 text-orange-700 shadow-sm">
                {mode === 'create' ? '新建流程' : '编辑流程'}
              </Badge>
              <Badge className="border-slate-200 bg-white/90 px-3 py-1 text-slate-600 shadow-sm">
                已启用架构 {activeArchitectures.length} 个
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200/80 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.45)]">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-lg text-slate-950">版本核心信息</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-6 text-slate-500">
                      逻辑版本号只保留一份，真正的可下载内容由下方已启用的架构主程序决定。
                    </CardDescription>
                  </div>
                  <div className="inline-flex items-center rounded-2xl border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700">
                    已启用 {enabledPrimaryCount} / {form.primaryArtifacts.length} 个架构
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="version-number">版本号</Label>
                  <Input
                    id="version-number"
                    value={form.version}
                    onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                    placeholder="1.2.3"
                    disabled={submitting}
                    className="h-12 rounded-2xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-architecture">默认架构</Label>
                  <select
                    id="default-architecture"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    value={form.defaultArchitectureKey}
                    onChange={(event) => setForm((current) => ({ ...current, defaultArchitectureKey: event.target.value }))}
                    disabled={submitting}
                  >
                    {activeArchitectures.map((architecture) => (
                      <option key={architecture.id} value={architecture.key}>{architecture.name} · {architecture.key}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="version-changelog">更新日志</Label>
                  <textarea
                    id="version-changelog"
                    className="min-h-[140px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    value={form.changelog}
                    onChange={(event) => setForm((current) => ({ ...current, changelog: event.target.value }))}
                    placeholder="1. 修复热更新失败&#10;2. 优化 arm64-v8a 主程序启动速度"
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                    <Checkbox checked={form.defaultForceUpdate} onCheckedChange={(checked) => setForm((current) => ({ ...current, defaultForceUpdate: Boolean(checked) }))} disabled={submitting} />
                    默认强制更新
                  </label>
                  <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                    <Checkbox checked={form.isCurrent} onCheckedChange={(checked) => setForm((current) => ({ ...current, isCurrent: Boolean(checked) }))} disabled={submitting} />
                    保存后设为当前逻辑版本
                  </label>
                </div>
              </CardContent>
            </Card>

            {legacyAttachmentCount > 0 && (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 shadow-[0_16px_40px_-34px_rgba(217,119,6,0.7)]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-medium">检测到 {legacyAttachmentCount} 个历史附件</p>
                    <p className="leading-6 text-amber-800">
                      当前弹窗已收敛为“仅维护架构主程序”的简化模式。如果继续保存，这些历史附件会被自动移除。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Card className="rounded-[28px] border-slate-200/80 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.45)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-950">架构主程序</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-500">
                  每个架构最多维护一个主程序；未勾选表示该逻辑版本对该架构暂未发布。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.primaryArtifacts.map((artifact) => (
                  <div
                    key={artifact.architectureKey}
                    className={`rounded-[26px] border p-5 transition-all ${artifact.enabled
                      ? 'border-orange-200 bg-gradient-to-br from-white via-orange-50/80 to-amber-50 shadow-[0_20px_45px_-34px_rgba(245,73,0,0.65)]'
                      : 'border-slate-200 bg-white shadow-sm'}`}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-slate-950">{artifact.architectureName}</h4>
                          <Badge variant="outline" className="border-slate-200 bg-white/90 text-slate-600">
                            {artifact.architectureKey}
                          </Badge>
                          {form.defaultArchitectureKey === artifact.architectureKey && (
                            <Badge className="bg-indigo-100 text-indigo-800">默认下载架构</Badge>
                          )}
                          {artifact.enabled && (
                            <Badge className="bg-emerald-100 text-emerald-800">已启用</Badge>
                          )}
                        </div>
                        <p className="text-sm leading-6 text-slate-500">
                          {artifact.enabled
                            ? '请为该架构提供一个清晰、稳定的主程序下载入口。'
                            : '未启用时，该架构在当前逻辑版本中不会对外发布。'}
                        </p>
                      </div>
                      <label className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium ${artifact.enabled
                        ? 'border-orange-200 bg-white/90 text-orange-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                      >
                        <Checkbox checked={artifact.enabled} onCheckedChange={(checked) => patchPrimary(artifact.architectureKey, { enabled: Boolean(checked) })} disabled={submitting} />
                        发布该架构主程序
                      </label>
                    </div>

                    {artifact.enabled && (
                      <div className="mt-5 rounded-[22px] border border-white/80 bg-white/85 p-4 sm:p-5">
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <Label>显示名称</Label>
                            <Input
                              value={artifact.displayName}
                              onChange={(event) => patchPrimary(artifact.architectureKey, { displayName: event.target.value })}
                              placeholder={`${artifact.architectureName} 主程序`}
                              disabled={submitting}
                              className="h-12 rounded-2xl border-slate-200"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>上传方式</Label>
                            <UploadMethodSelector
                              value={artifact.uploadMethod}
                              onChange={(uploadMethod) => patchPrimary(artifact.architectureKey, {
                                uploadMethod,
                                ...(uploadMethod === 'url' ? { file: null } : {}),
                              })}
                              disabled={submitting}
                            />
                          </div>

                          {artifact.uploadMethod === 'url' ? (
                            <>
                              <div className="space-y-2">
                                <Label>下载地址</Label>
                                <Input
                                  value={artifact.downloadUrl}
                                  onChange={(event) => patchPrimary(artifact.architectureKey, { downloadUrl: event.target.value })}
                                  placeholder="https://example.com/app-arm64.apk"
                                  disabled={submitting}
                                  className="h-12 rounded-2xl border-slate-200"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>MD5（可选）</Label>
                                <Input
                                  value={artifact.md5}
                                  onChange={(event) => patchPrimary(artifact.architectureKey, { md5: event.target.value.trim() })}
                                  placeholder="32位十六进制"
                                  disabled={submitting}
                                  className="h-12 rounded-2xl border-slate-200"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                              <div className="space-y-2">
                                <Label>选择文件</Label>
                                <FileUpload
                                  variant="square"
                                  className="max-w-[220px]"
                                  selectedFile={artifact.file}
                                  onFileSelect={(file) => patchPrimary(artifact.architectureKey, { file })}
                                  onFileRemove={() => patchPrimary(artifact.architectureKey, { file: null })}
                                  uploading={submitting}
                                  disabled={submitting}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>目标存储</Label>
                                <select
                                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                  value={storageValueOf(artifact.storageConfigId)}
                                  onChange={(event) => patchPrimary(artifact.architectureKey, { storageConfigId: storageIdFromValue(event.target.value) })}
                                  disabled={submitting}
                                >
                                  {availableStorages.map((storage) => (
                                    <option key={storageValueOf(storage.id)} value={storageValueOf(storage.id)}>
                                      {formatStorageOptionLabel(storage, apiScope)}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs leading-5 text-slate-500">
                                  上传完成后会自动回填体积、MD5 和存储信息。
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:px-8">
          <div className="mr-auto flex items-center gap-2 text-sm text-slate-500">
            {uploadingLabel ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在上传：{uploadingLabel}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-orange-500" />
                未勾选的架构不会被视为已发布；本次共配置 {enabledPrimaryCount} 个主程序。
              </>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="h-11 rounded-2xl border-slate-200 px-5">
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="h-11 rounded-2xl bg-orange-600 px-5 hover:bg-orange-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? '创建版本' : '保存版本'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectWorkbench({
  projectId,
  apiBase,
  apiScope,
  resetKeyActionPath,
  showOwnerInfo = false,
  showApiExamples = true,
  onProjectMutated,
}: ProjectWorkbenchProps) {
  const [project, setProject] = useState<ProjectDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectApiKey, setProjectApiKey] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [resettingKey, setResettingKey] = useState(false)
  const [activeTab, setActiveTab] = useState(showApiExamples ? 'overview' : 'versions')
  const [versionDialogMode, setVersionDialogMode] = useState<'create' | 'edit'>('create')
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [editingVersion, setEditingVersion] = useState<ProjectVersionItem | null>(null)
  const [architectureDialogMode, setArchitectureDialogMode] = useState<'create' | 'edit'>('create')
  const [editingArchitecture, setEditingArchitecture] = useState<ProjectArchitectureItem | null>(null)
  const [architectureDialogOpen, setArchitectureDialogOpen] = useState(false)
  const [deletingVersion, setDeletingVersion] = useState<ProjectVersionItem | null>(null)
  const [deletingArchitecture, setDeletingArchitecture] = useState<ProjectArchitectureItem | null>(null)
  const [mutatingVersionId, setMutatingVersionId] = useState<string | null>(null)
  const [availableStorages, setAvailableStorages] = useState<StorageOptionItem[]>([
    { id: null, name: '本地存储(内置)', provider: 'LOCAL', isDefault: true, scope: 'system' },
  ])

  const applyProjectDetail = useCallback((data: ProjectDetailItem) => {
    setProject(data)
    setProjectName(data.name)
    setProjectApiKey(data.apiKey)
    onProjectMutated?.(data)
  }, [onProjectMutated])

  const fetchProject = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const response = await fetch(`${apiBase}/${projectId}`, { cache: 'no-store' })
      const data = await readJson<any>(response)
      if (!response.ok) throw new Error(data?.error || '获取项目详情失败')
      applyProjectDetail(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取项目详情失败')
      setProject(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [apiBase, projectId, applyProjectDetail])

  const fetchStorages = useCallback(async () => {
    try {
      const response = await fetch(`/api/storage-configs/available?projectId=${encodeURIComponent(projectId)}`)
      if (!response.ok) return
      const data = await readJson<any>(response)
      const items = Array.isArray(data?.items) ? data.items : []
      if (items.length > 0) {
        setAvailableStorages(items)
      }
    } catch {
      // ignore
    }
  }, [projectId])

  useEffect(() => {
    void fetchProject()
    void fetchStorages()
  }, [fetchProject, fetchStorages])

  const handleSaveProjectSettings = async () => {
    if (!projectName.trim()) {
      toast.error('项目名称不能为空')
      return
    }
    if (!projectApiKey.trim()) {
      toast.error('API Key 不能为空')
      return
    }

    setSavingProject(true)
    try {
      const response = await fetch(`${apiBase}/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          apiKey: projectApiKey.trim(),
        }),
      })
      const data = await readJson<any>(response)
      if (!response.ok) throw new Error(data?.error || '更新项目失败')
      applyProjectDetail(data)
      toast.success('项目信息已更新')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新项目失败')
    } finally {
      setSavingProject(false)
    }
  }

  const handleResetApiKey = async () => {
    setResettingKey(true)
    try {
      const response = await fetch(`${apiBase}/${projectId}/${resetKeyActionPath}`, { method: 'POST' })
      const data = await readJson<any>(response)
      if (!response.ok) throw new Error(data?.error || '重置 API Key 失败')
      toast.success(apiScope === 'admin' ? 'API Key 已重置' : 'API Key 已重新生成')
      await fetchProject(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重置 API Key 失败')
    } finally {
      setResettingKey(false)
    }
  }

  const handleSetCurrentVersion = async (version: ProjectVersionItem) => {
    setMutatingVersionId(version.id)
    try {
      const response = await fetch(`${apiBase}/${projectId}/versions/${version.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCurrent: true }),
      })
      const data = await readJson<any>(response)
      if (!response.ok) throw new Error(data?.error || '设置当前版本失败')
      toast.success(`当前逻辑版本已切换到 ${version.version}`)
      await fetchProject(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '设置当前版本失败')
    } finally {
      setMutatingVersionId(null)
    }
  }

  const handleDeleteVersion = async () => {
    if (!deletingVersion) return
    setMutatingVersionId(deletingVersion.id)
    try {
      const response = await fetch(`${apiBase}/${projectId}/versions/${deletingVersion.id}`, { method: 'DELETE' })
      const data = await readJson<any>(response)
      if (!response.ok) throw new Error(data?.error || '删除版本失败')
      toast.success(`版本 ${deletingVersion.version} 已删除`)
      setDeletingVersion(null)
      await fetchProject(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除版本失败')
    } finally {
      setMutatingVersionId(null)
    }
  }

  const handleDeleteArchitecture = async () => {
    if (!deletingArchitecture) return
    try {
      const response = await fetch(`${apiBase}/${projectId}/architectures/${deletingArchitecture.id}`, { method: 'DELETE' })
      const data = await readJson<any>(response)
      if (!response.ok) throw new Error(data?.error || '删除架构失败')
      toast.success(`架构 ${deletingArchitecture.name} 已删除`)
      setDeletingArchitecture(null)
      await fetchProject(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除架构失败')
    }
  }

  const apiExamples = useMemo(() => buildApiExamples(project), [project])

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-white/80"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
          <Package className="h-12 w-12 text-slate-300" />
          <div>
            <p className="text-lg font-semibold text-slate-900">项目详情加载失败</p>
            <p className="text-sm text-slate-500">请刷新重试，或确认当前账号是否有权限访问该项目。</p>
          </div>
          <Button variant="outline" onClick={() => void fetchProject()}>重新加载</Button>
        </CardContent>
      </Card>
    )
  }

  const currentVersion = project.versions.find((item) => item.isCurrent) || project.versions[0] || null

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.4fr,1fr,1fr]">
        <Card className="border-orange-200 bg-gradient-to-br from-white via-orange-50 to-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl"><Package className="h-5 w-5 text-orange-600" />{project.name}</CardTitle>
            <CardDescription>项目 ID：<code className="rounded bg-white/80 px-2 py-1 text-xs">{project.id}</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/80 bg-white/80 p-3"><div className="text-xs text-slate-500">当前逻辑版本</div><div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900"><Star className="h-4 w-4 text-amber-500" />{project.currentVersion || '未设置'}</div></div>
              <div className="rounded-xl border border-white/80 bg-white/80 p-3"><div className="text-xs text-slate-500">架构数量</div><div className="mt-1 text-sm font-semibold text-slate-900">{project.architectures.length} 个</div></div>
              <div className="rounded-xl border border-white/80 bg-white/80 p-3"><div className="text-xs text-slate-500">版本数量</div><div className="mt-1 text-sm font-semibold text-slate-900">{project._count?.versions ?? project.versions.length} 个</div></div>
              <div className="rounded-xl border border-white/80 bg-white/80 p-3"><div className="text-xs text-slate-500">最近更新时间</div><div className="mt-1 text-sm font-semibold text-slate-900">{formatDate(project.updatedAt)}</div></div>
            </div>

            <div className="rounded-xl border border-orange-100 bg-white/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><Key className="h-4 w-4 text-orange-600" /><span className="text-sm font-medium text-slate-700">API Key</span></div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-slate-900 px-3 py-2 font-mono text-xs text-orange-200">{apiKeyVisible ? project.apiKey : '••••••••••••••••••••••••••••••••'}</code>
                    <Button variant="ghost" size="icon" onClick={() => setApiKeyVisible((current) => !current)}>{apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(project.apiKey); toast.success('API Key 已复制') }}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void fetchProject(true)} disabled={refreshing}>{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}<span className="ml-2">刷新</span></Button>
                  <Button variant="outline" onClick={handleResetApiKey} disabled={resettingKey}>{resettingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}<span className="ml-2">{apiScope === 'admin' ? '重置 API Key' : '重新生成 API Key'}</span></Button>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                上传存储作用域：{apiScope === 'admin' ? '项目所有者配置优先，其次全局配置' : '当前用户配置优先，其次全局配置'}。
                当前默认目标：{formatStorageOptionLabel(availableStorages.find((item) => item.isDefault) || availableStorages[0], apiScope)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">当前版本状态</CardTitle><CardDescription>逻辑版本与多架构发布覆盖情况。</CardDescription></CardHeader>
          <CardContent>
            {currentVersion ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800">{currentVersion.version}</Badge>
                  <Badge className={publishStateMeta(currentVersion.publishState).className}>{publishStateMeta(currentVersion.publishState).label}</Badge>
                  {currentVersion.defaultForceUpdate && <Badge className="bg-red-100 text-red-800">默认强更</Badge>}
                </div>
                <div className="text-sm text-slate-600">默认架构：{currentVersion.defaultArchitectureKey || '未设置'}</div>
                <div className="text-sm text-slate-600">覆盖率：{currentVersion.architectureCoverage?.published ?? 0} / {currentVersion.architectureCoverage?.total ?? project.architectures.length}</div>
                {(currentVersion.architectureCoverage?.missingKeys || []).length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">缺失架构：{currentVersion.architectureCoverage?.missingKeys.join('、')}</div>}
                <div className="text-xs text-slate-500">更新时间：{formatDateTime(currentVersion.updatedAt)}</div>
              </div>
            ) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">还没有任何版本，先创建一个多架构逻辑版本吧。</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">项目设置</CardTitle><CardDescription>轻量调整项目名称与 API Key，迁移服务器时也能保持客户端配置不变。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="project-name">项目名称</Label><Input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} disabled={savingProject} /></div>
            <div className="space-y-2">
              <Label htmlFor="project-api-key">API Key</Label>
              <Input id="project-api-key" value={projectApiKey} onChange={(event) => setProjectApiKey(event.target.value)} disabled={savingProject} />
              <p className="text-xs text-slate-500">可手动输入旧服务器上的 API Key；若与其他项目重复，系统会拒绝保存。</p>
            </div>
            <Button onClick={handleSaveProjectSettings} disabled={savingProject || !projectName.trim() || !projectApiKey.trim()} className="w-full bg-orange-600 hover:bg-orange-700">{savingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}<span className="ml-2">保存项目设置</span></Button>
            <div className="text-xs text-slate-500">创建时间：{formatDateTime(project.createdAt)}</div>
            {showOwnerInfo && project.user && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><div className="mb-1 flex items-center gap-2 font-medium text-slate-700"><User className="h-4 w-4" /> 所有者</div><div>{project.user.username}</div><div>{project.user.email}</div></div>}
          </CardContent>
        </Card>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full ${showApiExamples ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="architectures">架构</TabsTrigger>
          <TabsTrigger value="versions">版本</TabsTrigger>
          {showApiExamples && <TabsTrigger value="api">API 接入</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">已启用架构总览</CardTitle><CardDescription>帮助你快速识别当前项目支持的客户端架构集合。</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {project.architectures.map((architecture) => <Badge key={architecture.id} variant="outline" className={architecture.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}>{architecture.name} · {architecture.key}{architecture.isDefault && ' · 默认'}{!architecture.enabled && ' · 已禁用'}</Badge>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">最近版本快照</CardTitle><CardDescription>展示最新几个逻辑版本的发布状态与覆盖率。</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {project.versions.slice(0, 4).map((version) => { const state = publishStateMeta(version.publishState); return <div key={version.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h4 className="text-base font-semibold text-slate-900">{version.version}</h4>{version.isCurrent && <Badge className="bg-emerald-100 text-emerald-800">当前逻辑版本</Badge>}<Badge className={state.className}>{state.label}</Badge></div><div className="mt-2 text-sm text-slate-500">默认架构：{version.defaultArchitectureKey || '未设置'} · 覆盖 {version.architectureCoverage?.published ?? 0}/{version.architectureCoverage?.total ?? project.architectures.length}</div></div><div className="text-sm text-slate-500">{formatDateTime(version.updatedAt)}</div></div></div>})}
              {project.versions.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">暂无版本数据。</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="architectures" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-semibold text-slate-900">项目架构管理</h3><p className="text-sm text-slate-500">先定义架构，再在版本里按架构上传主程序。</p></div><Button className="bg-orange-600 hover:bg-orange-700" onClick={() => { setArchitectureDialogMode('create'); setEditingArchitecture(null); setArchitectureDialogOpen(true) }}><Plus className="mr-2 h-4 w-4" /> 新增架构</Button></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {project.architectures.map((architecture) => { const primaryCount = project.versions.filter((version) => version.artifacts.some((artifact) => artifact.fileRole === 'PRIMARY' && artifact.architectureKey === architecture.key)).length; return <Card key={architecture.id} className="border-slate-200"><CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base"><span>{architecture.name}</span><div className="flex flex-wrap gap-2">{architecture.isDefault && <Badge className="bg-indigo-100 text-indigo-800">默认</Badge>}<Badge variant="outline">{architecture.key}</Badge></div></CardTitle><CardDescription>排序值 {architecture.sortOrder} · {architecture.enabled ? '已启用' : '已禁用'}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-slate-600"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3">历史已发布版本数：<span className="font-semibold text-slate-900">{primaryCount}</span></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setArchitectureDialogMode('edit'); setEditingArchitecture(architecture); setArchitectureDialogOpen(true) }}><Edit className="mr-2 h-4 w-4" /> 编辑</Button><Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setDeletingArchitecture(architecture)}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card> })}
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">多架构版本管理</h3>
              <p className="text-sm text-slate-500">逻辑版本统一编号，各架构主程序在一个版本下集中维护。</p>
            </div>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => { setVersionDialogMode('create'); setEditingVersion(null); setVersionDialogOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" /> 创建版本
            </Button>
          </div>
          <div className="space-y-5">
            {project.versions.map((version) => {
              const state = publishStateMeta(version.publishState)
              const primaryArtifacts = version.artifacts.filter((artifact) => artifact.fileRole === 'PRIMARY')
              const extraArtifacts = version.artifacts.filter((artifact) => artifact.fileRole === 'EXTRA')
              const coveragePublished = version.architectureCoverage?.published ?? 0
              const coverageTotal = version.architectureCoverage?.total ?? project.architectures.length
              const coveragePercent = coverageTotal > 0 ? Math.round((coveragePublished / coverageTotal) * 100) : 0
              const accentBarClass = version.publishState === 'READY'
                ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400'
                : version.publishState === 'PARTIAL'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300'
                  : 'bg-gradient-to-r from-slate-400 via-slate-300 to-slate-200'

              return (
                <Card key={version.id} className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] transition-shadow hover:shadow-[0_30px_70px_-40px_rgba(245,73,0,0.28)]">
                  <div className={`h-1.5 w-full ${accentBarClass}`} />
                  <CardHeader className="gap-5 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.14),_transparent_34%),linear-gradient(180deg,_rgba(248,250,252,0.92),_rgba(255,255,255,0.98))] px-5 pb-5 pt-5 sm:px-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl font-semibold tracking-tight text-slate-950">{version.version}</CardTitle>
                          {version.isCurrent && <Badge className="bg-emerald-100 text-emerald-800">当前逻辑版本</Badge>}
                          <Badge className={state.className}>{state.label}</Badge>
                          {version.defaultForceUpdate && <Badge className="bg-red-100 text-red-800">默认强更</Badge>}
                        </div>
                        <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                          默认架构 {version.defaultArchitectureKey || '未设置'}，当前覆盖 {coveragePublished}/{coverageTotal} 个已启用架构，版本卡片聚焦主程序发布状态与下载入口。
                        </CardDescription>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">默认架构</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{version.defaultArchitectureKey || '未设置'}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">覆盖率</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{coveragePercent}%</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">主程序数</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{primaryArtifacts.length} 个</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">最近更新</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(version.updatedAt)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:max-w-[260px] xl:justify-end">
                        {!version.isCurrent && (
                          <Button
                            variant="outline"
                            onClick={() => void handleSetCurrentVersion(version)}
                            disabled={mutatingVersionId === version.id}
                            className="rounded-2xl border-slate-200 bg-white/90 shadow-sm"
                          >
                            {mutatingVersionId === version.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                            <span className="ml-2">设为当前</span>
                          </Button>
                        )}
                        <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/90 shadow-sm" onClick={() => { setVersionDialogMode('edit'); setEditingVersion(version); setVersionDialogOpen(true) }}>
                          <Edit className="mr-2 h-4 w-4" /> 编辑
                        </Button>
                        <Button variant="outline" className="rounded-2xl border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50" onClick={() => setDeletingVersion(version)}>
                          <Trash2 className="mr-2 h-4 w-4" /> 删除
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Sparkles className="h-4 w-4 text-orange-500" /> 更新日志
                        </div>
                        <div className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {version.changelog || '暂无更新日志'}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">架构覆盖进度</div>
                            <div className="mt-1 text-xs text-slate-500">已发布主程序的架构越多，客户端命中更新越稳定。</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-semibold tracking-tight text-slate-950">{coveragePercent}%</div>
                            <div className="text-xs text-slate-500">{coveragePublished}/{coverageTotal}</div>
                          </div>
                        </div>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 transition-all" style={{ width: `${coveragePercent}%` }} />
                        </div>
                        {(version.architectureCoverage?.missingKeys || []).length > 0 && (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            缺失架构：{version.architectureCoverage?.missingKeys.join('、')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <FolderTree className="h-4 w-4 text-orange-600" /> 架构主程序
                        </div>
                        <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-600">共 {primaryArtifacts.length} 个产物</Badge>
                      </div>
                      {primaryArtifacts.length > 0 ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                          {primaryArtifacts.map((artifact) => (
                            <div key={artifact.id} className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.4)]">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-slate-900">{artifact.displayName}</span>
                                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">{artifact.architectureName || artifact.architectureKey || '通用'}</Badge>
                                    {artifact.isDefault && <Badge className="bg-indigo-100 text-indigo-800">默认</Badge>}
                                  </div>
                                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">大小：<span className="font-medium text-slate-700">{formatFileSize(artifact.size)}</span></div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">MD5：<span className="font-medium text-slate-700">{artifact.md5 || '未提供'}</span></div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600" asChild>
                                  <a href={artifact.downloadUrl} target="_blank" rel="noreferrer noopener">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
                          当前版本还没有任何主程序产物。
                        </div>
                      )}
                    </div>

                    {extraArtifacts.length > 0 && (
                      <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 p-4 text-xs leading-6 text-amber-800">
                        该版本仍保留 {extraArtifacts.length} 个历史附件；如需完全收敛为主程序模型，可重新编辑并保存该版本。
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
                      <div>创建时间：{formatDateTime(version.createdAt)}</div>
                      <div>更新时间：{formatDateTime(version.updatedAt)}</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {project.versions.length === 0 && (
              <Card className="rounded-[28px] border-slate-200 shadow-sm">
                <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
                  <Package className="h-12 w-12 text-slate-300" />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">还没有任何版本</p>
                    <p className="text-sm text-slate-500">先创建一个逻辑版本，再逐步补齐各架构的主程序。</p>
                  </div>
                  <Button className="rounded-2xl bg-orange-600 hover:bg-orange-700" onClick={() => { setVersionDialogMode('create'); setEditingVersion(null); setVersionDialogOpen(true) }}>
                    <Plus className="mr-2 h-4 w-4" /> 创建首个版本
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {showApiExamples && <TabsContent value="api" className="space-y-4"><Card><CardHeader><CardTitle className="text-base">推荐调用方式</CardTitle><CardDescription>客户端带上 architecture + currentVersion，可获得“该架构最新可用版本”，避免逻辑版本缺架构时误判无更新。</CardDescription></CardHeader><CardContent className="space-y-6"><div><div className="mb-2 flex items-center justify-between"><Label>cURL 示例</Label><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(apiExamples.curl); toast.success('cURL 示例已复制') }}><Copy className="mr-2 h-4 w-4" /> 复制</Button></div><pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300"><code>{apiExamples.curl}</code></pre></div><div><div className="mb-2 flex items-center justify-between"><Label>JavaScript / TypeScript</Label><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(apiExamples.javascript); toast.success('JavaScript 示例已复制') }}><Copy className="mr-2 h-4 w-4" /> 复制</Button></div><pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100"><code>{apiExamples.javascript}</code></pre></div><div><Label className="mb-2 block">响应示例</Label><pre className="overflow-x-auto rounded-xl border bg-slate-50 p-4 text-xs text-slate-700"><code>{apiExamples.response}</code></pre></div><Separator /><div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" /> 错误语义提示</div><ul className="space-y-1"><li>• <code>ARCH_NOT_PUBLISHED</code>：该架构历史上从未发布过主程序。</li><li>• <code>hasUpdate: false</code>：该架构已有发布记录，但没有高于当前版本的更新。</li><li>• 推荐优先调用 <code>/api/v1/check</code> 或 <code>/api/versions/latest</code>，并始终传递架构参数。</li></ul></div></CardContent></Card></TabsContent>}
      </Tabs>

      <VersionDialog open={versionDialogOpen} mode={versionDialogMode} projectId={projectId} projectName={project.name} apiBase={apiBase} apiScope={apiScope} architectures={project.architectures} initialVersion={editingVersion} suggestedVersion={buildNextVersion(project.versions)} availableStorages={availableStorages} onSaved={() => fetchProject(true)} onOpenChange={(open) => { setVersionDialogOpen(open); if (!open) setEditingVersion(null) }} />
      <ArchitectureDialogForm open={architectureDialogOpen} apiBase={apiBase} projectId={projectId} mode={architectureDialogMode} architecture={editingArchitecture} onSaved={() => fetchProject(true)} onOpenChange={setArchitectureDialogOpen} />

      <AlertDialog open={Boolean(deletingVersion)} onOpenChange={() => setDeletingVersion(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认删除版本</AlertDialogTitle><AlertDialogDescription>删除后，该逻辑版本下的所有版本产物都会一起移除，且无法恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleDeleteVersion()}>删除版本</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={Boolean(deletingArchitecture)} onOpenChange={() => setDeletingArchitecture(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认删除架构</AlertDialogTitle><AlertDialogDescription>只有在该架构没有任何关联产物时才允许删除。若删除默认架构，系统会自动选取新的默认架构。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void handleDeleteArchitecture()}>删除架构</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
