import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import tls from 'node:tls'
import { hasLanzouAllProxy, hasLanzouResolveProxy } from './config'

const DEFAULT_BASE_URL = 'https://pc.woozooo.com'
const DEFAULT_SHARE_BASE_URL = 'https://www.lanzouf.com'
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const MAX_PROXY_REDIRECTS = 5

export interface LanzouConfig {
  cookie?: string
  folderId?: string | number
  baseUrl?: string
  shareBaseUrl?: string
  uploadPath?: string
  userAgent?: string
  sharePassword?: string
  resolverEndpoint?: string
  proxyUrl?: string
  proxyMode?: 'off' | 'all' | 'resolve' | string
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

interface LanzouProcessResponse {
  zt?: number
  inf?: string
  dom?: string
  url?: string
}

interface MultipartFile {
  fieldName: string
  fileName: string
  contentType: string
  buffer?: Buffer
  filePath?: string
}

interface LanzouTextResponse {
  ok: boolean
  status: number
  headers: Record<string, string>
  text: string
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
    return this.requestJson<T>(
      buildUrl(this.config.baseUrl, 'doupload.php'),
      {
        method: 'POST',
        headers: {
          Cookie: this.config.cookie!.trim(),
          'User-Agent': this.config.userAgent,
          Referer: this.config.baseUrl,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams(body).toString(),
      },
      { allowProxy: hasLanzouAllProxy(this.config) },
    )
  }

  private async requestJson<T>(url: string, init: RequestInit & { duplex?: 'half' }, options: { allowProxy?: boolean } = {}): Promise<T> {
    const text = await fetchTextWithTimeout(url, this.config, init, options)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`invalid JSON response: ${text.slice(0, 200)}`)
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
  if (endpoint) {
    return resolveLanzouDownloadUrlByEndpoint(shareUrl, config, endpoint)
  }
  return resolveLanzouDownloadUrlEmbedded(shareUrl, config)
}

async function resolveLanzouDownloadUrlByEndpoint(shareUrl: string, config: LanzouConfig, endpoint: string): Promise<string> {
  const url = new URL(endpoint)
  url.searchParams.set('url', shareUrl)
  const password = config.sharePassword?.trim()
  if (password) url.searchParams.set('pwd', password)

  const text = await fetchTextWithTimeout(
    url.toString(),
    config,
    {
      headers: {
        'User-Agent': config.userAgent?.trim() || DEFAULT_USER_AGENT,
      },
    },
    { allowProxy: true },
  )
  const data = JSON.parse(text) as { code?: number; msg?: string; downUrl?: string }
  if (data.code !== 200 || !data.downUrl) {
    throw new Error(data.msg || 'LANZOU resolver did not return downUrl')
  }
  return data.downUrl
}

async function resolveLanzouDownloadUrlEmbedded(shareUrl: string, config: LanzouConfig): Promise<string> {
  const parsed = new URL(shareUrl)
  const shareBaseUrl = normalizeShareBaseUrl(config.shareBaseUrl)
  const sharePageUrl = `${shareBaseUrl}${parsed.pathname}${parsed.search}`
  const password = config.sharePassword?.trim() || ''
  let pageHtml = await fetchLanzouHtml(sharePageUrl, config)

  if (pageHtml.includes('文件取消分享') || pageHtml.includes('取消分享')) {
    throw new Error('蓝奏云文件已取消分享')
  }
  if (pageHtml.includes('文件不存在')) {
    throw new Error('蓝奏云文件不存在')
  }

  let processResponse: LanzouProcessResponse
  let directReferer = sharePageUrl

  if (requiresSharePassword(pageHtml)) {
    if (!password) {
      throw new Error('蓝奏云分享链接需要提取码，请在 LANZOU 配置中设置 sharePassword')
    }

    const functionBody = extractFunctionBody(pageHtml, 'down_p') || pageHtml
    const fileId = extractAjaxFileId(functionBody)
    const signCandidates = extractAll(functionBody, /'sign'\s*:\s*'([^']*)'/g)
    const form = {
      action: 'downprocess',
      sign: signCandidates[1] || signCandidates[0] || extractQuotedValue(functionBody, 'sign'),
      p: password,
      kd: '1',
    }
    processResponse = await postLanzouProcess(`${shareBaseUrl}/ajaxm.php?file=${fileId}`, form, sharePageUrl, config)
  } else {
    const iframePath = matchFirst(pageHtml, /<iframe[^>]*src=["']([^"']+)["']/i)
    if (!iframePath) {
      throw new Error('蓝奏云解析失败：未找到下载页面')
    }
    const iframeUrl = new URL(iframePath, shareBaseUrl).toString()
    directReferer = iframeUrl
    pageHtml = await fetchLanzouHtml(iframeUrl, config)

    const fileId = extractAjaxFileId(pageHtml)
    const ajaxData = matchFirst(pageHtml, /ajaxdata\s*=\s*'([^']*)'/)
    const form = parseLanzouScriptParams(pageHtml)
    if (!form.action) form.action = 'downprocess'
    if (!form.websignkey) form.websignkey = ajaxData || ''
    if (!form.signs) form.signs = ajaxData || form.websignkey || ''
    if (!form.websign) form.websign = ''
    if (!form.kd) form.kd = '1'
    if (!form.ves) form.ves = '1'

    processResponse = await postLanzouProcess(`${shareBaseUrl}/ajaxm.php?file=${fileId}`, form, iframeUrl, config)
  }

  if (processResponse.zt !== 1 || !processResponse.dom || !processResponse.url) {
    throw new Error(processResponse.inf || '蓝奏云解析失败：未返回下载地址')
  }

  const baseUrl = `${processResponse.dom.replace(/\/$/, '')}/file`
  const intermediateUrl = `${baseUrl}/${processResponse.url}`
  const redirectedUrl = await resolveLanzouRedirect(intermediateUrl, directReferer || baseUrl, config)
  return stripLanzouPid(redirectedUrl || intermediateUrl)
}

async function postLanzouProcess(url: string, form: Record<string, string>, referer: string, config: LanzouConfig): Promise<LanzouProcessResponse> {
  const text = await fetchTextWithTimeout(
    url,
    config,
    {
      method: 'POST',
      headers: {
        'User-Agent': config.userAgent?.trim() || DEFAULT_USER_AGENT,
        Referer: referer,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams(form).toString(),
    },
    { allowProxy: true },
  )
  return JSON.parse(text) as LanzouProcessResponse
}

async function resolveLanzouRedirect(url: string, referer: string, config: LanzouConfig) {
  const res = await requestTextWithTimeout(url, config, {
    redirect: 'manual',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Cookie: 'down_ip=1',
      Referer: referer,
      'User-Agent': config.userAgent?.trim() || DEFAULT_USER_AGENT,
    },
  }, { allowProxy: true })
  const location = res.headers.location
  return location ? new URL(location, url).toString() : url
}

async function fetchLanzouHtml(url: string, config: LanzouConfig) {
  let acwCookie = ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const html = await fetchTextWithTimeout(
      url,
      config,
      {
        headers: {
          ...(acwCookie ? { Cookie: `acw_sc__v2=${acwCookie}` } : {}),
          'User-Agent': config.userAgent?.trim() || DEFAULT_USER_AGENT,
        },
      },
      { allowProxy: true },
    )
    const nextCookie = extractAcwScV2Cookie(html)
    if (nextCookie) {
      acwCookie = nextCookie
      continue
    }
    return html
  }
  throw new Error('蓝奏云触发 acw_sc__v2 验证，内置解析未通过')
}

async function fetchTextWithTimeout(
  url: string,
  config: LanzouConfig,
  init: RequestInit & { duplex?: 'half' } = {},
  options: { allowProxy?: boolean } = {},
) {
  const response = await requestTextWithTimeout(url, config, init, options)
  if (!response.ok) {
    throw new Error(`LANZOU HTTP ${response.status}: ${response.text.slice(0, 200)}`)
  }
  return response.text
}

async function requestTextWithTimeout(
  url: string,
  config: LanzouConfig,
  init: RequestInit & { duplex?: 'half' } = {},
  options: { allowProxy?: boolean } = {},
): Promise<LanzouTextResponse> {
  if (options.allowProxy && hasLanzouResolveProxy(config)) {
    return requestTextViaHttpProxy(url, config, init)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), clampTimeout(config.timeoutMs))
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      headers: headersToRecord(res.headers),
      text,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function requestTextViaHttpProxy(
  url: string,
  config: LanzouConfig,
  init: RequestInit & { duplex?: 'half' },
  redirectCount = 0,
): Promise<LanzouTextResponse> {
  const proxyUrl = config.proxyUrl?.trim()
  if (!proxyUrl) throw new Error('LANZOU proxyUrl is required')
  const proxy = new URL(proxyUrl)
  if (proxy.protocol !== 'http:') {
    throw new Error('LANZOU proxyUrl 当前仅支持 http:// 代理')
  }

  const target = new URL(url)
  const method = init.method || 'GET'
  const headers = headersInitToRecord(init.headers)
  const body = bodyInitToString(init.body)
  if (body && !headers['Content-Length'] && !headers['content-length']) {
    headers['Content-Length'] = String(Buffer.byteLength(body))
  }

  let response: LanzouTextResponse
  if (target.protocol === 'https:') {
    response = await requestHttpsViaHttpProxy(target, proxy, method, headers, body, clampTimeout(config.timeoutMs))
  } else if (target.protocol === 'http:') {
    response = await requestHttpViaHttpProxy(target, proxy, method, headers, body, clampTimeout(config.timeoutMs))
  } else {
    throw new Error(`LANZOU proxy does not support protocol: ${target.protocol}`)
  }

  const location = response.headers.location
  if (shouldFollowRedirect(init, response, location)) {
    if (redirectCount >= MAX_PROXY_REDIRECTS) throw new Error('LANZOU proxy redirect limit exceeded')
    const redirectedUrl = new URL(location!, url).toString()
    return requestTextViaHttpProxy(redirectedUrl, config, buildRedirectInit(init, response.status, method), redirectCount + 1)
  }
  return response
}

function requestHttpViaHttpProxy(target: URL, proxy: URL, method: string, headers: Record<string, string>, body: string | undefined, timeoutMs: number) {
  return new Promise<LanzouTextResponse>((resolve, reject) => {
    const req = http.request(
      {
        host: proxy.hostname,
        port: Number(proxy.port || 80),
        method,
        path: target.toString(),
        headers: { ...proxyHeaders(proxy), ...headers, Host: target.host },
        timeout: timeoutMs,
      },
      (res) => collectNodeResponse(res, resolve),
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('LANZOU proxy request timeout')))
    if (body) req.write(body)
    req.end()
  })
}

function requestHttpsViaHttpProxy(target: URL, proxy: URL, method: string, headers: Record<string, string>, body: string | undefined, timeoutMs: number) {
  return new Promise<LanzouTextResponse>((resolve, reject) => {
    const connectReq = http.request({
      host: proxy.hostname,
      port: Number(proxy.port || 80),
      method: 'CONNECT',
      path: `${target.hostname}:${target.port || 443}`,
      headers: proxyHeaders(proxy),
      timeout: timeoutMs,
    })

    connectReq.on('connect', (connectRes, socket) => {
      if (connectRes.statusCode !== 200) {
        socket.destroy()
        reject(new Error(`LANZOU proxy CONNECT failed: ${connectRes.statusCode}`))
        return
      }

      const secureSocket = tls.connect({ socket, servername: target.hostname })
      secureSocket.once('secureConnect', () => {
        const req = https.request(
          {
            host: target.hostname,
            port: Number(target.port || 443),
            method,
            path: `${target.pathname}${target.search}`,
            headers: { ...headers, Host: target.host },
            createConnection: () => secureSocket,
            timeout: timeoutMs,
          },
          (res) => collectNodeResponse(res, resolve),
        )
        req.on('error', reject)
        req.on('timeout', () => req.destroy(new Error('LANZOU proxy request timeout')))
        if (body) req.write(body)
        req.end()
      })
      secureSocket.on('error', reject)
    })
    connectReq.on('error', reject)
    connectReq.on('timeout', () => connectReq.destroy(new Error('LANZOU proxy CONNECT timeout')))
    connectReq.end()
  })
}

function collectNodeResponse(
  res: http.IncomingMessage,
  resolve: (value: LanzouTextResponse) => void,
) {
  const chunks: Buffer[] = []
  res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  res.on('end', () => {
    const status = res.statusCode || 0
    resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: nodeHeadersToRecord(res.headers),
      text: Buffer.concat(chunks).toString('utf-8'),
    })
  })
}

function headersInitToRecord(headers?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {}
  if (!headers) return record
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => {
      record[key] = value
    })
    return record
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      record[key] = value
    }
    return record
  }
  for (const [key, value] of Object.entries(headers)) {
    record[key] = String(value)
  }
  return record
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value
  })
  return record
}

function nodeHeadersToRecord(headers: http.IncomingHttpHeaders): Record<string, string> {
  const record: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') record[key.toLowerCase()] = value
    else if (Array.isArray(value)) record[key.toLowerCase()] = value.join(', ')
  }
  return record
}

function bodyInitToString(body: BodyInit | null | undefined) {
  if (!body) return undefined
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  throw new Error('LANZOU proxy request body only supports string or URLSearchParams')
}

function shouldFollowRedirect(init: RequestInit, response: LanzouTextResponse, location?: string) {
  if (!location || response.status < 300 || response.status >= 400) return false
  if (init.redirect === 'manual') return false
  if (init.redirect === 'error') throw new Error(`LANZOU proxy redirect blocked: ${response.status}`)
  return true
}

function buildRedirectInit(init: RequestInit & { duplex?: 'half' }, status: number, method: string): RequestInit & { duplex?: 'half' } {
  if (status !== 303 && !((status === 301 || status === 302) && method !== 'GET' && method !== 'HEAD')) return init
  const headers = headersInitToRecord(init.headers)
  deleteHeader(headers, 'Content-Length')
  deleteHeader(headers, 'Content-Type')
  return { ...init, method: 'GET', body: undefined, headers }
}

function deleteHeader(headers: Record<string, string>, name: string) {
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase())
  if (matchedKey) delete headers[matchedKey]
}

function proxyHeaders(proxy: URL): Record<string, string> {
  if (!proxy.username) return {}
  return {
    'Proxy-Authorization': `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64')}`,
  }
}

function requiresSharePassword(html: string) {
  return html.includes('function down_p()') || html.includes('pwdload') || html.includes('passwddiv')
}

function parseLanzouScriptParams(html: string) {
  const params: Record<string, string> = {}
  for (const match of html.matchAll(/['"]([a-zA-Z0-9_]+)['"]\s*:\s*['"]([^'"]*)['"]/g)) {
    params[match[1]] = match[2]
  }
  return params
}

function extractFunctionBody(html: string, functionName: string) {
  const start = html.indexOf(`function ${functionName}()`)
  if (start < 0) return null
  const braceStart = html.indexOf('{', start)
  if (braceStart < 0) return null
  let depth = 0
  for (let index = braceStart; index < html.length; index += 1) {
    const char = html[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) return html.slice(braceStart + 1, index)
  }
  return null
}

function extractAjaxFileId(html: string) {
  const id = matchFirst(html, /ajaxm\.php\?file=(\d+)/)
  if (!id) throw new Error('蓝奏云解析失败：未找到文件 ID')
  return id
}

function extractQuotedValue(html: string, key: string) {
  return matchFirst(html, new RegExp(`['"]${key}['"]\\s*:\\s*['"]([^'"]*)['"]`)) || ''
}

function extractAll(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern)).map((item) => item[1]).filter(Boolean)
}

function matchFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] || ''
}

function stripLanzouPid(url: string) {
  return url.replace(/pid=.*?&/, '')
}

function extractAcwScV2Cookie(html: string) {
  if (!html.includes('acw_sc__v2')) return null
  const arg1 = matchFirst(html, /arg1\s*=\s*['"]([0-9a-fA-F]{40})['"]/)
  return arg1 ? acwScV2Simple(arg1) : null
}

function acwScV2Simple(arg1: string) {
  const posList = [15, 35, 29, 24, 33, 16, 1, 38, 10, 9, 19, 31, 40, 27, 22, 23, 25, 13, 6, 11, 39, 18, 20, 8, 14, 21, 32, 26, 2, 30, 7, 4, 17, 5, 3, 28, 34, 37, 12, 36]
  const mask = '3000176000856006061501533003690027800375'
  const output = Array(40).fill('')
  for (let index = 0; index < arg1.length; index += 1) {
    const target = posList.findIndex((position) => position === index + 1)
    if (target >= 0) output[target] = arg1[index]
  }
  const arg2 = output.join('')
  let result = ''
  for (let index = 0; index < Math.min(arg2.length, mask.length); index += 2) {
    const left = parseInt(arg2.slice(index, index + 2), 16)
    const right = parseInt(mask.slice(index, index + 2), 16)
    result += (left ^ right).toString(16).padStart(2, '0')
  }
  return result
}

function normalizeBaseUrl(value?: string) {
  return (value?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function normalizeShareBaseUrl(value?: string) {
  return (value?.trim() || DEFAULT_SHARE_BASE_URL).replace(/\/$/, '')
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
