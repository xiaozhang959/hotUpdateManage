import { prisma } from '@/lib/prisma'

interface ResolveProjectAccessParams {
  projectId: string
  requesterUserId: string
  requesterRole?: string | null
}

export interface ProjectAccessContext {
  projectId: string
  ownerUserId: string
}

export async function resolveProjectAccessContext({
  projectId,
  requesterUserId,
  requesterRole,
}: ResolveProjectAccessParams): Promise<ProjectAccessContext> {
  const isAdmin = requesterRole === 'ADMIN'

  const project = await prisma.project.findFirst({
    where: isAdmin
      ? { id: projectId }
      : {
          id: projectId,
          userId: requesterUserId,
        },
    select: {
      id: true,
      userId: true,
    },
  })

  if (!project) {
    throw new Error(isAdmin ? '项目不存在' : '项目不存在或无权限')
  }

  return {
    projectId: project.id,
    ownerUserId: project.userId,
  }
}
