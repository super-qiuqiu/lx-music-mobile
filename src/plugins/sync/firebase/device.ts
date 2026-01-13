/**
 * Firebase设备信息管理
 */
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'
import logger from './logger'

class DeviceManager {
  private deviceName: string | null = null
  private deviceInfo: {
    name: string
    model: string
    os: string
    version: string
  } | null = null

  /**
   * 获取设备名称
   */
  async getDeviceName(): Promise<string> {
    if (this.deviceName) return this.deviceName

    try {
      // 尝试获取真实设备名
      this.deviceName = await DeviceInfo.getDeviceName()
      logger.debug('Device', '获取设备名称成功', this.deviceName)
    } catch (error) {
      logger.warn('Device', '获取设备名称失败，使用降级方案', error)
      
      // 降级方案：使用 型号 + 平台
      const model = DeviceInfo.getModel()
      const platform = Platform.OS
      this.deviceName = `${platform} ${model}`
    }

    return this.deviceName
  }

  /**
   * 获取完整设备信息
   */
  async getDeviceInfo(): Promise<{
    name: string
    model: string
    os: string
    version: string
  }> {
    if (this.deviceInfo) return this.deviceInfo

    try {
      this.deviceInfo = {
        name: await this.getDeviceName(),
        model: DeviceInfo.getModel(),
        os: Platform.OS,
        version: DeviceInfo.getSystemVersion(),
      }
      
      logger.debug('Device', '获取设备信息成功', this.deviceInfo)
    } catch (error) {
      logger.error('Device', '获取设备信息失败', error)
      
      // 降级方案
      this.deviceInfo = {
        name: 'Unknown Device',
        model: 'Unknown',
        os: Platform.OS,
        version: 'Unknown',
      }
    }

    return this.deviceInfo
  }

  /**
   * 清除缓存（用于测试）
   */
  clearCache(): void {
    this.deviceName = null
    this.deviceInfo = null
  }
}

export default new DeviceManager()