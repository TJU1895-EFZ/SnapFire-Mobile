# SnapFire Mobile — 开发计划

- 依据文档：`docs/PRD.md` v1.0
- 计划版本：v1.0
- 日期：2026-10-24
- 目标平台：手机浏览器（Chrome / Edge / Safari）
- 项目关系：独立仓库，基于桌面版 SnapFire v1.0.0 代码衍生
- 桌面版仓库：`D:\github\SnapFire-MR实景枪战\`（完全不动）
- 移动端仓库：`D:\github\SnapFire-Mobile\`（新建）

---

## 0. 当前状态与完成定义

### 0.1 当前状态

- 桌面版 SnapFire v1.0.0 已发布，功能完整可用。
- 移动端 M0–M7 已实现（2026-10-24）：项目骨架、共享代码、IndexedDB、
  App 适配、建档与大厅、触屏输入、战斗页、PWA、局域网 HTTPS/WSS 代理。
- M8（真机 AI 性能实测）与 M9（桌面 + 手机完整对局验收）仍待执行。

### 0.2 完成定义（DoD）

Mobile V1 视为完成，必须同时满足：

1. `npm run typecheck` 通过。
2. `npm run build` 通过，`dist/` 产物可部署到任意静态服务器。
3. 桌面版房主 + 手机客户端在同一局域网内可完成一整局比赛。
4. 建档、开火、扣血、阵亡复活、计时/击杀上限、结算全部可用。
5. 玩家档案、设置、建档、历史战绩关闭浏览器标签后不丢失。
6. 手机可 PWA 安装到主屏。
7. 触屏输入（虚拟扳机 + 滑动选目标）正常工作。
8. 不依赖互联网、登录、云数据库。

---

## 1. 技术方案与架构

### 1.1 技术栈

| 层 | 选型 | 用途 | 与桌面版差异 |
| --- | --- | --- | --- |
| 运行时 | 手机浏览器（Chrome/Edge/Safari） | 渲染 + 交互 | 无 Electron |
| PWA | manifest.json + service worker | 添加到主屏、离线缓存 | 桌面版无 |
| 构建 | Vite 8 | 前端构建 | 无 electron-vite |
| UI | React 19 + TypeScript 5.9 | 页面与状态 | 相同 |
| 3D/AR | Three.js 0.186 | 手臂、枪械、后坐力、枪口火花 | 相同 |
| 识别 | `@vladmandic/human` 3.3.6 | 人体姿态、人脸检测、人脸特征 | 相同（性能待验证） |
| 联机 | WebSocket API（浏览器原生） | 连接房主电脑 | 无 `ws` 包，无 LanServer |
| 持久化 | IndexedDB | 档案、设置、建档、历史 | 替代 Electron IPC + JSON 文件 |
| 样式 | 原生 CSS + CSS 变量 | 深色战术风；适配手机布局 | 新增移动端响应式样式 |

### 1.2 进程与模块

```
┌────────────────────────── 房主电脑 ──────────────────────────┐
│ Electron 主进程                                               │
│  ├─ LanServer：房间状态 + 比赛规则（唯一权威）                  │
│         ▲ WebSocket (ws://IP:端口)                             │
│         │                                                      │
│  渲染进程（房主）── 摄像头 / Human 识别 / Three.js / UI         │
└───────────────────────────────────────────────────────────────┘
                    ▲ 局域网 WebSocket
                    │
┌───────────────────┴───────────────────────────────────────────┐
│ 手机浏览器（PWA）── 同样的识别/AR/UI，纯客户端                   │
│ 各自 IndexedDB 保存档案、设置、建档、历史                        │
└───────────────────────────────────────────────────────────────┘
```

设计要点：

- **服务端权威**：与桌面版相同，所有游戏逻辑由房主电脑的 `LanServer` 决定。
- **识别在客户端**：手机用自己的摄像头识别目标；识别结果只上报"打中的是谁"。
- **不传视频**：局域网只同步昵称、队伍、识别特征、血量、比分、命中事件。
- **本地优先**：所有玩家数据存本机 IndexedDB。
- **时钟基准**：与桌面版相同，服务端下发 `serverNow`，客户端换算。

### 1.3 关键数据流

与桌面版相同，区别仅在于：

- 手机客户端通过局域网 WebSocket 连接房主；页面为 HTTPS 时使用 `wss://`，
  由独立代理转发到桌面版明文 `ws://127.0.0.1:端口`。
- 手机客户端不使用 `window.snapfire.*` IPC，直接使用 IndexedDB storage。
- 手机客户端不调用 `host.start/stop`（不跑服务器）。
- 手机客户端没有文件对话框（无备份导出/导入、无 Field Test 日志文件）。

---

## 2. 工程结构

```
SnapFire-Mobile/
├── docs/
│   ├── PRD.md                          ← 产品需求文档
│   └── DEV_PLAN.md                     ← 本文件
├── public/
│   ├── manifest.json                   ← PWA 清单
│   ├── icons/
│   │   ├── icon-192.png                ← 192×192 图标
│   │   └── icon-512.png                ← 512×512 图标
│   ├── service-worker.js               ← 唯一的 Service Worker 源文件
│   └── models/                         ← Human AI 离线模型
│       ├── blazeface.json / .bin
│       ├── faceres.json / .bin
│       ├── movenet-lightning.json / .bin
│       └── LICENSE-human.txt
├── src/
│   ├── shared/                         ← 从桌面版复制，不动
│   │   ├── types.ts                    ← 共享类型、协议、常量
│   │   └── fieldLog.ts                 ← 场地测试类型（仅类型，不使用）
│   ├── mobile/
│   │   ├── index.html                  ← PWA 入口 HTML
│   │   ├── index.tsx                   ← React 入口
│   │   ├── App.tsx                     ← 移动端 App 组件
│   │   ├── env.d.ts                    ← window 类型扩展
│   │   ├── net/                        ← 从桌面版复制，不动
│   │   │   └── NetClient.ts            ← WebSocket 客户端
│   │   ├── vision/                     ← 从桌面版复制，不动
│   │   │   ├── engine.ts               ← 连续识别引擎
│   │   │   ├── human.ts                ← Human 加载/检测
│   │   │   ├── enrollment.ts           ← 建档采集
│   │   │   └── descriptors.ts          ← 衣着/人脸匹配
│   │   ├── game/                       ← 从桌面版复制，不动
│   │   │   ├── audio.ts                ← 程序化音效
│   │   │   └── BattleScene.ts          ← 3D 手臂/枪/火花
│   │   ├── hooks/                      ← 从桌面版复制 + 新增
│   │   │   ├── useCamera.ts            ← 摄像头 hook（复制）
│   │   │   ├── useServerClock.ts       ← 服务器时钟 hook（复制）
│   │   │   └── useTouchInput.ts        ← 触屏输入 hook（新增）
│   │   ├── components/                 ← 从桌面版复制
│   │   │   ├── Icons.tsx               ← SVG 图标组件
│   │   │   └── OperatorArt.tsx         ← 首页角色（可选保留）
│   │   ├── utils/                      ← 从桌面版复制
│   │   │   ├── format.ts               ← 时间格式化
│   │   │   └── clipboard.ts            ← 剪贴板
│   │   ├── screens/                    ← 页面组件
│   │   │   ├── HomeScreen.tsx          ← 首页（精简布局 + 战绩汇总）
│   │   │   ├── RoomEntryScreen.tsx     ← 房间入口（无创建）
│   │   │   ├── LobbyScreen.tsx         ← 大厅（只读设置 + 建档入口）
│   │   │   ├── BattleScreen.tsx        ← 战斗页（摄像头 + 触屏 + 识别开火）
│   │   │   ├── ResultsScreen.tsx       ← 结算页（返回大厅/离开）
│   │   │   └── EnrollmentModal.tsx     ← 建档弹窗（正面/背面/侧面）
│   │   ├── components/
│   │   │   ├── SettingsModal.tsx       ← 设置弹窗（精简）
│   │   │   ├── HistoryModal.tsx        ← 战绩弹窗
│   │   │   ├── InstallPrompt.tsx       ← 添加到主屏提示
│   │   │   ├── ErrorBoundary.tsx       ← 渲染错误兜底
│   │   │   ├── Icons.tsx
│   │   │   └── OperatorArt.tsx
│   │   ├── storage/                    ← IndexedDB 存储
│   │   │   ├── index.ts                ← IndexedDB 封装
│   │   │   └── types.ts                ← 存储类型定义
│   │   ├── input/                      ← 触屏输入组件
│   │   │   ├── TriggerButton.tsx       ← 虚拟扳机按钮
│   │   │   └── TargetSelector.tsx      ← 滑动目标选择面板
│   │   ├── hooks/
│   │   │   ├── useCamera.ts            ← 手机摄像头参数
│   │   │   ├── useServerClock.ts
│   │   │   └── useTouchInput.ts        ← 选中目标状态
│   │   └── utils/stats.ts              ← 个人战绩汇总
│   └── styles/
│       ├── global.css                  ← 全局样式 + CSS 变量
│       └── screens.css                 ← 屏幕/弹窗/安全区/触屏样式
├── scripts/
│   ├── lan-proxy.mjs                   ← HTTPS 静态服务 + WSS 反向代理
│   ├── make-certs.mjs                  ← mkcert / OpenSSL 证书
│   └── smoke-lan.mjs                   ← 代理冒烟测试
├── docs/
│   ├── PRD.md
│   ├── DEV_PLAN.md
│   └── LAN_DEPLOY.md                   ← 局域网 HTTPS/WSS 部署
├── vite.config.ts                      ← Vite 构建配置
├── vitest.config.ts                    ← 单元测试配置
├── tsconfig.json                       ← TypeScript 配置
├── package.json                        ← 依赖与脚本（精简）
├── README.md                           ← 移动端说明
├── LICENSE                             ← Apache-2.0
└── THIRD_PARTY_NOTICES.md
```

### 2.1 从桌面版复制的模块与适配

以下模块以桌面版为基础；“原样复制”表示接口与行为不变，少量适配已在说明中列出。

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 共享类型 | `shared/types.ts`, `shared/fieldLog.ts` | 原样复制 |
| 网络层 | `net/NetClient.ts` | 原样复制；仅新增 `ws/wss` 协议自动解析 |
| AI 识别 | `vision/descriptors.ts`, `vision/enrollment.ts` | 原样复制 |
| AI 识别 | `vision/engine.ts`, `vision/human.ts` | 仅修改手机识别档位、模型绝对路径 |
| 3D 渲染 | `game/BattleScene.ts` | 原样复制 |
| 音频 | `game/audio.ts` | 原样复制 |
| 摄像头 | `hooks/useCamera.ts` | 改为手机分辨率/后置优先；增加安全上下文检查 |
| 服务器时钟 | `hooks/useServerClock.ts` | 原样复制 |
| UI 组件 | `components/Icons.tsx`, `utils/format.ts`, `utils/clipboard.ts` | 原样复制 |

### 2.2 从桌面版复制但需要修改的文件

| 文件 | 改动 |
| --- | --- |
| `screens/HomeScreen.tsx` | 精简右侧总览数据（去掉桌面专属统计）；布局适配手机 |
| `screens/RoomEntryScreen.tsx` | 移除"创建房间"按钮，只保留"加入房间" |
| `screens/LobbyScreen.tsx` | 设置区域改为只读（不显示修改控件） |
| `screens/BattleScreen.tsx` | **最大改动**：移除键盘事件，接入触屏输入；HUD 布局适配小屏；移除 Field Test 面板和调试面板 |
| `components/SettingsModal.tsx` | 移除备份导出/导入、Field Test 日志、调试开关；保留音量/质量/摄像头 |
| `screens/ResultsScreen.tsx` | 返回大厅/离开房间；本局与个人统计 |
| `screens/EnrollmentModal.tsx` | 移植并适配移动端布局；缩略图只在采集过程中使用，不持久化 |
| `components/HistoryModal.tsx` | 显示本人汇总；修复胜场/命中率统计 |
| `App.tsx` | **核心改动**：移除 `window.snapfire.*` IPC；接入 IndexedDB；移除 `host.start/stop`；按房间阶段驱动导航；网络回调使用 ref 读取最新状态 |

### 2.3 新增的文件

| 模块 | 文件 | 作用 |
| --- | --- | --- |
| IndexedDB 存储 | `storage/index.ts` | 封装 IndexedDB，替代 `window.snapfire.storage.*` |
| IndexedDB 存储 | `storage/types.ts` | 存储层类型定义 |
| 触屏输入 | `input/TriggerButton.tsx` | 屏幕右下角虚拟扳机按钮 |
| 触屏输入 | `input/TargetSelector.tsx` | 屏幕左侧滑动选目标面板 |
| 触屏输入 | `input/useTouchInput.ts` | 触屏事件汇总 hook |
| PWA | `public/manifest.json` | PWA 应用清单 |
| PWA | `public/service-worker.js` | 唯一的 Service Worker（离线壳 + 缓存策略） |
| PWA | `src/mobile/components/InstallPrompt.tsx` | 添加到主屏提示 |
| 部署 | `scripts/lan-proxy.mjs` | HTTPS 静态服务 + WSS 反向代理 |
| 部署 | `scripts/make-certs.mjs` | mkcert / OpenSSL 证书生成 |
| 样式 | `src/styles/global.css` | 全局样式 + CSS 变量 |
| 样式 | `src/styles/screens.css` | 屏幕/弹窗/安全区/触屏样式 |
| 构建 | `vite.config.ts` | 纯 Vite 构建配置 |
| 构建 | `package.json` | 精简依赖（无 Electron） |
| 入口 | `index.html` | PWA 入口 HTML |
| 入口 | `index.tsx` | React 入口 |
| 入口 | `App.tsx` | 移动端 App 组件 |

---

## 3. 里程碑总览

| 里程碑 | 目标 | 依赖 | 状态 |
| --- | --- | --- | --- |
| M0 | 项目骨架搭建 | — | ✅ |
| M1 | 复制共享代码（不动的模块） | M0 | ✅（含 `public/models/`） |
| M2 | IndexedDB 存储层 | M0 | ✅ |
| M3 | App 适配（去掉 IPC，接入 IndexedDB） | M1, M2 | ✅ |
| M4 | 屏幕组件适配（去掉桌面专属逻辑） | M3 | ✅（含建档弹窗） |
| M5 | 触屏输入层（虚拟扳机 + 目标选择） | M4 | ✅ |
| M6 | BattleScreen 适配（HUD 手机布局 + 触屏战斗） | M4, M5 | ✅ |
| M7 | PWA 配置（manifest + service worker + 图标） | M6 | ✅ |
| M7.5 | 局域网 HTTPS/WSS 部署（独立代理 + 桌面内嵌） | M7 | ✅ |
| M8 | AI 性能测试与调优 | M6 | ⬜ 待真机 |
| M9 | 桌面 + 手机联机验收 | M7, M8 | ⬜ 待真机 |

---

## 4. 可直接执行的开发阶段

### Phase M0：项目骨架搭建

目标：创建独立仓库，配置构建系统，能跑起一个空白页面。

- [ ] **M0.1 初始化仓库**
  - 在 `D:\github\SnapFire-Mobile\` 创建新仓库。
  - `git init`，创建 `.gitignore`（排除 `node_modules/`、`dist/`）。
  - 创建 `.claude/` 目录（可选）。

- [ ] **M0.2 创建 `package.json`**
  - 从桌面版 `package.json` 复制，移除以下依赖：
    - `electron`、`electron-builder`、`electron-vite`
    - `playwright-core`（桌面测试用）
    - `vitest`（后续可加，但 V1 先不加测试）
  - 保留以下依赖：
    - `react`、`react-dom`
    - `three`
    - `@vladmandic/human`
    - `@vitejs/plugin-react`
    - `vite`
    - `typescript`
    - `@types/node`、`@types/react`、`@types/react-dom`、`@types/three`
  - 新增脚本：
    - `dev`: `vite`
    - `build`: `tsc --noEmit && vite build`
    - `preview`: `vite preview`
    - `typecheck`: `tsc --noEmit`

- [ ] **M0.3 创建 `vite.config.ts`**
  - 使用 Vite + React 插件。
  - 配置别名：`@shared` → `src/shared`，`@mobile` → `src/mobile`。
  - 配置 `build.outDir = 'dist'`。
  - 配置 `server.host = '0.0.0.0'`（局域网访问）。

- [ ] **M0.4 创建 `tsconfig.json`**
  - 基于桌面版 `tsconfig.web.json`。
  - 配置路径别名。
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`。

- [ ] **M0.5 创建最小入口**
  - `index.html`：PWA 基本结构，`<div id="root">`。
  - `src/mobile/index.tsx`：ReactDOM render。
  - `src/mobile/App.tsx`：显示"SnapFire Mobile"标题的占位组件。
  - `src/styles/global.css`：最小样式（背景色、居中文字）。

- [ ] **M0.6 验证**
  - 运行 `npm run dev`。
  - 手机浏览器访问 `http://<电脑IP>:5173`，能看到标题。

**Phase M0 验收**：`npm run dev` 可启动 → 手机浏览器可见 → 无报错。

---

### Phase M1：复制共享代码

目标：把桌面版中不需要修改的模块完整复制过来。

- [ ] **M1.1 复制 `shared/`**
  - `src/shared/types.ts` → 不动。
  - `src/shared/fieldLog.ts` → 不动（仅类型，不使用）。

- [ ] **M1.2 复制 `net/`**
  - `src/mobile/net/NetClient.ts` → 不动。

- [ ] **M1.3 复制 `vision/`**
  - `src/mobile/vision/engine.ts` → 不动。
  - `src/mobile/vision/human.ts` → 不动。
  - `src/mobile/vision/descriptors.ts` → 不动。
  - `src/mobile/vision/enrollment.ts` → 不动。
  - `public/models/` → 复制 Human 离线模型（blazeface.json, faceres.json, movenet-lightning.json）。

- [ ] **M1.4 复制 `game/`**
  - `src/mobile/game/audio.ts` → 不动。
  - `src/mobile/game/BattleScene.ts` → 不动。

- [ ] **M1.5 复制 `hooks/`**
  - `src/mobile/hooks/useCamera.ts` → 不动。
  - `src/mobile/hooks/useServerClock.ts` → 不动。

- [ ] **M1.6 复制 `components/` 和 `utils/`**
  - `src/mobile/components/Icons.tsx` → 不动。
  - `src/mobile/components/OperatorArt.tsx` → 不动（首页用）。
  - `src/mobile/utils/format.ts` → 不动。
  - `src/mobile/utils/clipboard.ts` → 不动。

- [ ] **M1.7 验证**
  - `npm run typecheck` 通过。
  - 确认 `public/models/` 有 3 个模型文件。

**Phase M1 验收**：`npm run typecheck` 通过；所有共享代码就位。

---

### Phase M2：IndexedDB 存储层

目标：实现 IndexedDB 封装，提供与桌面版 `window.snapfire.storage.*` 相同的接口。

- [ ] **M2.1 设计 IndexedDB 结构**
  - Database: `snapfire-mobile`
  - Object Stores:
    - `profile`：keyPath = `'key'`，存储 `profile`、`settings`、`appearance`、`history` 四个键值对。
    - 或：四个独立 store（更清晰）。
  - 推荐：四个独立 store，每个 store 只有一个记录（key = `'current'`）。

- [ ] **M2.2 创建 `storage/types.ts`**
  - 定义存储层接口：
    ```ts
    interface StorageApi {
      loadProfile(): Promise<ProfileData>
      saveProfile(profile: ProfileData): Promise<void>
      loadSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<void>
      loadAppearance(): Promise<AppearanceData | null>
      saveAppearance(appearance: AppearanceData | null): Promise<void>
      loadHistory(): Promise<HistoryData>
      addHistory(result: MatchResult): Promise<HistoryData>
      clearHistory(): Promise<void>
      resetAll(): Promise<void>
      consumeWarnings(): Promise<string[]>
    }
    ```

- [ ] **M2.3 创建 `storage/index.ts`**
  - 实现 IndexedDB 打开/创建/读写。
  - 实现 `loadProfile`：返回默认值（生成新 playerId）如果不存在。
  - 实现 `saveProfile` / `saveSettings` / `saveAppearance` / `addHistory` / `clearHistory`。
  - 实现 `resetAll`：清空所有 store。
  - 实现 `consumeWarnings`：返回启动时的警告列表。
  - 错误处理：读取到损坏数据时跳过，记录 warning。

- [ ] **M2.4 验证**
  - 手动测试：打开 IndexedDB 检查器，确认数据写入/读取正确。
  - 关闭浏览器标签，重新打开，确认数据仍在。

**Phase M2 验收**：IndexedDB 读写正确；数据跨标签页持久化。

---

### Phase M3：App 适配

目标：去掉桌面版 `App.tsx` 的 Electron IPC 依赖，接入 IndexedDB storage。

- [ ] **M3.1 创建 `src/mobile/App.tsx`（基础版）**
  - 从桌面版 `App.tsx` 复制。
  - 移除 `window.snapfire.*` 所有调用。
  - 替换为 IndexedDB storage 调用：
    - `window.snapfire.storage.loadProfile()` → `storage.loadProfile()`
    - `window.snapfire.storage.saveProfile()` → `storage.saveProfile()`
    - 等等...
  - 移除 `host.start/stop` 相关逻辑（`createRoom` 中的 `window.snapfire.host.start()`）。
  - 移除 `backup.export/import` 相关逻辑。
  - 移除 `fieldLog` 相关逻辑。
  - 移除 `app.info()` 调用（或简化为返回固定版本字符串）。

- [ ] **M3.2 适配 `createRoom` → 移除**
  - 手机端不创建房间，移除 `createRoom` 函数。
  - `RoomEntryScreen` 只调用 `joinRoom`。

- [ ] **M3.3 适配网络事件处理**
  - 桌面版 `handleNetEvent` 中的 `welcome`、`room`、`gallery`、`match-start`、`match-end`、`error`、`socket-closed`、`socket-error` 事件处理基本不变。
  - 移除 `match-end` 中的 `window.snapfire.storage.addHistory()`，改用 `storage.addHistory()`。

- [ ] **M3.4 创建最小屏幕组件**
  - 从桌面版复制所有 `screens/*.tsx`。
  - 暂时不做修改，确保能编译通过。

- [ ] **M3.5 验证**
  - `npm run typecheck` 通过。
  - 启动后能看到首页（虽然是桌面版布局）。
  - IndexedDB 中能看到 profile/settings 数据。

**Phase M3 验收**：App 能启动、能读 IndexedDB 数据、能显示首页。

---

### Phase M4：屏幕组件适配

目标：去掉桌面专属逻辑，精简 UI。

- [ ] **M4.1 `RoomEntryScreen.tsx`**
  - 移除"创建房间"按钮和对应逻辑。
  - 只保留"加入房间"表单（地址输入 + 房间号输入）。

- [ ] **M4.2 `LobbyScreen.tsx`**
  - 设置区域改为只读显示（不显示修改控件）。
  - 移除"开始比赛"按钮（手机端不能开始）。
  - 保留"返回大厅"和"离开房间"按钮。

- [ ] **M4.3 `SettingsModal.tsx`**
  - 移除：备份导出、备份导入、Field Test 日志开关、调试信息开关、数据目录显示。
  - 保留：音量滑块、识别质量三档、摄像头设备下拉、清除本地数据（二次确认）。

- [ ] **M4.4 `HomeScreen.tsx`**
  - 精简右侧总览：去掉桌面专属统计项。
  - 布局适配手机竖屏（单列布局）。

- [ ] **M4.5 `BattleScreen.tsx`（基础适配）**
  - 移除 Field Test 面板（`settings.fieldTestLog` 相关）。
  - 移除调试面板（`settings.showDebug` 相关）。
  - 移除键盘事件监听（Space/Esc/数字键）。
  - 保留摄像头、Three.js、VisionEngine、网络事件处理。
  - 暂时保留桌面版 HUD 布局（后续 Phase M6 重新设计）。

- [ ] **M4.6 `ResultsScreen.tsx`**
  - 基本不动，微调布局。

- [ ] **M4.7 `EnrollmentModal.tsx`**
  - 基本不动，微调布局。

- [ ] **M4.8 `HistoryModal.tsx`**
  - 基本不动。

- [ ] **M4.9 验证**
  - `npm run typecheck` 通过。
  - 加入房间后能看到精简版大厅（只读设置、无开始按钮）。
  - 设置弹窗只有音量/质量/摄像头/清除数据。

**Phase M4 验收**：所有桌面专属功能已移除；手机端能正常加入房间、查看大厅。

---

### Phase M5：触屏输入层

目标：实现虚拟扳机和滑动目标选择。

- [ ] **M5.1 创建 `input/TriggerButton.tsx`**
  - 屏幕右下角固定位置的半透明圆形按钮。
  - 按下时放大 + 变色反馈。
  - 支持 `onFire` 回调。
  - 样式：`position: fixed; bottom: 20px; right: 20px;`。
  - 横屏模式：位置不变。

- [ ] **M5.2 创建 `input/TargetSelector.tsx`**
  - 屏幕左侧的垂直滑动面板。
  - 显示当前房间所有敌方玩家列表。
  - 手指上下滑动滚动列表。
  - 点击/松开选中目标。
  - 选中目标高亮显示。
  - 样式：`position: fixed; left: 0; top: 50%; transform: translateY(-50%);`。
  - 可收起/展开（点击边缘展开）。

- [ ] **M5.3 创建 `hooks/useTouchInput.ts`**
  - 汇总触屏输入状态：
    - `isFiring: boolean` — 扳机是否按下。
    - `selectedTargetId: string | null` — 选中的目标 ID。
    - `onFire(): void` — 触发开火回调。
    - `onSelectTarget(id: string | null): void` — 选择目标回调。
  - 处理 `touchstart`/`touchmove`/`touchend` 事件。
  - 防止默认滚动行为（战斗时）。

- [ ] **M5.4 验证**
  - 在任意页面上能看到虚拟扳机和目标选择面板。
  - 点击扳机触发回调。
  - 滑动选择目标正确更新状态。

**Phase M5 验收**：虚拟扳机和目标选择面板正常工作。

---

### Phase M6：BattleScreen 适配

目标：战斗页 HUD 重新布局适配手机，接入触屏输入。

- [ ] **M6.1 HUD 手机布局设计**
  - 顶部：比分 + 倒计时（精简，小字号）。
  - 左下：自己的血量条（精简）。
  - 右下：虚拟扳机按钮（不遮挡血量）。
  - 左侧：目标选择面板（可收起）。
  - 中心：准心（不变）。
  - 右上角：锁定目标提示（小字号）。
  - 击杀信息：不显示或极精简（手机屏幕太小）。
  - 阵亡遮罩：保留。
  - 倒计时遮罩：保留。

- [ ] **M6.2 接入触屏输入**
  - 在 `BattleScreen` 中集成 `useTouchInput`。
  - 虚拟扳机按下 → 调用 `fire()`。
  - 目标选择 → 更新 `intendedId`（用于 Field Test，手机端可简化）。
  - 移除所有键盘事件。

- [ ] **M6.3 摄像头优化**
  - 手机端降低摄像头分辨率目标（720p@15fps 或 480p@30fps）。
  - 在 `useCamera.ts` 中根据平台自动调整默认分辨率。
  - 或新增 `useCameraMobile` hook，专门针对手机优化。

- [ ] **M6.4 识别性能调优**
  - 手机端降低 `VisionEngine` 检测频率（从 200ms 拉到 400ms）。
  - 降低检测画布宽度（从 960px 降到 480px）。
  - 在 `BattleScreen` 中根据平台自动选择质量档位。

- [ ] **M6.5 横屏适配**
  - 监听 `orientationchange` 事件。
  - 横屏时重新布局 HUD（扳机在右下，目标选择在左下）。
  - 竖屏时 HUD 元素更紧凑。

- [x] **M6.6 样式**
  - 战斗 HUD 使用内联样式 + `src/styles/screens.css` 的通用类。
  - 确保摄像头画面全屏、HUD 元素按安全区布局、不错位。
  - 已通过 `touch-action: none`、`user-select: none`、viewport 限制防止缩放/长按菜单。

- [ ] **M6.7 验证**
  - 手机进入战斗页，摄像头画面正常。
  - 点击虚拟扳机能开火。
  - 滑动选择目标正常工作。
  - HUD 在手机屏幕上布局合理。

**Phase M6 验收**：手机端战斗页可正常运行，触屏输入有效。

---

### Phase M7：PWA 配置

目标：手机可添加到主屏，离线访问首页。

- [ ] **M7.1 创建 `public/manifest.json`**
  ```json
  {
    "name": "SnapFire Mobile",
    "short_name": "SnapFire",
    "description": "Mixed Reality Real-Person Gunfight",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#07090a",
    "theme_color": "#07090a",
    "orientation": "landscape",
    "icons": [
      { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```

- [ ] **M7.2 创建应用图标**
  - 使用桌面版图标或创建简化版。
  - 生成 192×192 和 512×512 的 PNG。

- [x] **M7.3 创建 `public/service-worker.js`**
  - 缓存核心资源（HTML、manifest、图标；模型首次使用时缓存）。
  - 首页离线可用；导航使用 Network First，更新可及时生效。
  - Vite 带有内容哈希的 `/assets/` 使用 Cache First。
  - 已删除根目录重复的 `service-worker.ts`，避免两份实现漂移。

- [ ] **M7.4 注册 Service Worker**
  - 在 `index.tsx` 中注册 service worker。
  - 添加 PWA 安装提示（当浏览器支持时）。

- [ ] **M7.5 验证**
  - Chrome for Android：能看到"添加到主屏幕"提示。
  - 添加到主屏后以独立窗口启动。
  - 离线打开首页正常。

**Phase M7 验收**：PWA 安装成功；离线首页可用。

---

### Phase M8：AI 性能测试与调优

目标：确认手机端 AI 识别性能可接受。

- [ ] **M8.1 性能测试页**
  - 创建一个最小测试页，只运行 Human 检测。
  - 显示每帧检测耗时、FPS。
  - 在手机 Chrome 上打开测试。

- [ ] **M8.2 实测与记录**
  - 在常用手机上测试：
    - 检测频率（130ms / 200ms / 340ms）的实际 FPS。
    - 检测画布宽度（480px / 720px / 960px）的实际耗时。
    - 不同质量档位的 CPU/温度变化。
  - 记录结果到 `docs/PERFORMANCE.md`。

- [ ] **M8.3 调优**
  - 根据测试结果调整默认参数：
    - 如果 200ms 档能跑 5fps+ → 保持 balanced。
    - 如果 200ms 档只有 2-3fps → 默认降到 performance（340ms）。
    - 如果 480px 画布能接受 → 使用 480px 作为手机默认。
  - 考虑换用 MediaPipe（如果 Human 在手机太慢）。

- [ ] **M8.4 验证**
  - 战斗页在目标手机上能持续运行，不卡死。
  - 识别结果与桌面版一致（正确性不受影响）。

**Phase M8 验收**：手机端 AI 识别性能可接受（≥ 3fps，无明显发热）。

---

### Phase M9：桌面 + 手机联机验收

目标：桌面版房主 + 手机客户端完成完整对局。

- [ ] **M9.1 基础联机**
  - 桌面版创建房间。
  - 手机输入地址和房间号加入。
  - 确认双方玩家列表一致。

- [ ] **M9.2 建档同步**
  - 手机端完成建档。
  - 桌面端能看到手机玩家的建档状态。

- [ ] **M9.3 战斗对射**
  - 桌面版 + 手机端同时进入战斗。
  - 手机端开火，桌面端收到命中。
  - 桌面版开火，手机端收到扣血。
  - 验证血量、比分、时间在双方一致。

- [ ] **M9.4 完整一局**
  - 打完一局，验证结算数据。
  - 手机端战绩保存到 IndexedDB。
  - 关闭浏览器标签，重新打开，战绩仍在。

- [ ] **M9.5 异常测试**
  - 手机断网 → 桌面端看到断开。
  - 手机关闭浏览器 → 桌面端看到断开。
  - 桌面房主关闭 → 手机端收到断开提示。

- [ ] **M9.6 记录**
  - 记录到 `docs/TEST_REPORT.md`。
  - 记录使用的设备型号、浏览器版本、识别性能数据。

**Phase M9 验收**：桌面 + 手机完成一整局比赛，所有功能正常。

---

## 5. 关键实现约定

### 5.1 WebSocket 协议

消息格式与桌面版完全相同，仍使用 `NetClient.ts`。地址解析会根据页面来源自动选择
`ws://` 或 `wss://`：

- `http://` 页面 → `ws://`
- `https://` 页面（局域网代理）→ `wss://`

代理（`scripts/lan-proxy.mjs`）负责 TLS 终止并把 WebSocket 转发到桌面版
`ws://127.0.0.1:17890`。

### 5.2 IndexedDB 存储接口

```ts
// 与桌面版 window.snapfire.storage.* 接口对齐
interface StorageApi {
  loadProfile(): Promise<ProfileData>
  saveProfile(profile: ProfileData): Promise<void>
  loadSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  loadAppearance(): Promise<AppearanceData | null>
  saveAppearance(appearance: AppearanceData | null): Promise<void>
  loadHistory(): Promise<HistoryData>
  addHistory(result: MatchResult): Promise<HistoryData>
  clearHistory(): Promise<void>
  resetAll(): Promise<void>
  consumeWarnings(): Promise<string[]>
}
```

### 5.3 手机摄像头默认参数（已落地）

`src/mobile/hooks/useCamera.ts`：

```ts
const MOBILE_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 15, min: 10 },
  facingMode: { ideal: 'environment' }
}
```

选择具体设备时去掉 `facingMode`，避免与 `deviceId` 冲突；非安全来源会直接给出
“需要 HTTPS”的提示。

### 5.4 手机 AI 识别默认参数（已落地）

`src/mobile/vision/engine.ts`：

```ts
const QUALITY_PRESETS = {
  performance: { intervalMs: 500, cropScale: 0.5,  maxWidth: 480 },
  balanced:    { intervalMs: 340, cropScale: 0.54, maxWidth: 480 },
  accurate:    { intervalMs: 200, cropScale: 0.62, maxWidth: 720 }
}
```

---

## 6. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| **Human 在手机太慢** | 识别帧率低，战斗卡顿 | 降低分辨率/频率；换 MediaPipe；手机端只做衣着识别（跳过人脸） |
| **手机摄像头差异大** | 某些手机画面质量差 | 提供摄像头选择；设置中显示实际分辨率 |
| **Safari 兼容性** | WebGL/IndexedDB 行为差异 | 额外在 Safari 上测试；必要时加 polyfill |
| **手机握持姿势** | 屏幕小，HUD 元素拥挤 | 优先横屏；精简 HUD；虚拟扳机不遮挡 |
| **浏览器后台限制** | 切到后台后识别暂停 | 使用 Web Worker；提醒用户不要切后台 |
| **PWA 安装率低** | 用户不知道可以添加到主屏 | 启动时显示"添加到主屏"引导 |
| **局域网 NAT 问题** | 手机连不上电脑 | README 说明；提供连接排查提示 |
| **触屏误触** | 滑动选目标时误操作 | 滑动区域与战斗区域分离；添加确认步骤 |

---

## 7. 交付物

1. 源代码（本仓库）。
2. `docs/PRD.md`、`docs/DEV_PLAN.md`、`docs/TEST_REPORT.md`。
3. `README.md`：手机端的安装、使用、排查。
4. `LICENSE`（Apache-2.0）、`THIRD_PARTY_NOTICES.md`。
5. PWA 可部署的 `dist/` 产物（静态文件）。
6. 部署方式：任意静态服务器（Nginx、GitHub Pages、Vercel 等），或局域网直连 `vite preview`。

---

## 8. 建议执行顺序（压缩版）

```
M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9
```

**关键路径**：M0 → M1 → M3 → M6 → M8 → M9。

- M6（BattleScreen 适配）是手机端工作量最大的阶段，包含 HUD 重新布局和触屏输入集成。
- M8（AI 性能测试）是最大风险点，如果 Human 在手机太慢需要尽早发现并调整方案。
- M7（PWA）可以并行于 M6，不阻塞主路径。

---

## 9. 实施记录（2026-10-24）

本次修复把 M0–M7 从“能编译”推进到“真机可跑”，重点如下：

### 9.1 安全上下文与部署

- 新增独立进程 `scripts/lan-proxy.mjs`：HTTPS 静态托管 `dist/` + WSS 反向代理，
  不修改桌面版仓库。
- 桌面版当前代码已把同样的 HTTPS/WSS 服务内嵌到 Electron 主进程：创建房间时
  自动启动，大厅显示手机地址、本地 CA 证书，以及二维码 / HTTP 安装页
  （手机扫码即可下载 CA 并打开客户端）；无需终端或独立代理。
  （实现位于桌面仓库 `src/main/mobileServer.ts`；已发布的 v1.0.0 便携包尚未包含，
  需重新构建桌面端。）
- 新增 `scripts/make-certs.mjs`：优先 mkcert，支持 OpenSSL 自签名兜底。
- `NetClient.normalizeHostAddress` 根据页面协议自动选择 `ws/wss`。
- 首页房间地址在局域网 HTTPS 页面下自动预填当前页面地址。
- 详见 `docs/LAN_DEPLOY.md`。

### 9.2 识别链路

- 从桌面版复制 `public/models/`（blazeface / faceres / movenet-lightning）。
- `human.ts` 使用基于 `document.baseURI` 的绝对模型地址。
- 摄像头参数改为 1280×720@15、优先后置；非安全来源给出明确错误。
- 识别档位改为手机参数（500/340/200ms，480/480/720px）。
- 新增建档弹窗：正面/背面必采、侧面可选；保存到 IndexedDB 并发送
  `set-appearance`；缩略图只在采集过程中使用，不持久化、不上传；处理服务端
  `gallery` 广播。

### 9.3 战斗与导航

- 修复摄像头从未启动、视频元素未绑定 `useCamera` ref 的问题。
- 修复 `match-start`/`room.phase` 不切屏导致战斗页不可达的问题。
- 修复网络监听捕获首次渲染闭包、受伤音效永不触发的问题。
- 开火时调用 `VisionEngine.analyzeNow()`；使用 `playerId` 而非昵称；
  队友/未识别/过期检测不会猜测目标；手动选择作为显式辅助。
- 补上复活倒计时、无敌提示、受击闪烁、准心、击杀信息。
- 结算页支持房主返回大厅；非房主等待房主操作。
- 大厅显示全员建档/准备状态和开局条件清单。

### 9.4 PWA 与工程

- 合并为唯一 `public/service-worker.js`；离线壳、模型缓存、版本清理。
- PWA 安装提示（Chrome/Edge + iOS 手动提示）。
- 战斗页与建档弹窗改为懒加载：主包从约 2.38 MB 降到约 265 KB。
- 新增 ErrorBoundary、初始化超时、连接失败留在入口页。
- 新增 Vitest：地址解析、身份匹配、IndexedDB 存储。
- 新增 `npm run smoke:lan`：验证 HTTPS、模型、Service Worker 头、目录穿越和
  WSS 转发。
- 新增 `npm run smoke:app`：用 Edge/Chrome + 模拟房间服务跑通首页 → 加入 →
  建档（摄像头）→ 倒计时 → 战斗（选目标/开火）→ 结算 → 首页。

### 9.5 仍待执行

- M8：在目标手机上实测识别 FPS/耗时/发热，记录到 `docs/PERFORMANCE.md`。
- M9：桌面房主 + 1~2 台手机完成建档、对射、复活、结算、断线验收，
  记录到 `docs/TEST_REPORT.md`。
