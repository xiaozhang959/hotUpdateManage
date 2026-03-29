import { NextRequest, NextResponse } from 'next/server'
import { parseLoginEncryptedPayload } from '@/lib/server/auth-request-payloads'
import { validateLoginCredentials } from '@/lib/server/login-auth'

export async function POST(request: NextRequest) {
  try {
    const { encryptedPayload } = await request.json()

    let decryptedCredentials: {
      account: string
      password: string
    }

    try {
      decryptedCredentials = parseLoginEncryptedPayload(encryptedPayload)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : '加密请求解密失败，请刷新页面后重试',
      }, { status: 400 })
    }

    const result = await validateLoginCredentials(
      decryptedCredentials.account,
      decryptedCredentials.password,
    )

    if (!result.success) {
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        return NextResponse.json({
          success: false,
          error: 'email_not_verified',
          message: result.message,
          email: result.email,
        })
      }

      return NextResponse.json({
        success: false,
        error: result.message,
      })
    }

    return NextResponse.json({
      success: true,
      message: '验证通过',
    })
    
  } catch (error) {
    console.error('Pre-check error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '服务器错误，请稍后重试' 
    }, { status: 500 })
  }
}
