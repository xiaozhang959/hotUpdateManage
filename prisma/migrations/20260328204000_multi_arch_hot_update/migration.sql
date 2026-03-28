-- CreateTable
CREATE TABLE "ProjectArchitecture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectArchitecture_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VersionArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "architectureId" TEXT,
    "artifactType" TEXT NOT NULL DEFAULT 'BINARY',
    "fileRole" TEXT NOT NULL DEFAULT 'PRIMARY',
    "displayName" TEXT NOT NULL,
    "fileName" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "size" BIGINT,
    "md5" TEXT NOT NULL,
    "md5Source" TEXT NOT NULL DEFAULT 'manual',
    "storageProvider" TEXT,
    "objectKey" TEXT,
    "storageConfigId" TEXT,
    "forceUpdateOverride" BOOLEAN,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VersionArtifact_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VersionArtifact_architectureId_fkey" FOREIGN KEY ("architectureId") REFERENCES "ProjectArchitecture" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VersionArtifact_storageConfigId_fkey" FOREIGN KEY ("storageConfigId") REFERENCES "StorageConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "downloadUrls" TEXT NOT NULL DEFAULT '[]',
    "urlRotationIndex" INTEGER NOT NULL DEFAULT 0,
    "size" BIGINT,
    "md5" TEXT NOT NULL,
    "md5Source" TEXT NOT NULL DEFAULT 'manual',
    "storageProvider" TEXT,
    "objectKey" TEXT,
    "storageConfigId" TEXT,
    "storageProviders" TEXT NOT NULL DEFAULT '[]',
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "defaultForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "publishState" TEXT NOT NULL DEFAULT 'DRAFT',
    "defaultArchitectureKey" TEXT,
    "changelog" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Version_storageConfigId_fkey" FOREIGN KEY ("storageConfigId") REFERENCES "StorageConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" (
    "changelog", "createdAt", "downloadUrl", "downloadUrls", "forceUpdate", "defaultForceUpdate",
    "publishState", "defaultArchitectureKey", "id", "isCurrent", "md5", "md5Source", "objectKey",
    "projectId", "size", "storageConfigId", "storageProvider", "storageProviders", "updatedAt",
    "urlRotationIndex", "version"
)
SELECT
    "changelog", "createdAt", "downloadUrl", "downloadUrls", "forceUpdate", "forceUpdate",
    CASE WHEN "downloadUrl" <> '' THEN 'READY' ELSE 'DRAFT' END,
    CASE WHEN "downloadUrl" <> '' THEN 'default' ELSE NULL END,
    "id", "isCurrent", "md5", "md5Source", "objectKey",
    "projectId", "size", "storageConfigId", "storageProvider", "storageProviders", "updatedAt",
    "urlRotationIndex", "version"
FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_projectId_version_key" ON "Version"("projectId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Seed default architecture for legacy projects
INSERT INTO "ProjectArchitecture" (
    "id", "projectId", "key", "name", "sortOrder", "enabled", "isDefault", "createdAt", "updatedAt"
)
SELECT
    lower(hex(randomblob(12))),
    p."id",
    'default',
    '默认架构',
    0,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Project" p
WHERE NOT EXISTS (
    SELECT 1 FROM "ProjectArchitecture" pa WHERE pa."projectId" = p."id"
);

-- Migrate legacy version file metadata into artifacts
INSERT INTO "VersionArtifact" (
    "id", "versionId", "architectureId", "artifactType", "fileRole", "displayName", "fileName", "downloadUrl",
    "size", "md5", "md5Source", "storageProvider", "objectKey", "storageConfigId", "forceUpdateOverride",
    "enabled", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    lower(hex(randomblob(12))),
    v."id",
    pa."id",
    'BINARY',
    'PRIMARY',
    CASE WHEN trim(v."version") <> '' THEN '版本 ' || v."version" || ' 主程序' ELSE '主程序' END,
    NULL,
    v."downloadUrl",
    v."size",
    v."md5",
    v."md5Source",
    CASE
        WHEN upper(coalesce(v."storageProvider", '')) <> '' THEN upper(v."storageProvider")
        WHEN v."downloadUrl" LIKE '/uploads/%' THEN 'LOCAL'
        WHEN v."downloadUrl" LIKE 'http%' THEN 'LINK'
        ELSE 'LOCAL'
    END,
    v."objectKey",
    v."storageConfigId",
    v."forceUpdate",
    true,
    0,
    v."createdAt",
    v."updatedAt"
FROM "Version" v
JOIN "ProjectArchitecture" pa
    ON pa."projectId" = v."projectId"
   AND pa."key" = 'default'
WHERE trim(coalesce(v."downloadUrl", '')) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM "VersionArtifact" va WHERE va."versionId" = v."id"
  );

-- CreateIndex
CREATE INDEX "ProjectArchitecture_projectId_sortOrder_idx" ON "ProjectArchitecture"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectArchitecture_projectId_key_key" ON "ProjectArchitecture"("projectId", "key");

-- CreateIndex
CREATE INDEX "VersionArtifact_versionId_sortOrder_idx" ON "VersionArtifact"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "VersionArtifact_architectureId_idx" ON "VersionArtifact"("architectureId");

-- CreateIndex
CREATE INDEX "VersionArtifact_versionId_architectureId_artifactType_fileRole_idx" ON "VersionArtifact"("versionId", "architectureId", "artifactType", "fileRole");
