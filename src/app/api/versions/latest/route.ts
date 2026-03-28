import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getLatestAvailableVersionForArchitecture, serializeVersionDetail } from '@/lib/version-artifacts'

function getRequestedArchitecture(body: Record<string, unknown>) {
  const value = body.architectureKey || body.architecture || body.arch || null
  return typeof value === 'string' ? value : null
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req)
    const rate = await checkRateLimit(clientIp, 'api/versions/latest')
    if (!rate.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: rate.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rate.limit.toString(),
            'X-RateLimit-Remaining': rate.remaining.toString(),
            'X-RateLimit-Reset': rate.reset.toISOString(),
          },
        },
      )
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const currentVersion = typeof body.currentVersion === 'string' ? body.currentVersion : null
    const requestedArchitecture = getRequestedArchitecture(body)

    let project: { id: string } | null = null

    const user = await validateBearerToken(req)
    if (user) {
      const projectId = typeof body.projectId === 'string' ? body.projectId : null
      if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required when using Bearer token' }, { status: 400 })
      }
      project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId: user.id,
        },
        select: { id: true },
      })
    } else {
      const apiKeyFromHeader = req.headers.get('X-API-Key')
      const apiKey = apiKeyFromHeader || (typeof body.apiKey === 'string' ? body.apiKey : null)
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Authentication required - provide Bearer token or X-API-Key' },
          { status: 401 },
        )
      }
      project = await prisma.project.findUnique({
        where: { apiKey },
        select: { id: true },
      })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    const lookup = await getLatestAvailableVersionForArchitecture(
      prisma,
      project.id,
      requestedArchitecture,
      currentVersion,
    )

    if (!lookup.latestLogicalVersion) {
      return NextResponse.json({ error: 'No versions available' }, { status: 404 })
    }

    if (!lookup.latestAvailable) {
      return NextResponse.json(
        {
          error: 'ARCH_NOT_PUBLISHED',
          message: `架构 ${lookup.targetArchitectureKey} 尚未发布任何可用版本`,
        },
        { status: 404 },
      )
    }

    const selected = lookup.nextAvailable?.version || lookup.latestAvailable.version
    const serialized = serializeVersionDetail(selected, lookup.architectures, lookup.targetArchitectureKey)

    return NextResponse.json({
      success: true,
      hasUpdate: currentVersion ? Boolean(lookup.nextAvailable) : true,
      data: {
        version: serialized.version,
        downloadUrl: serialized.downloadUrl,
        md5: serialized.md5,
        size: serialized.size ?? null,
        forceUpdate: serialized.forceUpdate,
        changelog: serialized.changelog,
        createdAt: serialized.createdAt,
        updatedAt: serialized.updatedAt,
        timestamp: serialized.timestamp,
        isCurrent: selected.isCurrent,
        publishState: serialized.publishState,
        architectureKey: serialized.artifact?.architectureKey || lookup.targetArchitectureKey,
        architectureName: serialized.artifact?.architectureName || null,
        artifactId: serialized.artifact?.id || null,
      },
    })
  } catch (error) {
    console.error('Failed to get latest version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
