import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { calculateMD5 } from '@/lib/crypto'
import { getConfig } from '@/lib/system-config'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查是否允许上传
    const uploadEnabled = await getConfig('upload_enabled')
    if (!uploadEnabled) {
      return NextResponse.json({ error: '系统暂时关闭文件上传功能' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: '项目ID缺失' }, { status: 400 })
    }

    // 安全检查
    // 1. 文件大小限制 (从系统配置获取)
    const maxUploadSize = await getConfig('max_upload_size') as number || (100 * 1024 * 1024)
    if (file.size > maxUploadSize) {
      const sizeMB = Math.round(maxUploadSize / 1024 / 1024)
      return NextResponse.json({ error: `文件大小不能超过${sizeMB}MB` }, { status: 400 })
    }

    // 2. 文件名安全处理 - 移除潜在的危险字符
    const safeFileName = file.name
      .replace(/[<>:"|?*\\/]/g, '_')  // 移除文件系统不允许的字符
      .replace(/\.{2,}/g, '_')         // 移除连续的点（防止目录遍历）
      .replace(/^\./g, '_')            // 移除开头的点

    // 3. 检查危险的文件扩展名（可执行文件）
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar']
    const fileExtension = path.extname(safeFileName).toLowerCase()
    const isDangerous = dangerousExtensions.includes(fileExtension)
    
    // 如果是危险文件，添加.txt后缀使其不可执行
    const processedFileName = isDangerous ? `${safeFileName}.txt` : safeFileName
    
    // 4. 对文件名进行URL编码处理
    // 分离文件名和扩展名
    const nameWithoutExt = path.basename(processedFileName, path.extname(processedFileName))
    const ext = path.extname(processedFileName)
    
    // 对文件名部分进行URL编码（保留扩展名不编码）
    // 只对非ASCII字符进行编码，保持ASCII字符可读性
    const encodedName = nameWithoutExt.split('').map(char => {
      // 如果是ASCII字符且不是特殊字符，保持原样
      if (/^[a-zA-Z0-9._()-]$/.test(char)) {
        return char
      }
      // 否则进行URL编码
      return encodeURIComponent(char)
    }).join('')
    
    const finalFileName = encodedName + ext

    // 创建上传目录（在public目录之外）
    const uploadDir = path.join(process.cwd(), 'uploads', projectId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const fileName = `${timestamp}-${randomString}-${finalFileName}`
    const filePath = path.join(uploadDir, fileName)

    // 读取文件内容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 计算MD5
    const md5 = calculateMD5(buffer)

    // 写入文件
    await writeFile(filePath, buffer)

    // 记录上传日志（可选：用于安全审计）
    console.log(`File uploaded: ${fileName} by user: ${session.user.id}, size: ${file.size}, original: ${file.name}`)

    // 返回文件URL和MD5
    const fileUrl = `/uploads/${projectId}/${fileName}`

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        md5: md5,
        fileName: fileName,
        originalName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('文件上传失败:', error)
    return NextResponse.json(
      { error: '文件上传失败' },
      { status: 500 }
    )
  }
}

// 配置允许的最大文件大小（100MB）
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb'
    }
  }
}