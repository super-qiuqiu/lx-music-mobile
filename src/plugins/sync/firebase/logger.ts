/**
 * Firebase统一日志管理系统
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class FirebaseLogger {
  private level: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO
  private prefix = '[Firebase]'

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * 调试日志 - 仅开发环境
   */
  debug(module: string, message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`${this.prefix}[${module}]`, message, data || '')
    }
  }

  /**
   * 信息日志
   */
  info(module: string, message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`${this.prefix}[${module}]`, message, data || '')
    }
  }

  /**
   * 警告日志
   */
  warn(module: string, message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`${this.prefix}[${module}]`, message, data || '')
    }
  }

  /**
   * 错误日志
   */
  error(module: string, message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`${this.prefix}[${module}]`, message, error || '')

      // 生产环境可以上报到错误监控服务
      if (!__DEV__) {
        this.reportError(module, message, error)
      }
    }
  }

  /**
   * 上报错误到监控服务
   */
  private reportError(module: string, message: string, error: any): void {
    // 集成错误监控服务（如 Sentry）
    // 示例：
    // try {
    //   Sentry.captureException(error, {
    //     tags: { module: 'firebase', submodule: module },
    //     extra: { message },
    //   })
    // } catch (e) {
    //   // 忽略上报失败
    // }
  }
}

export default new FirebaseLogger()