import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'

// POST /api/v1/versions/delete - Delete a version
export async function POST(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { versionId } = body

    if (!versionId) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    // Verify version ownership
    const version = await prisma.version.findFirst({
      where: {
        id: versionId,
        project: {
          userId: user.id
        }
      }
    })

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found or access denied' },
        { status: 404 }
      )
    }

    await prisma.version.delete({
      where: { id: versionId }
    })

    return NextResponse.json({
      success: true,
      message: 'Version deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}