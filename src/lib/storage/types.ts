export type StorageProviderName = 'LOCAL' | 'S3' | 'OSS' | 'WEBDAV'

export interface PutParams {
  projectId: string
  fileName: string
  buffer: Buffer
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
