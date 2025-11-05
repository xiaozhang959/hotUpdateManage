import { PrismaClient, Prisma } from '@prisma/client'

// Ensure default timezone from env (fallback Asia/Shanghai)
try {
  if (!process.env.TZ || process.env.TZ.length === 0) {
    process.env.TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Shanghai'
  }
} catch {}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 配置连接池和查询日志
const prismaClientOptions: Prisma.PrismaClientOptions = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // 日志配置（开发环境启用）
  log: process.env.NODE_ENV === 'development' 
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : [
        { level: 'error', emit: 'stdout' },
      ],
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions)

// 开发环境下监听查询事件，记录慢查询
if (process.env.NODE_ENV === 'development') {
  // @ts-expect-error - Prisma query event types
  prisma.$on('query', (e: any) => {
    // 记录执行时间超过100ms的查询
    if (e.duration > 100) {
      console.warn(`⚠️ Slow query detected (${e.duration}ms):`, {
        query: e.query,
        params: e.params,
        duration: e.duration,
      })
    }
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 导出用于关闭连接的函数
export async function disconnectPrisma() {
  await prisma.$disconnect()
}
