const { configCache } = require('../dist/lib/cache/config-cache')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testConfigCache() {
  console.log('=== 测试配置缓存系统 ===\n')
  
  try {
    // 1. 首次获取配置（会查询数据库）
    console.log('1. 首次获取 api_rate_limit（从数据库读取）')
    console.time('  耗时')
    const value1 = await configCache.getConfig('api_rate_limit')
    console.timeEnd('  耗时')
    console.log('  值:', value1)
    
    // 2. 第二次获取（从缓存读取）
    console.log('\n2. 第二次获取 api_rate_limit（从缓存读取）')
    console.time('  耗时')
    const value2 = await configCache.getConfig('api_rate_limit')
    console.timeEnd('  耗时')
    console.log('  值:', value2)
    
    // 3. 批量获取配置
    console.log('\n3. 批量获取多个配置')
    console.time('  耗时')
    const configs = await configCache.getConfigs([
      'api_rate_limit',
      'max_upload_size',
      'registration_enabled',
      'session_timeout'
    ])
    console.timeEnd('  耗时')
    console.log('  结果:', configs)
    
    // 4. 更新配置并清除缓存
    console.log('\n4. 更新配置并清除缓存')
    const newValue = 200
    await prisma.systemConfig.upsert({
      where: { key: 'api_rate_limit' },
      update: { value: String(newValue) },
      create: {
        key: 'api_rate_limit',
        value: String(newValue),
        type: 'number',
        category: 'security',
        description: 'API请求速率限制（次/分钟）'
      }
    })
    console.log('  数据库已更新为:', newValue)
    
    // 清除缓存
    await configCache.invalidateConfig('api_rate_limit')
    console.log('  缓存已清除')
    
    // 5. 再次获取（应该从数据库读取新值）
    console.log('\n5. 清除缓存后获取（从数据库读取新值）')
    console.time('  耗时')
    const value3 = await configCache.getConfig('api_rate_limit')
    console.timeEnd('  耗时')
    console.log('  值:', value3)
    
    // 6. 获取缓存统计
    console.log('\n6. 缓存统计信息')
    const stats = configCache.getStats()
    console.log('  缓存类型:', stats.type)
    console.log('  缓存键数量:', stats.memoryKeys.length)
    console.log('  缓存键:', stats.memoryKeys)
    
    // 恢复原值
    console.log('\n7. 恢复原始值')
    await prisma.systemConfig.update({
      where: { key: 'api_rate_limit' },
      data: { value: '100' }
    })
    await configCache.invalidateConfig('api_rate_limit')
    console.log('  已恢复为 100')
    
  } catch (error) {
    console.error('测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
testConfigCache().then(() => {
  console.log('\n=== 测试完成 ===')
  process.exit(0)
})