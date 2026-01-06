/**
 * Firebase同步模块统一导出
 */

import firebaseConnection from './connection'
import roomManager from './room'
import syncAdapter from './sync'
import * as utils from './utils'

/**
 * 连接Firebase并创建房间
 */
export async function connectAndCreateRoom(): Promise<{ roomId: string; roomCode: string }> {
  try {
    // 初始化Firebase连接
    await firebaseConnection.initialize()
    
    // 创建房间
    const result = await roomManager.createRoom()
    
    // 开始监听状态变化
    syncAdapter.startListening()
    
    return result
  } catch (error) {
    console.error('[Firebase] 连接并创建房间失败:', error)
    throw error
  }
}

/**
 * 连接Firebase并加入房间
 */
export async function connectAndJoinRoom(roomCode: string): Promise<string> {
  try {
    // 格式化房间码
    const formattedCode = utils.formatRoomCode(roomCode)
    
    // 验证房间码格式
    if (!utils.validateRoomCode(formattedCode)) {
      throw new Error('房间码格式不正确')
    }
    
    // 初始化Firebase连接
    await firebaseConnection.initialize()
    
    // 加入房间
    const roomId = await roomManager.joinRoom(formattedCode)
    
    // 开始监听状态变化
    syncAdapter.startListening()
    
    return roomId
  } catch (error) {
    console.error('[Firebase] 连接并加入房间失败:', error)
    throw error
  }
}

/**
 * 断开Firebase连接
 */
export async function disconnectFirebase(): Promise<void> {
  try {
    // 停止状态同步
    syncAdapter.stopListening()
    
    // 离开房间
    await roomManager.leaveRoom()
    
    // 断开Firebase连接
    await firebaseConnection.disconnect()
  } catch (error) {
    console.error('[Firebase] 断开连接失败:', error)
    throw error
  }
}

/**
 * 获取当前房间信息
 */
export function getRoomInfo() {
  return {
    roomId: roomManager.getCurrentRoomId(),
    roomCode: roomManager.getCurrentRoomCode(),
    isInRoom: roomManager.isInRoom(),
    isConnected: firebaseConnection.isConnected(),
    connectionStatus: firebaseConnection.getStatus(),
  }
}

/**
 * 更新远程状态
 */
export async function updateRemoteState(): Promise<void> {
  await syncAdapter.updateRemoteState()
}

/**
 * 同步当前完整状态
 */
export async function syncCurrentState(): Promise<void> {
  await syncAdapter.syncCurrentState()
}

/**
 * 检查是否为主控端
 */
export async function isController(): Promise<boolean> {
  return await roomManager.isController()
}

/**
 * 设置主控端
 */
export async function setController(userId?: string): Promise<void> {
  await roomManager.setController(userId)
}

/**
 * 监听连接状态变化
 */
export function onConnectionStatusChange(callback: (status: string) => void) {
  return firebaseConnection.onStatusChange(callback)
}

// 导出工具函数
export { utils }

// 导出类型
export type { ConnectionStatus } from './connection'
export type { RoomInfo } from './room'