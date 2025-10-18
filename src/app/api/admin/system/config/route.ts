import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CONFIGS, getConfigs, setConfig } from '@/lib/system-config'
import { configCache } from '@/lib/cache/config-cache'

// 获取所有系统配置
export async function GET(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }
    
    // 获取URL参数
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || undefined
    
    // 从数据库获取配置
    const where = category ? { category } : {}
    const dbConfigs = await prisma.systemConfig.findMany({ where })
    
    // 合并默认配置和数据库配置
    const configMap = new Map()
    
    // 首先添加默认配置
    for (const defaultConfig of DEFAULT_CONFIGS) {
      if (!category || defaultConfig.category === category) {
        configMap.set(defaultConfig.key, {
          ...defaultConfig,
          value: defaultConfig.value,
          isDefault: true
        })
      }
    }
    
    // 覆盖数据库中的配置
    for (const dbConfig of dbConfigs) {
      const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === dbConfig.key)
      if (defaultConfig) {
        let value: any = dbConfig.value
        // 根据类型转换值
        switch (dbConfig.type) {
          case 'boolean':
            value = dbConfig.value === 'true'
            break
          case 'number':
            value = parseInt(dbConfig.value, 10)
            break
        }
        
        configMap.set(dbConfig.key, {
          key: dbConfig.key,
          value,
          type: dbConfig.type,
          category: dbConfig.category,
          description: dbConfig.description || defaultConfig.description,
          isDefault: false,
          updatedAt: dbConfig.updatedAt
        })
      }
    }
    
    // 转换为数组
    const configs = Array.from(configMap.values())
    
    // 按类别分组
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = []
      }
      acc[config.category].push(config)
      return acc
    }, {} as Record<string, any[]>)
    
    return NextResponse.json({
      configs,
      groupedConfigs,
      categories: ['general', 'upload', 'auth', 'security', 'email']
    })
  } catch (error) {
    console.error('获取系统配置失败:', error)
    return NextResponse.json(
      { error: '获取系统配置失败' },
      { status: 500 }
    )
  }
}

// 更新系统配置
export async function POST(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }
    
    const { configs } = await req.json()
    
    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        { error: '配置格式错误' },
        { status: 400 }
      )
    }
    
    const results = []
    const errors = []
    const updatedKeys: string[] = [] // 记录更新的配置键
    
    // 批量更新配置
    for (const config of configs) {
      const { key, value } = config
      
      // 查找默认配置以获取类型信息
      const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === key)
      if (!defaultConfig) {
        errors.push(`未知的配置项: ${key}`)
        continue
      }
      
      try {
        // 验证值的类型
        let validatedValue = value
        switch (defaultConfig.type) {
          case 'boolean':
            if (typeof value !== 'boolean') {
              validatedValue = value === 'true' || value === true
            }
            break
          case 'number':
            validatedValue = parseInt(value, 10)
            if (isNaN(validatedValue)) {
              throw new Error(`${key} 的值必须是数字`)
            }
            break
          case 'string':
            validatedValue = String(value)
            break
        }
        
        // 更新或创建配置
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value: String(validatedValue) },
          create: {
            key,
            value: String(validatedValue),
            type: defaultConfig.type,
            category: defaultConfig.category,
            description: defaultConfig.description
          }
        })
        
        updatedKeys.push(key) // 记录成功更新的键
        results.push({ key, success: true })
      } catch (error: any) {
        errors.push(`更新 ${key} 失败: ${error.message}`)
        results.push({ key, success: false, error: error.message })
      }
    }
    
    // 清除更新过的配置缓存
    if (updatedKeys.length > 0) {
      await configCache.invalidateConfigs(updatedKeys)
    }
    
    return NextResponse.json({
      message: '配置更新完成',
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('更新系统配置失败:', error)
    return NextResponse.json(
      { error: '更新系统配置失败' },
      { status: 500 }
    )
  }
}

// 重置配置为默认值
export async function DELETE(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }
    
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    const category = searchParams.get('category')
    
    if (!key && !category) {
      return NextResponse.json(
        { error: '请指定要重置的配置项或类别' },
        { status: 400 }
      )
    }
    
    if (key) {
      // 重置单个配置
      await prisma.systemConfig.delete({
        where: { key }
      }).catch(() => {
        // 忽略不存在的配置
      })
      
      // 清除缓存
      await configCache.invalidateConfig(key)
      
      return NextResponse.json({
        message: `配置 ${key} 已重置为默认值`
      })
    }
    
    if (category) {
      // 重置整个类别
      await prisma.systemConfig.deleteMany({
        where: { category }
      })
      
      // 清除该类别的所有缓存
      await configCache.invalidateCategory(category)
      
      return NextResponse.json({
        message: `类别 ${category} 的所有配置已重置为默认值`
      })
    }
  } catch (error) {
    console.error('重置配置失败:', error)
    return NextResponse.json(
      { error: '重置配置失败' },
      { status: 500 }
    )
  }
}