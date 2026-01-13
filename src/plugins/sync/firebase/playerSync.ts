/**
 * Firebase播放器状态同步模块
 * 监听本地播放器事件，自动将状态上报到Firebase
 */

import { updateRemoteState, getRoomInfo } from './index'
import { throttle } from './utils'
import logger from './logger'

/**
 * Firebase播放器同步管理类
 */
class FirebasePlayerSync {
  private isEnabled = false
  private unsubscribers: Array<() => void> = []
  private throttledUpdate: ((...args: any[]) => void) | null = null

  /**
   * 启动Firebase播放器状态同步
   */
  start(): void {
    if (this.isEnabled) {
      logger.debug('PlayerSync', '已经在运行中')
      return
    }

    const roomInfo = getRoomInfo()
    if (!roomInfo.isInRoom) {
      logger.warn('PlayerSync', '未在房间中，无法启动同步')
      return
    }

    this.isEnabled = true
    logger.info('PlayerSync', '启动播放器状态同步')

    // 创建节流更新函数（200ms节流）
    this.throttledUpdate = throttle(() => {
      void this.syncState()
    }, 200)

    // 监听播放状态变化
    this.listenPlayState()

    // 监听歌曲信息变化
    this.listenMusicInfo()

    // 监听播放进度变化
    this.listenProgress()

    // 监听播放信息变化（播放列表、索引等）
    this.listenPlayInfo()
  }

  /**
   * 停止Firebase播放器状态同步
   */
  stop(): void {
    if (!this.isEnabled) return

    logger.info('PlayerSync', '停止播放器状态同步')
    
    // 取消所有事件监听
    this.unsubscribers.forEach(unsubscribe => unsubscribe())
    this.unsubscribers = []
    
    this.throttledUpdate = null
    this.isEnabled = false
  }

  /**
   * 监听播放状态变化（播放/暂停）
   */
  private listenPlayState(): void {
    const handler = (isPlay: boolean) => {
      if (!this.isEnabled) return
      logger.debug('PlayerSync', '播放状态变化', { isPlay })
      this.throttledUpdate?.()
    }

    global.state_event.on('playStateChanged', handler)
    this.unsubscribers.push(() => {
      global.state_event.off('playStateChanged', handler)
    })
  }

  /**
   * 监听歌曲信息变化
   */
  private listenMusicInfo(): void {
    const handler = (playMusicInfo: any) => {
      if (!this.isEnabled) return
      logger.debug('PlayerSync', '歌曲信息变化', {
        musicName: playMusicInfo?.musicInfo?.name
      })
      // 歌曲切换时立即同步，不使用节流
      void this.syncState()
    }

    global.state_event.on('playMusicInfoChanged', handler)
    this.unsubscribers.push(() => {
      global.state_event.off('playMusicInfoChanged', handler)
    })
  }

  /**
   * 监听播放进度变化
   */
  private listenProgress(): void {
    const handler = (progress: any) => {
      if (!this.isEnabled) return
      // 进度变化频繁，使用节流
      this.throttledUpdate?.()
    }

    global.state_event.on('playProgressChanged', handler)
    this.unsubscribers.push(() => {
      global.state_event.off('playProgressChanged', handler)
    })
  }

  /**
   * 监听播放信息变化（列表、索引）
   */
  private listenPlayInfo(): void {
    const handler = (playInfo: any) => {
      if (!this.isEnabled) return
      logger.debug('PlayerSync', '播放信息变化', { playInfo })
      this.throttledUpdate?.()
    }

    global.state_event.on('playInfoChanged', handler)
    this.unsubscribers.push(() => {
      global.state_event.off('playInfoChanged', handler)
    })
  }

  /**
   * 同步当前状态到Firebase
   */
  private async syncState(): Promise<void> {
    try {
      const roomInfo = getRoomInfo()
      if (!roomInfo.isInRoom) {
        logger.warn('PlayerSync', '未在房间中，跳过同步')
        return
      }

      await updateRemoteState()
    } catch (error) {
      logger.error('PlayerSync', '状态同步失败', error)
    }
  }

  /**
   * 检查同步是否启用
   */
  isActive(): boolean {
    return this.isEnabled
  }
}

// 导出单例
export default new FirebasePlayerSync()