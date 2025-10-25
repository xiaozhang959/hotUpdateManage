import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/fileUtils'
import { versionCache } from '@/lib/cache/version-cache'
import crypto from 'crypto'

// 更新版本
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string, versionId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id, versionId } = await params
    const body = await req.json()
    const { version, downloadUrl, downloadUrls, changelog, forceUpdate, isCurrent } = body

    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 验证版本是否存在
    const existingVersion = await prisma.version.findFirst({
      where: {
        id: versionId,
        projectId: id
      }
    })

    if (!existingVersion) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    // 检查版本号是否与其他版本冲突（如果修改了版本号）
    if (version && version !== existingVersion.version) {
      const duplicateVersion = await prisma.version.findFirst({
        where: {
          projectId: id,
          version,
          id: { not: versionId }
        }
      })

      if (duplicateVersion) {
        return NextResponse.json(
          { error: `版本 ${version} 已存在` },
          { status: 400 }
        )
      }
    }

    // 准备更新数据
    const updateData: any = {
      updatedAt: new Date()
    }

    // 更新基本信息
    if (version !== undefined) updateData.version = version
    if (changelog !== undefined) updateData.changelog = changelog
    if (forceUpdate !== undefined) updateData.forceUpdate = forceUpdate

    // 处理文件/链接更新
    let oldFileUrl: string | null = null
    if (downloadUrl !== undefined && downloadUrl !== existingVersion.downloadUrl) {
      // 如果提供了新的下载链接，保存旧的用于删除
      oldFileUrl = existingVersion.downloadUrl
      updateData.downloadUrl = downloadUrl
      
      // 计算新的MD5（如果是外部链接，使用链接本身的hash）
      updateData.md5 = crypto.createHash('md5').update(downloadUrl).digest('hex')
    }

    // 处理多链接更新
    if (downloadUrls !== undefined) {
      updateData.downloadUrls = JSON.stringify(downloadUrls)
      updateData.urlRotationIndex = 0 // 重置轮询索引
    }

    // 使用事务处理设置为当前版本的逻辑
    if (isCurrent === true && !existingVersion.isCurrent) {
      await prisma.$transaction(async (tx) => {
        // 取消其他版本的当前状态
        await tx.version.updateMany({
          where: {
            projectId: id,
            isCurrent: true,
            id: { not: versionId }
          },
          data: { isCurrent: false }
        })

        // 更新当前版本
        const updatedVersion = await tx.version.update({
          where: { id: versionId },
          data: {
            ...updateData,
            isCurrent: true
          }
        })

        // 更新项目的当前版本
        await tx.project.update({
          where: { id },
          data: {
            currentVersion: updatedVersion.version,
            updatedAt: new Date()
          }
        })
      })
    } else if (isCurrent === false && existingVersion.isCurrent) {
      // 如果取消当前版本状态，需要选择另一个版本作为当前版本
      const latestVersion = await prisma.version.findFirst({
        where: {
          projectId: id,
          id: { not: versionId }
        },
        orderBy: { createdAt: 'desc' }
      })

      await prisma.$transaction(async (tx) => {
        // 更新当前版本
        await tx.version.update({
          where: { id: versionId },
          data: {
            ...updateData,
            isCurrent: false
          }
        })

        // 如果有其他版本，设置最新的为当前版本
        if (latestVersion) {
          await tx.version.update({
            where: { id: latestVersion.id },
            data: { isCurrent: true }
          })
          await tx.project.update({
            where: { id },
            data: {
              currentVersion: latestVersion.version,
              updatedAt: new Date()
            }
          })
        } else {
          // 没有其他版本了，清空当前版本
          await tx.project.update({
            where: { id },
            data: {
              currentVersion: null,
              updatedAt: new Date()
            }
          })
        }
      })
    } else {
      // 普通更新
      await prisma.version.update({
        where: { id: versionId },
        data: updateData
      })

      // 如果修改了当前版本的版本号，需要更新项目
      if (existingVersion.isCurrent && version && version !== existingVersion.version) {
        await prisma.project.update({
          where: { id },
          data: {
            currentVersion: version,
            updatedAt: new Date()
          }
        })
      }
    }

    // 删除旧文件（如果更换了文件）
    if (oldFileUrl && oldFileUrl.startsWith('/uploads/')) {
      try {
        await deleteFile(oldFileUrl)
      } catch (error) {
        console.error('删除旧文件失败:', error)
      }
    }

    // 清理缓存
    await versionCache.clearProjectCache(id)

    // 获取更新后的版本信息
    const updatedVersion = await prisma.version.findUnique({
      where: { id: versionId }
    })

    return NextResponse.json({
      message: '版本更新成功',
      version: updatedVersion
    })
  } catch (error) {
    console.error('更新版本失败:', error)
    return NextResponse.json(
      { error: '更新版本失败' },
      { status: 500 }
    )
  }
}

// 删除版本
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string, versionId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id, versionId } = await params

    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 验证版本是否存在
    const version = await prisma.version.findFirst({
      where: {
        id: versionId,
        projectId: id
      }
    })

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    // 保存文件URL用于删除
    const fileUrlToDelete = version.downloadUrl

    // 如果删除的是当前版本，需要更新项目的当前版本
    if (version.isCurrent || project.currentVersion === version.version) {
      // 获取其他版本
      const otherVersion = await prisma.version.findFirst({
        where: {
          projectId: id,
          id: { not: versionId }
        },
        orderBy: { createdAt: 'desc' }
      })

      // 使用事务更新
      await prisma.$transaction(async (tx) => {
        // 删除版本
        await tx.version.delete({
          where: { id: versionId }
        })

        // 如果有其他版本，设置最新的为当前版本
        if (otherVersion) {
          await tx.version.update({
            where: { id: otherVersion.id },
            data: { isCurrent: true }
          })
          await tx.project.update({
            where: { id },
            data: { currentVersion: otherVersion.version }
          })
        } else {
          // 没有其他版本了，清空当前版本
          await tx.project.update({
            where: { id },
            data: { currentVersion: null }
          })
        }
      })
    } else {
      // 不是当前版本，直接删除
      await prisma.version.delete({
        where: { id: versionId }
      })
    }

    // 删除关联的文件或远程对象
    try {
      if (version.objectKey && version.storageProvider) {
        const { getProviderByConfigId, getActiveStorageProvider } = await import('@/lib/storage')
        let provider = null
        if (version.storageConfigId) {
          provider = await getProviderByConfigId(version.storageConfigId)
        }
        if (!provider) {
          const sel = await getActiveStorageProvider(project.userId)
          provider = sel.provider
        }
        if (provider && typeof (provider as any).deleteObject === 'function') {
          await (provider as any).deleteObject({ projectId: id, objectKey: version.objectKey })
        }
      } else if (fileUrlToDelete) {
        await deleteFile(fileUrlToDelete)
      }
    } catch (e) {
      console.warn('删除对象失败（已忽略）：', e)
    }
    
    // 清理项目缓存
    await versionCache.clearProjectCache(id)

    return NextResponse.json({ message: '版本已删除' })
  } catch (error) {
    console.error('删除版本失败:', error)
    return NextResponse.json(
      { error: '删除版本失败' },
      { status: 500 }
    )
  }
}