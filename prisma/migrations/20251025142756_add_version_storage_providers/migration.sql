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
    "md5" TEXT NOT NULL,
    "md5Source" TEXT NOT NULL DEFAULT 'manual',
    "storageProvider" TEXT,
    "objectKey" TEXT,
    "storageConfigId" TEXT,
    "storageProviders" TEXT NOT NULL DEFAULT '[]',
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "changelog" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Version_storageConfigId_fkey" FOREIGN KEY ("storageConfigId") REFERENCES "StorageConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Version" ("changelog", "createdAt", "downloadUrl", "downloadUrls", "forceUpdate", "id", "isCurrent", "md5", "md5Source", "objectKey", "projectId", "storageConfigId", "storageProvider", "updatedAt", "urlRotationIndex", "version") SELECT "changelog", "createdAt", "downloadUrl", "downloadUrls", "forceUpdate", "id", "isCurrent", "md5", "md5Source", "objectKey", "projectId", "storageConfigId", "storageProvider", "updatedAt", "urlRotationIndex", "version" FROM "Version";
DROP TABLE "Version";
ALTER TABLE "new_Version" RENAME TO "Version";
CREATE UNIQUE INDEX "Version_projectId_version_key" ON "Version"("projectId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
