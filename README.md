这条 Git 提交消息的翻译如下：

**feat(sync): 添加 Firebase 跨设备同步功能**

添加基于 Firebase 的实时同步功能，以实现在非局域网设备之间同步播放状态。实现了基于“房间”连接的主控/从属（controller/follower）模式。

- 添加 Firebase 依赖项 (@react-native-firebase/app, auth, database)
- 在 Android 构建文件中配置 Firebase 及 google-services 插件
- 创建包含房间管理和状态同步功能的 Firebase 同步模块
- 添加用于创建/加入房间的 FirebaseSync UI 组件
- 实现 Firebase 连接和房间状态的状态事件处理
- 为 Firebase 同步界面添加多语言翻译 (en-us, zh-cn, zh-tw)
- 导出 Firebase 同步函数，与现有的局域网同步功能并存
- 包含 Firebase 设置文档和相关配置文件

---

**翻译建议与术语：**
*   **feat(sync):** 这里的 `feat` 是功能开发，`sync` 是作用域（同步模块）。
*   **Controller/Follower pattern:** 译为“主控/从属模式”或“控制者/跟随者模式”。
*   **Room-based connections:** 译为“基于房间的连接”，通常指用户通过输入房间号来匹配。
*   **Local network sync:** 译为“局域网同步”，指设备在同一个 Wi-Fi 下的同步方式。