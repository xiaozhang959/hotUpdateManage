'use client'

import { createContext, useContext } from 'react'
import type { AuthTransportPublicConfig } from '@/lib/shared/auth-request-contract'

const AuthTransportContext = createContext<AuthTransportPublicConfig | null>(null)

export function AuthTransportProvider({
  config,
  children,
}: {
  config: AuthTransportPublicConfig
  children: React.ReactNode
}) {
  return (
    <AuthTransportContext.Provider value={config}>
      {children}
    </AuthTransportContext.Provider>
  )
}

export function useAuthTransportPublicConfig() {
  const context = useContext(AuthTransportContext)

  if (!context) {
    throw new Error('useAuthTransportPublicConfig 必须在 AuthTransportProvider 内使用')
  }

  return context
}
