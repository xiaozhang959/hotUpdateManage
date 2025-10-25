import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// GET /api/v1/projects - Get all user's projects
export async function GET(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 }
      )
    }

    const projects = await prisma.project.findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        currentVersion: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          select: {
            id: true,
            version: true,
            createdAt: true,
            isCurrent: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: projects
    })
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/v1/projects - Create a new project
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
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        apiKey: generateApiKey(),
        userId: user.id
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: project,
      message: 'Project created successfully'
    })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}