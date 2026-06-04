import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'

const DEFAULT_BASE_URL = 'https://pc.woozooo.com'
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export interface LanzouConfig {
  cookie?: string
  folderId?: string | number
  baseUrl?: string
  uploadPath?: string
  userAgent?: string
  sharePassword?: string
  resolverEndpoint?: string
  timeoutMs?: number
}

export interface LanzouUploadFile {
  id: string
  f_id?: string
  name_all?: string
  name?: string
  size?: string
  is_newd?: string
}

export interface LanzouShareFile {
  pwd?: string
  onof?: string
  f_id?: string
  is_newd?: string
}

interface LanzouResponse<Info = unknown, Text = unknown> {
  zt: number | null
  info: Info
  text: Text
}

interface MultipartFile {
  fieldName: string
  fileName: string
  contentType: string
  buffer?: Buffer
  filePath?: string
}

export class LanzouClient {
  private readonly config: Required<Pick<LanzouConfig, 'baseUrl' | 'uploadPath' | 'userAgent' | 'timeoutMs'>> & LanzouConfig

  constructor(config: LanzouConfig) {
    this.config = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
      uploadPath: config.uploadPath?.trim() || 'html5up.php',
      userAgent: config.userAgent?.trim() || DEFAULT_USER_AGENT,
      timeoutMs: clampTimeout(config.timeoutMs),
    }
  }

  async uploadFile(params: {
    folderId?: string | number
    fileName: string
    contentType?: string
    buffer?: Buffer
    filePath?: string
  }): Promise<LanzouUploadFile> {
    this.assertCookie()
    if (!params.buffer && !params.filePath) {
      throw new Error('LANZOU upload requires buffer or filePath')
    }

    const { body, contentType, contentLength } = await createMultipartBody(
      {
        task: '1',
        vie: '2',
        ve: '2',
        id: 'WU_FILE_0',
        name: params.fileName,
        folder_id_bb_n: String(params.folderId ?? this.config.folderId ?? -1),
      },
      {
        fieldName: 'upload_file',
        fileName: params.fileName,
        contentType: params.contentType || 'application/octet-stream',
        buffer: params.buffer,
        filePath: params.filePath,
      },
    )

    const resp = await this.requestJson<LanzouResponse<string, LanzouUploadFile[]>>(
      buildUrl(this.config.baseUrl, this.config.uploadPath),
      {
        method: 'POST',
        headers: {
          Cookie: this.config.cookie!.trim(),
          'User-Agent': this.config.userAgent,
          Referer: this.config.baseUrl,
          'Content-Type': contentType,
          'Content-Length': String(contentLength),
        },
        body: body as any,
        duplex: 'half',
      },
    )

    if (resp.zt !== 1 || !Array.isArray(resp.text) || !resp.text[0]?.id) {
      throw new Error(`LANZOU upload failed: ${formatLanzouError(resp)}`)
    }
    return resp.text[0]
  }

  async deleteFile(fileId: string): Promise<boolean> {
    this.assertCookie()
    const resp = await this.postDoupload<LanzouResponse<string, null>>({
      task: '6',
      file_id: fileId,
    })
    return resp.zt === 1
  }

  async shareFile(fileId: string): Promise<LanzouShareFile> {
    this.assertCookie()
    const resp = await this.postDoupload<LanzouResponse<LanzouShareFile, null>>({
      task: '22',
      file_id: fileId,
    })
    if (resp.zt !== 1 || !resp.info) {
      throw new Error(`LANZOU share lookup failed: ${formatLanzouError(resp)}`)
    }
    return resp.info
  }

  async setFilePassword(fileId: string, password: string): Promise<void> {
    this.assertCookie()
    const normalized = password.trim()
    if (normalized.length < 2 || normalized.length > 6) {
      throw new Error('蓝奏云文件提取码长度必须为 2-6 位')
    }
    const resp = await this.postDoupload<LanzouResponse<string, number | null>>({
      task: '23',
      file_id: fileId,
      shows: '1',
      shownames: normalized,
    })
    if (resp.zt !== 1) {
      throw new Error(`LANZOU password update failed: ${formatLanzouError(resp)}`)
    }
  }

  buildShareUrl(file: Pick<LanzouUploadFile, 'is_newd' | 'f_id'> | LanzouShareFile): string | null {
    if (!file.is_newd || !file.f_id) return null
    return `${String(file.is_newd).replace(/\/$/, '')}/${file.f_id}`
  }

  private async postDoupload<T>(body: Record<string, string>): Promise<T> {
    return this.requestJson<T>(buildUrl(this.config.baseUrl, 'doupload.php'), {
      method: 'POST',
      headers: {
        Cookie: this.config.cookie!.trim(),
        'User-Agent': this.config.userAgent,
        Referer: this.config.baseUrl,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams(body).toString(),
    })
  }

  private async requestJson<T>(url: string, init: RequestInit & { duplex?: 'half' }): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      try {
        return JSON.parse(text) as T
      } catch {
        throw new Error(`invalid JSON response: ${text.slice(0, 200)}`)
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private assertCookie() {
    if (!this.config.cookie?.trim()) {
      throw new Error('LANZOU cookie is required')
    }
  }
}

export async function resolveLanzouDownloadUrl(shareUrl: string, config: LanzouConfig): Promise<string> {
  const endpoint = config.resolverEndpoint?.trim()
  if (!endpoint) {
    throw new Error('LANZOU resolverEndpoint is required')
  }
  const url = new URL(endpoint)
  url.searchParams.set('url', shareUrl)
  const password = config.sharePassword?.trim()
  if (password) url.searchParams.set('pwd', password)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), clampTimeout(config.timeoutMs))
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': config.userAgent?.trim() || DEFAULT_USER_AGENT,
      },
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`LANZOU resolver HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = JSON.parse(text) as { code?: number; msg?: string; downUrl?: string }
    if (data.code !== 200 || !data.downUrl) {
      throw new Error(data.msg || 'LANZOU resolver did not return downUrl')
    }
    return data.downUrl
  } finally {
    clearTimeout(timer)
  }
}

function normalizeBaseUrl(value?: string) {
  return (value?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function buildUrl(baseUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${baseUrl}/${pathOrUrl.replace(/^\/+/, '')}`
}

function clampTimeout(value?: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 30000
  return Math.max(3000, Math.min(Math.floor(parsed), 120000))
}

function formatLanzouError(resp: LanzouResponse) {
  const message = typeof resp.info === 'string' ? resp.info : typeof resp.text === 'string' ? resp.text : ''
  return message || JSON.stringify(resp).slice(0, 200)
}

async function createMultipartBody(fields: Record<string, string>, file: MultipartFile) {
  const boundary = `----hot-update-lanzou-${crypto.randomBytes(12).toString('hex')}`
  const fieldBuffers = Object.entries(fields).map(([name, value]) =>
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${escapeHeaderValue(name)}"\r\n\r\n${value}\r\n`),
  )
  const fileHeader = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${escapeHeaderValue(file.fieldName)}"; filename="${escapeHeaderValue(file.fileName)}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`,
  )
  const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`)
  const prefix = Buffer.concat([...fieldBuffers, fileHeader])

  if (file.buffer) {
    const contentLength = prefix.length + file.buffer.length + fileFooter.length
    return {
      body: Readable.from([prefix, file.buffer, fileFooter]),
      contentType: `multipart/form-data; boundary=${boundary}`,
      contentLength,
    }
  }

  if (!file.filePath) {
    throw new Error('multipart file requires buffer or filePath')
  }

  const fileSize = (await stat(file.filePath)).size
  const contentLength = prefix.length + fileSize + fileFooter.length
  const body = Readable.from((async function* () {
    yield prefix
    for await (const chunk of createReadStream(file.filePath!)) {
      yield chunk
    }
    yield fileFooter
  })())

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    contentLength,
  }
}

function escapeHeaderValue(value: string) {
  return value.replace(/[\r\n"]/g, '_')
}
