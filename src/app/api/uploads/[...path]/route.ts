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
    
    // 重构路径
    const filePath = pathSegments.join('/')
    
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
    }
    
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    
    // 返回文件内容
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': file.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}