import { prisma } from '@/lib/prisma'

export interface InitializationStatus {
  isInitialized: boolean
  userCount: number
  checkedAt: string
}

interface InitStateStore {
  startupStatusPromise: Promise<InitializationStatus> | null
  liveStatusPromise: Promise<InitializationStatus> | null
  initializedSnapshot: InitializationStatus | null
}

const globalInitState = globalThis as typeof globalThis & {
  __HOT_UPDATE_INIT_STATE__?: InitStateStore
}

const initStateStore: InitStateStore =
  globalInitState.__HOT_UPDATE_INIT_STATE__ ??
  (globalInitState.__HOT_UPDATE_INIT_STATE__ = {
    startupStatusPromise: null,
    liveStatusPromise: null,
    initializedSnapshot: null,
  })

function createSafeFallbackStatus(): InitializationStatus {
  return {
    isInitialized: true,
    userCount: 0,
    checkedAt: new Date().toISOString(),
  }
}

async function readInitializationStatusFromDatabase(
  reason: 'startup' | 'live-refresh',
): Promise<InitializationStatus> {
  const userCount = await prisma.user.count()
  const status: InitializationStatus = {
    isInitialized: userCount > 0,
    userCount,
    checkedAt: new Date().toISOString(),
  }

  console.log(
    `[InitState] ${reason === 'startup' ? '启动阶段' : '运行期'}读取初始化状态: ${status.isInitialized ? '已初始化' : '未初始化'} (userCount=${userCount})`,
  )

  return status
}

function rememberInitializedStatus(status: InitializationStatus) {
  if (!status.isInitialized) {
    return
  }

  initStateStore.initializedSnapshot = status
  initStateStore.startupStatusPromise = Promise.resolve(status)
  initStateStore.liveStatusPromise = null
}

async function getStartupStatus(): Promise<InitializationStatus> {
  if (!initStateStore.startupStatusPromise) {
    initStateStore.startupStatusPromise = readInitializationStatusFromDatabase('startup').catch(
      (error) => {
        initStateStore.startupStatusPromise = null
        throw error
      },
    )
  }

  return initStateStore.startupStatusPromise
}

async function getLiveStatus(): Promise<InitializationStatus> {
  if (!initStateStore.liveStatusPromise) {
    initStateStore.liveStatusPromise = readInitializationStatusFromDatabase(
      'live-refresh',
    ).finally(() => {
      initStateStore.liveStatusPromise = null
    })
  }

  return initStateStore.liveStatusPromise
}

/**
 * 获取初始化状态。
 * - 服务启动后先读取一次数据库
 * - 如果启动时已初始化，后续请求直接复用进程内快照
 * - 如果启动时未初始化，仅在“未初始化”阶段做实时查库兜底
 * - 任一实例一旦观察到已初始化，就提升为进程内快照，避免后续每次请求查库
 */
export async function getInitializationStatus(): Promise<InitializationStatus> {
  try {
    if (initStateStore.initializedSnapshot) {
      return initStateStore.initializedSnapshot
    }

    const startupStatus = await getStartupStatus()
    if (startupStatus.isInitialized) {
      rememberInitializedStatus(startupStatus)
      return startupStatus
    }

    const liveStatus = await getLiveStatus()
    if (liveStatus.isInitialized) {
      rememberInitializedStatus(liveStatus)
    } else {
      initStateStore.startupStatusPromise = Promise.resolve(liveStatus)
    }

    return liveStatus
  } catch (error) {
    console.error('[InitState] 检查初始化状态失败:', error)
    return createSafeFallbackStatus()
  }
}

export async function needsInitialization(): Promise<boolean> {
  const status = await getInitializationStatus()
  return !status.isInitialized
}

/**
 * 仅重置本实例的初始化状态快照。
 * 下次读取时会重新按“启动检查 + 未初始化兜底”的策略获取最新状态。
 */
export function revalidateInitializationState() {
  initStateStore.initializedSnapshot = null
  initStateStore.startupStatusPromise = null
  initStateStore.liveStatusPromise = null
}

/**
 * 在当前实例已明确完成初始化后，直接提升为已初始化快照，
 * 避免 /init 成功后本实例再次落到实时查库或旧状态。
 */
export function markInitializationCompleted(userCount = 1) {
  rememberInitializedStatus({
    isInitialized: true,
    userCount: Math.max(userCount, 1),
    checkedAt: new Date().toISOString(),
  })
}

/**
 * 手动刷新当前实例的初始化状态。
 * 适合管理端调用或恢复数据库后主动同步。
 */
export async function refreshInitializationState(): Promise<InitializationStatus> {
  revalidateInitializationState()
  return getInitializationStatus()
}
