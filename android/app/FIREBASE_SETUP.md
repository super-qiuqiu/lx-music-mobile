# Firebase配置说明

## 如何获取 google-services.json

### 1. 创建Firebase项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击"添加项目"
3. 输入项目名称（例如：`lx-music-sync`）
4. 按提示完成项目创建

### 2. 添加Android应用

1. 在项目概览页面，点击Android图标
2. 填写以下信息：
   - **Android包名**: `cn.toside.music.mobile`
   - **应用昵称**: `LX Music Mobile`（可选）
   - **调试签名证书SHA-1**: （可选，调试用）

3. 点击"注册应用"

### 3. 下载配置文件

1. 下载 `google-services.json` 文件
2. 将文件放置到 `android/app/` 目录下

**最终路径**: `android/app/google-services.json`

### 4. 启用Firebase服务

在Firebase Console中启用以下服务：

#### 4.1 Authentication（认证）
1. 进入 Authentication > Sign-in method
2. 启用"匿名"登录方式

#### 4.2 Realtime Database（实时数据库）
1. 进入 Realtime Database
2. 点击"创建数据库"
3. 选择数据库位置（推荐：asia-southeast1）
4. 选择"以测试模式启动"

#### 4.3 配置数据库规则

进入 Realtime Database > 规则，使用以下规则：

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

### 5. 验证配置

配置完成后，目录结构应该是：

```
android/
├── app/
│   ├── google-services.json  ← 新增的文件
│   ├── build.gradle
│   └── src/
├── build.gradle
└── ...
```

## 注意事项

⚠️ **重要**：
- `google-services.json` 包含敏感信息，请勿提交到公共仓库
- 建议将其添加到 `.gitignore` 文件中

## 免费额度

Firebase的免费额度（Spark计划）对于2人使用完全足够：
- Realtime Database: 1GB存储 + 10GB/月下载
- 匿名认证: 无限制
- 并发连接: 100个

## 故障排查

如果遇到构建错误：
1. 确认 `google-services.json` 在正确的位置
2. 确认包名为 `cn.toside.music.mobile`
3. 清理项目：`cd android && ./gradlew clean`
4. 重新构建：`npm run dev`