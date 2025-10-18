const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateRateLimit(newLimit) {
  try {
    // 确保 newLimit 是一个有效的数字
    const limit = parseInt(newLimit, 10)
    if (isNaN(limit) || limit < 1) {
      console.error('请提供一个有效的数字（最小值为1）')
      process.exit(1)
    }
    
    // 更新或创建配置
    const result = await prisma.systemConfig.upsert({
      where: { key: 'api_rate_limit' },
      update: { value: String(limit) },
      create: {
        key: 'api_rate_limit',
        value: String(limit),
        type: 'number',
        category: 'security',
        description: 'API请求速率限制（次/分钟）'
      }
    })
    
    console.log('API速率限制已更新为:', limit, '次/分钟')
    console.log('数据库中的值:', result.value)
    
    // 验证更新
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'api_rate_limit' }
    })
    
    console.log('\n验证结果:')
    console.log('  键:', config.key)
    console.log('  值:', config.value)
    console.log('  类型:', config.type)
    console.log('  数值化:', parseInt(config.value, 10))
    
  } catch (error) {
    console.error('更新失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 从命令行参数获取新的限制值
const newLimit = process.argv[2]

if (!newLimit) {
  console.log('使用方法: node scripts/update-rate-limit.js <新的限制值>')
  console.log('例如: node scripts/update-rate-limit.js 100')
  process.exit(1)
}

updateRateLimit(newLimit)