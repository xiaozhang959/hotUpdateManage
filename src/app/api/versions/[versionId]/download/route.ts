import { prisma } from '@/lib/prisma'
import { buildVersionDownloadResponse } from '@/lib/version-download'
import { pickVersionArtifact, projectArchitectureOrder, versionArtifactsOrder, versionArtifactInclude } from '@/lib/version-artifacts'

type LegacyStorageProviderEntry =
  | string
  | {
    type?: string | null
    configId?: string | null
    objectKey?: string | null
  }

function safeParseStringArray(value?: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => Boolean(item))
      : []
  } catch {
    return []
  }
}

function safeParseStorageProviders(value?: string | null): LegacyStorageProviderEntry[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  try {
    const { versionId } = await params
    const url = new URL(req.url)
    const requestedArchitecture = url.searchParams.get('architecture') || url.searchParams.get('architectureKey')
    const artifactId = url.searchParams.get('artifactId')
    const legacyIndexParam = url.searchParams.get('i')

    const version = await prisma.version.findUnique({
      where: { id: versionId },
      include: {
        artifacts: {
          include: versionArtifactInclude,
          orderBy: versionArtifactsOrder,
        },
        project: {
          include: {
            architectures: {
              orderBy: projectArchitectureOrder,
            },
          },
        },
      },
    })

    if (!version) {
      return new Response(JSON.stringify({ error: '版本不存在' }), { status: 404 })
    }

    const enabledArtifacts = version.artifacts.filter((artifact) => artifact.enabled)
    const selectedArtifact = artifactId
      ? enabledArtifacts.find((artifact) => artifact.id === artifactId) || null
      : requestedArchitecture
        ? pickVersionArtifact(version, version.project.architectures, requestedArchitecture)
        : legacyIndexParam === null
          ? pickVersionArtifact(version, version.project.architectures)
          : null

    if (legacyIndexParam !== null && !artifactId && !requestedArchitecture) {
      const legacyUrls = safeParseStringArray(version.downloadUrls)
      const providerEntries = safeParseStorageProviders(version.storageProviders)
      const clampedIndex = Math.max(
        0,
        Math.min(
          Number.isFinite(Number(legacyIndexParam)) ? Number(legacyIndexParam) : 0,
          Math.max(legacyUrls.length - 1, 0),
        ),
      )
      const selectedProvider = providerEntries[clampedIndex]

      return buildVersionDownloadResponse({
        downloadUrl: legacyUrls[clampedIndex] || version.downloadUrl,
        storageProvider:
          typeof selectedProvider === 'string'
            ? selectedProvider
            : selectedProvider?.type || version.storageProvider,
        objectKey:
          typeof selectedProvider === 'string'
            ? version.objectKey
            : selectedProvider?.objectKey || version.objectKey,
        storageConfigId:
          typeof selectedProvider === 'string'
            ? version.storageConfigId
            : selectedProvider?.configId || version.storageConfigId,
        fileName: null,
      })
    }

    if (selectedArtifact) {
      return buildVersionDownloadResponse({
        downloadUrl: selectedArtifact.downloadUrl,
        storageProvider: selectedArtifact.storageProvider,
        objectKey: selectedArtifact.objectKey,
        storageConfigId: selectedArtifact.storageConfigId,
        fileName: selectedArtifact.fileName,
      })
    }

    if (!version.downloadUrl) {
      return new Response(JSON.stringify({ error: '该版本无可用下载链接' }), { status: 404 })
    }

    return buildVersionDownloadResponse({
      downloadUrl: version.downloadUrl,
      storageProvider: version.storageProvider,
      objectKey: version.objectKey,
      storageConfigId: version.storageConfigId,
      fileName: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '下载失败'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}

export const runtime = 'nodejs'
