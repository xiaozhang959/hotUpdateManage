const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkRateLimit() {
  try {
    // 查询数据库中的配置
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'api_rate_limit' }
    })
    
    console.log('数据库中的 api_rate_limit 配置:')
    if (config) {
      console.log('  值:', config.value)
      console.log('  类型:', config.type)
      console.log('  实际数值:', parseInt(config.value, 10))
    } else {
      console.log('  未找到配置（将使用默认值 100）')
    }
    
    // 列出所有安全配置
    console.log('\n所有安全配置:')
    const securityConfigs = await prisma.systemConfig.findMany({
      where: { category: 'security' }
    })
    
    for (const cfg of securityConfigs) {
      console.log(`  ${cfg.key}: ${cfg.value} (${cfg.type})`)
    }
    
  } catch (error) {
    console.error('查询失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkRateLimit()