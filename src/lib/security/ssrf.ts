import dns from 'dns/promises'
import net from 'net'

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true

  const [a, b] = parts

  // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 0 || a === 10 || a === 127) return true

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true

  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true

  // 198.18.0.0/15 (benchmark)
  if (a === 198 && (b === 18 || b === 19)) return true

  // multicast / reserved
  if (a >= 224) return true

  return false
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()

  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fe80:')) return true // link-local fe80::/10 (coarse)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA fc00::/7

  // IPv4-mapped IPv6: ::ffff:127.0.0.1
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length)
    if (net.isIP(v4) === 4) return isPrivateIpv4(v4)
    // Some forms may include hex; treat as unsafe
    return true
  }

  return false
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  // Common cloud metadata hostnames
  if (h === 'metadata.google.internal') return true
  return false
}

/**
 * SSRF 保护：仅允许访问可解析为公网 IP 的 http(s) URL。
 * - 阻止 localhost / 私网 / 链路本地 / 组播 / 保留段
 * - 阻止 URL 中携带 userinfo (username:password@)
 */
export async function assertSafeRemoteHttpUrl(input: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('invalid url')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('only http(s) urls are allowed')
  }

  if (url.username || url.password) {
    throw new Error('url userinfo is not allowed')
  }

  const hostname = (url.hostname || '').trim()
  if (!hostname) throw new Error('missing hostname')
  if (isBlockedHostname(hostname)) throw new Error('blocked hostname')

  const ipType = net.isIP(hostname)
  if (ipType === 4) {
    if (isPrivateIpv4(hostname)) throw new Error('private ip not allowed')
    return url
  }
  if (ipType === 6) {
    if (isPrivateIpv6(hostname)) throw new Error('private ip not allowed')
    return url
  }

  // DNS 解析后判定是否落入私网/保留地址
  let resolved: Array<{ address: string }>
  try {
    resolved = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('hostname resolve failed')
  }

  if (!resolved || resolved.length === 0) {
    throw new Error('hostname resolve empty')
  }

  for (const r of resolved) {
    const addr = r.address
    const t = net.isIP(addr)
    if (t === 4) {
      if (isPrivateIpv4(addr)) throw new Error('private ip not allowed')
    } else if (t === 6) {
      if (isPrivateIpv6(addr)) throw new Error('private ip not allowed')
    } else {
      // Should not happen; be conservative
      throw new Error('invalid resolved ip')
    }
  }

  return url
}
