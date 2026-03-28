import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  generateAvailableProjectApiKey,
  isProjectApiKeyTaken,
  isProjectApiKeyUniqueConstraintError,
  normalizeProjectApiKey,
  PROJECT_API_KEY_CONFLICT_MESSAGE,
  validateProjectApiKey,
} from '@/lib/server/project-api-key'
import { ensureDefaultArchitecture, projectWithVersionDetailsInclude } from '@/lib/version-artifacts'
import { serializeProjectSummary } from '@/lib/project-version-service'

// 获取用户的所有项目
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id,
      },
      include: projectWithVersionDetailsInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(projects.map((project) => serializeProjectSummary(project)))
  } catch (error) {
    console.error('获取项目失败:', error)
    return NextResponse.json({ error: '获取项目失败' }, { status: 500 })
  }
}

// 创建项目
export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      name?: string
      apiKey?: string
    }
    const name = body.name?.trim()
    const customApiKey = normalizeProjectApiKey(body.apiKey)

    if (!name) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 })
    }

    if (customApiKey) {
      const apiKeyError = validateProjectApiKey(customApiKey)
      if (apiKeyError) {
        return NextResponse.json({ error: apiKeyError }, { status: 400 })
      }

      if (await isProjectApiKeyTaken(customApiKey)) {
        return NextResponse.json(
          { error: PROJECT_API_KEY_CONFLICT_MESSAGE },
          { status: 409 },
        )
      }
    }

    const apiKey = customApiKey || (await generateAvailableProjectApiKey())

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          apiKey,
          userId: session.user.id,
        },
      })
      await ensureDefaultArchitecture(tx, created.id)
      return tx.project.findUniqueOrThrow({
        where: { id: created.id },
        include: projectWithVersionDetailsInclude,
      })
    })

    return NextResponse.json(serializeProjectSummary(project), { status: 201 })
  } catch (error) {
    console.error('创建项目失败:', error)
    if (isProjectApiKeyUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: PROJECT_API_KEY_CONFLICT_MESSAGE },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 })
  }
}
