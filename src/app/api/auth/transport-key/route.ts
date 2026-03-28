import { NextResponse } from 'next/server'
import { getAuthTransportPublicConfig } from '@/lib/server/auth-request-crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getAuthTransportPublicConfig(), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}
