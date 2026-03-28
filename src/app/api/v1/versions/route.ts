import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'
import { createVersionWithArtifacts, refreshProjectVersionCache, serializeProjectDetail } from '@/lib/project-version-service'
import { projectWithVersionDetailsInclude } from '@/lib/version-artifacts'
import { getActiveStorageProvider } from '@/lib/storage'

function resolveErrorStatus(message: string) {
  if (message.includes('Unauthorized')) return 401
  if (message.includes('access denied') || message.includes('Project not found')) return 404
  if (
    message.includes('已存在')
    || message.includes('请提供')
    || message.includes('至少需要')
    || message.includes('缺失')
    || message.includes('非法')
    || message.includes('必须')
    || message.includes('Invalid')
  ) {
    return 400
  }
  return 500
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true' || value === '1'
}

// GET /api/v1/versions - Get versions for a project
export async function GET(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const architecture = searchParams.get('architecture') || searchParams.get('architectureKey')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      include: projectWithVersionDetailsInclude,
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: serializeProjectDetail(project, architecture).versions,
    })
  } catch (error) {
    console.error('Failed to fetch versions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/v1/versions - Create a new version
export async function POST(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 },
      )
    }

    const formData = await req.formData()
    const projectId = String(formData.get('projectId') || '')
    const version = String(formData.get('version') || '')
    const changelog = String(formData.get('changelog') || '')
    const architectureKey = String(formData.get('architectureKey') || formData.get('architecture') || '') || undefined
    const defaultArchitectureKey = String(formData.get('defaultArchitectureKey') || '') || architectureKey
    const forceUpdate = parseBoolean(formData.get('forceUpdate'))
    const artifactsRaw = String(formData.get('artifacts') || '')
    const file = formData.get('file') as File | null
    const url = String(formData.get('url') || '') || null
    const urls = String(formData.get('urls') || '') || null
    const providedMd5 = String(formData.get('md5') || '') || undefined
    const providedSize = String(formData.get('size') || '') || undefined

    if (!projectId || !version) {
      return NextResponse.json(
        { error: 'Project ID and version are required' },
        { status: 400 },
      )
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id,
      },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 },
      )
    }

    let payload: Record<string, unknown> = {
      version,
      changelog,
      forceUpdate,
      defaultForceUpdate: forceUpdate,
      architectureKey,
      defaultArchitectureKey,
      isCurrent: true,
    }

    if (artifactsRaw) {
      try {
        payload.artifacts = JSON.parse(artifactsRaw)
      } catch {
        return NextResponse.json({ error: 'Invalid artifacts format. Must be a JSON array' }, { status: 400 })
      }
    } else if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeFileName = file.name
        .replace(/[<>:"|?*\\/]/g, '_')
        .replace(/\.{2,}/g, '_')
        .replace(/^\./g, '_')
      const fileName = `${version}_${Date.now()}_${safeFileName}`
      const selection = await getActiveStorageProvider(user.id)
      const uploaded = await selection.provider.putObject({
        projectId,
        fileName,
        buffer,
        contentType: file.type || 'application/octet-stream',
      })
      payload = {
        ...payload,
        downloadUrl: uploaded.url,
        size: providedSize || String(file.size),
        md5: uploaded.md5,
        storageProvider: selection.provider.name,
        objectKey: uploaded.objectKey,
        storageConfigId: selection.configId || null,
      }
    } else if (urls) {
      try {
        const parsedUrls = JSON.parse(urls)
        if (!Array.isArray(parsedUrls) || parsedUrls.length === 0) {
          return NextResponse.json({ error: 'Invalid URLs format. Must be a JSON array of strings' }, { status: 400 })
        }
        payload = {
          ...payload,
          downloadUrl: String(parsedUrls[0] || ''),
          downloadUrls: parsedUrls,
          md5: providedMd5,
          size: providedSize,
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URLs format. Must be a JSON array of strings' }, { status: 400 })
      }
    } else if (url) {
      payload = {
        ...payload,
        downloadUrl: url,
        downloadUrls: [url],
        md5: providedMd5,
        size: providedSize,
      }
    } else {
      return NextResponse.json(
        { error: 'Either file, url, urls, or artifacts must be provided' },
        { status: 400 },
      )
    }

    const createdVersion = await prisma.$transaction((tx) => createVersionWithArtifacts(tx, projectId, payload))
    await refreshProjectVersionCache(projectId)

    return NextResponse.json({
      success: true,
      data: createdVersion,
      message: 'Version created successfully',
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Failed to create version:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}
