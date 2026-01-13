/**
 * Firebase同步数据类型定义
 */

/**
 * Firebase歌曲信息
 */
export interface FirebaseMusicInfo {
  id: string
  name: string
  singer: string
  album: string
  source: LX.OnlineSource
  interval: string | null
  pic_url: string | null
  type: LX.Quality
}

/**
 * Firebase播放列表数据
 */
export interface FirebasePlaylistData {
  list_id: string
  list_name: string
  list_source: 'default' | 'love' | 'temp' | 'download' | 'user'
  musics: FirebaseMusicInfo[]
  updated_at: number
  version: number
}

/**
 * Firebase当前播放歌曲
 */
export interface FirebaseCurrentMusic {
  id: string
  name: string
  singer: string
  album: string
  pic_url: string | null
  list_id: string | null
  source: LX.OnlineSource
  interval: string | null
  type: LX.Quality
}

/**
 * Firebase播放状态
 */
export interface FirebasePlaybackStatus {
  is_playing: boolean
  current_time: number
  duration: number
  updated_at: number
}

/**
 * Firebase播放信息
 */
export interface FirebasePlayInfo {
  play_index: number
  player_list_id: string | null
  player_play_index: number
}

/**
 * Firebase完整播放状态
 */
export interface FirebasePlaybackState {
  current_music: FirebaseCurrentMusic | null
  play_info: FirebasePlayInfo
  status: FirebasePlaybackStatus
  controller_id: string
}

/**
 * Firebase房间信息
 */
export interface FirebaseRoomInfo {
  roomCode: string
  createdAt: number
  participants: {
    [userId: string]: {
      joinedAt: number
      deviceName: string
    }
  }
}