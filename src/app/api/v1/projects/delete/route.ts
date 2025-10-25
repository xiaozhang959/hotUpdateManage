import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'

// POST /api/v1/projects/delete - Delete a project
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
    const { projectId } = body

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

    await prisma.project.delete({
      where: { id: projectId }
    })

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}