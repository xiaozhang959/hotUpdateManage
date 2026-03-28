import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getLatestAvailableVersionForArchitecture, serializeVersionDetail } from '@/lib/version-artifacts'

function getRequestedArchitecture(source: URLSearchParams | Record<string, unknown>) {
  if (source instanceof URLSearchParams) {
    return source.get('architectureKey') || source.get('architecture') || source.get('arch') || null
  }
  const value = source.architectureKey || source.architecture || source.arch || null
  return typeof value === 'string' ? value : null
}

async function checkRate(req: NextRequest) {
  const clientIp = getClientIp(req)
  const rate = await checkRateLimit(clientIp, 'api/v1/check')
  if (rate.success) {
    return null
  }
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: `Rate limit exceeded: ${rate.limit} requests per minute`,
      retryAfter: rate.reset.toISOString(),
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rate.limit.toString(),
        'X-RateLimit-Remaining': rate.remaining.toString(),
        'X-RateLimit-Reset': rate.reset.toISOString(),
        'Retry-After': Math.ceil((rate.reset.getTime() - Date.now()) / 1000).toString(),
      },
    },
  )
}

async function resolveProjectByRequest(req: NextRequest, projectId: string | null) {
  const user = await validateBearerToken(req)
  if (user) {
    if (!projectId) {
      return {
        error: NextResponse.json(
          { error: 'Project ID is required when using Bearer token authentication' },
          { status: 400 },
        ),
        project: null as { id: string } | null,
      }
    }
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      select: { id: true },
    })
    return {
      error: project ? null : NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 }),
      project,
    }
  }

  const project = await validateApiKey(req)
  if (!project) {
    return {
      error: NextResponse.json({ error: 'Unauthorized - Invalid or missing authentication' }, { status: 401 }),
      project: null as { id: string } | null,
    }
  }

  return {
    error: null,
    project: { id: project.id },
  }
}

function buildVersionPayload(serialized: ReturnType<typeof serializeVersionDetail>, targetArchitectureKey: string) {
  return {
    version: serialized.version,
    downloadUrl: serialized.downloadUrl,
    md5: serialized.md5,
    size: serialized.size ?? null,
    forceUpdate: serialized.forceUpdate,
    changelog: serialized.changelog,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
    timestamp: serialized.timestamp,
    publishState: serialized.publishState,
    architectureKey: serialized.artifact?.architectureKey || targetArchitectureKey,
    architectureName: serialized.artifact?.architectureName || null,
    artifactId: serialized.artifact?.id || null,
  }
}

// POST /api/v1/check - Check for updates (supports both API key and Bearer token)
export async function POST(req: NextRequest) {
  try {
    const rateError = await checkRate(req)
    if (rateError) {
      return rateError
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const projectId = typeof body.projectId === 'string' ? body.projectId : null
    const currentVersion = typeof body.currentVersion === 'string' ? body.currentVersion : null
    const requestedArchitecture = getRequestedArchitecture(body)

    const projectResult = await resolveProjectByRequest(req, projectId)
    if (projectResult.error) {
      return projectResult.error
    }

    const lookup = await getLatestAvailableVersionForArchitecture(
      prisma,
      projectResult.project!.id,
      requestedArchitecture,
      currentVersion,
    )

    if (!lookup.latestLogicalVersion) {
      return NextResponse.json({
        success: true,
        hasUpdate: false,
        message: 'No versions available',
      })
    }

    if (!lookup.latestAvailable) {
      return NextResponse.json({
        success: true,
        hasUpdate: false,
        code: 'ARCH_NOT_PUBLISHED',
        message: `架构 ${lookup.targetArchitectureKey} 尚未发布任何可用版本`,
      })
    }

    if (currentVersion && !lookup.nextAvailable) {
      return NextResponse.json({
        success: true,
        hasUpdate: false,
        data: null,
      })
    }

    const selected = lookup.nextAvailable?.version || lookup.latestAvailable.version
    const serialized = serializeVersionDetail(selected, lookup.architectures, lookup.targetArchitectureKey)

    return NextResponse.json({
      success: true,
      hasUpdate: true,
      data: buildVersionPayload(serialized, lookup.targetArchitectureKey),
    })
  } catch (error) {
    console.error('Failed to check version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/v1/check - Get latest version info (supports both API key and Bearer token)
export async function GET(req: NextRequest) {
  try {
    const rateError = await checkRate(req)
    if (rateError) {
      return rateError
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const requestedArchitecture = getRequestedArchitecture(searchParams)

    const projectResult = await resolveProjectByRequest(req, projectId)
    if (projectResult.error) {
      return projectResult.error
    }

    const lookup = await getLatestAvailableVersionForArchitecture(
      prisma,
      projectResult.project!.id,
      requestedArchitecture,
      null,
    )

    if (!lookup.latestLogicalVersion) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No versions available',
      })
    }

    if (!lookup.latestAvailable) {
      return NextResponse.json({
        success: true,
        data: null,
        code: 'ARCH_NOT_PUBLISHED',
        message: `架构 ${lookup.targetArchitectureKey} 尚未发布任何可用版本`,
      })
    }

    const serialized = serializeVersionDetail(
      lookup.latestAvailable.version,
      lookup.architectures,
      lookup.targetArchitectureKey,
    )

    return NextResponse.json({
      success: true,
      data: buildVersionPayload(serialized, lookup.targetArchitectureKey),
    })
  } catch (error) {
    console.error('Failed to get latest version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
