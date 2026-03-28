export interface ProjectArchitectureItem {
  id: string
  projectId: string
  key: string
  name: string
  sortOrder: number
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface VersionArtifactItem {
  id: string
  architectureKey: string | null
  architectureName: string | null
  artifactType: 'BINARY' | 'FILE'
  fileRole: 'PRIMARY' | 'EXTRA'
  displayName: string
  fileName: string | null
  downloadUrl: string
  rawDownloadUrl?: string
  size?: number | string | null
  md5: string
  md5Source?: string
  forceUpdate: boolean
  forceUpdateOverride?: boolean | null
  enabled: boolean
  isDefault?: boolean
  storageProvider?: string | null
  objectKey?: string | null
  storageConfigId?: string | null
  createdAt: string
  updatedAt: string
}

export interface VersionCoverage {
  total: number
  published: number
  missingKeys: string[]
}

export interface ProjectVersionItem {
  id: string
  projectId: string
  version: string
  changelog: string
  defaultForceUpdate?: boolean
  publishState?: 'DRAFT' | 'PARTIAL' | 'READY'
  defaultArchitectureKey?: string | null
  isCurrent: boolean
  createdAt: string
  updatedAt: string
  timestamp?: number
  architectureCoverage?: VersionCoverage
  artifacts: VersionArtifactItem[]
  artifact?: VersionArtifactItem | null
  downloadUrls?: string | null
  downloadUrl: string
  md5: string
  md5Source?: string
  size?: number | string | null
  forceUpdate: boolean
  storageProvider?: string | null
  objectKey?: string | null
  storageConfigId?: string | null
  storageProviders?: string | null
}

export interface ProjectOwnerSummary {
  id: string
  username: string
  email: string
}

export interface ProjectDetailItem {
  id: string
  name: string
  apiKey: string
  currentVersion: string | null
  userId?: string
  user?: ProjectOwnerSummary
  architectures: ProjectArchitectureItem[]
  versions: ProjectVersionItem[]
  createdAt: string
  updatedAt: string
  _count?: {
    versions: number
  }
}

export type ProjectSummaryItem = ProjectDetailItem

export interface StorageOptionItem {
  id: string | null
  name: string
  provider: string
  isDefault: boolean
  scope: string
}
