const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session); // 文件存储
const app = express();

const router = require("./route.js");
const checkRole = require("./permission.js");
const config = require("./config");
const { connectDatabase, datarouter } = require("./database_router.js");
const PORT = config.port;
// 中间件
app.use(cors());
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
  })
);


app.use(router);
connectDatabase();
app.use(datarouter);
app.get("/test", checkRole(["admin", "viewer"]), (req, res) => {
  res.json("aaa");
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Express服务器运行在 http://localhost:${PORT}`);
});
