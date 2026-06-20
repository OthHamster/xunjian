const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const FileStore = require("session-file-store")(session); // 文件存储
const app = express();
const server = http.createServer(app);
const useSecureCookie = process.env.COOKIE_SECURE !== "false";
const allowedOrigins = [
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://8.148.203.45:1145",
  "https://app.otham.site",
];

const localhostDevPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(origin) || localhostDevPattern.test(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Socket.IO CORS origin not allowed: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});
const router = require("./routers/auth.js");
const checkRole = require("./utils/permission.js");
const config = require("./utils/config.js");
const { connectDatabase } = require("./utils/database.js");
const { datarouter } = require("./routers/user.js");
const { routeRouter } = require("./routers/route.js");
const checkRouter = require("./routers/check.js");
const { initializeUsers } = require("./utils/user.js");
const {
  bindSocketToSession,
  touchHeartbeat,
  updateLocationBySession,
  clearSocketBindingBySocketId,
  getActiveTaskExtraInfoBySession,
} = require("./utils/global_variable.js");
const PORT = config.port;

// 反向代理后启用，确保 secure cookie 能正确工作
app.set("trust proxy", 1);

// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const photoDir = process.pkg
  ? path.join(path.dirname(process.execPath), "photo")
  : path.join(__dirname, "photo");
app.use("/photo", express.static(photoDir));
app.use(express.urlencoded({ extended: true }));

// 配置会话中间件
app.use(
  session({
    name: "your_app_session",
    secret: "your_secret_key_change_this", // 用于签名会话ID的密钥，应设为环境变量
    resave: false, // 避免每次请求都重新保存会话
    saveUninitialized: false, // 不要保存未初始化的会话（如未登录的匿名会话）
    store: new FileStore({
      // 使用文件存储会话数据
      path: "./sessions", // 会话文件存储目录
      ttl: 24 * 60 * 60, // 会话有效期（秒），这里设24小时
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // Cookie有效期
      httpOnly: true, // 禁止JavaScript访问，增强安全性
      secure: useSecureCookie, // HTTPS反向代理环境建议为true
      sameSite: useSecureCookie ? "none" : "lax",
    },
  }),
);

connectDatabase();
initializeUsers();
app.use(router);
app.use(datarouter);
app.use(routeRouter);
app.use(checkRouter);
app.get("/test", checkRole(["admin", "viewer"]), (req, res) => {
  res.json("aaa");
});
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("heartbeat", ({ sessionId, location } = {}) => {
    if (!sessionId) {
      socket.emit("heartbeat_ack", { success: false, error: "缺少sessionId" });
      return;
    }

    const bound = bindSocketToSession(sessionId, socket.id);
    if (!bound) {
      socket.emit("heartbeat_ack", {
        success: false,
        error: "session未登录或不存在",
      });
      return;
    }

    touchHeartbeat(sessionId);
    updateLocationBySession(sessionId, location);

    const extraInfo = getActiveTaskExtraInfoBySession(sessionId);
    const ackPayload = {
      success: true,
      sessionId,
      socketId: socket.id,
    };

    if (extraInfo?.success) {
      if (extraInfo.completed) {
        ackPayload.completed = true;
      }

      if (extraInfo.hasActiveTask) {
        ackPayload.taskId = extraInfo.taskId;
        ackPayload.nextCheckpointId = extraInfo.nextCheckpointId;
      }
    }

    socket.emit("heartbeat_ack", ackPayload);
  });

  socket.on("text_update", (text) => {
    console.log("Received text update:", text);
  });

  socket.on("disconnect", () => {
    clearSocketBindingBySocketId(socket.id);
  });
});
// 启动服务器
server.listen(PORT, () => {
  console.log(`Express服务器运行在 http://localhost:${PORT}`);
});
