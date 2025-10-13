import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/layout/navbar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <NavBar user={session.user} />
      {children}
    </div>
  )
}