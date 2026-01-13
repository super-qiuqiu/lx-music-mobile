import database from '@react-native-firebase/database'
import roomManager from './room'
import { getListMusics, overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { userLists } from '@/utils/listManage'
import playerState from '@/store/player/state'
import logger from './logger'
import type { FirebasePlaylistData, FirebaseMusicInfo } from './types'

/**
 * Firebase播放列表同步管理器
 */
class FirebasePlaylistSync {
  private listeners: Array<() => void> = []
  private isListening = false
  private lastSyncTime = 0
  private syncThrottleMs = 5000 // 5秒节流，避免频繁同步
  private isSyncing = false
  private playlistVersion = 0
  private currentWatchingListId: string | null = null

  /**
   * 开始监听播放列表变化
   */
  startListening(): void {
    if (this.isListening) {
      logger.debug('PlaylistSync', '已在监听中')
      return
    }

    const roomId = roomManager.getCurrentRoomId()
    if (!roomId) {
      throw new Error('未在房间中')
    }

    this.isListening = true
    logger.info('PlaylistSync', '开始监听播放列表', { roomId })

    this.listenToPlaylist(roomId)
    this.listenToLocalPlaylistChanges()
  }

  /**
   * 监听播放列表
   */
  private listenToPlaylist(roomId: string): void {
    const playlistRef = database().ref(`sync_rooms/${roomId}/playlist`)

    const listener = playlistRef.on('value', async (snapshot) => {
      if (!snapshot.exists()) return

      const data: FirebasePlaylistData = snapshot.val()
      const isController = await roomManager.isController()

      // 主控端不接收播放列表更新
      if (isController) return

      logger.info('PlaylistSync', '收到播放列表更新', {
        listId: data.list_id,
        count: data.musics?.length || 0,
        version: data.version,
      })

      try {
        await this.handleRemotePlaylist(data)
      } catch (error) {
        logger.error('PlaylistSync', '应用播放列表失败', error)
      }
    })

    this.listeners.push(() => playlistRef.off('value', listener))
  }

  /**
   * 处理远程播放列表（从端接收）
   */
  private async handleRemotePlaylist(data: FirebasePlaylistData): Promise<void> {
    if (!data.musics || !Array.isArray(data.musics)) {
      logger.warn('PlaylistSync', '播放列表数据无效', data)
      return
    }

    // 1. 转换为本地格式 - 使用any避免复杂的类型联合
    const musics: LX.Music.MusicInfo[] = data.musics.map((m: FirebaseMusicInfo) => ({
      id: m.id,
      name: m.name,
      singer: m.singer,
      source: m.source,
      interval: m.interval,
      meta: {
        songId: m.id,
        albumName: m.album,
        picUrl: m.pic_url || null,
        qualitys: [],
        _qualitys: m.type || {},
      } as any,
    } as any))

    // 2. 更新本地播放列表
    const targetListId = data.list_id || LIST_IDS.TEMP
    await overwriteListMusics(targetListId, musics)

    logger.info('PlaylistSync', '播放列表已应用', {
      listId: targetListId,
      count: musics.length,
    })

    // 3. 如果当前无播放且列表不为空，自动播放第一首
    if (!playerState.playMusicInfo.musicInfo && musics.length > 0) {
      await this.autoPlayFirst(targetListId, musics[0])
    }
  }

  /**
   * 自动播放第一首（从端）
   */
  private async autoPlayFirst(listId: string, music: LX.Music.MusicInfo): Promise<void> {
    try {
      // 播放列表的第一首歌曲（index 0）
      await playList(listId, 0)
      
      logger.info('PlaylistSync', '自动播放第一首', {
        listId,
        musicId: music.id,
        musicName: music.name,
      })
    } catch (error) {
      logger.error('PlaylistSync', '自动播放失败', error)
    }
  }

  /**
   * 上报当前播放列表到Firebase（主控端）
   */
  async syncPlaylist(listId: string): Promise<void> {
    const roomId = roomManager.getCurrentRoomId()
    if (!roomId) {
      logger.debug('PlaylistSync', '未在房间中，跳过同步')
      return
    }

    const isController = await roomManager.isController()
    if (!isController) {
      logger.debug('PlaylistSync', '非主控端，跳过同步')
      return
    }

    // 节流控制
    const now = Date.now()
    if (now - this.lastSyncTime < this.syncThrottleMs) {
      logger.debug('PlaylistSync', '节流中，跳过同步')
      return
    }

    if (this.isSyncing) {
      logger.debug('PlaylistSync', '正在同步中，跳过')
      return
    }

    try {
      this.isSyncing = true
      this.lastSyncTime = now

      // 1. 获取列表完整信息
      const musics = await getListMusics(listId)
      const listInfo = this.getListInfo(listId)
      
      // 2. 转换为Firebase格式（包含完整歌曲信息）
      const playlistData: FirebasePlaylistData = {
        list_id: listId,
        list_name: listInfo.name,
        list_source: this.getListSource(listId),
        musics: musics.map(m => ({
          id: m.id,
          name: m.name,
          singer: m.singer,
          album: 'meta' in m ? m.meta.albumName : '',
          source: m.source,
          interval: m.interval,
          pic_url: ('meta' in m ? m.meta.picUrl : null) || null,
          type: ('meta' in m && '_qualitys' in m.meta ? m.meta._qualitys : {}) as any,
        })) as any,
        updated_at: Date.now(),
        version: this.playlistVersion++,
      }

      // 3. 上报到Firebase
      await database().ref(`sync_rooms/${roomId}/playlist`).set(playlistData)
      
      logger.info('PlaylistSync', '播放列表已上报', {
        listId,
        listName: listInfo.name,
        count: musics.length,
        version: playlistData.version,
      })
    } catch (error) {
      logger.error('PlaylistSync', '上报播放列表失败', error)
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * 获取列表信息
   */
  private getListInfo(listId: string): { name: string } {
    if (listId === LIST_IDS.DEFAULT) return { name: '默认列表' }
    if (listId === LIST_IDS.LOVE) return { name: '我的收藏' }
    if (listId === LIST_IDS.TEMP) return { name: '临时播放' }
    if (listId === LIST_IDS.DOWNLOAD) return { name: '下载列表' }
    
    const userList = userLists.find(l => l.id === listId)
    return { name: userList?.name || '播放列表' }
  }

  /**
   * 获取列表来源类型
   */
  private getListSource(listId: string): FirebasePlaylistData['list_source'] {
    if (listId === LIST_IDS.DEFAULT) return 'default'
    if (listId === LIST_IDS.LOVE) return 'love'
    if (listId === LIST_IDS.TEMP) return 'temp'
    if (listId === LIST_IDS.DOWNLOAD) return 'download'
    return 'user'
  }

  /**
   * 监听本地播放列表变化（主控端）
   */
  private listenToLocalPlaylistChanges(): void {
    // 监听播放列表歌曲变化事件
    const handlePlaylistChange = async (listId: string) => {
      logger.debug('PlaylistSync', '检测到播放列表变化', { listId })
      
      // 检查是否是当前监控的列表
      if (this.currentWatchingListId && this.currentWatchingListId === listId) {
        await this.syncPlaylist(listId)
      }
    }

    // 监听各种可能导致播放列表变化的事件
    const events = [
      'list_music_overwrite', // 覆盖列表
      'list_music_add',       // 添加歌曲
      'list_music_remove',    // 删除歌曲
      'list_music_move',      // 移动歌曲
      'list_music_update_position', // 更新位置
    ]

    events.forEach(eventName => {
      const handler = async (listId: string, ...args: any[]) => {
        await handlePlaylistChange(listId)
      }
      global.list_event.on(eventName as any, handler)
      this.listeners.push(() => global.list_event.off(eventName as any, handler))
    })

    logger.info('PlaylistSync', '本地播放列表变化监听已启动')
  }

  /**
   * 设置当前监控的播放列表
   */
  setWatchingListId(listId: string | null): void {
    this.currentWatchingListId = listId
    logger.debug('PlaylistSync', '更新监控列表ID', { listId })
  }

  /**
   * 停止监听
   */
  stopListening(): void {
    if (!this.isListening) return

    logger.info('PlaylistSync', '停止监听播放列表')

    this.listeners.forEach(unsubscribe => unsubscribe())
    this.listeners = []
    this.isListening = false
    this.currentWatchingListId = null
  }

  /**
   * 检查是否在监听中
   */
  isActive(): boolean {
    return this.isListening
  }
}

export default new FirebasePlaylistSync()