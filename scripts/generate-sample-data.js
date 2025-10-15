const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function generateSampleData() {
  console.log('开始生成示例数据...')
  
  try {
    // 生成过去7天的API请求数据
    console.log('生成API请求数据...')
    const apiRequestsToCreate = []
    
    for (let day = 6; day >= 0; day--) {
      const date = new Date()
      date.setDate(date.getDate() - day)
      date.setHours(0, 0, 0, 0)
      
      // 每天生成10-50个随机API请求
      const requestCount = Math.floor(Math.random() * 40) + 10
      
      for (let i = 0; i < requestCount; i++) {
        const requestTime = new Date(date)
        requestTime.setHours(Math.floor(Math.random() * 24))
        requestTime.setMinutes(Math.floor(Math.random() * 60))
        requestTime.setSeconds(Math.floor(Math.random() * 60))
        
        const endpoints = ['/api/check', '/api/download', '/api/projects', '/api/versions', '/api/stats']
        const methods = ['GET', 'POST', 'PUT', 'DELETE']
        const statusCodes = [200, 201, 400, 404, 500]
        const weights = [70, 10, 10, 5, 5] // 200状态码权重更高
        
        // 根据权重选择状态码
        const randomNum = Math.random() * 100
        let statusCode = 200
        let cumulativeWeight = 0
        for (let j = 0; j < statusCodes.length; j++) {
          cumulativeWeight += weights[j]
          if (randomNum <= cumulativeWeight) {
            statusCode = statusCodes[j]
            break
          }
        }
        
        apiRequestsToCreate.push({
          endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
          method: methods[Math.floor(Math.random() * methods.length)],
          statusCode,
          responseTime: Math.floor(Math.random() * 2000) + 50, // 50-2050ms
          userAgent: 'Sample User Agent',
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          createdAt: requestTime
        })
      }
    }
    
    await prisma.apiRequest.createMany({
      data: apiRequestsToCreate
    })
    console.log(`生成了 ${apiRequestsToCreate.length} 条API请求记录`)
    
    // 生成邮件日志数据
    console.log('生成邮件日志数据...')
    const emailLogsToCreate = []
    
    for (let day = 6; day >= 0; day--) {
      const date = new Date()
      date.setDate(date.getDate() - day)
      date.setHours(0, 0, 0, 0)
      
      // 每天生成2-10个邮件记录
      const emailCount = Math.floor(Math.random() * 8) + 2
      
      for (let i = 0; i < emailCount; i++) {
        const emailTime = new Date(date)
        emailTime.setHours(Math.floor(Math.random() * 24))
        emailTime.setMinutes(Math.floor(Math.random() * 60))
        emailTime.setSeconds(Math.floor(Math.random() * 60))
        
        const types = ['verification', 'reset_password', 'notification']
        const statuses = ['sent', 'failed']
        const statusWeights = [85, 15] // 85%成功，15%失败
        
        // 根据权重选择状态
        const randomNum = Math.random() * 100
        const status = randomNum <= statusWeights[0] ? 'sent' : 'failed'
        
        emailLogsToCreate.push({
          toEmail: `user${i}@example.com`,
          subject: `测试邮件主题 ${i + 1}`,
          type: types[Math.floor(Math.random() * types.length)],
          status,
          error: status === 'failed' ? 'SMTP connection failed' : null,
          createdAt: emailTime
        })
      }
    }
    
    await prisma.emailLog.createMany({
      data: emailLogsToCreate
    })
    console.log(`生成了 ${emailLogsToCreate.length} 条邮件日志记录`)
    
    console.log('示例数据生成完成！')
  } catch (error) {
    console.error('生成示例数据失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateSampleData()