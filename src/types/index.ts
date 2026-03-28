export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  apiKey: string;
  userId: string;
  user?: User;
  architectures?: ProjectArchitecture[];
  versions?: Version[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectArchitecture {
  id: string;
  projectId: string;
  key: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionArtifact {
  id: string;
  versionId: string;
  architectureKey: string | null;
  architectureName: string | null;
  artifactType: 'BINARY' | 'FILE';
  fileRole: 'PRIMARY' | 'EXTRA';
  displayName: string;
  fileName: string | null;
  downloadUrl: string;
  rawDownloadUrl?: string;
  size?: number | string | null;
  md5: string;
  md5Source?: string;
  forceUpdate: boolean;
  forceUpdateOverride?: boolean | null;
  enabled: boolean;
  isDefault?: boolean;
  storageProvider?: string | null;
  objectKey?: string | null;
  storageConfigId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Version {
  id: string;
  projectId: string;
  project?: Project;
  version: string;
  downloadUrl: string;
  size?: number | string | null;
  md5: string;
  forceUpdate: boolean;
  defaultForceUpdate?: boolean;
  publishState?: 'DRAFT' | 'PARTIAL' | 'READY';
  defaultArchitectureKey?: string | null;
  changelog: string;
  artifact?: VersionArtifact | null;
  artifacts?: VersionArtifact[];
  architectureCoverage?: {
    total: number;
    published: number;
    missingKeys: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
