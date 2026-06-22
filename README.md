# 智能巡检系统

三个子项目组成的智能巡检系统：

| 子项目     | 路径          | 说明                                  |
| ---------- | ------------- | ------------------------------------- |
| 后端服务   | `backend/`    | Express API 服务器 + SQLite 数据库    |
| Web 管理端 | `web/my-app/` | React + Vite 管理后台（浏览器）       |
| 移动巡检端 | `app/Patrol/` | React + Capacitor 巡检 App（Android） |

---

## 1. 后端服务 (`backend/`)

### 环境要求

- **Node.js** >= 22
- (Windows 打包) 无需额外依赖
- (Linux/Docker) 需要 `libsqlite3-mod-spatialite`

### 安装

```bash
cd backend
npm install
```

### 开发调试

```bash
npm start
# 等价于: node server.js
```

服务默认运行在 `http://localhost:1145`，端口可在 `config.json` 中修改。

首次运行会自动创建以下目录和文件：

| 目录/文件       | 用途             |
| --------------- | ---------------- |
| `sessions/`     | 会话文件存储     |
| `photo/`        | 巡检照片存储     |
| `risk/`         | 风险工单数据     |
| `mydatabase.db` | SQLite 数据库    |
| `config.json`   | 自动生成默认配置 |

### 构建打包

```bash
# Windows 可执行文件
npm run build

# Linux 可执行文件
npm run build:linux
```

输出到 `backend/dist/` 目录。打包后的 exe 可在未安装 Node.js 的机器上直接运行，所有运行时数据（数据库、照片、配置等）会生成在 exe 同级目录。

### Docker 部署

```bash
docker build -t xunjian-backend ./backend
docker run -d \
  -p 1145:1145 \
  -v ./data/sessions:/app/sessions \
  -v ./data/photo:/app/photo \
  -v ./data/risk:/app/risk \
  xunjian-backend
```

### Cookie 跨域说明

- **远程部署（HTTPS）**：前端和后端在同一域名下，cookie 正常工作
- **本地开发（HTTP）**：后端自动检测开发环境，关闭 `Secure` cookie 标志，允许 `localhost` 跨端口携带 cookie
- 如需手动控制，设置环境变量 `COOKIE_SECURE=true/false`

---

## 2. Web 管理端 (`web/my-app/`)

### 环境要求

- **Node.js** >= 22

### 安装

```bash
cd web/my-app
npm install
```

### 配置 API 地址

编辑 `src/config.js`：

```js
export const CONFIG = {
  VITE_API_BASE_URL: "http://localhost:1145", // 本地开发
  //VITE_API_BASE_URL: "https://app.otham.site", // 远程部署
};
```

### 开发调试

```bash
npm run dev
```

Vite 开发服务器默认运行在 `http://localhost:5173`，确保后端已在 `1145` 端口运行。

---

## 3. 移动巡检端 (`app/Patrol/`)

### 环境要求

- **Node.js** >= 22
- **Android Studio**（用于构建 Android APK）
- **JDK** >= 17

### 安装

```bash
cd app/Patrol
npm install
```

### 配置 API 地址

编辑 `src/config.js`：

```js
export const CONFIG = {
  VITE_API_BASE_URL: "http://8.148.203.45:1145", // 后端服务器地址
  //VITE_API_BASE_URL: "https://app.otham.site",
};
```

> **注意**：移动端需要使用后端实际 IP 地址，不能使用 `localhost`。

### Web 预览调试

```bash
npm run dev
```

在浏览器中预览 UI，但相机等原生功能无法使用。

### 构建 APK

```bash
# 1. 构建前端资源
npm run build

# 2. 同步到 Android 项目
npx cap sync

# 3. 用 Android Studio 打开并构建 APK
npx cap open android
```

在 Android Studio 中选择 **Build → Build Bundle(s) / APK(s) → Build APK(s)**。

### Android 网络配置说明

`capacitor.config.json` 中已配置：

- `androidScheme: "http"` — 允许 HTTP 明文请求
- `cleartext: true` — Android 允许明文流量
- `allowNavigation` — 允许访问后端服务器 IP

如果后端切换为 HTTPS，将 `androidScheme` 改为 `"https"` 即可。

---

## 项目结构总览

```
xunjian/
├── backend/                # 后端服务
│   ├── server.js           # 入口文件
│   ├── config.json         # 配置文件（端口等）
│   ├── routers/            # API 路由
│   ├── utils/              # 工具函数（数据库、权限等）
│   ├── public/             # 静态资源
│   ├── Dockerfile          # Docker 构建文件
│   └── package.json
├── web/my-app/             # Web 管理端
│   ├── src/
│   │   ├── config.js       # API 地址配置
│   │   └── pages/
│   │       ├── admin/      # 管理页面
│   │       └── viewer/     # 查看页面
│   └── package.json
├── app/Patrol/             # 移动巡检端
│   ├── src/
│   │   ├── config.js       # API 地址配置
│   │   ├── pages/
│   │   │   ├── inspector/  # 巡检页面
│   │   │   └── repair/     # 维修页面
│   │   └── components/     # 组件（地图、拍照等）
│   ├── android/            # Android 原生项目
│   ├── capacitor.config.json
│   └── package.json
└── README.md
```

---
