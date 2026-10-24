# 局域网 HTTPS / WSS 部署指南

> **桌面版内嵌模式（推荐）：** 当前桌面仓库代码创建房间时会在主进程内启动同样的
> HTTPS/WSS 服务，大厅直接显示手机地址、CA 证书路径、二维码和 HTTP 安装页
> （手机扫码即可下载 CA 并打开客户端），不需要运行本仓库的独立代理。
> 桌面内嵌模式使用 8443（手机客户端）和 8444（安装页），防火墙需要放行这两个
> 端口；v1.1.0-rc.1 预发布包已包含该服务（v1.0.0 不包含）。
> 本文档主要描述独立代理方式，适用于桌面版未内嵌或需要单独部署手机资源的场景。

手机浏览器有两个硬性限制：

1. `getUserMedia`（摄像头）和 Service Worker 只在 **安全来源**（HTTPS 或 localhost）可用；
2. HTTPS 页面不能连接不安全的 `ws://`，必须使用 `wss://`。

桌面版 LanServer 目前提供的是明文 `ws://`，也不托管静态文件。因此本仓库提供一个
**独立代理进程**（`scripts/lan-proxy.mjs`），在不修改桌面版的前提下同时解决两件事：

```
手机 ──https/wss──> 代理 (8443) ──http/ws──> 桌面 LanServer (127.0.0.1:17890)
                         └── 托管 dist/（PWA 静态文件）
```

---

## 1. 前置条件

- 已安装 Node.js 20+；
- 已执行 `npm install` 和 `npm run build`；
- 桌面版 SnapFire 已启动并创建房间；
- 手机与电脑在同一局域网；
- 电脑的 8443 端口未被占用，且 Windows 防火墙允许入站。

---

## 2. 证书

### 2.1 推荐：mkcert

```bash
winget install FiloSottile.mkcert   # Windows
npm run lan:cert
```

脚本会为 `localhost`、`127.0.0.1` 和当前所有局域网 IPv4 地址生成证书：

```
certs/lan-cert.pem
certs/lan-key.pem
```

mkcert 会使用本机的根 CA。首次运行后会打印根证书路径，例如：

```
C:\Users\<you>\AppData\Local\mkcert\rootCA.pem
```

把 `rootCA.pem` 安装到每台手机：

- **Android**：设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书。
  部分品牌还需在“信任的凭据 → 用户”中启用该 CA。
- **iOS**：用 AirDrop/文件 App 传入 `rootCA.pem` → 安装描述文件 →
  设置 → 通用 → 关于本机 → 证书信任设置 → 开启完全信任。

> 只在一台电脑上使用、且不介意浏览器警告时，也可以在该电脑执行 `mkcert -install`。

### 2.2 备用：自签名证书

```bash
npm run lan:cert:selfsigned
```

会生成 `certs/lan-cert.pem` / `certs/lan-key.pem`。手机需要安装并信任
`lan-cert.pem`；iOS/Android 对自签名证书较严格，正式使用仍建议 mkcert。

证书里的 IP 是生成时的局域网 IP。**电脑 IP 变化后需要重新生成**：

```bash
node scripts/make-certs.mjs --force
```

---

## 3. 启动代理

```bash
npm run lan
```

或构建后直接启动：

```bash
npm run lan:prod
```

输出示例：

```
SnapFire LAN — HTTPS + WSS proxy
静态目录 : D:\github\SnapFire-Mobile\dist
证书     : D:\github\SnapFire-Mobile\certs\lan-cert.pem
WebSocket: wss://<host>:8443  →  ws://127.0.0.1:17890

手机访问 : https://192.168.1.20:8443
```

手机浏览器打开该地址即可。

### 3.1 桌面端口不是 17890

桌面版会从 17890 开始尝试空闲端口。若实际端口是 17891：

```bash
# Git Bash
SNAPFIRE_WS=127.0.0.1:17891 npm run lan

# PowerShell
$env:SNAPFIRE_WS="127.0.0.1:17891"; npm run lan
```

### 3.2 换 HTTPS 端口

```bash
LAN_PORT=9443 npm run lan
```

如果使用非 8443 端口，手机页面地址会带端口，房间地址自动预填也会使用该端口。

### 3.3 其他环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `LAN_HOST` | `0.0.0.0` | 绑定地址 |
| `LAN_ROOT` | `dist` | 静态目录 |
| `LAN_CERT` | `certs/lan-cert.pem` | 证书路径 |
| `LAN_KEY` | `certs/lan-key.pem` | 私钥路径 |

---

## 4. 手机加入房间

1. 打开 `https://电脑IP:8443`；
2. 首页 → 团战；
3. 地址默认已填为 `电脑IP:8443`（即当前页面地址）；
4. 输入桌面端显示的 4 位房间号；
5. 选队 → 准备 → 建档；
6. 房主在桌面端开始比赛。

代理会把 `wss://电脑IP:8443` 原样转发到 `ws://127.0.0.1:17890`，
手机不需要直接访问 17890 端口。

---

## 5. PWA 安装

- Chrome/Edge for Android：地址栏菜单或页面提示“添加到主屏幕”；
- iOS Safari：分享 → 添加到主屏幕；
- 安装后以独立窗口启动，隐藏地址栏；
- 首页可离线打开（战斗仍需局域网）。

Service Worker 只在生产构建中注册；`npm run dev` 不会注册，避免缓存干扰开发。

---

## 6. Windows 防火墙

代理需要允许入站 TCP 8443。首次运行 Node 时 Windows 通常会弹窗，选择“专用网络”。

手动添加（管理员 PowerShell）：

```powershell
New-NetFirewallRule -DisplayName "SnapFire LAN 8443" -Direction Inbound `
  -Protocol TCP -LocalPort 8443 -Action Allow -Profile Private
```

桌面 LanServer 的 17890 端口只需本机访问（代理通过 `127.0.0.1` 连接），
一般不需要额外放行；如果桌面端自己也用手机直连调试，则另需放行。

---

## 7. 验证与冒烟测试

```bash
npm run build
npm run smoke:lan
```

会启动临时后端并验证：

- HTTPS 返回 `dist/index.html`；
- `/models/blazeface.json` 可访问；
- Service Worker 响应头正确；
- 目录穿越被拒绝；
- `wss://` 握手能转发到明文 WS 后端并回显消息。

完整 UI 流程（需要本机 Edge/Chrome）：

```bash
npm run smoke:app
```

会启动模拟房间服务，自动走完：首页 → 加入房间 → 大厅 → 建档弹窗（摄像头）
→ 倒计时 → 战斗（选目标 + 开火）→ 结算 → 返回首页。截图保存在 `artifacts/`。
可用 `BROWSER_PATH` 指定浏览器可执行文件。

---

## 8. 安全说明

- 代理只在局域网监听；不要把 8443 暴露到公网。
- 房间号是唯一的准入凭证；本项目没有账号体系，请只在可信局域网使用。
- `certs/` 已加入 `.gitignore`，私钥不会提交。
- 代理不记录请求体，也不转发照片；建档缩略图只保存在手机 IndexedDB。

---

## 9. 常见问题

| 现象 | 原因/处理 |
| --- | --- |
| `找不到静态目录` | 先 `npm run build` |
| `找不到证书` | 先 `npm run lan:cert` 或 `lan:cert:selfsigned` |
| `端口已被占用` | 设置 `LAN_PORT` 换端口 |
| 手机提示证书不安全 | 根证书未安装/未完全信任；或 IP 变化后证书过期 |
| 页面能开但连不上房间 | 检查桌面端口（`SNAPFIRE_WS`）、防火墙、房间号 |
| 摄像头仍不可用 | 确认地址是 `https://`；检查浏览器站点权限 |
| 安装不了 PWA | 必须 HTTPS；iOS 需手动“添加到主屏幕” |
| 手机打开页面空白 | 重新 `npm run build`；检查 `dist/index.html` 是否存在 |
