/**
 * Firebase错误处理工具
 */
import logger from './logger'

export enum FirebaseErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  INVALID_ROOM_CODE = 'INVALID_ROOM_CODE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface FirebaseError {
  code: FirebaseErrorCode
  message: string
  details?: any
}

/**
 * 创建Firebase错误
 */
export function createFirebaseError(
  code: FirebaseErrorCode,
  message: string,
  details?: any
): FirebaseError {
  return {
    code,
    message,
    details,
  }
}

/**
 * 解析Firebase原生错误
 */
export function parseFirebaseError(error: any): FirebaseError {
  // Firebase特定错误代码映射
  const errorCodeMap: Record<string, FirebaseErrorCode> = {
    'auth/network-request-failed': FirebaseErrorCode.NETWORK_ERROR,
    'database/permission-denied': FirebaseErrorCode.PERMISSION_DENIED,
    'database/disconnected': FirebaseErrorCode.CONNECTION_FAILED,
  }

  // 检查是否是Firebase错误
  if (error?.code && errorCodeMap[error.code]) {
    return createFirebaseError(
      errorCodeMap[error.code],
      error.message || '未知错误',
      error
    )
  }

  // 通用错误处理
  if (error?.message) {
    if (error.message.includes('network')) {
      return createFirebaseError(
        FirebaseErrorCode.NETWORK_ERROR,
        '网络连接失败，请检查网络设置',
        error
      )
    }
    if (error.message.includes('permission')) {
      return createFirebaseError(
        FirebaseErrorCode.PERMISSION_DENIED,
        '权限被拒绝，请检查Firebase配置',
        error
      )
    }
    if (error.message.includes('not found')) {
      return createFirebaseError(
        FirebaseErrorCode.ROOM_NOT_FOUND,
        '房间不存在或已过期',
        error
      )
    }
  }

  // 未知错误
  return createFirebaseError(
    FirebaseErrorCode.UNKNOWN_ERROR,
    error?.message || '发生未知错误',
    error
  )
}

/**
 * 获取用户友好的错误消息
 */
export function getUserFriendlyErrorMessage(error: FirebaseError): string {
  const messageMap: Record<FirebaseErrorCode, string> = {
    [FirebaseErrorCode.CONNECTION_FAILED]: '连接失败，请检查网络设置',
    [FirebaseErrorCode.ROOM_NOT_FOUND]: '房间不存在或已过期，请确认房间码是否正确',
    [FirebaseErrorCode.INVALID_ROOM_CODE]: '房间码格式不正确，应为6位字符',
    [FirebaseErrorCode.PERMISSION_DENIED]: 'Firebase权限不足，请检查配置',
    [FirebaseErrorCode.NETWORK_ERROR]: '网络错误，请检查网络连接',
    [FirebaseErrorCode.ALREADY_IN_ROOM]: '已在房间中，请先断开连接',
    [FirebaseErrorCode.NOT_INITIALIZED]: 'Firebase未初始化，请重试',
    [FirebaseErrorCode.SYNC_FAILED]: '同步失败，请重试',
    [FirebaseErrorCode.UNKNOWN_ERROR]: '发生未知错误，请重试',
  }

  return messageMap[error.code] || error.message
}

/**
 * 错误日志记录
 */
export function logError(context: string, error: FirebaseError): void {
  logger.error('ErrorHandler', `${context}`, {
    code: error.code,
    message: error.message,
    details: error.details,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 包装异步函数，添加错误处理
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      const firebaseError = parseFirebaseError(error)
      logError(context, firebaseError)
      throw firebaseError
    }
  }) as T
}

/**
 * 重试机制
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // 最后一次不等待
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        logger.debug('ErrorHandler', `重试 ${i + 1}/${maxRetries}`, { delayMs: delay })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}