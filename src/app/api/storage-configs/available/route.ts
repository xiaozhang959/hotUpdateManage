import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveProjectAccessContext } from '@/lib/project-access'
import { listAvailableStorageConfigs } from '@/lib/storage'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  try {
    const projectId = new URL(req.url).searchParams.get('projectId')?.trim() || ''
    const ownerUserId = projectId
      ? (
          await resolveProjectAccessContext({
            projectId,
            requesterUserId: session.user.id,
            requesterRole: session.user.role,
          })
        ).ownerUserId
      : session.user.id

    const { ownerItems, globalItems, defaultId } = await listAvailableStorageConfigs(ownerUserId)
    const items = [
      ...ownerItems.map((item) => ({
        id: item.id,
        name: item.name,
        provider: item.provider,
        isDefault: Boolean(item.isDefault),
        scope: 'user',
      })),
      ...globalItems.map((item) => ({
        id: item.id,
        name: item.name,
        provider: item.provider,
        isDefault: Boolean(item.isDefault),
        scope: 'global',
      })),
    ]

    // 本地回退（仅当没有任何默认时作为默认）
    if (!defaultId) {
      items.unshift({ id: null as any, name: '本地存储(内置)', provider: 'LOCAL', isDefault: true, scope: 'fallback' })
    } else {
      items.unshift({ id: null as any, name: '本地存储(内置)', provider: 'LOCAL', isDefault: false, scope: 'fallback' })
    }

    return NextResponse.json({ success: true, items, defaultId, ownerUserId })
  } catch (e:any) {
    const message = e?.message || '获取可用存储失败'
    const status = message.includes('无权限') ? 403 : message.includes('不存在') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
