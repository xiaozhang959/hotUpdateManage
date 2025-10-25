import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/system-config'

// 获取公开的系统配置（不需要管理员权限）
export async function GET() {
  try {
    // 只返回前端需要的配置项
    const publicConfigs = {
      registration_enabled: await getConfig('registration_enabled'),
      upload_enabled: await getConfig('upload_enabled'),
      require_md5_for_link_uploads: await getConfig('require_md5_for_link_uploads'),
      max_upload_size: await getConfig('max_upload_size'),
      site_name: await getConfig('site_name'),
      site_description: await getConfig('site_description')
    }
    
    return NextResponse.json(publicConfigs)
  } catch (error) {
    console.error('获取公开配置失败:', error)
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    )
  }
}
