import { initializeDefaultConfigs } from '../src/lib/system-config'

async function main() {
  console.log('正在初始化系统配置...')
  
  try {
    await initializeDefaultConfigs()
    console.log('✅ 系统配置初始化完成')
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })