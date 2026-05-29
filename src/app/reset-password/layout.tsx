import { AuthTransportProvider } from '@/components/providers/AuthTransportProvider'
import { getAuthTransportPublicConfig } from '@/lib/server/auth-request-crypto'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthTransportProvider config={await getAuthTransportPublicConfig()}>
      {children}
    </AuthTransportProvider>
  )
}
