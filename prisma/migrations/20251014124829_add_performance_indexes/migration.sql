-- Add performance indexes for frequently queried columns

-- Index for User queries by role
CREATE INDEX "User_role_idx" ON "User"("role");

-- Index for User queries by createdAt (for sorting)
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt" DESC);

-- Index for Project queries by userId
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- Index for Project queries by createdAt (for sorting)
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt" DESC);

-- Index for Version queries by projectId
CREATE INDEX "Version_projectId_idx" ON "Version"("projectId");

-- Index for Version queries by createdAt (for sorting)
CREATE INDEX "Version_createdAt_idx" ON "Version"("createdAt" DESC);

-- Composite index for Version queries by projectId and isCurrent
CREATE INDEX "Version_projectId_isCurrent_idx" ON "Version"("projectId", "isCurrent");

-- Composite index for Version queries by projectId and version
CREATE INDEX "Version_projectId_version_idx" ON "Version"("projectId", "version");

-- Index for SystemConfig queries by key and category
CREATE INDEX "SystemConfig_key_category_idx" ON "SystemConfig"("key", "category");

-- This is an empty migration.