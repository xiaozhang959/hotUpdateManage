import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NavBar } from '@/components/layout/navbar'

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <NavBar user={session.user} />
      {children}
    </div>
  )
}