import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, validateApiKey } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

// GET /api/v1/versions - Get versions for a project
export async function GET(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    const versions = await prisma.version.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: versions
    })
  } catch (error) {
    console.error('Failed to fetch versions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/v1/versions - Create a new version
export async function POST(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const projectId = formData.get('projectId') as string
    const version = formData.get('version') as string
    const forceUpdate = formData.get('forceUpdate') === 'true'
    const changelog = formData.get('changelog') as string || ''
    const file = formData.get('file') as File | null
    const url = formData.get('url') as string | null
    const urls = formData.get('urls') as string | null

    if (!projectId || !version) {
      return NextResponse.json(
        { error: 'Project ID and version are required' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Check if version already exists
    const existingVersion = await prisma.version.findUnique({
      where: {
        projectId_version: {
          projectId,
          version
        }
      }
    })

    if (existingVersion) {
      return NextResponse.json(
        { error: 'Version already exists for this project' },
        { status: 409 }
      )
    }

    let downloadUrl: string = ''
    let downloadUrls: string[] = []
    let md5: string = ''

    // Priority: file upload > urls > url
    if (file && file.size > 0) {
      // Handle file upload (highest priority)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Calculate MD5
      md5 = crypto.createHash('md5').update(buffer).digest('hex')

      // Save file
      const uploadDir = path.join(process.cwd(), 'uploads', projectId)
      await fs.mkdir(uploadDir, { recursive: true })
      
      const fileName = `${version}_${Date.now()}_${file.name}`
      const filePath = path.join(uploadDir, fileName)
      await fs.writeFile(filePath, buffer)

      downloadUrl = `/uploads/${projectId}/${fileName}`
      downloadUrls = [downloadUrl]
    } else if (urls) {
      // Handle multiple URLs (second priority)
      try {
        downloadUrls = JSON.parse(urls)
        if (!Array.isArray(downloadUrls) || downloadUrls.length === 0) {
          throw new Error('Invalid URLs format')
        }
        downloadUrl = downloadUrls[0]
        // Generate random MD5 for URL-based versions
        const randomString = `${projectId}-${version}-${Date.now()}-${Math.random()}`
        md5 = crypto.createHash('md5').update(randomString).digest('hex')
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid URLs format. Must be a JSON array of strings' },
          { status: 400 }
        )
      }
    } else if (url) {
      // Handle single URL (lowest priority)
      downloadUrl = url
      downloadUrls = [url]
      // Generate random MD5 for URL-based versions
      const randomString = `${projectId}-${version}-${Date.now()}-${Math.random()}`
      md5 = crypto.createHash('md5').update(randomString).digest('hex')
    } else {
      return NextResponse.json(
        { error: 'Either file, url, or urls must be provided' },
        { status: 400 }
      )
    }

    // Create version in database
    const newVersion = await prisma.version.create({
      data: {
        projectId,
        version,
        downloadUrl,
        downloadUrls: JSON.stringify(downloadUrls),
        md5,
        forceUpdate,
        changelog,
        isCurrent: true
      }
    })

    // Update all other versions to not be current
    await prisma.version.updateMany({
      where: {
        projectId,
        id: { not: newVersion.id }
      },
      data: { isCurrent: false }
    })

    // Update project's current version
    await prisma.project.update({
      where: { id: projectId },
      data: { currentVersion: version }
    })

    return NextResponse.json({
      success: true,
      data: newVersion,
      message: 'Version created successfully'
    })
  } catch (error) {
    console.error('Failed to create version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

