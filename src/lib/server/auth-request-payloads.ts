import { decryptAuthRequestData } from '@/lib/server/auth-request-crypto'

const MISSING_ENCRYPTED_PAYLOAD_ERROR = '缺少加密请求体，请刷新页面后重试'

function requireEncryptedPayload(rawPayload: unknown) {
  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    throw new Error(MISSING_ENCRYPTED_PAYLOAD_ERROR)
  }

  return decryptAuthRequestData(rawPayload)
}

function readRequiredTrimmedString(
  payload: Record<string, unknown>,
  field: string,
  message: string,
) {
  const value = payload[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message)
  }
  return value.trim()
}

function readRequiredString(
  payload: Record<string, unknown>,
  field: string,
  message: string,
) {
  const value = payload[field]
  if (typeof value !== 'string' || !value) {
    throw new Error(message)
  }
  return value
}

function readOptionalTrimmedString(payload: Record<string, unknown>, field: string) {
  const value = payload[field]
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized || undefined
}

function readOptionalString(payload: Record<string, unknown>, field: string) {
  const value = payload[field]
  if (typeof value !== 'string') {
    return undefined
  }

  return value || undefined
}

export function parseLoginEncryptedPayload(rawPayload: unknown) {
  const payload = requireEncryptedPayload(rawPayload)
  return {
    account: readRequiredTrimmedString(payload, 'account', '请输入用户名/邮箱和密码'),
    password: readRequiredString(payload, 'password', '请输入用户名/邮箱和密码'),
  }
}

export function parseRegisterEncryptedPayload(rawPayload: unknown) {
  const payload = requireEncryptedPayload(rawPayload)
  return {
    email: readRequiredTrimmedString(payload, 'email', '所有字段都是必填的'),
    username: readRequiredTrimmedString(payload, 'username', '所有字段都是必填的'),
    password: readRequiredString(payload, 'password', '所有字段都是必填的'),
  }
}

export function parseInitEncryptedPayload(rawPayload: unknown) {
  const payload = requireEncryptedPayload(rawPayload)
  return {
    bootstrapToken: readOptionalTrimmedString(payload, 'bootstrapToken'),
    email: readRequiredTrimmedString(payload, 'email', '请填写所有必填字段'),
    username: readRequiredTrimmedString(payload, 'username', '请填写所有必填字段'),
    password: readRequiredString(payload, 'password', '请填写所有必填字段'),
  }
}

export function parseResetPasswordEncryptedPayload(rawPayload: unknown) {
  const payload = requireEncryptedPayload(rawPayload)
  return {
    token: readRequiredTrimmedString(payload, 'token', '令牌和新密码都是必填项'),
    password: readRequiredString(payload, 'password', '令牌和新密码都是必填项'),
  }
}

export function parseProfileEncryptedPayload(rawPayload: unknown) {
  const payload = requireEncryptedPayload(rawPayload)
  return {
    username: readOptionalTrimmedString(payload, 'username'),
    currentPassword: readOptionalString(payload, 'currentPassword'),
    newPassword: readOptionalString(payload, 'newPassword'),
  }
}
