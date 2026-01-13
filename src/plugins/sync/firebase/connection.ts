import auth from '@react-native-firebase/auth'
import database from '@react-native-firebase/database'
import { withErrorHandler, retryWithBackoff, FirebaseErrorCode, createFirebaseError } from './errorHandler'
import logger from './logger'

/**
 * Firebase连接状态
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Firebase连接管理类
 */
class FirebaseConnection {
  private static instance: FirebaseConnection
  private connectionStatus: ConnectionStatus = 'disconnected'
  private currentUser: any = null
  private databaseRef: any = null
  private statusCallbacks: Array<(status: ConnectionStatus) => void> = []

  private constructor() {}

  static getInstance(): FirebaseConnection {
    if (!FirebaseConnection.instance) {
      FirebaseConnection.instance = new FirebaseConnection()
    }
    return FirebaseConnection.instance
  }

  /**
   * 初始化Firebase连接
   */
  async initialize(): Promise<void> {
    try {
      this.setStatus('connecting')
      
      // 使用重试机制初始化
      await retryWithBackoff(async () => {
        // 检查是否已有用户登录
        const currentUser = auth().currentUser
        if (currentUser) {
          this.currentUser = currentUser
        } else {
          // 使用匿名认证
          const userCredential = await auth().signInAnonymously()
          this.currentUser = userCredential.user
        }

        // 获取数据库引用
        this.databaseRef = database()
        
        // 监听连接状态
        const connectedRef = database().ref('.info/connected')
        connectedRef.on('value', (snapshot) => {
          if (snapshot.val() === true) {
            this.setStatus('connected')
          } else {
            this.setStatus('disconnected')
          }
        })

        this.setStatus('connected')
      }, 3, 1000)
    } catch (error) {
      logger.error('Connection', '初始化失败', error)
      this.setStatus('error')
      throw createFirebaseError(
        FirebaseErrorCode.CONNECTION_FAILED,
        'Firebase初始化失败',
        error
      )
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    try {
      // 移除所有监听器
      const connectedRef = database().ref('.info/connected')
      connectedRef.off()

      // 退出登录（可选，如果想保留匿名会话可以不退出）
      // await auth().signOut()
      
      this.setStatus('disconnected')
      this.currentUser = null
    } catch (error) {
      logger.error('Connection', '断开连接失败', error)
      throw error
    }
  }

  /**
   * 获取数据库引用
   */
  getDatabase() {
    if (!this.databaseRef) {
      throw createFirebaseError(
        FirebaseErrorCode.NOT_INITIALIZED,
        'Firebase数据库未初始化'
      )
    }
    return this.databaseRef
  }

  /**
   * 获取当前用户ID
   */
  getUserId(): string | null {
    return this.currentUser?.uid || null
  }

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * 设置连接状态
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      this.notifyStatusChange(status)
    }
  }

  /**
   * 订阅连接状态变化
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusCallbacks.push(callback)
    // 返回取消订阅函数
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index > -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 通知所有订阅者状态变化
   */
  private notifyStatusChange(status: ConnectionStatus): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status)
      } catch (error) {
        logger.error('Connection', '状态回调执行失败', error)
      }
    })
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected'
  }
}

export default FirebaseConnection.getInstance()