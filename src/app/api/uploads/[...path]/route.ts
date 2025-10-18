import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // 等待 params
    const { path: pathSegments } = await params
    
    // 重构路径 (Next.js已经解码了URL)
    const filePath = pathSegments.join('/')
    
    // 调试日志
    console.log('Requested file path:', filePath)
    
    // 构建完整的文件路径
    const fullPath = path.join(process.cwd(), 'uploads', filePath)
    
    // 安全检查：确保路径不会跳出 uploads 目录
    const normalizedPath = path.normalize(fullPath)
    const uploadsDir = path.normalize(path.join(process.cwd(), 'uploads'))
    
    if (!normalizedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }
    
    // 检查文件是否存在
    if (!existsSync(normalizedPath)) {
      console.error('File not found at:', normalizedPath)
      // 尝试查找未编码的文件名（兼容旧文件）
      const decodedPath = path.join(
        path.dirname(normalizedPath),
        decodeURIComponent(path.basename(normalizedPath))
      )
      console.log('Trying decoded path:', decodedPath)
      
      if (existsSync(decodedPath)) {
        // 使用解码后的路径
        const file = await readFile(decodedPath)
        const ext = path.extname(decodedPath).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.json': 'application/json',
          '.txt': 'text/plain',
          '.zip': 'application/zip',
          '.apk': 'application/vnd.android.package-archive',
          '.ipa': 'application/octet-stream',
          '.exe': 'application/octet-stream',
          '.dmg': 'application/octet-stream',
          '.pkg': 'application/octet-stream',
          '.deb': 'application/octet-stream',
          '.rpm': 'application/octet-stream',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.pdf': 'application/pdf',
          '.lrj': 'application/octet-stream',
        }
        const contentType = mimeTypes[ext] || 'application/octet-stream'
        const fileName = path.basename(decodedPath)
        const asciiFileName = fileName.replace(/[^\x00-\x7F]/g, '_')
        const encodedFileName = encodeURIComponent(fileName).replace(/'/g, '%27')
        
        return new NextResponse(new Uint8Array(file), {
          headers: {
            'Content-Type': contentType,
            'Content-Length': file.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Disposition': `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
          },
        })
      }
      
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // 读取文件
    const file = await readFile(normalizedPath)
    
    // 获取文件扩展名来确定 MIME 类型
    const ext = path.extname(normalizedPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.apk': 'application/vnd.android.package-archive',
      '.ipa': 'application/octet-stream',
      '.exe': 'application/octet-stream',
      '.dmg': 'application/octet-stream',
      '.pkg': 'application/octet-stream',
      '.deb': 'application/octet-stream',
      '.rpm': 'application/octet-stream',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.lrj': 'application/octet-stream', // 热更新插件文件
    }
    
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    
    // 获取文件名
    const fileName = path.basename(normalizedPath)
    
    // 处理文件名编码，确保兼容性
    // 对于ASCII字符使用原始文件名，对于非ASCII字符使用URL编码
    const asciiFileName = fileName.replace(/[^\x00-\x7F]/g, '_')
    const encodedFileName = encodeURIComponent(fileName)
      .replace(/'/g, '%27') // 确保单引号被正确编码
    
    // 返回文件内容，设置为附件下载
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': file.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        // 设置为 attachment 强制触发下载
        // 使用安全的ASCII文件名作为主要值，UTF-8编码作为备选
        'Content-Disposition': `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}