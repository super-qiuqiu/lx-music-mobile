import database from '@react-native-firebase/database'
import firebaseConnection from './connection'
import roomManager from './room'
import { setProgress } from '@/core/player/progress'
import { setIsPlay } from '@/core/player/playStatus'
import { setPlayMusicInfo } from '@/core/player/playInfo'
import playerState from '@/store/player/state'
import playerActions from '@/store/player/action'
import { getListMusics } from '@/core/list'
import logger from './logger'
import type { FirebaseCurrentMusic, FirebasePlayInfo } from './types'

/**
 * 播放状态数据结构
 */
interface FirebasePlaybackState {
  current_music: {
    id: string | null
    name: string
    singer: string
    album: string
    pic_url: string | null
    list_id: string | null
  } | null
  play_info: {
    play_index: number
    player_list_id: string | null
    player_play_index: number
  }
  status: {
    is_playing: boolean
    current_time: number
    duration: number
    updated_at: any
  }
  controller_id: string
}

/**
 * Firebase同步适配器
 */
class FirebaseSyncAdapter {
  private listeners: Array<() => void> = []
  private isListening = false
  private lastUpdateTime = 0
  private updateThrottleMs = 200 // 节流间隔
  private isUpdating = false

  /**
   * 开始监听远程状态变更
   */
  startListening(): void {
    if (this.isListening) {
      logger.debug('Sync', '已经在监听中')
      return
    }

    const roomId = roomManager.getCurrentRoomId()
    if (!roomId) {
      throw new Error('未在房间中')
    }

    this.isListening = true
    logger.info('Sync', '开始监听房间', { roomId })

    // 监听播放状态
    this.listenToPlaybackStatus(roomId)
    
    // 监听当前歌曲
    this.listenToCurrentMusic(roomId)
    
    // 监听播放信息
    this.listenToPlayInfo(roomId)
  }

  /**
   * 监听播放状态（播放/暂停、进度）
   */
  private listenToPlaybackStatus(roomId: string): void {
    const statusRef = database().ref(`sync_rooms/${roomId}/playback_state/status`)
    
    const listener = statusRef.on('value', async (snapshot) => {
      if (!snapshot.exists()) return
      
      const data = snapshot.val()
      const isController = await roomManager.isController()
      
      // 如果是主控端，不接收其他端的状态更新
      if (isController) return
      
      logger.info('Sync', '收到播放状态更新', {
        is_playing: data.is_playing,
        current_time: data.current_time,
        duration: data.duration,
      })
      
      try {
        // 更新播放状态
        setIsPlay(data.is_playing)
        
        // 更新播放进度
        setProgress(data.current_time || 0, data.duration || 0)
      } catch (error) {
        logger.error('Sync', '应用播放状态失败', error)
      }
    })

    this.listeners.push(() => statusRef.off('value', listener))
  }

  /**
   * 监听当前歌曲
   */
  private listenToCurrentMusic(roomId: string): void {
    const musicRef = database().ref(`sync_rooms/${roomId}/playback_state/current_music`)
    
    const listener = musicRef.on('value', async (snapshot) => {
      if (!snapshot.exists()) return
      
      const data: FirebaseCurrentMusic | null = snapshot.val()
      const isController = await roomManager.isController()
      
      // 如果是主控端，不接收其他端的歌曲更新
      if (isController) return
      
      logger.info('Sync', '收到歌曲更新', {
        musicId: data?.id,
        musicName: data?.name,
      })
      
      if (!data) {
        setPlayMusicInfo(null, null, false)
        return
      }
      
      try {
        // 转换为本地歌曲格式 - 使用any避免复杂的类型联合
        const musicInfo: LX.Music.MusicInfo = {
          id: data.id,
          name: data.name,
          singer: data.singer,
          source: data.source,
          interval: data.interval,
          meta: {
            songId: data.id,
            albumName: data.album || '',
            picUrl: data.pic_url || null,
            qualitys: [],
            _qualitys: data.type || {},
          } as any,
        } as any
        
        // 更新当前播放歌曲
        setPlayMusicInfo(data.list_id, musicInfo, false)
        
        logger.debug('Sync', '歌曲信息已同步')
      } catch (error) {
        logger.error('Sync', '应用歌曲信息失败', error)
      }
    })

    this.listeners.push(() => musicRef.off('value', listener))
  }

  /**
   * 监听播放信息
   */
  private listenToPlayInfo(roomId: string): void {
    const playInfoRef = database().ref(`sync_rooms/${roomId}/playback_state/play_info`)
    
    const listener = playInfoRef.on('value', async (snapshot) => {
      if (!snapshot.exists()) return
      
      const data: FirebasePlayInfo = snapshot.val()
      const isController = await roomManager.isController()
      
      // 如果是主控端，不接收其他端的播放信息更新
      if (isController) return
      
      logger.info('Sync', '收到播放信息更新', data)
      
      try {
        // 更新播放索引
        playerActions.updatePlayIndex(
          data.play_index ?? -1,
          data.player_play_index ?? -1
        )
        
        // 更新播放列表ID
        if (data.player_list_id &&
            data.player_list_id !== playerState.playInfo.playerListId) {
          playerActions.setPlayListId(data.player_list_id)
          
          // 确保列表已加载
          await this.ensureListLoaded(data.player_list_id)
        }
        
        logger.debug('Sync', '播放信息已同步')
      } catch (error) {
        logger.error('Sync', '应用播放信息失败', error)
      }
    })

    this.listeners.push(() => playInfoRef.off('value', listener))
  }

  /**
   * 确保列表已加载
   */
  private async ensureListLoaded(listId: string): Promise<void> {
    try {
      await getListMusics(listId)
      logger.debug('Sync', '列表已加载', { listId })
    } catch (error) {
      logger.warn('Sync', '加载列表失败', { listId, error })
    }
  }

  /**
   * 停止监听
   */
  stopListening(): void {
    if (!this.isListening) return
    
    logger.info('Sync', '停止监听')
    
    // 移除所有监听器
    this.listeners.forEach(unsubscribe => unsubscribe())
    this.listeners = []
    this.isListening = false
  }

  /**
   * 上报本地状态到Firebase（带节流）
   */
  async updateRemoteState(forceUpdate = false): Promise<void> {
    const roomId = roomManager.getCurrentRoomId()
    if (!roomId) {
      logger.debug('Sync', '未在房间中，跳过状态上报')
      return
    }

    const isController = await roomManager.isController()
    if (!isController && !forceUpdate) {
      // 非主控端不上报状态
      logger.debug('Sync', '非主控端，跳过状态上报')
      return
    }

    // 节流控制
    const now = Date.now()
    if (!forceUpdate && now - this.lastUpdateTime < this.updateThrottleMs) {
      return
    }

    if (this.isUpdating) {
      return
    }

    try {
      this.isUpdating = true
      this.lastUpdateTime = now

      const state = playerState
      
      // 准备上报数据
      const updates: any = {}

      // 播放状态
      updates[`sync_rooms/${roomId}/playback_state/status`] = {
        is_playing: state.isPlay,
        current_time: state.progress.nowPlayTime,
        duration: state.progress.maxPlayTime,
        updated_at: database.ServerValue.TIMESTAMP,
      }

      // 当前歌曲 - 包含完整信息
      if (state.playMusicInfo.musicInfo) {
        const musicInfo = state.playMusicInfo.musicInfo
        updates[`sync_rooms/${roomId}/playback_state/current_music`] = {
          id: musicInfo.id,
          name: musicInfo.name,
          singer: musicInfo.singer,
          album: ('meta' in musicInfo && musicInfo.meta.albumName) || '',
          pic_url: ('meta' in musicInfo && musicInfo.meta.picUrl) || null,
          list_id: state.playMusicInfo.listId,
          // 新增完整字段
          source: musicInfo.source,
          interval: musicInfo.interval,
          type: ('meta' in musicInfo && '_qualitys' in musicInfo.meta ? musicInfo.meta._qualitys : {}) as any,
        }
      } else {
        updates[`sync_rooms/${roomId}/playback_state/current_music`] = null
      }

      // 播放信息
      updates[`sync_rooms/${roomId}/playback_state/play_info`] = {
        play_index: state.playInfo.playIndex,
        player_list_id: state.playInfo.playerListId,
        player_play_index: state.playInfo.playerPlayIndex,
      }

      // 批量更新
      await database().ref().update(updates)

      logger.debug('Sync', '状态已上报')
    } catch (error) {
      logger.error('Sync', '上报状态失败', error)
    } finally {
      this.isUpdating = false
    }
  }

  /**
   * 立即同步当前完整状态
   */
  async syncCurrentState(): Promise<void> {
    await this.updateRemoteState(true)
  }

  /**
   * 检查是否在监听中
   */
  isActive(): boolean {
    return this.isListening
  }
}

export default new FirebaseSyncAdapter()