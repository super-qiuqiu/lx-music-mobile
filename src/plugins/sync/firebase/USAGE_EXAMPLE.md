# Firebase播放器同步使用示例

## 快速开始

### 1. 基础使用

```typescript
import {
  connectFirebaseRoom,
  joinFirebaseRoom,
  disconnectFirebase,
  getFirebaseRoomInfo,
} from '@/plugins/sync'

// 创建房间（主控端）
async function createRoom() {
  try {
    const { roomId, roomCode } = await connectFirebaseRoom()
    console.log('房间创建成功！')
    console.log('房间码:', roomCode) // 例如: ABC123
    console.log('房间ID:', roomId)
    
    // 播放器状态会自动同步
    // 无需手动调用同步函数
  } catch (error) {
    console.error('创建房间失败:', error.message)
  }
}

// 加入房间（从端）
async function joinRoom(roomCode: string) {
  try {
    const roomId = await joinFirebaseRoom(roomCode)
    console.log('加入房间成功！')
    console.log('房间ID:', roomId)
    
    // 自动接收并应用主控端的播放状态
  } catch (error) {
    console.error('加入房间失败:', error.message)
  }
}

// 断开连接
async function disconnect() {
  try {
    await disconnectFirebase()
    console.log('已断开连接')
  } catch (error) {
    console.error('断开连接失败:', error.message)
  }
}

// 获取房间信息
function checkRoomStatus() {
  const info = getFirebaseRoomInfo()
  console.log('房间信息:', {
    在房间中: info.isInRoom,
    房间码: info.roomCode,
    已连接: info.isConnected,
    连接状态: info.connectionStatus,
  })
}
```

### 2. React组件中使用

```typescript
import { useState, useCallback } from 'react'
import {
  connectFirebaseRoom,
  joinFirebaseRoom,
  disconnectFirebase,
  getFirebaseRoomInfo,
} from '@/plugins/sync'

function FirebaseSyncComponent() {
  const [isConnected, setIsConnected] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [status, setStatus] = useState('disconnected')

  // 创建房间
  const handleCreateRoom = useCallback(async () => {
    try {
      setStatus('connecting')
      const result = await connectFirebaseRoom()
      
      setIsConnected(true)
      setRoomCode(result.roomCode)
      setStatus('connected')
      
      alert(`房间创建成功！房间码: ${result.roomCode}`)
    } catch (error) {
      console.error('创建房间失败:', error)
      setStatus('error')
      alert('创建房间失败: ' + error.message)
    }
  }, [])

  // 加入房间
  const handleJoinRoom = useCallback(async () => {
    if (!inputCode || inputCode.length !== 6) {
      alert('请输入6位房间码')
      return
    }

    try {
      setStatus('connecting')
      await joinFirebaseRoom(inputCode.toUpperCase())
      
      setIsConnected(true)
      setRoomCode(inputCode.toUpperCase())
      setInputCode('')
      setStatus('connected')
      
      alert('加入房间成功！')
    } catch (error) {
      console.error('加入房间失败:', error)
      setStatus('error')
      alert('加入房间失败: ' + error.message)
    }
  }, [inputCode])

  // 断开连接
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectFirebase()
      
      setIsConnected(false)
      setRoomCode('')
      setStatus('disconnected')
      
      alert('已断开连接')
    } catch (error) {
      console.error('断开连接失败:', error)
      alert('断开连接失败')
    }
  }, [])

  return (
    <View>
      <Text>Firebase 同步状态: {status}</Text>
      
      {isConnected ? (
        <View>
          <Text>房间码: {roomCode}</Text>
          <Button onPress={handleDisconnect}>断开连接</Button>
        </View>
      ) : (
        <View>
          <Button onPress={handleCreateRoom}>创建房间</Button>
          
          <Input
            value={inputCode}
            onChangeText={setInputCode}
            placeholder="输入6位房间码"
            maxLength={6}
          />
          <Button onPress={handleJoinRoom}>加入房间</Button>
        </View>
      )}
    </View>
  )
}
```

### 3. 主控权管理

```typescript
import {
  isFirebaseController,
  setFirebaseController,
  getFirebaseRoomInfo,
} from '@/plugins/sync'

// 检查是否为主控端
async function checkController() {
  const isController = await isFirebaseController()
  console.log('是否为主控端:', isController)
  return isController
}

// 转移主控权到当前设备
async function takeControl() {
  try {
    await setFirebaseController()
    console.log('已成为主控端')
  } catch (error) {
    console.error('获取主控权失败:', error)
  }
}

// 转移主控权到指定用户
async function transferControl(userId: string) {
  try {
    await setFirebaseController(userId)
    console.log(`主控权已转移到用户: ${userId}`)
  } catch (error) {
    console.error('转移主控权失败:', error)
  }
}
```

### 4. 监听连接状态变化

```typescript
import { onFirebaseStatusChange } from '@/plugins/sync'

function setupStatusListener() {
  // 监听连接状态变化
  const unsubscribe = onFirebaseStatusChange((status) => {
    console.log('连接状态变化:', status)
    
    switch (status) {
      case 'connected':
        console.log('✅ 已连接到Firebase')
        break
      case 'connecting':
        console.log('🔄 正在连接...')
        break
      case 'disconnected':
        console.log('❌ 已断开连接')
        break
      case 'error':
        console.log('⚠️ 连接错误')
        break
    }
  })
  
  // 组件卸载时取消监听
  return () => {
    unsubscribe()
  }
}

// 在React组件中使用
function Component() {
  useEffect(() => {
    const unsubscribe = setupStatusListener()
    return unsubscribe
  }, [])
  
  // ...
}
```

### 5. 手动触发状态同步

```typescript
import {
  updateFirebaseState,
  syncFirebaseState,
} from '@/plugins/sync'

// 立即上报当前状态（仅主控端有效）
async function updateState() {
  try {
    await updateFirebaseState()
    console.log('状态已上报')
  } catch (error) {
    console.error('状态上报失败:', error)
  }
}

// 强制同步完整状态
async function forceSync() {
  try {
    await syncFirebaseState()
    console.log('完整状态已同步')
  } catch (error) {
    console.error('状态同步失败:', error)
  }
}
```

## 完整示例：两台设备同步播放

### 设备A（主控端）

```typescript
import { connectFirebaseRoom } from '@/plugins/sync'
import { play, setPlayMusicInfo } from '@/core/player/player'

async function setupController() {
  // 1. 创建房间
  const { roomCode } = await connectFirebaseRoom()
  console.log('📱 设备A - 房间码:', roomCode)
  
  // 2. 播放音乐
  // 假设已有歌曲信息
  const musicInfo = {
    id: 'song123',
    name: '测试歌曲',
    singer: '测试歌手',
    // ... 其他信息
  }
  
  setPlayMusicInfo('default', musicInfo, false)
  await play()
  
  console.log('🎵 设备A - 开始播放')
  // 播放状态会自动同步到Firebase
  // 设备B会自动接收并播放相同歌曲
}
```

### 设备B（从端）

```typescript
import { joinFirebaseRoom } from '@/plugins/sync'

async function setupFollower(roomCode: string) {
  // 1. 加入房间
  await joinFirebaseRoom(roomCode)
  console.log('📱 设备B - 已加入房间')
  
  // 2. 自动接收状态
  // 无需手动操作，播放器会自动：
  // - 播放相同歌曲
  // - 同步播放进度
  // - 同步播放/暂停状态
  
  console.log('🎵 设备B - 开始同步播放')
}
```

## 错误处理

```typescript
import {
  connectFirebaseRoom,
  joinFirebaseRoom,
} from '@/plugins/sync'

// 带错误处理的创建房间
async function safeCreateRoom() {
  try {
    const result = await connectFirebaseRoom()
    return { success: true, data: result }
  } catch (error) {
    console.error('创建房间错误:', error)
    
    // 根据错误类型处理
    if (error.message.includes('Firebase未连接')) {
      return { success: false, error: '网络连接失败' }
    } else if (error.message.includes('用户ID不存在')) {
      return { success: false, error: '认证失败' }
    } else {
      return { success: false, error: '未知错误' }
    }
  }
}

// 带重试的加入房间
async function joinRoomWithRetry(roomCode: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const roomId = await joinFirebaseRoom(roomCode)
      return { success: true, roomId }
    } catch (error) {
      console.log(`尝试 ${i + 1}/${maxRetries} 失败:`, error.message)
      
      if (i === maxRetries - 1) {
        return { success: false, error: error.message }
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## 最佳实践

### 1. 房间生命周期管理

```typescript
class RoomManager {
  private roomId: string | null = null
  private roomCode: string | null = null

  async createRoom() {
    if (this.roomId) {
      console.warn('已在房间中')
      return
    }

    const result = await connectFirebaseRoom()
    this.roomId = result.roomId
    this.roomCode = result.roomCode
    
    return result
  }

  async joinRoom(code: string) {
    if (this.roomId) {
      console.warn('已在房间中，先退出当前房间')
      await this.leaveRoom()
    }

    this.roomId = await joinFirebaseRoom(code)
    this.roomCode = code
  }

  async leaveRoom() {
    if (!this.roomId) {
      console.warn('未在房间中')
      return
    }

    await disconnectFirebase()
    this.roomId = null
    this.roomCode = null
  }

  getRoomInfo() {
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      isInRoom: this.roomId !== null,
    }
  }
}
```

### 2. 用户提示优化

```typescript
async function createRoomWithUI() {
  // 显示加载提示
  showLoading('正在创建房间...')

  try {
    const { roomCode } = await connectFirebaseRoom()
    
    hideLoading()
    
    // 显示房间码
    showRoomCodeDialog({
      title: '房间创建成功！',
      message: `请将房间码分享给朋友：\n\n${roomCode}`,
      showCopyButton: true,
    })
  } catch (error) {
    hideLoading()
    showError('创建房间失败，请重试')
  }
}
```

### 3. 自动重连

```typescript
let reconnectTimer: NodeJS.Timeout | null = null

function setupAutoReconnect(roomCode: string) {
  onFirebaseStatusChange((status) => {
    if (status === 'disconnected' || status === 'error') {
      console.log('连接断开，5秒后尝试重连...')
      
      reconnectTimer = setTimeout(async () => {
        try {
          await joinFirebaseRoom(roomCode)
          console.log('重连成功')
        } catch (error) {
          console.error('重连失败:', error)
        }
      }, 5000)
    } else if (status === 'connected') {
      // 清除重连定时器
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }
  })
}
```

## 注意事项

1. **房间码分享**: 房间码应通过安全的方式分享（如二维码、聊天工具）
2. **网络要求**: 确保设备有稳定的网络连接
3. **主控权**: 默认创建者为主控端，可通过 `setFirebaseController` 转移
4. **资源清理**: 组件卸载时记得调用 `disconnectFirebase()`
5. **并发控制**: 避免同时创建多个房间或频繁加入/退出