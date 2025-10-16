import { prisma } from '@/lib/prisma'

interface LogApiRequestParams {
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  userAgent?: string | null
  ipAddress?: string | null
  projectId?: string | null
}

/**
 * 记录 API 请求到数据库
 * 这个函数可以在任何 API 路由中直接调用
 */
export async function logApiRequest(params: LogApiRequestParams) {
  try {
    await prisma.apiRequest.create({
      data: {
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        responseTime: params.responseTime,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        projectId: params.projectId
      }
    })
  } catch (error) {
    // 日志记录失败不应该影响主要功能
    console.error('Failed to log API request:', error)
  }
}

/**
 * 从请求头中提取客户端信息
 */
export function extractClientInfo(headers: Headers) {
  const userAgent = headers.get('user-agent')
  const forwarded = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')
  const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown'
  
  return {
    userAgent,
    ipAddress
  }
}