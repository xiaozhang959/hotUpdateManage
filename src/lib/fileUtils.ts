import { unlink, rmdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * 从文件URL中提取实际的文件路径
 * @param fileUrl - 文件的URL，例如 "/uploads/projectId/filename.zip"
 * @returns 文件在文件系统中的完整路径
 */
export function getFilePathFromUrl(fileUrl: string): string | null {
  try {
    // 处理完整的URL（包含域名）
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      const url = new URL(fileUrl)
      fileUrl = url.pathname
    }

    // 检查是否是上传的文件路径
    if (!fileUrl.startsWith('/uploads/')) {
      console.warn(`文件URL不是上传文件: ${fileUrl}`)
      return null
    }

    // 构建完整的文件路径
    const relativePath = fileUrl.replace(/^\//, '') // 移除开头的斜杠
    const fullPath = path.join(process.cwd(), 'public', relativePath)
    
    return fullPath
  } catch (error) {
    console.error(`解析文件URL失败: ${fileUrl}`, error)
    return null
  }
}

/**
 * 安全地删除单个文件
 * @param fileUrl - 文件的URL
 * @returns 是否成功删除
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  try {
    const filePath = getFilePathFromUrl(fileUrl)
    
    if (!filePath) {
      console.log(`跳过非本地文件: ${fileUrl}`)
      return false
    }

    if (!existsSync(filePath)) {
      console.log(`文件不存在，跳过删除: ${filePath}`)
      return false
    }

    await unlink(filePath)
    console.log(`成功删除文件: ${filePath}`)
    return true
  } catch (error) {
    console.error(`删除文件失败: ${fileUrl}`, error)
    return false
  }
}

/**
 * 删除多个文件
 * @param fileUrls - 文件URL数组
 * @returns 成功删除的文件数量
 */
export async function deleteFiles(fileUrls: string[]): Promise<number> {
  let deletedCount = 0
  
  for (const fileUrl of fileUrls) {
    if (await deleteFile(fileUrl)) {
      deletedCount++
    }
  }
  
  return deletedCount
}

/**
 * 删除项目的整个上传目录
 * @param projectId - 项目ID
 * @returns 是否成功删除
 */
export async function deleteProjectUploadDir(projectId: string): Promise<boolean> {
  try {
  const uploadDir = path.join(process.cwd(), 'uploads', projectId);
    
    if (!existsSync(uploadDir)) {
      console.log(`项目上传目录不存在: ${uploadDir}`)
      return false
    }

    // 先删除目录中的所有文件
    const files = await readdir(uploadDir)
    for (const file of files) {
      const filePath = path.join(uploadDir, file)
      await unlink(filePath)
      console.log(`删除文件: ${filePath}`)
    }

    // 删除空目录
    await rmdir(uploadDir)
    console.log(`成功删除项目上传目录: ${uploadDir}`)
    return true
  } catch (error) {
    console.error(`删除项目上传目录失败: ${projectId}`, error)
    return false
  }
}

/**
 * 清理孤立的文件（数据库中已删除但文件系统中仍存在的文件）
 * 这个函数可以定期运行以清理孤立文件
 */
export async function cleanupOrphanFiles(activeFileUrls: string[]): Promise<number> {
  try {
  const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!existsSync(uploadsDir)) {
      return 0
    }

    let deletedCount = 0
    const activePathSet = new Set(
      activeFileUrls
        .map(url => getFilePathFromUrl(url))
        .filter(path => path !== null)
    )

    // 递归遍历上传目录
    async function traverseDir(dirPath: string) {
      const entries = await readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          await traverseDir(fullPath)
        } else if (entry.isFile()) {
          // 如果文件不在活跃文件列表中，删除它
          if (!activePathSet.has(fullPath)) {
            await unlink(fullPath)
            console.log(`清理孤立文件: ${fullPath}`)
            deletedCount++
          }
        }
      }
    }

    await traverseDir(uploadsDir)
    return deletedCount
  } catch (error) {
    console.error('清理孤立文件失败:', error)
    return 0
  }
}