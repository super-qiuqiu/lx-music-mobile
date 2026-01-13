# Firebase播放器同步集成测试指南

## 测试环境准备

### 1. Firebase配置检查

确认以下文件已正确配置：
- ✅ `android/app/google-services.json` 存在
- ✅ `android/app/build.gradle` 包含 `apply plugin: 'com.google.gms.google-services'`
- ✅ Firebase Console 中已启用：
  - Authentication (匿名登录)
  - Realtime Database

### 2. 数据库规则配置

在 Firebase Console → Realtime Database → 规则中配置：

```json
{
  "rules": {
    "sync_rooms": {
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null",
        ".indexOn": ["updated_at"]
      }
    }
  }
}
```

## 功能测试

### 测试用例 1: 创建房间

**测试步骤:**
1. 打开设置 → 数据同步 → Firebase 跨设备同步
2. 点击"创建房间"按钮
3. 观察房间码显示

**预期结果:**
- ✅ 显示6位房间码（如: ABC123）
- ✅ 状态显示"已连接"
- ✅ 控制台输出: `[Firebase PlayerSync] 启动播放器状态同步`

**验证数据:**
在 Firebase Console 查看 Realtime Database，应该看到：
```
sync_rooms/
  └─ room_xxxxx/
      ├─ session_info/
      └─ playback_state/
```

### 测试用例 2: 播放状态同步

**测试步骤 (主控端):**
1. 创建房间后
2. 播放一首歌曲
3. 暂停播放
4. 继续播放

**预期结果:**
- ✅ 每次播放/暂停后控制台输出: `[Firebase PlayerSync] 播放状态变化: true/false`
- ✅ 控制台输出: `[Firebase Sync] 状态已上报 (主控端)`
- ✅ Firebase Database 中 `playback_state/status/is_playing` 更新

**验证方法:**
```javascript
// 在 Firebase Console 查看实时数据
sync_rooms/{roomId}/playback_state/status/
  ├─ is_playing: true/false
  ├─ current_time: 123.45
  ├─ duration: 300.0
  └─ updated_at: timestamp
```

### 测试用例 3: 歌曲切换同步

**测试步骤 (主控端):**
1. 在创建的房间中
2. 播放歌曲 A
3. 切换到歌曲 B
4. 切换到歌曲 C

**预期结果:**
- ✅ 每次切歌后控制台输出: `[Firebase PlayerSync] 歌曲信息变化: {歌曲名}`
- ✅ 立即同步，不等待节流
- ✅ Firebase Database 中 `current_music` 实时更新

**验证数据:**
```javascript
sync_rooms/{roomId}/playback_state/current_music/
  ├─ id: "musicId"
  ├─ name: "歌曲名"
  ├─ singer: "歌手名"
  ├─ album: "专辑名"
  ├─ pic_url: "图片URL"
  └─ list_id: "listId"
```

### 测试用例 4: 进度同步

**测试步骤 (主控端):**
1. 播放一首歌曲
2. 拖动进度条到不同位置
3. 观察同步频率

**预期结果:**
- ✅ 进度变化时触发节流更新（200ms间隔）
- ✅ 不会每秒上报多次
- ✅ Firebase Database 中 `current_time` 按节流频率更新

**性能验证:**
- 观察控制台日志，200ms内不应有重复上报
- 网络请求数量合理（约5次/秒）

### 测试用例 5: 加入房间 (从端)

**测试步骤:**
1. 在第二台设备上打开应用
2. 设置 → Firebase 同步 → 加入房间
3. 输入主控端的房间码
4. 点击确认

**预期结果:**
- ✅ 提示"房间加入成功"
- ✅ 显示相同的房间码
- ✅ 控制台输出: `[Firebase PlayerSync] 启动播放器状态同步`
- ✅ 控制台输出: `[Firebase Sync] 非主控端，跳过状态上报`

### 测试用例 6: 从端接收状态

**测试步骤:**
1. 从端加入房间后
2. 在主控端播放/暂停音乐
3. 在主控端切换歌曲
4. 观察从端的反应

**预期结果:**
- ✅ 从端自动播放/暂停
- ✅ 从端自动切换到相同歌曲
- ✅ 从端进度与主控端同步
- ✅ 控制台输出: `[Firebase Sync] 收到播放状态更新`
- ✅ 控制台输出: `[Firebase Sync] 收到歌曲更新`

### 测试用例 7: 断开连接

**测试步骤:**
1. 在已连接房间的设备上
2. 点击"断开连接"按钮

**预期结果:**
- ✅ 提示"已断开连接"
- ✅ 房间码消失
- ✅ 状态显示"未连接"
- ✅ 控制台输出: `[Firebase PlayerSync] 停止播放器状态同步`
- ✅ 如果房间无人，Firebase中房间数据被删除

### 测试用例 8: 主控权转移

**测试步骤:**
1. 主控端和从端都在房间中
2. 调用 `setFirebaseController(fromUserId)`
3. 观察行为变化

**预期结果:**
- ✅ 原主控端停止上报状态
- ✅ 新主控端开始上报状态
- ✅ Firebase Database 中 `controller_id` 更新

## 异常测试

### 异常用例 1: 网络断开

**测试步骤:**
1. 在房间中播放音乐
2. 关闭设备网络
3. 恢复网络

**预期结果:**
- ✅ 网络断开时本地播放不受影响
- ✅ 恢复网络后自动重连
- ✅ 状态重新同步

### 异常用例 2: 无效房间码

**测试步骤:**
1. 尝试加入不存在的房间码

**预期结果:**
- ✅ 提示"房间不存在"
- ✅ 不会崩溃

### 异常用例 3: 房间码格式错误

**测试步骤:**
1. 输入少于6位的房间码
2. 输入包含特殊字符的房间码

**预期结果:**
- ✅ 提示"房间码格式不正确"
- ✅ 不允许加入

## 性能测试

### 性能指标

**网络流量:**
- 播放一首歌（5分钟）的上报流量应该 < 100KB
- 进度更新频率: ~5次/秒

**CPU占用:**
- 播放器同步模块 CPU 占用应该 < 1%
- 不应影响音乐播放流畅性

**延迟:**
- 主控端操作到从端响应延迟应该 < 500ms
- 歌曲切换同步延迟应该 < 1s

## 调试技巧

### 1. 查看详细日志

在代码中启用详细日志：
```typescript
// 在 playerSync.ts 中取消注释所有 console.log
// 在 sync.ts 中取消注释所有 console.log
```

### 2. Firebase控制台实时监控

在 Firebase Console → Realtime Database 中：
- 启用"实时数据"视图
- 观察数据变化

### 3. 检查事件监听

在 Chrome DevTools 中：
```javascript
// 检查事件监听器是否正常
console.log(global.state_event._events)
```

### 4. 手动触发同步

```typescript
import { syncFirebaseState } from '@/plugins/sync'

// 手动触发完整状态同步
await syncFirebaseState()
```

## 已知限制

1. **播放列表同步**: 当前版本仅同步播放状态，完整播放列表同步需要后续实现
2. **离线模式**: 离线时无法同步，需要网络连接
3. **设备数量**: 建议同一房间不超过5台设备
4. **Firebase免费额度**: 注意监控Firebase使用量

## 问题排查清单

- [ ] Firebase配置文件是否正确
- [ ] Authentication是否启用匿名登录
- [ ] Realtime Database规则是否正确
- [ ] 网络连接是否正常
- [ ] 包名是否与Firebase配置匹配
- [ ] 是否有足够的Firebase免费额度
- [ ] 控制台是否有错误日志

## 测试报告模板

```markdown
## 测试报告

**测试日期**: YYYY-MM-DD
**测试人员**: XXX
**测试设备**: 
- 主控端: Android XX / iOS XX
- 从端: Android XX / iOS XX

### 功能测试结果

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| 创建房间 | ✅/❌ | |
| 播放状态同步 | ✅/❌ | |
| 歌曲切换同步 | ✅/❌ | |
| 进度同步 | ✅/❌ | |
| 加入房间 | ✅/❌ | |
| 从端接收状态 | ✅/❌ | |
| 断开连接 | ✅/❌ | |

### 性能指标

- 网络流量: XX KB
- 同步延迟: XX ms
- CPU占用: XX %

### 问题记录

1. [问题描述]
   - 重现步骤
   - 预期结果
   - 实际结果