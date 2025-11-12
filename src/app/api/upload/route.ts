import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import path from 'path'
import { getConfig } from '@/lib/system-config'
import { getActiveStorageProvider, getProviderByConfigId } from '@/lib/storage'

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
    const storageConfigId = (formData.get('storageConfigId') as string | null)?.toString() || ''

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
    
    // 4. 生成最终文件名（不进行URL编码，保持原始文件名）
    const finalFileName = processedFileName

    // 生成唯一文件名
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const fileName = `${timestamp}-${randomString}-${finalFileName}`

    // 读取文件内容
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 选择存储并写入
    let providerInfo = await getActiveStorageProvider(session.user.id)
    if (storageConfigId && storageConfigId !== 'null') {
      const specified = await getProviderByConfigId(storageConfigId)
      if (specified) {
        providerInfo = { scope: providerInfo.scope, provider: specified, configId: storageConfigId }
      }
    }
    const { provider, scope, configId } = providerInfo
    const put = await provider.putObject({ projectId, fileName, buffer, contentType: file.type || 'application/octet-stream' })

    // 记录上传日志（可选：用于安全审计）
    console.log(`File uploaded via ${provider.name}(${scope}): ${fileName} by user: ${session.user.id}, size: ${file.size}, original: ${file.name}`)

    // 返回文件URL和MD5（对URL进行编码）
    const fileUrl = put.url

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        md5: put.md5,
        storageProvider: provider.name,
        objectKey: put.objectKey,
        storageConfigId: configId || null,
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
// 注意：App Router 不支持 pages API 的 bodyParser 配置，已通过新分片上传接口处理大文件。
