import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface AuthUser {
  id: string
  email: string
  username: string
  role: string
}

/**
 * Validate bearer token from Authorization header
 * @param req NextRequest object
 * @returns User object if valid, null otherwise
 */
export async function validateBearerToken(req: NextRequest): Promise<AuthUser | null> {
  try {
    // Get Authorization header
    const authHeader = req.headers.get('authorization')
    
    if (!authHeader) {
      return null
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return null
    }

    // Extract token
    const token = authHeader.substring(7)
    
    if (!token) {
      return null
    }

    // Find user with this token
    const user = await prisma.user.findUnique({
      where: {
        apiToken: token
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true
      }
    })

    if (!user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Bearer token validation error:', error)
    return null
  }
}

/**
 * Validate API key from X-API-Key header (for backward compatibility)
 * @param req NextRequest object
 * @returns Project object if valid, null otherwise
 */
export async function validateApiKey(req: NextRequest): Promise<any> {
  try {
    const apiKey = req.headers.get('x-api-key')
    
    if (!apiKey) {
      return null
    }

    const project = await prisma.project.findUnique({
      where: { apiKey },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            role: true
          }
        }
      }
    })

    return project
  } catch (error) {
    console.error('API key validation error:', error)
    return null
  }
}