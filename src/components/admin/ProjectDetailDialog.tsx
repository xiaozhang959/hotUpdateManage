'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui'
import { ProjectWorkbench } from '@/components/projects/ProjectWorkbench'
import type { ProjectSummaryItem } from '@/components/projects/project-types'

interface ProjectDetailDialogProps {
  project: ProjectSummaryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (project: ProjectSummaryItem) => void
}

export function ProjectDetailDialog({
  project,
  open,
  onOpenChange,
  onUpdate,
}: ProjectDetailDialogProps) {
  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>项目详情管理</DialogTitle>
          <DialogDescription>
            以管理员身份查看并维护项目 {project.name} 的多架构版本、API Key 与架构配置。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <ProjectWorkbench
            projectId={project.id}
            apiBase="/api/admin/projects"
            apiScope="admin"
            resetKeyActionPath="reset-api-key"
            showOwnerInfo
            showApiExamples
            onProjectMutated={onUpdate}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
