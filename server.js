const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 1145;

const inspectorAccounts = [
  {
    id: "inspector-001",
    username: "xj001",
    password: "123456",
    name: "巡检员001",
  },
  {
    id: "inspector-002",
    username: "xj002",
    password: "123456",
    name: "巡检员002",
  },
  {
    id: "inspector-003",
    username: "xj003",
    password: "123456",
    name: "巡检员003",
  },
];

const sessionsByToken = new Map();

function buildInspectorList() {
  const list = [];

  for (const [, session] of sessionsByToken) {
    list.push({
      inspectorId: session.inspectorId,
      name: session.name,
      loginAt: session.loginAt,
      online: Boolean(session.socketId),
      lastHeartbeatAt: session.lastHeartbeatAt,
    });
  }

  list.sort((left, right) => left.loginAt.localeCompare(right.loginAt));
  return list;
}

function broadcastInspectorList() {
  io.to("dashboards").emit("dashboard:inspectors:list", {
    ts: new Date().toISOString(),
    inspectors: buildInspectorList(),
  });
}

app.get("/api/health", (req, res) => {
  res.json({
    code: 0,
    message: "ok",
    data: {
      service: "xunjian-phase-1-server",
      time: new Date().toISOString(),
    },
  });
});

app.post("/api/inspectors/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      code: 40001,
      message: "username 和 password 不能为空",
    });
  }

  const account = inspectorAccounts.find(
    (item) => item.username === username && item.password === password,
  );

  if (!account) {
    return res.status(401).json({
      code: 40101,
      message: "账号或密码错误",
    });
  }

  const token = crypto.randomUUID();
  const now = new Date().toISOString();

  sessionsByToken.set(token, {
    token,
    inspectorId: account.id,
    name: account.name,
    loginAt: now,
    lastHeartbeatAt: null,
    socketId: null,
  });

  broadcastInspectorList();

  return res.json({
    code: 0,
    message: "登录成功",
    data: {
      token,
      inspector: {
        inspectorId: account.id,
        name: account.name,
      },
    },
  });
});

io.on("connection", (socket) => {
  const { clientType, token } = socket.handshake.auth || {};

  if (clientType === "dashboard") {
    socket.join("dashboards");
    socket.emit("dashboard:inspectors:list", {
      ts: new Date().toISOString(),
      inspectors: buildInspectorList(),
    });
    return;
  }

  if (clientType !== "inspector") {
    socket.emit("error:unauthorized", { message: "缺少合法 clientType" });
    socket.disconnect(true);
    return;
  }

  if (!token || !sessionsByToken.has(token)) {
    socket.emit("error:unauthorized", { message: "token 无效或已过期" });
    socket.disconnect(true);
    return;
  }

  const session = sessionsByToken.get(token);
  session.socketId = socket.id;
  sessionsByToken.set(token, session);

  broadcastInspectorList();

  socket.on("inspector:heartbeat", () => {
    const current = sessionsByToken.get(token);
    if (!current) {
      return;
    }

    current.lastHeartbeatAt = new Date().toISOString();
    sessionsByToken.set(token, current);

    broadcastInspectorList();
  });

  socket.on("disconnect", () => {
    const current = sessionsByToken.get(token);
    if (!current) {
      return;
    }

    if (current.socketId === socket.id) {
      current.socketId = null;
      sessionsByToken.set(token, current);
      broadcastInspectorList();
    }
  });
});

server.listen(PORT, () => {
  console.log(`[xunjian] phase-1 server running at http://localhost:${PORT}`);
});
