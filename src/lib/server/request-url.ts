const LOCAL_BASE_URL = 'http://localhost:3000'

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

function withProtocol(hostOrUrl: string) {
  if (/^https?:\/\//i.test(hostOrUrl)) {
    return hostOrUrl
  }

  return `https://${hostOrUrl}`
}

function getConfiguredBaseUrl() {
  const configuredUrl =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  return configuredUrl ? trimTrailingSlash(withProtocol(configuredUrl)) : null
}

function getRequestBaseUrl(req: Request) {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost || req.headers.get('host')

  if (!host) {
    return null
  }

  const normalizedHost = host.split(',')[0]?.trim()
  if (!normalizedHost) {
    return null
  }

  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const requestProtocol = new URL(req.url).protocol.replace(':', '')
  const protocol =
    forwardedProto ||
    requestProtocol ||
    (normalizedHost.startsWith('localhost') ? 'http' : 'https')

  return `${protocol}://${normalizedHost}`
}

export function getBaseUrl(req?: Request) {
  return getConfiguredBaseUrl() || (req ? getRequestBaseUrl(req) : null) || LOCAL_BASE_URL
}
