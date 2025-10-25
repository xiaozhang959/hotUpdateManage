"use client"
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Separator } from '@/components/ui'
import { toast } from 'sonner'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'

type Provider = 'LOCAL'|'WEBDAV'|'S3'|'OSS'

interface Item {
  id: string
  name: string
  provider: Provider
  isDefault: boolean
  configJson: string
  createdAt: string
}

export default function ProfileStoragePage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ id: '', name: '', provider: 'LOCAL' as Provider, isDefault: false, config: {} })

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile/storage-config')
      const data = await res.json()
      setItems(data.data || [])
    } catch { toast.error('获取列表失败') } finally { setLoading(false) }
  }
  useEffect(()=>{ fetchItems() },[])

  const providerFields = (p: Provider) => {
    switch (p) {
      case 'LOCAL': return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>publicPrefix</Label>
            <Input value={form.config?.publicPrefix||''} onChange={e=>setForm({...form, config:{...form.config, publicPrefix:e.target.value}})} placeholder="/uploads"/>
            <p className="text-xs text-gray-500 mt-1">必须以 / 开头且不以 / 结尾。默认 /uploads。注意：next.config.ts 仅重写 /uploads → /api/uploads，如改前缀需同步修改 rewrite。</p>
          </div>
          <div>
            <Label>baseDir</Label>
            <Input value={form.config?.baseDir||''} onChange={e=>setForm({...form, config:{...form.config, baseDir:e.target.value}})} placeholder="uploads"/>
            <p className="text-xs text-gray-500 mt-1">服务端本地目录（相对项目根）。默认 uploads。与 publicPrefix 对应。</p>
          </div>
        </div>
      )
      case 'WEBDAV': return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>baseUrl</Label>
            <Input value={form.config?.baseUrl||''} onChange={e=>setForm({...form, config:{...form.config, baseUrl:e.target.value}})} placeholder="https://dav.example.com/remote.php/webdav"/>
            <p className="text-xs text-gray-500 mt-1">必填，WebDAV 根地址，结尾不要带 /。例如：Nextcloud → https://cloud.example.com/remote.php/webdav；通用 → https://dav.example.com/webdav。</p>
          </div>
          <div>
            <Label>publicBaseUrl</Label>
            <Input value={form.config?.publicBaseUrl||''} onChange={e=>setForm({...form, config:{...form.config, publicBaseUrl:e.target.value}})} placeholder="可选，默认等于 baseUrl"/>
            <p className="text-xs text-gray-500 mt-1">可选，对外可访问域名（无认证）。留空则与 baseUrl 相同。非公开时可留空，下载将走服务端代理。</p>
          </div>
          <div>
            <Label>username</Label>
            <Input value={form.config?.username||''} onChange={e=>setForm({...form, config:{...form.config, username:e.target.value}})} />
            <p className="text-xs text-gray-500 mt-1">如服务端需认证，请填写用户名。</p>
          </div>
          <div>
            <Label>password</Label>
            <Input type="password" value={form.config?.password||''} onChange={e=>setForm({...form, config:{...form.config, password:e.target.value}})} />
            <p className="text-xs text-gray-500 mt-1">如服务端需认证，请填写密码。</p>
          </div>
          <div>
            <Label>rootPath</Label>
            <Input value={form.config?.rootPath||''} onChange={e=>setForm({...form, config:{...form.config, rootPath:e.target.value}})} placeholder="/hotupdates"/>
            <p className="text-xs text-gray-500 mt-1">可选，仓库内子目录。不要以 / 开头或结尾，示例：hotupdates。最终路径：baseUrl/rootPath/{'{projectId}'}/{'{file}'}。</p>
          </div>
        </div>
      )
      case 'S3': return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>region</Label>
            <Input value={form.config?.region||''} onChange={e=>setForm({...form, config:{...form.config, region:e.target.value}})} placeholder="us-east-1"/>
            <p className="text-xs text-gray-500 mt-1">AWS 写真实区域；S3 兼容服务（如 MinIO/Bitiful/R2）一般填 us-east-1 或 provider 要求的值。</p>
          </div>
          <div>
            <Label>bucket</Label>
            <Input value={form.config?.bucket||''} onChange={e=>setForm({...form, config:{...form.config, bucket:e.target.value}})} />
          </div>
          <div>
            <Label>accessKeyId</Label>
            <Input value={form.config?.accessKeyId||''} onChange={e=>setForm({...form, config:{...form.config, accessKeyId:e.target.value}})} />
          </div>
          <div>
            <Label>secretAccessKey</Label>
            <Input type="password" value={form.config?.secretAccessKey||''} onChange={e=>setForm({...form, config:{...form.config, secretAccessKey:e.target.value}})} />
          </div>
          <div>
            <Label>endpoint</Label>
            <Input value={form.config?.endpoint||''} onChange={e=>setForm({...form, config:{...form.config, endpoint:e.target.value}})} placeholder="可选"/>
            <p className="text-xs text-gray-500 mt-1">S3 兼容服务必填，例如 MinIO/Bitiful：如 https://s3.bitiful.net；AWS 官方可留空。</p>
          </div>
          <div>
            <Label>publicBaseUrl</Label>
            <Input value={form.config?.publicBaseUrl||''} onChange={e=>setForm({...form, config:{...form.config, publicBaseUrl:e.target.value}})} placeholder="可选"/>
            <p className="text-xs text-gray-500 mt-1">可选，桶对外域名（公开或 CDN），形如 https://{'{bucket}'} . s3 . {'{region}'} . amazonaws . com / 或兼容服务域名。若桶私有可留空，下载走预签名。</p>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input id="forcePathStyle" type="checkbox" checked={!!form.config?.forcePathStyle} onChange={e=>setForm({...form, config:{...form.config, forcePathStyle:e.target.checked}})} />
            <Label htmlFor="forcePathStyle">forcePathStyle（路径式地址）</Label>
            <p className="text-xs text-gray-500">MinIO/部分兼容服务需要勾选。勾选后地址形如 https://endpoint/bucket/key。</p>
          </div>
        </div>
      )
      case 'OSS': return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>region</Label>
            <Input value={form.config?.region||''} onChange={e=>setForm({...form, config:{...form.config, region:e.target.value}})} placeholder="cn-hangzhou"/>
          </div>
          <div>
            <Label>bucket</Label>
            <Input value={form.config?.bucket||''} onChange={e=>setForm({...form, config:{...form.config, bucket:e.target.value}})} />
          </div>
          <div>
            <Label>accessKeyId</Label>
            <Input value={form.config?.accessKeyId||''} onChange={e=>setForm({...form, config:{...form.config, accessKeyId:e.target.value}})} />
          </div>
          <div>
            <Label>accessKeySecret</Label>
            <Input type="password" value={form.config?.accessKeySecret||''} onChange={e=>setForm({...form, config:{...form.config, accessKeySecret:e.target.value}})} />
          </div>
          <div>
            <Label>endpoint</Label>
            <Input value={form.config?.endpoint||''} onChange={e=>setForm({...form, config:{...form.config, endpoint:e.target.value}})} placeholder="可选"/>
            <p className="text-xs text-gray-500 mt-1">可选，内网或自定义域名。留空则使用官方域名。</p>
          </div>
          <div>
            <Label>publicBaseUrl</Label>
            <Input value={form.config?.publicBaseUrl||''} onChange={e=>setForm({...form, config:{...form.config, publicBaseUrl:e.target.value}})} placeholder="可选"/>
            <p className="text-xs text-gray-500 mt-1">可选，公开访问域名/CDN 域名。桶私有时可留空，下载走预签名。</p>
          </div>
        </div>
      )
    }
  }

  const testConn = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/profile/storage-config/test', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ provider: form.provider, config: form.config }) })
      const data = await res.json()
      if (data.success) toast.success('连通性正常')
      else toast.error(data.error || '测试失败')
    } catch { toast.error('测试失败') } finally { setTesting(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { id: form.id||undefined, name: form.name, provider: form.provider, isDefault: form.isDefault, config: form.config }
      const res = await fetch('/api/profile/storage-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('保存失败')
      toast.success('已保存')
      setOpen(false)
      fetchItems()
    } catch { toast.error('保存失败') } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('确认删除该配置？')) return
    await fetch(`/api/profile/storage-config?id=${id}`, { method:'DELETE' })
    fetchItems()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">我的存储配置</h1>
          <p className="text-sm text-gray-500">设置我的默认存储，优先级高于全局</p>
        </div>
        <Button onClick={()=>{ setForm({ id:'', name:'', provider:'LOCAL', isDefault:false, config:{} }); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-1"/>新增配置
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>默认</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>{it.provider}</TableCell>
                  <TableCell>{it.isDefault ? <Badge variant="outline">默认</Badge> : '-'}</TableCell>
                  <TableCell>{new Date(it.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={()=>{ setForm({ id:it.id, name:it.name, provider: it.provider as Provider, isDefault: it.isDefault, config: JSON.parse(it.configJson||'{}') }); setOpen(true) }}>编辑</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={()=>remove(it.id)}><Trash2 className="h-4 w-4"/></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? '编辑配置' : '新增配置'}</DialogTitle>
            <DialogDescription>选择 Provider 并填写对应字段</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>名称</Label>
                <Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              </div>
              <div>
                <Label>Provider</Label>
                <select className="border rounded h-10 px-2 w-full" value={form.provider} onChange={e=>setForm({...form, provider:e.target.value as Provider})}>
                  <option value="LOCAL">LOCAL</option>
                  <option value="WEBDAV">WEBDAV</option>
                  <option value="S3">S3</option>
                  <option value="OSS">OSS</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="isDefault" type="checkbox" checked={!!form.isDefault} onChange={e=>setForm({...form, isDefault:e.target.checked})}/>
              <Label htmlFor="isDefault">设为默认</Label>
            </div>
            <Separator />
            {providerFields(form.provider)}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={testConn} disabled={testing}><RefreshCw className="h-4 w-4 mr-1"/>{testing?'测试中...':'测试连通性'}</Button>
              <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1"/>{saving?'保存中...':'保存'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
