'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui'
import { ProjectWorkbench } from '@/components/projects/ProjectWorkbench'

export default function ProjectVersionsPage() {
  const params = useParams()
  const projectId = params.id as string

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/projects">
              <Button variant="ghost" className="mb-3 -ml-3 text-slate-600 hover:text-slate-900">
                <ChevronLeft className="mr-2 h-4 w-4" /> 返回项目列表
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">多架构版本工作台</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              在一个逻辑版本里统一维护架构主程序与默认架构下载策略。
            </p>
          </div>
        </div>

        <ProjectWorkbench
          projectId={projectId}
          apiBase="/api/projects"
          apiScope="user"
          resetKeyActionPath="regenerate-key"
          showApiExamples
        />
      </main>
      <Footer />
    </div>
  )
}
