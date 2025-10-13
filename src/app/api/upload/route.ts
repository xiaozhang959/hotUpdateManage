import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { calculateMD5 } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
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

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', projectId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 生成文件名
    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}-${originalName}`
    const filePath = path.join(uploadDir, fileName)

    // 读取文件内容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 计算MD5
    const md5 = calculateMD5(buffer)

    // 写入文件
    await writeFile(filePath, buffer)

    // 返回文件URL和MD5
    const fileUrl = `/uploads/${projectId}/${fileName}`

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        md5: md5,
        fileName: fileName,
        size: file.size
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