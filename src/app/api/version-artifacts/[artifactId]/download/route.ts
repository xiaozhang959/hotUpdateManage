import { prisma } from '@/lib/prisma'
import { buildVersionDownloadResponse } from '@/lib/version-download'
import { withApiRequestLogging } from '@/lib/api-logger'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  return withApiRequestLogging(req, '/api/version-artifacts/[artifactId]/download', async ({ setProjectId }) => {
    try {
      const { artifactId } = await params
      const artifact = await prisma.versionArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          downloadUrl: true,
          storageProvider: true,
          objectKey: true,
          storageConfigId: true,
          fileName: true,
          version: {
            select: {
              projectId: true,
            },
          },
        },
      })

      if (!artifact) {
        return new Response(JSON.stringify({ error: '产物不存在' }), { status: 404 })
      }
      setProjectId(artifact.version.projectId)

      return buildVersionDownloadResponse({
        downloadUrl: artifact.downloadUrl,
        storageProvider: artifact.storageProvider,
        objectKey: artifact.objectKey,
        storageConfigId: artifact.storageConfigId,
        fileName: artifact.fileName,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '下载失败'
      return new Response(JSON.stringify({ error: message }), { status: 500 })
    }
  })
}

export const runtime = 'nodejs'
