const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const FileStore = require("session-file-store")(session); // 文件存储
const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost:5173",
  "http://8.148.203.45:1145",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
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
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});
const router = require("./auth_routers/route.js");
const checkRole = require("./permission.js");
const config = require("./config");
const {
  connectDatabase,
  datarouter,
} = require("./database_routers/database_router.js");
const { initializeUsers } = require("./database_routers/user_routers");
const PORT = config.port;
// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
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
      secure: false, // 开发时设为false，生产环境应设为true（仅HTTPS）
    },
  }),
);

connectDatabase();
initializeUsers();
app.use(router);
app.use(datarouter);
app.get("/test", checkRole(["admin", "viewer"]), (req, res) => {
  res.json("aaa");
});
io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("text_update", (text) => {
    console.log("Received text update:", text);
  });
});
// 启动服务器
server.listen(PORT, () => {
  console.log(`Express服务器运行在 http://localhost:${PORT}`);
});
