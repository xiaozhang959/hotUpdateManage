import crypto from 'crypto'

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function calculateMD5(content: Buffer | string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

export function generateRandomMD5(): string {
  return crypto.randomBytes(16).toString('hex')
}