export type StorageProviderName = 'LOCAL' | 'S3' | 'OSS' | 'WEBDAV'

export interface PutParams {
  projectId: string
  fileName: string
  // 为兼容大文件与流式上传，三选一优先级：stream > filePath > buffer
  buffer?: Buffer
  filePath?: string
  // Node.js Readable stream（按需引入，避免在浏览器端打包）
  // 使用 any 以避免在边缘运行时类型不匹配
  stream?: any
  contentType?: string
}

export interface PutResult {
  url: string
  fileName: string
  md5: string
  objectKey: string
}

export interface StorageProvider {
  name: StorageProviderName
  putObject(params: PutParams): Promise<PutResult>
  deleteObject(params: { projectId: string, objectKey: string }): Promise<boolean>
}

export interface LocalConfig {
  publicPrefix?: string // default '/uploads'
  baseDir?: string // default 'uploads'
}

export interface WebDAVConfig {
  baseUrl: string // 如 https://dav.example.com/remote.php/webdav
  username?: string
  password?: string
  rootPath?: string // 如 /hotupdates
  publicBaseUrl?: string // 对外可访问的基址，缺省使用 baseUrl
}

export type ProviderConfig = LocalConfig | WebDAVConfig | Record<string, any>
