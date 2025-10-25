// 设置SMTP端口配置
import { prisma } from '../src/lib/prisma'

async function setSMTPPort() {
  try {
    // AhaSend 通常使用端口 587 (STARTTLS) 或 465 (SSL/TLS)
    const port: number = 587 // 您可以根据需要修改为 465
    
    const result = await prisma.systemConfig.upsert({
      where: { key: 'smtp_port' },
      update: { 
        value: String(port),
        updatedAt: new Date()
      },
      create: {
        key: 'smtp_port',
        value: String(port),
        type: 'number',
        category: 'email',
        description: 'SMTP服务器端口'
      }
    })
    
    console.log(`✅ SMTP端口已设置为: ${port}`)
    console.log('配置详情:', result)
    
    // 同时设置 smtp_secure 基于端口
    const secure = port === 465 // 465端口使用SSL，其他端口使用STARTTLS
    
    await prisma.systemConfig.upsert({
      where: { key: 'smtp_secure' },
      update: { 
        value: String(secure),
        updatedAt: new Date()
      },
      create: {
        key: 'smtp_secure',
        value: String(secure),
        type: 'boolean',
        category: 'email',
        description: '是否使用SSL/TLS加密'
      }
    })
    
    console.log(`✅ SSL/TLS设置已更新为: ${secure}`)
    
  } catch (error) {
    console.error('设置SMTP端口失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setSMTPPort()