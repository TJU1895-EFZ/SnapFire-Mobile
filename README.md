# SnapFire Mobile

SnapFire 桌面版的**手机浏览器客户端**：手机摄像头当作瞄准镜，本地 AI 识别对手，
通过局域网加入桌面版房主创建的 3V3 现实枪战房间。

- 纯客户端：手机不创建房间、不跑服务器。
- 本地优先：档案、设置、建档、战绩全部保存在本机 IndexedDB。
- 不传视频/照片：房间内只同步识别特征与游戏状态。
- PWA：可添加到主屏，离线打开首页。

产品与规则见 [`docs/PRD.md`](docs/PRD.md)，开发计划见 [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md)。

## 模式

- **常规作战**：单人、团战（巷战 / 野战）、夺旗、拆弹。目前只有
  “团战 → 巷战”接入局域网房间，其余入口为占位。
- **长征胜利 90 周年纪念**：10 秒导读 → 常规 / 历史场景。常规沿用巷战规则，
  阵营显示为红军 / 国民党军，并在战斗画面按阵营叠加军服贴图。换装只影响
  屏幕显示，识别与命中判定仍使用原始摄像头画面。

---

## 1. 环境要求

| 项目 | 要求 |
| --- | --- |
| Node.js | 20.19+ / 22.12+（开发使用 24） |
| 房主电脑 | 运行桌面版 SnapFire，创建房间 |
| 手机 | Android Chrome/Edge 或 iOS Safari，与电脑同一 Wi-Fi |
| 网络 | 不需要互联网；但摄像头/PWA 需要 **HTTPS**（见下文） |

> **重要：** 浏览器只在 HTTPS 或 localhost 下允许 `getUserMedia` 和 Service Worker。
> 直接访问 `http://192.168.x.x` 摄像头会被禁用。请使用仓库自带的局域网 HTTPS 代理。

---

## 2. 快速开始

> **推荐：使用包含移动端支持的桌面版构建（当前桌面仓库代码）。**
> 桌面版创建房间时会自动启动内嵌手机服务，大厅会显示手机地址和 CA 证书路径；
> 只需在手机安装 CA 后打开该地址，无需终端。
> （v1.0.0 便携包不包含该服务；v1.1.0-rc.1 预发布包已包含。）
> 下面的独立代理步骤用于桌面版未内嵌、或需要单独部署手机资源的场景。

### 2.1 安装依赖

```bash
npm install
```

### 2.2 桌面版内嵌模式（推荐）

1. 在本仓库构建手机端：`npm run build`；
2. 启动桌面版，创建房间；
3. 大厅“手机加入”卡片会显示二维码和 HTTP 安装页；
4. 手机扫码打开安装页，先下载并安装 CA 证书（页面有 Android/iOS 步骤），
   再点“打开手机客户端”；
5. 输入 4 位房间号。

不想扫码时也可以手动把 `ca-cert.pem` 传到手机，然后直接打开卡片上的
HTTPS 客户端地址。证书只需每台手机安装一次。

桌面版开发模式会自动查找同级的 `../SnapFire-Mobile/dist`；打包版使用
`resources/mobile-dist`。不需要运行 `npm run lan`。

### 2.3 独立代理：生成局域网证书（每台房主电脑一次）

推荐安装 [mkcert](https://github.com/FiloSottile/mkcert)：

```bash
# Windows
winget install FiloSottile.mkcert

npm run lan:cert
```

没有 mkcert 时可临时生成自签名证书（手机需要手动信任）：

```bash
npm run lan:cert:selfsigned
```

### 2.4 独立代理：构建并启动

```bash
npm run lan:prod
```

或分步：

```bash
npm run build
npm run lan
```

终端会打印手机访问地址，例如：

```
手机访问 : https://192.168.1.20:8443
```

### 2.5 手机首次设置

1. 手机与电脑连接同一 Wi-Fi。
2. **安装根证书**（仅 mkcert 方案）：
   - Android：设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书；
     部分机型还需要在“信任的凭据 → 用户”中启用。
   - iOS：把 `rootCA.pem` 通过 AirDrop/文件传到手机，安装描述文件后，
     在 设置 → 通用 → 关于本机 → 证书信任设置 中开启完全信任。
   - 使用自签名证书时，安装 `certs/lan-cert.pem` 并信任。
3. 浏览器打开终端打印的 `https://...:8443` 地址。
4. 可选择“添加到主屏幕”。

### 2.6 加入房间

1. 在桌面版创建房间，记下 4 位房间号。
2. 手机首页 → **团战** → 输入地址和房间号。
   - 通过局域网代理访问时，地址已自动预填为当前页面地址，通常无需修改。
3. 进入大厅：选队、准备、**去建档**。
4. 所有玩家建档并准备后，由房主在桌面端点“开始比赛”。

---

## 3. 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本机开发（手机摄像头需 HTTPS，建议用 `npm run lan` 测真机） |
| `npm run typecheck` | TypeScript 检查 |
| `npm test` | Vitest 单元测试 |
| `npm run build` | 生产构建到 `dist/` |
| `npm run lan:cert` | 用 mkcert 生成 `certs/lan-{cert,key}.pem` |
| `npm run lan:cert:selfsigned` | 用 OpenSSL 生成自签名证书 |
| `npm run lan` | 启动 HTTPS 静态服务 + WSS 反向代理 |
| `npm run lan:prod` | 构建后启动 |
| `npm run smoke:lan` | LAN 代理冒烟测试（需先 build + 证书） |
| `npm run smoke:app` | 浏览器全流程冒烟测试（Edge/Chrome，需先 build + 证书） |

代理可配置的环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LAN_PORT` | `8443` | HTTPS 端口 |
| `LAN_HOST` | `0.0.0.0` | 监听地址 |
| `LAN_ROOT` | `dist` | 静态目录 |
| `LAN_CERT` / `LAN_KEY` | `certs/lan-cert.pem` / `certs/lan-key.pem` | 证书 |
| `SNAPFIRE_WS` | `127.0.0.1:17890` | 桌面 LanServer 地址 |

如果桌面房主的端口不是 17890（桌面会从 17890 起尝试空闲端口），例如是 17891：

```bash
SNAPFIRE_WS=127.0.0.1:17891 npm run lan
```

Windows PowerShell：

```powershell
$env:SNAPFIRE_WS="127.0.0.1:17891"; npm run lan
```

---

## 4. 数据与隐私

| 数据 | 位置 | 是否上传 |
| --- | --- | --- |
| 昵称、玩家 ID | IndexedDB `profile` | 昵称同步到房间 |
| 音量/识别质量/摄像头 | IndexedDB `settings` | 否 |
| 人脸特征、衣着特征 | IndexedDB `appearance` | 仅同步特征向量，不同步照片 |
| 采集预览图 | 仅采集过程中的内存 | **否**，不持久化 |
| 历史战绩 | IndexedDB `history` | 否 |

手机端不提供备份导出/导入（浏览器文件系统限制），也不写 Field Test 日志。

---

## 5. 工程结构

```
src/
  shared/                 与桌面版共享的类型与协议（不改）
  mobile/
    App.tsx               会话、网络、导航
    screens/              Home / 作战菜单 / 长征导读 / 房间 / 大厅 / 战斗 / 结算
    content/              长征导读文章与历史战役数据
    input/                虚拟扳机、滑动目标选择、换枪按钮
    vision/               Human 引擎、建档、衣着/人脸匹配、全屏多人换装检测
    game/                 Three.js 武器、程序化音效、军服叠加渲染
    hooks/                摄像头、服务器时钟、触控状态
    net/                  WebSocket 客户端（浏览器原生）
    storage/              IndexedDB
    components/           模式卡片、设置、战绩、安装提示、错误边界
  styles/                 global.css + screens.css
public/
  models/                 Human 离线模型（blazeface/faceres/movenet/centernet）
  assets/uniforms/        长征模式军服贴图（红军 / 国民党军）
  icons/                  PWA 图标
  manifest.json           PWA 清单
  service-worker.js       离线壳 + 资源缓存
scripts/
  lan-proxy.mjs           HTTPS 静态服务 + WSS 反向代理
  make-certs.mjs          证书生成
  smoke-app.mjs           浏览器端到端冒烟测试
  smoke-lan.mjs           代理冒烟测试
```

---

## 6. 排障

| 现象 | 处理 |
| --- | --- |
| 摄像头黑屏/提示需要 HTTPS | 必须通过 `https://` 访问；使用 `npm run lan` |
| 证书不受信任 | 安装 mkcert 根证书，或安装自签名证书并信任 |
| 连接失败/超时 | 确认同一 Wi-Fi、地址和端口、Windows 防火墙放行 8443；房主房间号正确 |
| 房间已满/队伍已满 | 一房最多 6 人，红蓝各最多 3 人 |
| 无法开始比赛 | 所有玩家需建档、选队；非房主需准备；至少 2 人且红蓝都有 |
| 识别一直失败 | 确认 `public/models/` 存在并已构建进 `dist/models/`；光线充足；重新建档 |
| 手机发热/卡顿 | 设置 → 识别质量改为“性能”；详见 M8 性能测试 |
| PWA 无法安装 | Chrome/Edge 需要 HTTPS；iOS 用 Safari 分享 → 添加到主屏幕 |

更多部署细节见 [`docs/LAN_DEPLOY.md`](docs/LAN_DEPLOY.md)。

---

## 7. 当前状态

已完成：M0–M7（构建、存储、导航、建档、触屏、战斗页、PWA、局域网 HTTPS/WSS），
以及桌面版内嵌手机服务（桌面创建房间时自动启动，无需终端）。
v1.2 改进：步枪连发 / 手枪 / 换枪动画、两级作战菜单、长征 90 周年导读与
历史场景、红军 / 国民党军阵营显示及屏幕内玩家换装。
待真机验收：M8（AI 性能实测与调优）、M9（桌面房主 + 手机完整对局）。

已知限制：

- 手机端不创建房间。
- 不做复杂断线重连；房主离开则房间关闭。
- 识别不确定时按未命中处理，不会猜测目标。
- 局域网证书需要在每台手机上手动信任一次。

---

## 8. 许可

Apache-2.0，见 [`LICENSE`](LICENSE)。第三方组件与 AI 模型许可见
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
