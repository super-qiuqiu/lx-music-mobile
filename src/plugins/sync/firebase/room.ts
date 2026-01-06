import database from '@react-native-firebase/database'
import firebaseConnection from './connection'

/**
 * 房间信息接口
 */
export interface RoomInfo {
  roomCode: string
  createdAt: number
  participants: {
    [userId: string]: {
      joinedAt: number
      deviceName: string
    }
  }
}

/**
 * 房间管理类
 */
class RoomManager {
  private currentRoomId: string | null = null
  private currentRoomCode: string | null = null

  /**
   * 生成6位房间码
   */
  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 移除易混淆字符
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * 创建新房间
   */
  async createRoom(): Promise<{ roomId: string; roomCode: string }> {
    try {
      if (!firebaseConnection.isConnected()) {
        throw new Error('Firebase未连接')
      }

      const userId = firebaseConnection.getUserId()
      if (!userId) {
        throw new Error('用户ID不存在')
      }

      const roomCode = this.generateRoomCode()
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const roomData: RoomInfo = {
        roomCode,
        createdAt: database.ServerValue.TIMESTAMP as any,
        participants: {
          [userId]: {
            joinedAt: database.ServerValue.TIMESTAMP as any,
            deviceName: 'Android Device', // TODO: 获取实际设备名
          },
        },
      }

      // 创建房间
      await database().ref(`sync_rooms/${roomId}/session_info`).set(roomData)

      // 初始化播放状态
      await database().ref(`sync_rooms/${roomId}/playback_state`).set({
        current_music: null,
        play_info: {
          play_index: -1,
          player_list_id: null,
          player_play_index: -1,
        },
        status: {
          is_playing: false,
          current_time: 0,
          duration: 0,
          updated_at: database.ServerValue.TIMESTAMP,
        },
        controller_id: userId, // 创建者默认为主控
      })

      // 初始化播放列表
      await database().ref(`sync_rooms/${roomId}/playlist`).set({
        temp_play_list: [],
        played_list: [],
      })

      this.currentRoomId = roomId
      this.currentRoomCode = roomCode

      console.log(`[Firebase Room] 房间创建成功: ${roomCode}`)
      return { roomId, roomCode }
    } catch (error) {
      console.error('[Firebase Room] 创建房间失败:', error)
      throw error
    }
  }

  /**
   * 通过房间码加入房间
   */
  async joinRoom(roomCode: string): Promise<string> {
    try {
      if (!firebaseConnection.isConnected()) {
        throw new Error('Firebase未连接')
      }

      const userId = firebaseConnection.getUserId()
      if (!userId) {
        throw new Error('用户ID不存在')
      }

      // 查找房间
      const roomsSnapshot = await database()
        .ref('sync_rooms')
        .orderByChild('session_info/roomCode')
        .equalTo(roomCode)
        .once('value')

      if (!roomsSnapshot.exists()) {
        throw new Error('房间不存在')
      }

      // 获取第一个匹配的房间
      let roomId: string | null = null
      roomsSnapshot.forEach((childSnapshot) => {
        if (!roomId) {
          roomId = childSnapshot.key
        }
        return false // 只取第一个
      })

      if (!roomId) {
        throw new Error('房间ID获取失败')
      }

      // 加入房间
      await database()
        .ref(`sync_rooms/${roomId}/session_info/participants/${userId}`)
        .set({
          joinedAt: database.ServerValue.TIMESTAMP,
          deviceName: 'Android Device', // TODO: 获取实际设备名
        })

      this.currentRoomId = roomId
      this.currentRoomCode = roomCode

      console.log(`[Firebase Room] 加入房间成功: ${roomCode}`)
      return roomId
    } catch (error) {
      console.error('[Firebase Room] 加入房间失败:', error)
      throw error
    }
  }

  /**
   * 离开当前房间
   */
  async leaveRoom(): Promise<void> {
    try {
      if (!this.currentRoomId) {
        return
      }

      const userId = firebaseConnection.getUserId()
      if (!userId) {
        return
      }

      // 从参与者列表中移除
      await database()
        .ref(`sync_rooms/${this.currentRoomId}/session_info/participants/${userId}`)
        .remove()

      // 检查是否还有其他参与者
      const participantsSnapshot = await database()
        .ref(`sync_rooms/${this.currentRoomId}/session_info/participants`)
        .once('value')

      // 如果没有参与者了，删除整个房间
      if (!participantsSnapshot.exists() || !participantsSnapshot.hasChildren()) {
        await database().ref(`sync_rooms/${this.currentRoomId}`).remove()
        console.log(`[Firebase Room] 房间已删除: ${this.currentRoomCode}`)
      }

      console.log(`[Firebase Room] 离开房间: ${this.currentRoomCode}`)
      this.currentRoomId = null
      this.currentRoomCode = null
    } catch (error) {
      console.error('[Firebase Room] 离开房间失败:', error)
      throw error
    }
  }

  /**
   * 获取当前房间ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId
  }

  /**
   * 获取当前房间码
   */
  getCurrentRoomCode(): string | null {
    return this.currentRoomCode
  }

  /**
   * 检查是否在房间中
   */
  isInRoom(): boolean {
    return this.currentRoomId !== null
  }

  /**
   * 获取房间信息
   */
  async getRoomInfo(): Promise<RoomInfo | null> {
    if (!this.currentRoomId) {
      return null
    }

    try {
      const snapshot = await database()
        .ref(`sync_rooms/${this.currentRoomId}/session_info`)
        .once('value')
      
      return snapshot.val()
    } catch (error) {
      console.error('[Firebase Room] 获取房间信息失败:', error)
      return null
    }
  }

  /**
   * 检查是否为主控端
   */
  async isController(): Promise<boolean> {
    if (!this.currentRoomId) {
      return false
    }

    const userId = firebaseConnection.getUserId()
    if (!userId) {
      return false
    }

    try {
      const snapshot = await database()
        .ref(`sync_rooms/${this.currentRoomId}/playback_state/controller_id`)
        .once('value')
      
      return snapshot.val() === userId
    } catch (error) {
      console.error('[Firebase Room] 检查主控权失败:', error)
      return false
    }
  }

  /**
   * 设置主控端
   */
  async setController(userId?: string): Promise<void> {
    if (!this.currentRoomId) {
      throw new Error('未在房间中')
    }

    const controllerId = userId || firebaseConnection.getUserId()
    if (!controllerId) {
      throw new Error('用户ID不存在')
    }

    try {
      await database()
        .ref(`sync_rooms/${this.currentRoomId}/playback_state/controller_id`)
        .set(controllerId)
      
      console.log(`[Firebase Room] 主控权已设置: ${controllerId}`)
    } catch (error) {
      console.error('[Firebase Room] 设置主控权失败:', error)
      throw error
    }
  }
}

export default new RoomManager()