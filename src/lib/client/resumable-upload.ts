// 仅在浏览器端使用
export type UploadResult = {
  url: string
  md5: string
  storageProvider: string
  objectKey: string
  storageConfigId: string | null
  fileName: string
  originalName: string
  size: number
  uploadedAt: string
}

type Options = {
  file: File
  projectId: string
  storageConfigId?: string | null
  onProgress?: (p: { uploadedBytes: number; totalBytes: number; uploadedParts: number; totalParts: number }) => void
  // 智能阈值（MB）：小于等于阈值走单请求上传；默认 60MB
  thresholdMB?: number
  onEvent?: (e:
    | { type: 'started'; strategy: 'S3_MULTIPART' | 'SERVER_CHUNK' | 'SINGLE'; resumed: boolean; totalParts: number; partSize: number; totalBytes: number }
    | { type: 'resumed'; uploadedParts: number; uploadedBytes: number }
    | { type: 'part-complete'; partNumber: number; uploadedBytes: number; totalBytes: number }
    | { type: 'retry'; attempt: number; delayMs: number; target: 'part' | 'chunk' | 'presign' }
    | { type: 'complete' }
  ) => void
  retry?: { maxRetries?: number; baseDelayMs?: number; factor?: number; maxDelayMs?: number }
}

function fingerprint(file: File, projectId: string, storageConfigId?: string | null) {
  return `${projectId}:${storageConfigId || 'local'}:${file.name}:${file.size}:${file.lastModified}`
}

async function createOrResumeSession(file: File, projectId: string, storageConfigId?: string | null) {
  const fp = fingerprint(file, projectId, storageConfigId)
  const ttlHours = parseInt(process.env.NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS || '72', 10) || 72
  const TTL = ttlHours * 3600 * 1000
  const cached = localStorage.getItem('upload:'+fp)
  if (cached) {
    try {
      const meta = JSON.parse(cached)
      const storedAt = typeof meta.storedAt === 'number' ? meta.storedAt : 0
      const expiresAt = typeof meta.expiresAt === 'number' ? meta.expiresAt : (storedAt ? storedAt + TTL : 0)
      if (expiresAt && Date.now() > expiresAt) { localStorage.removeItem('upload:'+fp) }
      // 查询服务器状态
      const res = await fetch(`/api/uploads/status?uploadId=${encodeURIComponent(meta.uploadId)}`)
      if (res.ok) {
        const j = await res.json()
        return { meta: j.data.meta, uploaded: j.data.uploaded as number[], fp, resumed: (j.data.uploaded as number[]).length > 0 }
      }
    } catch {/* ignore and fallback */}
  }
  const r = await fetch('/api/uploads/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, fileName: file.name, fileSize: file.size, contentType: file.type, storageConfigId: storageConfigId || null })
  })
  if (!r.ok) throw new Error((await r.json()).error || 'initiate failed')
  const meta = (await r.json()).data
  try {
    const now = Date.now()
    meta.storedAt = now
    meta.expiresAt = now + TTL
  } catch {}
  localStorage.setItem('upload:'+fp, JSON.stringify(meta))
  return { meta, uploaded: [] as number[], fp, resumed: false }
}

async function smallUpload(file: File, projectId: string, storageConfigId?: string | null): Promise<UploadResult> {
  // 优先尝试：S3 单次 PUT 预签名（完全绕过服务器）
  try {
    const init = await fetch('/api/uploads/initiate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, fileName: file.name, fileSize: file.size, contentType: file.type, storageConfigId: storageConfigId || null, preferSingle: true })
    })
    if (init.ok) {
      const metaResp = await init.json(); const meta = metaResp.data
      if (meta.strategy === 'S3_SINGLE') {
        const pre = await fetch(`/api/uploads/s3/presign-single?uploadId=${encodeURIComponent(meta.uploadId)}`)
        if (!pre.ok) throw new Error('presign single failed')
        const url = (await pre.json()).data.url
        const put = await fetch(url, { method: 'PUT', body: file })
        if (!put.ok) throw new Error('single put failed')
        const etag = put.headers.get('ETag') || put.headers.get('etag') || ''
        const fin = await fetch('/api/uploads/s3/complete-single', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: meta.uploadId, etag }) })
        if (!fin.ok) throw new Error('complete single failed')
        return (await fin.json()).data as UploadResult
      }
    }
  } catch (e) {
    console.warn('S3 单次预签名直传失败，回退到表单上传：', e)
  }
  // 回退：表单直传至服务端
  const fd = new FormData()
  fd.append('file', file)
  fd.append('projectId', projectId)
  if (storageConfigId) fd.append('storageConfigId', storageConfigId)
  const resp = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!resp.ok) throw new Error('文件上传失败')
  const j = await resp.json()
  return j.data as UploadResult
}

export async function uploadFileResumable(opts: Options): Promise<UploadResult> {
  const { file, projectId, storageConfigId, onProgress } = opts
  const thresholdMB = typeof opts.thresholdMB === 'number' ? opts.thresholdMB : (parseInt(process.env.NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB || '60', 10) || 60)
  const thresholdBytes = thresholdMB * 1024 * 1024

  // 小文件/单请求优先；若失败（如413）自动回退到分片
  if (file.size <= thresholdBytes) {
    try {
      opts.onEvent?.({ type: 'started', strategy: 'SINGLE', resumed: false, totalParts: 1, partSize: file.size, totalBytes: file.size })
      const res = await smallUpload(file, projectId, storageConfigId || null)
      opts.onEvent?.({ type: 'complete' })
      return res
    } catch (e) {
      // 回退到分片
      console.warn('小文件直传失败，回退到分片上传：', e)
    }
  }
  const { meta, uploaded, fp, resumed } = await createOrResumeSession(file, projectId, storageConfigId || null)
  opts.onEvent?.({ type: 'started', strategy: meta.strategy === 'S3_MULTIPART' ? 'S3_MULTIPART' : 'SERVER_CHUNK', resumed, totalParts: meta.totalParts, partSize: meta.partSize, totalBytes: file.size })
  const chunkSize: number = meta.partSize
  const totalParts: number = meta.totalParts

  if (meta.strategy === 'S3_MULTIPART') {
    const uploadedParts: { PartNumber: number; ETag: string }[] = []
    // 已存在的 parts（如断点续传）
    try {
      const status = await fetch(`/api/uploads/s3/status?uploadId=${encodeURIComponent(meta.uploadId)}`)
      if (status.ok) {
        const j = await status.json()
        for (const p of j.data.uploaded || []) uploadedParts.push({ PartNumber: p.PartNumber, ETag: p.ETag })
        if ((j.data.uploaded || []).length > 0) {
          const uploadedBytes = Math.min((j.data.uploaded || []).length * chunkSize, file.size)
          opts.onEvent?.({ type: 'resumed', uploadedParts: (j.data.uploaded || []).length, uploadedBytes })
        }
      }
    } catch {}

    let uploadedBytes = uploadedParts.length * chunkSize
    for (let i = 0; i < totalParts; i++) {
      if (uploadedParts.find(p => p.PartNumber === i+1)) { if (onProgress) onProgress({ uploadedBytes: Math.min(uploadedBytes, file.size), totalBytes: file.size, uploadedParts: i+1, totalParts }); continue }
      const start = i * chunkSize
      const end = Math.min(file.size, start + chunkSize)
      const blob = file.slice(start, end)
      const pre = await fetch(`/api/uploads/s3/presign-part?uploadId=${encodeURIComponent(meta.uploadId)}&partNumber=${i+1}`)
      if (!pre.ok) throw new Error('presign failed')
      const url = (await pre.json()).data.url
      const resp = await fetch(url, { method: 'PUT', body: blob })
      if (!resp.ok) throw new Error(`upload part ${i+1} failed`)
      const etag = resp.headers.get('ETag') || resp.headers.get('etag') || ''
      uploadedParts.push({ PartNumber: i+1, ETag: etag.replace(/\"/g,'') })
      uploadedBytes = Math.min(end, file.size)
      if (onProgress) onProgress({ uploadedBytes, totalBytes: file.size, uploadedParts: i+1, totalParts })
      opts.onEvent?.({ type: 'part-complete', partNumber: i+1, uploadedBytes, totalBytes: file.size })
    }
    // 完成合并
    const comp = await fetch('/api/uploads/s3/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: meta.uploadId, parts: uploadedParts }) })
    if (!comp.ok) throw new Error('complete failed')
    const res = (await comp.json()).data
    localStorage.removeItem('upload:'+fp)
    opts.onEvent?.({ type: 'complete' })
    return res as UploadResult
  }

  // 服务器端分片合并：LOCAL / WEBDAV / OSS
  // 查询已上传分片
  const uploadedSet = new Set<number>(uploaded)
  if (uploadedSet.size > 0) {
    const uploadedBytes = Math.min(uploadedSet.size * chunkSize, file.size)
    opts.onEvent?.({ type: 'resumed', uploadedParts: uploadedSet.size, uploadedBytes })
  }
  let uploadedBytes = uploadedSet.size * chunkSize
  for (let i = 0; i < totalParts; i++) {
    if (uploadedSet.has(i)) { if (onProgress) onProgress({ uploadedBytes: Math.min(uploadedBytes, file.size), totalBytes: file.size, uploadedParts: i+1, totalParts }); continue }
    const start = i * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    const blob = file.slice(start, end)
    const resp = await fetch(`/api/uploads/chunk?uploadId=${encodeURIComponent(meta.uploadId)}&index=${i}`, { method: 'POST', body: blob })
    if (!resp.ok) throw new Error(`upload chunk ${i} failed`)
    uploadedBytes = Math.min(end, file.size)
    if (onProgress) onProgress({ uploadedBytes, totalBytes: file.size, uploadedParts: i+1, totalParts })
    opts.onEvent?.({ type: 'part-complete', partNumber: i+1, uploadedBytes, totalBytes: file.size })
  }
  const comp = await fetch('/api/uploads/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: meta.uploadId }) })
  if (!comp.ok) throw new Error('complete failed')
  const res = (await comp.json()).data
  localStorage.removeItem('upload:'+fp)
  opts.onEvent?.({ type: 'complete' })
  return res as UploadResult
}

// 控制型上传：返回控制器，可暂停/继续/取消
export function startResumableUpload(opts: Options) {
  let paused = false
  let canceled = false
  let inFlight: AbortController | null = null
  let resumeResolver: (() => void) | null = null
  let currentUploadId: string | null = null
  let currentStrategy: 'S3_MULTIPART' | 'SERVER_CHUNK' | 'SINGLE' | null = null
  const fp = fingerprint(opts.file, opts.projectId, opts.storageConfigId || null)
  const ttlHours = parseInt(process.env.NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS || '72', 10) || 72
  const TTL = ttlHours * 3600 * 1000

  const waitIfPaused = () => new Promise<void>((resolve) => {
    if (!paused) return resolve()
    resumeResolver = resolve
  })
  const setPaused = (v: boolean) => { paused = v; if (!paused && resumeResolver) { const r = resumeResolver; resumeResolver = null; r() } }

  // 重试/退避策略与工具
  const retryCfg = {
    maxRetries: Math.max(0, opts.retry?.maxRetries ?? 5),
    baseDelayMs: Math.max(50, opts.retry?.baseDelayMs ?? 500),
    factor: Math.max(1.1, opts.retry?.factor ?? 2),
    maxDelayMs: Math.max(500, opts.retry?.maxDelayMs ?? 15000)
  }
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))
  const withBackoff = async (fn: () => Promise<Response>, target: 'part'|'chunk'|'presign') => {
    let attempt = 0
    let lastErr: any = null
    while (true) {
      if (canceled) throw new DOMException('aborted','AbortError')
      try {
        const resp = await fn()
        if (resp.ok) return resp
        lastErr = new Error(`HTTP ${resp.status}`)
      } catch (e:any) {
        if (e?.name === 'AbortError') {
          // 如果是暂停触发的中断，则等待继续后重试；取消则直接抛出
          if (canceled) throw e
          if (paused) { await waitIfPaused(); continue }
          throw e
        }
        lastErr = e
      }
      if (attempt >= retryCfg.maxRetries) throw lastErr
      const delay = Math.min(retryCfg.maxDelayMs, Math.floor(retryCfg.baseDelayMs * Math.pow(retryCfg.factor, attempt))) + Math.floor(Math.random()*250)
      attempt++
      opts.onEvent?.({ type: 'retry', attempt, delayMs: delay, target })
      await sleep(delay)
      await waitIfPaused()
    }
  }

  const promise = (async () => {
    const { file, projectId, storageConfigId } = opts
    const thresholdMB = typeof opts.thresholdMB === 'number' ? opts.thresholdMB : (parseInt(process.env.NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB || '60', 10) || 60)
    const thresholdBytes = thresholdMB * 1024 * 1024

    // 小文件优先：S3 单次直传
    if (file.size <= thresholdBytes) {
      try {
        opts.onEvent?.({ type: 'started', strategy: 'SINGLE', resumed: false, totalParts: 1, partSize: file.size, totalBytes: file.size })
        currentStrategy = 'SINGLE'
        const init = await fetch('/api/uploads/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, fileName: file.name, fileSize: file.size, contentType: file.type, storageConfigId: storageConfigId || null, preferSingle: true }) })
        if (init.ok) {
          const metaResp = await init.json(); const meta = metaResp.data; currentUploadId = meta.uploadId
          if (meta.strategy === 'S3_SINGLE') {
            const pre = await withBackoff(() => fetch(`/api/uploads/s3/presign-single?uploadId=${encodeURIComponent(meta.uploadId)}`), 'presign')
            const url = (await pre.json()).data.url
            await waitIfPaused(); if (canceled) throw new DOMException('aborted','AbortError')
            const ctrl = new AbortController(); inFlight = ctrl
            const put = await withBackoff(() => fetch(url, { method: 'PUT', body: file, signal: ctrl.signal }), 'part')
            if (!put.ok) throw new Error('single put failed')
            const etag = put.headers.get('ETag') || put.headers.get('etag') || ''
            const fin = await fetch('/api/uploads/s3/complete-single', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: meta.uploadId, etag }) })
            if (!fin.ok) throw new Error('complete single failed')
            opts.onEvent?.({ type: 'complete' })
            return (await fin.json()).data as UploadResult
          }
        }
      } catch (e) {
        if ((e as any)?.name === 'AbortError') throw e
        // 回退到表单直传
        const fd = new FormData(); fd.append('file', file); fd.append('projectId', projectId); if (storageConfigId) fd.append('storageConfigId', storageConfigId)
        const ctrl = new AbortController(); inFlight = ctrl
        const resp = await fetch('/api/upload', { method: 'POST', body: fd, signal: ctrl.signal })
        if (!resp.ok) throw new Error('文件上传失败')
        opts.onEvent?.({ type: 'complete' })
        return (await resp.json()).data as UploadResult
      }
    }

    // 分片/多段直传
    // 先尝试使用本地会话（在有效期内）
    let initMeta: any | null = null
    try {
      const raw = localStorage.getItem('upload:'+fp)
      if (raw) {
        const meta = JSON.parse(raw)
        const storedAt = typeof meta.storedAt === 'number' ? meta.storedAt : 0
        const expiresAt = typeof meta.expiresAt === 'number' ? meta.expiresAt : (storedAt ? storedAt + TTL : 0)
        if (!expiresAt || Date.now() <= expiresAt) initMeta = meta
        else localStorage.removeItem('upload:'+fp)
      }
    } catch {}
    if (initMeta) {
      try {
        const ch = await fetch(`/api/uploads/status?uploadId=${encodeURIComponent(initMeta.uploadId)}`)
        if (!ch.ok) { try { localStorage.removeItem('upload:'+fp) } catch {}; initMeta = null }
      } catch { try { localStorage.removeItem('upload:'+fp) } catch {}; initMeta = null }
    }
    if (!initMeta) {
      const initResp = await fetch('/api/uploads/initiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, fileName: file.name, fileSize: file.size, contentType: file.type, storageConfigId: storageConfigId || null }) });
      if (!initResp.ok) throw new Error('initiate failed')
      initMeta = (await initResp.json()).data
      try { const now = Date.now(); initMeta.storedAt = now; initMeta.expiresAt = now + TTL; localStorage.setItem('upload:'+fp, JSON.stringify(initMeta)) } catch {}
    }
    currentUploadId = initMeta.uploadId
    currentStrategy = initMeta.strategy === 'S3_MULTIPART' ? 'S3_MULTIPART' : 'SERVER_CHUNK'
    opts.onEvent?.({ type: 'started', strategy: currentStrategy, resumed: false, totalParts: initMeta.totalParts, partSize: initMeta.partSize, totalBytes: file.size })
    const chunkSize: number = initMeta.partSize
    const totalParts: number = initMeta.totalParts

    if (currentStrategy === 'S3_MULTIPART') {
      let uploadedParts: { PartNumber: number; ETag: string }[] = []
      try { const st = await fetch(`/api/uploads/s3/status?uploadId=${encodeURIComponent(initMeta.uploadId)}`); if (st.ok) { const j = await st.json(); uploadedParts = (j.data.uploaded || []).map((p:any)=>({ PartNumber: p.PartNumber, ETag: p.ETag })); if (uploadedParts.length>0) opts.onEvent?.({ type: 'resumed', uploadedParts: uploadedParts.length, uploadedBytes: Math.min(uploadedParts.length * chunkSize, file.size) }) } } catch {}
      let uploadedBytes = uploadedParts.length * chunkSize
      for (let i=0;i<totalParts;i++) {
        if (uploadedParts.find(p=>p.PartNumber===i+1)) { opts.onProgress?.({ uploadedBytes: Math.min(uploadedBytes, file.size), totalBytes: file.size, uploadedParts: i+1, totalParts }); continue }
        await waitIfPaused(); if (canceled) throw new DOMException('aborted','AbortError')
        const start = i*chunkSize, end = Math.min(file.size, start+chunkSize)
        const blob = file.slice(start, end)
        const pre = await withBackoff(() => fetch(`/api/uploads/s3/presign-part?uploadId=${encodeURIComponent(initMeta.uploadId)}&partNumber=${i+1}`), 'presign')
        const url = (await pre.json()).data.url
        const ctrl = new AbortController(); inFlight = ctrl
        const resp = await withBackoff(() => fetch(url, { method: 'PUT', body: blob, signal: ctrl.signal }), 'part')
        if (!resp.ok) throw new Error(`upload part ${i+1} failed`)
        const etag = resp.headers.get('ETag') || resp.headers.get('etag') || ''
        uploadedParts.push({ PartNumber: i+1, ETag: etag.replace(/\"/g,'') })
        uploadedBytes = Math.min(end, file.size)
        opts.onProgress?.({ uploadedBytes, totalBytes: file.size, uploadedParts: i+1, totalParts })
        opts.onEvent?.({ type: 'part-complete', partNumber: i+1, uploadedBytes, totalBytes: file.size })
      }
      const comp = await fetch('/api/uploads/s3/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: initMeta.uploadId, parts: uploadedParts }) })
      if (!comp.ok) throw new Error('complete failed')
      opts.onEvent?.({ type: 'complete' })
      try { localStorage.removeItem('upload:'+fp) } catch {}
      return (await comp.json()).data as UploadResult
    }

    // SERVER_CHUNK
    let uploaded = [] as number[]
    try { const st = await fetch(`/api/uploads/status?uploadId=${encodeURIComponent(initMeta.uploadId)}`); if (st.ok) { const j = await st.json(); uploaded = j.data.uploaded || [] } } catch {}
    if (uploaded.length>0) opts.onEvent?.({ type: 'resumed', uploadedParts: uploaded.length, uploadedBytes: Math.min(uploaded.length * chunkSize, file.size) })
    const uploadedSet = new Set<number>(uploaded)
    let uploadedBytes = uploadedSet.size * chunkSize
    for (let i=0;i<totalParts;i++) {
      if (uploadedSet.has(i)) { opts.onProgress?.({ uploadedBytes: Math.min(uploadedBytes, file.size), totalBytes: file.size, uploadedParts: i+1, totalParts }); continue }
      await waitIfPaused(); if (canceled) throw new DOMException('aborted','AbortError')
      const start = i*chunkSize, end = Math.min(file.size, start+chunkSize)
      const blob = file.slice(start, end)
      const ctrl = new AbortController(); inFlight = ctrl
      const resp = await withBackoff(() => fetch(`/api/uploads/chunk?uploadId=${encodeURIComponent(initMeta.uploadId)}&index=${i}`, { method: 'POST', body: blob, signal: ctrl.signal }), 'chunk')
      if (!resp.ok) throw new Error(`upload chunk ${i} failed`)
      uploadedBytes = Math.min(end, file.size)
      opts.onProgress?.({ uploadedBytes, totalBytes: file.size, uploadedParts: i+1, totalParts })
      opts.onEvent?.({ type: 'part-complete', partNumber: i+1, uploadedBytes, totalBytes: file.size })
    }
    const comp = await fetch('/api/uploads/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: initMeta.uploadId }) })
    if (!comp.ok) throw new Error('complete failed')
    opts.onEvent?.({ type: 'complete' })
    try { localStorage.removeItem('upload:'+fp) } catch {}
    return (await comp.json()).data as UploadResult
  })()

  return {
    promise,
    cancel: async () => {
      canceled = true
      if (inFlight) inFlight.abort()
      try {
        if (currentStrategy === 'S3_MULTIPART' && currentUploadId) {
          await fetch('/api/uploads/s3/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: currentUploadId }) })
        } else if (currentUploadId) {
          await fetch('/api/uploads/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadId: currentUploadId }) })
        }
      } catch {}
      // 手动取消：删除本地断点续传记录
      try { localStorage.removeItem('upload:'+fp) } catch {}
    }
  }
}

export function listPendingUploadSessions(): Array<{ key: string; meta: any }> {
  const items: Array<{ key: string; meta: any }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || ''
      if (k.startsWith('upload:')) {
        try { const meta = JSON.parse(localStorage.getItem(k) || '{}');
          const ttlHours = parseInt(process.env.NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS || '72', 10) || 72
          const TTL = ttlHours * 3600 * 1000
          const storedAt = typeof meta.storedAt === 'number' ? meta.storedAt : 0
          const expiresAt = typeof meta.expiresAt === 'number' ? meta.expiresAt : (storedAt ? storedAt + TTL : 0)
          if (expiresAt && Date.now() > expiresAt) { try { localStorage.removeItem(k) } catch {} ; continue }
          if (meta?.uploadId) items.push({ key: k, meta })
        } catch {}
      }
    }
  } catch {}
  return items
}

export function checkPendingForFile(file: File, projectId: string, storageConfigId?: string | null) {
  try { const fp = `${projectId}:${storageConfigId || 'local'}:${file.name}:${file.size}:${file.lastModified}`; const raw = localStorage.getItem('upload:'+fp); if (!raw) return false; const meta = JSON.parse(raw); const ttlHours = parseInt(process.env.NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS || '72', 10) || 72; const TTL = ttlHours * 3600 * 1000; const storedAt = typeof meta.storedAt === 'number' ? meta.storedAt : 0; const expiresAt = typeof meta.expiresAt === 'number' ? meta.expiresAt : (storedAt ? storedAt + TTL : 0); if (expiresAt && Date.now() > expiresAt) { try { localStorage.removeItem('upload:'+fp) } catch {}; return false } ; return true } catch { return false }
}

export function listPendingSessionsByProject(projectId: string) {
  return listPendingUploadSessions().filter(x => x.meta?.projectId === projectId)
}

export function removePendingUploadSession(key: string) {
  try { localStorage.removeItem(key) } catch {}
}
