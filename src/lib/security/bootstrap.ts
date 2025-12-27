function getProvidedToken(req: Request, tokenFromBody?: string | null) {
  const header = req.headers.get('x-bootstrap-token') || req.headers.get('x-init-token')
  if (header) return header
  try {
    const url = new URL(req.url)
    const qp = url.searchParams.get('token')
    if (qp) return qp
  } catch {}
  return tokenFromBody || null
}

/**
 * 初始化/安装接口保护。
 * - 开发环境默认放行
 * - 生产环境必须配置 HOT_UPDATE_BOOTSTRAP_TOKEN，并在请求中提供匹配的 token
 */
export function requireBootstrapToken(req: Request, tokenFromBody?: string | null): string | null {
  if (process.env.NODE_ENV !== 'production') return null

  const expected = (process.env.HOT_UPDATE_BOOTSTRAP_TOKEN || '').trim()
  if (!expected) {
    return '生产环境未配置 HOT_UPDATE_BOOTSTRAP_TOKEN，已禁用初始化接口'
  }

  const provided = getProvidedToken(req, tokenFromBody)
  if (!provided || provided !== expected) {
    return '初始化令牌错误或缺失'
  }

  return null
}

