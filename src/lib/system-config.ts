import { prisma } from '@/lib/prisma'
import { configCache } from '@/lib/cache/config-cache'

export interface SystemConfigItem {
  key: string
  value: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  category: 'general' | 'upload' | 'auth' | 'security' | 'email'
  description?: string
}

// 系统默认配置
export const DEFAULT_CONFIGS: SystemConfigItem[] = [
  // 通用配置
  {
    key: 'site_name',
    value: '热更新管理系统',
    type: 'string',
    category: 'general',
    description: '系统名称'
  },
  {
    key: 'site_description',
    value: '专业的应用热更新管理平台',
    type: 'string',
    category: 'general',
    description: '系统描述'
  },
  
  // 上传配置
  {
    key: 'upload_enabled',
    value: true,
    type: 'boolean',
    category: 'upload',
    description: '是否允许文件上传'
  },
  {
    key: 'require_md5_for_link_uploads',
    value: false,
    type: 'boolean',
    category: 'upload',
    description: '是否强制链接上传必须提供有效MD5（ETag/Content-MD5或手动填写）'
  },
  {
    key: 'max_upload_size',
    value: 104857600, // 100MB in bytes
    type: 'number',
    category: 'upload',
    description: '最大上传文件大小（字节）'
  },
  {
    key: 'allowed_file_types',
    value: '*', // * 表示所有类型
    type: 'string',
    category: 'upload',
    description: '允许的文件类型（逗号分隔，*表示所有）'
  },
  
  // 认证配置
  {
    key: 'registration_enabled',
    value: true,
    type: 'boolean',
    category: 'auth',
    description: '是否开放用户注册'
  },
  {
    key: 'require_email_verification',
    value: false,
    type: 'boolean',
    category: 'auth',
    description: '是否需要邮箱验证'
  },
  {
    key: 'default_user_role',
    value: 'USER',
    type: 'string',
    category: 'auth',
    description: '新用户默认角色'
  },
  
  // 安全配置
  {
    key: 'api_rate_limit',
    value: 100,
    type: 'number',
    category: 'security',
    description: 'API请求速率限制（次/分钟）'
  },
  {
    key: 'session_timeout',
    value: 86400, // 24小时（秒）
    type: 'number',
    category: 'security',
    description: '会话超时时间（秒）'
  },
  {
    key: 'max_login_attempts',
    value: 5,
    type: 'number',
    category: 'security',
    description: '最大登录尝试次数'
  },

  // 邮件配置
  {
    key: 'smtp_enabled',
    value: false,
    type: 'boolean',
    category: 'email',
    description: '是否启用SMTP邮件服务'
  },
  {
    key: 'smtp_host',
    value: '',
    type: 'string',
    category: 'email',
    description: 'SMTP服务器地址'
  },
  {
    key: 'smtp_port',
    value: 587,
    type: 'number',
    category: 'email',
    description: 'SMTP服务器端口'
  },
  {
    key: 'smtp_secure',
    value: true,
    type: 'boolean',
    category: 'email',
    description: '是否使用SSL/TLS加密'
  },
  {
    key: 'smtp_user',
    value: '',
    type: 'string',
    category: 'email',
    description: 'SMTP用户名'
  },
  {
    key: 'smtp_password',
    value: '',
    type: 'string',
    category: 'email',
    description: 'SMTP密码'
  },
  {
    key: 'smtp_from_email',
    value: '',
    type: 'string',
    category: 'email',
    description: '发件人邮箱地址'
  },
  {
    key: 'smtp_from_name',
    value: '热更新管理系统',
    type: 'string',
    category: 'email',
    description: '发件人显示名称'
  },
  {
    key: 'email_verify_expire',
    value: 86400, // 24小时（秒）
    type: 'number',
    category: 'email',
    description: '邮箱验证链接有效期（秒）'
  },
  {
    key: 'password_reset_expire',
    value: 3600, // 1小时（秒）
    type: 'number',
    category: 'email',
    description: '密码重置链接有效期（秒）'
  }
]

// 获取配置值（使用缓存优化）
export async function getConfig(key: string): Promise<string | number | boolean | null> {
  return configCache.getConfig(key)
}

// 批量获取配置
export async function getConfigs(category?: string): Promise<Record<string, any>> {
  try {
    const where = category ? { category } : {}
    const configs = await prisma.systemConfig.findMany({ where })
    
    const configMap: Record<string, any> = {}
    
    // 添加数据库中的配置
    for (const config of configs) {
      switch (config.type) {
        case 'boolean':
          configMap[config.key] = config.value === 'true'
          break
        case 'number':
          configMap[config.key] = parseInt(config.value, 10)
          break
        default:
          configMap[config.key] = config.value
      }
    }
    
    // 添加默认配置（如果数据库中没有）
    for (const defaultConfig of DEFAULT_CONFIGS) {
      if (!category || defaultConfig.category === category) {
        if (!(defaultConfig.key in configMap)) {
          configMap[defaultConfig.key] = defaultConfig.value
        }
      }
    }
    
    return configMap
  } catch (error) {
    console.error('批量获取配置失败:', error)
    return {}
  }
}

// 设置配置值
export async function setConfig(key: string, value: string | number | boolean): Promise<boolean> {
  try {
    const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === key)
    if (!defaultConfig) {
      console.error(`未知的配置项: ${key}`)
      return false
    }
    
    const stringValue = String(value)
    
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: stringValue },
      create: {
        key,
        value: stringValue,
        type: defaultConfig.type,
        category: defaultConfig.category,
        description: defaultConfig.description
      }
    })
    
    // 清除缓存
    await configCache.invalidateConfig(key)
    
    return true
  } catch (error) {
    console.error(`设置配置失败 [${key}]:`, error)
    return false
  }
}

// 初始化默认配置
export async function initializeDefaultConfigs(): Promise<void> {
  try {
    for (const config of DEFAULT_CONFIGS) {
      const existing = await prisma.systemConfig.findUnique({
        where: { key: config.key }
      })
      
      if (!existing) {
        await prisma.systemConfig.create({
          data: {
            key: config.key,
            value: String(config.value),
            type: config.type,
            category: config.category,
            description: config.description
          }
        })
      }
    }
    console.log('系统配置初始化完成')
  } catch (error) {
    console.error('初始化系统配置失败:', error)
  }
}
