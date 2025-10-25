/**
 * 查询优化工具函数
 */

import { queryOptimizationConfig } from './db-config'

/**
 * 分页参数接口
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  cursor?: string
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    nextCursor?: string
  }
}

/**
 * 解析分页参数
 */
export function parsePaginationParams(
  searchParams: URLSearchParams | any
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get?.('page') || searchParams.page || '1'))
  const pageSize = Math.min(
    queryOptimizationConfig.maxPageSize,
    Math.max(1, parseInt(searchParams.get?.('pageSize') || searchParams.pageSize || 
      String(queryOptimizationConfig.defaultPageSize)))
  )
  
  return {
    page,
    pageSize,
    cursor: searchParams.get?.('cursor') || searchParams.cursor,
    orderBy: searchParams.get?.('orderBy') || searchParams.orderBy || 'createdAt',
    orderDirection: (searchParams.get?.('orderDirection') || searchParams.orderDirection || 'desc') as 'asc' | 'desc'
  }
}

/**
 * 构建Prisma分页查询参数
 */
export function buildPaginationQuery(params: PaginationParams) {
  const { page = 1, pageSize = queryOptimizationConfig.defaultPageSize, cursor } = params
  
  if (cursor) {
    // 游标分页（性能更好，适合大数据集）
    return {
      take: pageSize,
      cursor: { id: cursor },
      skip: 1 // 跳过游标本身
    }
  } else {
    // 偏移分页（适合小数据集，支持跳页）
    return {
      take: pageSize,
      skip: (page - 1) * pageSize
    }
  }
}

/**
 * 构建分页响应
 */
export async function buildPaginatedResponse<T extends { id?: string }>(
  data: T[],
  total: number,
  params: PaginationParams
): Promise<PaginatedResult<T>> {
  const { page = 1, pageSize = queryOptimizationConfig.defaultPageSize } = params
  const totalPages = Math.ceil(total / pageSize)
  
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextCursor: data.length > 0 ? data[data.length - 1].id : undefined
    }
  }
}

/**
 * 批量查询优化
 */
export async function batchQuery<T>(
  ids: string[],
  queryFn: (batch: string[]) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = []
  const batchSize = queryOptimizationConfig.batchSize
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const batchResults = await queryFn(batch)
    results.push(...batchResults)
  }
  
  return results
}

/**
 * 查询性能监控装饰器
 */
export function measureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  
  return queryFn()
    .then(result => {
      const duration = Date.now() - startTime
      
      if (duration > queryOptimizationConfig.slowQueryThreshold) {
        console.warn(`⚠️ Slow query detected: ${queryName} took ${duration}ms`)
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Query: ${queryName} completed in ${duration}ms`)
      }
      
      return result
    })
    .catch(error => {
      console.error(`❌ Query error: ${queryName}`, error)
      throw error
    })
}

/**
 * 选择性字段加载
 * 根据请求参数动态选择要加载的字段
 */
export function buildSelectFields(
  fields?: string,
  allowedFields: string[] = [],
  defaultFields: string[] = []
): any {
  if (!fields) {
    // 如果没有指定字段，返回默认字段
    if (defaultFields.length === 0) return undefined
    
    return defaultFields.reduce((acc, field) => {
      acc[field] = true
      return acc
    }, {} as any)
  }
  
  // 解析请求的字段
  const requestedFields = fields.split(',').map(f => f.trim())
  
  // 过滤出允许的字段
  const selectedFields = requestedFields.filter(field => 
    allowedFields.includes(field)
  )
  
  if (selectedFields.length === 0) {
    return defaultFields.reduce((acc, field) => {
      acc[field] = true
      return acc
    }, {} as any)
  }
  
  return selectedFields.reduce((acc, field) => {
    acc[field] = true
    return acc
  }, {} as any)
}

/**
 * 防止N+1查询问题
 * 预加载关联数据
 */
export function buildIncludeQuery(
  includes?: string,
  allowedIncludes: Record<string, any> = {}
): any {
  if (!includes) return {}
  
  const requestedIncludes = includes.split(',').map(i => i.trim())
  
  return requestedIncludes.reduce((acc, include) => {
    if (allowedIncludes[include]) {
      acc[include] = allowedIncludes[include]
    }
    return acc
  }, {} as any)
}

/**
 * 构建排序查询
 */
export function buildOrderByQuery(
  orderBy?: string,
  orderDirection: 'asc' | 'desc' = 'desc',
  allowedFields: string[] = ['createdAt', 'updatedAt']
): any {
  if (!orderBy || !allowedFields.includes(orderBy)) {
    return { createdAt: orderDirection }
  }
  
  return { [orderBy]: orderDirection }
}