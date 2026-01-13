# Firebase 播放器状态同步

## 功能概述

Firebase播放器状态同步模块实现了跨设备的实时播放状态同步功能，允许两台或多台设备通过Firebase实时数据库同步播放状态。

## 架构设计

### 核心模块

1. **connection.ts** - Firebase连接管理
   - 匿名认证
   - 实时数据库连接
   - 连接状态监听

2. **room.ts** - 房间管理
   - 创建/加入/离开房间
   - 房间码生成与验证
   - 主控权管理

3. **sync.ts** - 状态同步适配器
   - 监听远程状态变化
   - 应用远程状态到本地播放器
   - 主控端判断逻辑

4. **playerSync.ts** - 播放器事件监听 (新增)
   - 监听本地播放器状态变化
   - 自动上报状态到Firebase
   - 事件节流优化

5. **utils.ts** - 工具函数
   - 房间码验证
   - 节流/防抖
   - 错误处理

## 工作流程

### 创建房间流程

```
主控端操作:
1. connectAndCreateRoom()
   ├─ firebaseConnection.initialize() - 初始化连接
   ├─ roomManager.createRoom() - 创建房间，获取房间码
   ├─ syncAdapter.startListening() - 开始监听远程状态
   └─ playerSync.start() - 启动播放器状态上报

2. 播放器状态变化时:
   ├─ global.state_event 触发事件
   ├─ playerSync 捕获事件
   ├─ 节流处理（200ms）
   └─ updateRemoteState() 上报到Firebase
```

### 加入房间流程

```
从端操作:
1. connectAndJoinRoom(roomCode)
   ├─ firebaseConnection.initialize() - 初始化连接
   ├─ roomManager.joinRoom(roomCode) - 加入房间
   ├─ syncAdapter.startListening() - 开始监听远程状态
   └─ playerSync.start() - 启动播放器状态上报（仅主控时生效）

2. 接收远程状态变化:
   ├─ Firebase数据库触发 value 事件
   ├─ syncAdapter 捕获变化
   ├─ 检查是否为从端（非主控端）
   └─ 应用状态到本地播放器
```

## 事件监听

### 播放器状态事件

播放器状态通过 `global.state_event` 广播，playerSync模块监听以下事件：

1. **playStateChanged** - 播放/暂停状态变化
2. **playMusicInfoChanged** - 当前歌曲信息变化
3. **playProgressChanged** - 播放进度变化
4. **playInfoChanged** - 播放列表信息变化

### 节流策略

- **进度更新**: 200ms节流，避免频繁上报
- **歌曲切换**: 立即同步，不使用节流
- **播放状态**: 200ms节流

## 主控端逻辑

### 主控端判断

- 房间创建者默认为主控端
- 主控端可以通过 `setController()` 转移控制权
- 只有主控端会上报播放状态到Firebase
- 从端只接收并应用远程状态

### 状态上报条件

```typescript
async updateRemoteState(forceUpdate = false) {
  // 1. 必须在房间中
  if (!roomId) return
  
  // 2. 必须是主控端（除非强制更新）
  const isController = await roomManager.isController()
  if (!isController && !forceUpdate) return
  
  // 3. 节流控制
  if (!forceUpdate && now - lastUpdateTime < 200) return
  
  // 4. 上报状态到Firebase
  await database().ref().update(updates)
}
```

## 数据结构

### Firebase数据库结构

```
sync_rooms/
  └─ {roomId}/
      ├─ session_info/
      │   ├─ roomCode: string
      │   ├─ createdAt: timestamp
      │   └─ participants/
      │       └─ {userId}/
      │           ├─ joinedAt: timestamp
      │           └─ deviceName: string
      │
      ├─ playback_state/
      │   ├─ controller_id: string
      │   ├─ current_music/
      │   │   ├─ id: string
      │   │   ├─ name: string
      │   │   ├─ singer: string
      │   │   ├─ album: string
      │   │   ├─ pic_url: string
      │   │   └─ list_id: string
      │   ├─ status/
      │   │   ├─ is_playing: boolean
      │   │   ├─ current_time: number
      │   │   ├─ duration: number
      │   │   └─ updated_at: timestamp
      │   └─ play_info/
      │       ├─ play_index: number
      │       ├─ player_list_id: string
      │       └─ player_play_index: number
      │
      └─ playlist/
          ├─ temp_play_list: array
          └─ played_list: array
```

## 使用示例

### 主控端创建房间

```typescript
import { connectFirebaseRoom } from '@/plugins/sync'

// 创建房间
const { roomId, roomCode } = await connectFirebaseRoom()
console.log('房间码:', roomCode) // 例如: ABC123

// 播放器状态会自动同步
// 无需手动调用同步函数
```

### 从端加入房间

```typescript
import { joinFirebaseRoom } from '@/plugins/sync'

// 输入房间码加入
const roomCode = 'ABC123'
const roomId = await joinFirebaseRoom(roomCode)

// 自动接收并同步主控端的播放状态
```

### 断开连接

```typescript
import { disconnectFirebase } from '@/plugins/sync'

// 离开房间并断开连接
await disconnectFirebase()
```

## 性能优化

### 1. 节流控制
- 播放进度更新频率控制在200ms
- 避免过度占用网络和Firebase资源

### 2. 批量更新
- 使用 `database().ref().update()` 批量更新多个字段
- 减少网络请求次数

### 3. 条件监听
- 主控端不监听自己上报的状态
- 从端不上报状态到Firebase

### 4. 自动清理
- 房间无人时自动删除
- 离开时自动取消事件监听

## 故障排查

### 常见问题

1. **状态不同步**
   - 检查Firebase规则配置
   - 确认设备网络连接
   - 查看控制台日志

2. **无法创建/加入房间**
   - 验证 google-services.json 配置
   - 检查Firebase Authentication和Database是否启用
   - 确认包名是否匹配

3. **主控权混乱**
   - 使用 `isController()` 检查当前主控状态
   - 必要时调用 `setController()` 重新分配

## 开发日志

- **2026-01-09**: 创建 playerSync.ts 模块，实现自动播放器状态上报
- **2026-01-09**: 集成播放器事件系统，支持实时状态同步
- **2026-01-09**: 优化节流策略和主控端判断逻辑