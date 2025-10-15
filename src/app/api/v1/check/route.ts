import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'

// POST /api/v1/check - Check for updates (supports both API key and Bearer token)
export async function POST(req: NextRequest) {
  try {
    let project: any = null
    
    // Try Bearer token authentication first
    const user = await validateBearerToken(req)
    if (user) {
      // If using Bearer token, projectId must be provided in the request body
      const body = await req.json()
      const { currentVersion, projectId } = body
      
      if (!projectId) {
        return NextResponse.json(
          { error: 'Project ID is required when using Bearer token authentication' },
          { status: 400 }
        )
      }
      
      // Verify project ownership
      project = await prisma.project.findFirst({
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
      
      // Continue with currentVersion from body
      var currentVersionToCheck = currentVersion
    } else {
      // Fall back to API key authentication
      project = await validateApiKey(req)
      
      if (!project) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid or missing authentication' },
          { status: 401 }
        )
      }
      
      const body = await req.json()
      var currentVersionToCheck = body.currentVersion
    }

    // Get the latest version
    const latestVersion = await prisma.version.findFirst({
      where: {
        projectId: project.id,
        isCurrent: true
      },
      select: {
        id: true,
        version: true,
        downloadUrl: true,
        downloadUrls: true,
        urlRotationIndex: true,
        md5: true,
        forceUpdate: true,
        changelog: true,
        createdAt: true
      }
    })

    if (!latestVersion) {
      return NextResponse.json({
        success: true,
        hasUpdate: false,
        message: 'No versions available'
      })
    }

    // Handle multiple download URLs with rotation
    let downloadUrl = latestVersion.downloadUrl
    if (latestVersion.downloadUrls && latestVersion.downloadUrls !== '[]') {
      try {
        const urls = JSON.parse(latestVersion.downloadUrls)
        if (Array.isArray(urls) && urls.length > 0) {
          // Get the current URL based on rotation index
          const currentIndex = latestVersion.urlRotationIndex % urls.length
          downloadUrl = urls[currentIndex]

          // Update rotation index for next request
          await prisma.version.update({
            where: { id: latestVersion.id },
            data: {
              urlRotationIndex: currentIndex + 1
            }
          })
        }
      } catch (e) {
        console.error('Error parsing download URLs:', e)
      }
    }

    // Check if update is needed
    const hasUpdate = currentVersionToCheck !== latestVersion.version

    return NextResponse.json({
      success: true,
      hasUpdate,
      data: hasUpdate ? {
        version: latestVersion.version,
        downloadUrl,
        md5: latestVersion.md5,
        forceUpdate: latestVersion.forceUpdate,
        changelog: latestVersion.changelog,
        createdAt: latestVersion.createdAt
      } : null
    })
  } catch (error) {
    console.error('Failed to check version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/v1/check/latest - Get latest version info (supports both API key and Bearer token)
export async function GET(req: NextRequest) {
  try {
    let project: any = null
    
    // Try Bearer token authentication first
    const user = await validateBearerToken(req)
    if (user) {
      // If using Bearer token, projectId must be provided as query parameter
      const { searchParams } = new URL(req.url)
      const projectId = searchParams.get('projectId')
      
      if (!projectId) {
        return NextResponse.json(
          { error: 'Project ID is required when using Bearer token authentication' },
          { status: 400 }
        )
      }
      
      // Verify project ownership
      project = await prisma.project.findFirst({
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
    } else {
      // Fall back to API key authentication
      project = await validateApiKey(req)
      
      if (!project) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid or missing authentication' },
          { status: 401 }
        )
      }
    }

    const latestVersion = await prisma.version.findFirst({
      where: {
        projectId: project.id,
        isCurrent: true
      },
      select: {
        version: true,
        downloadUrl: true,
        downloadUrls: true,
        urlRotationIndex: true,
        md5: true,
        forceUpdate: true,
        changelog: true,
        createdAt: true
      }
    })

    if (!latestVersion) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No versions available'
      })
    }

    // Handle multiple download URLs
    let downloadUrl = latestVersion.downloadUrl
    if (latestVersion.downloadUrls && latestVersion.downloadUrls !== '[]') {
      try {
        const urls = JSON.parse(latestVersion.downloadUrls)
        if (Array.isArray(urls) && urls.length > 0) {
          const currentIndex = latestVersion.urlRotationIndex % urls.length
          downloadUrl = urls[currentIndex]

          // Update rotation index
          await prisma.version.update({
            where: {
              projectId_version: {
                projectId: project.id,
                version: latestVersion.version
              }
            },
            data: {
              urlRotationIndex: currentIndex + 1
            }
          })
        }
      } catch (e) {
        console.error('Error parsing download URLs:', e)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        version: latestVersion.version,
        downloadUrl,
        md5: latestVersion.md5,
        forceUpdate: latestVersion.forceUpdate,
        changelog: latestVersion.changelog,
        createdAt: latestVersion.createdAt
      }
    })
  } catch (error) {
    console.error('Failed to get latest version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}