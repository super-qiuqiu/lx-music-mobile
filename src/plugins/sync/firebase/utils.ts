/**
 * Firebase工具函数
 */
import logger from './logger'

/**
 * 验证房间码格式
 */
export function validateRoomCode(code: string): boolean {
  // 房间码应为6位大写字母和数字组合
  const pattern = /^[A-Z0-9]{6}$/
  return pattern.test(code)
}

/**
 * 格式化房间码（转大写、移除空格）
 */
export function formatRoomCode(code: string): string {
  return code.toUpperCase().replace(/\s/g, '')
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let lastTime = 0
  let timeoutId: NodeJS.Timeout | null = null

  return function(this: any, ...args: Parameters<T>) {
    const now = Date.now()
    
    if (now - lastTime >= waitMs) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastTime = now
      func.apply(this, args)
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        lastTime = Date.now()
        func.apply(this, args)
        timeoutId = null
      }, waitMs - (now - lastTime))
    }
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args)
      timeoutId = null
    }, waitMs)
  }
}

/**
 * 安全执行异步函数，捕获错误
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: any) => void
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    logger.error('Utils', '异步操作失败', error)
    if (errorHandler) {
      errorHandler(error)
    }
    return null
  }
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      logger.debug('Utils', `重试 ${i + 1}/${maxRetries}...`)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)))
      }
    }
  }
  
  throw lastError
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Firebase错误码转换为友好提示
 */
export function getFirebaseErrorMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    'auth/network-request-failed': '网络连接失败，请检查网络',
    'auth/too-many-requests': '请求过于频繁，请稍后再试',
    'database/permission-denied': '权限不足，请检查Firebase规则',
    'database/disconnected': '数据库连接已断开',
    'database/network-error': '网络错误',
  }
  
  return messages[errorCode] || '操作失败，请重试'
}

/**
 * 检查网络连接状态
 */
export async function checkNetworkConnection(): Promise<boolean> {
  try {
    // 简单的网络检查
    const response = await fetch('https://www.google.com', {
      method: 'HEAD',
      mode: 'no-cors',
    })
    return true
  } catch {
    return false
  }
}