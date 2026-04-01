# 巡检系统 API 文档（第一阶段）

## 1. 目标范围

第一阶段只实现最基本的信息交流，不带实际业务数据：

1. 服务端 <-> 巡检员：巡检员身份登录（REST API）
2. 巡检员 -> 服务端：实时空心跳回传（每 5 秒，Socket.IO）
3. 服务端 -> 仪表盘：已登录巡检员列表推送（Socket.IO）

---

## 2. 服务基础信息

- Base URL：`http://localhost:1145`
- 协议：
  - REST：HTTP + JSON
  - 实时：Socket.IO

---

## 3. 巡检员测试账号

仅用于第一阶段联调：

| 用户名 | 密码   | 巡检员ID      | 姓名      |
| ------ | ------ | ------------- | --------- |
| xj001  | 123456 | inspector-001 | 巡检员001 |
| xj002  | 123456 | inspector-002 | 巡检员002 |
| xj003  | 123456 | inspector-003 | 巡检员003 |

---

## 4. REST API

### 4.1 健康检查

- Method：`GET`
- Path：`/api/health`

#### 响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "service": "xunjian-phase-1-server",
    "time": "2026-04-01T10:00:00.000Z"
  }
}
```

---

### 4.2 巡检员登录

- Method：`POST`
- Path：`/api/inspectors/login`
- Content-Type：`application/json`

#### 请求体

```json
{
  "username": "xj001",
  "password": "123456"
}
```

#### 成功响应（200）

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "0e5b7f5a-....",
    "inspector": {
      "inspectorId": "inspector-001",
      "name": "巡检员001"
    }
  }
}
```

#### 失败响应（400）

```json
{
  "code": 40001,
  "message": "username 和 password 不能为空"
}
```

#### 失败响应（401）

```json
{
  "code": 40101,
  "message": "账号或密码错误"
}
```

---

## 5. Socket.IO 实时接口

### 5.1 连接方式

客户端连接时通过 `auth` 传参：

#### 巡检员端连接

```js
io("http://localhost:1145", {
  auth: {
    clientType: "inspector",
    token: "<登录接口返回的token>",
  },
});
```

#### 仪表盘连接

```js
io("http://localhost:1145", {
  auth: {
    clientType: "dashboard",
  },
});
```

> 说明：第一阶段仪表盘不需要登录即可接收列表。

---

### 5.2 巡检员 -> 服务端：空心跳

- 事件名：`inspector:heartbeat`
- 方向：`Client(inspector) -> Server`
- 发送频率：建议每 5 秒
- 事件体：可为空（本阶段不带业务字段）

```js
setInterval(() => {
  socket.emit("inspector:heartbeat");
}, 5000);
```

---

### 5.3 服务端 -> 仪表盘：巡检员列表广播

- 事件名：`dashboard:inspectors:list`
- 方向：`Server -> Client(dashboard)`
- 触发时机：
  - 仪表盘刚连接成功后
  - 巡检员登录后
  - 巡检员 Socket 连接/断开后
  - 收到巡检员心跳后

#### 事件数据结构

```json
{
  "ts": "2026-04-01T10:01:00.000Z",
  "inspectors": [
    {
      "inspectorId": "inspector-001",
      "name": "巡检员001",
      "loginAt": "2026-04-01T10:00:00.000Z",
      "online": true,
      "lastHeartbeatAt": "2026-04-01T10:01:00.000Z"
    }
  ]
}
```

字段说明：

- `online`：是否已建立巡检员实时 Socket 连接
- `lastHeartbeatAt`：最近一次心跳时间，尚未收到心跳时为 `null`

---

### 5.4 异常事件

当连接参数不合法时，服务端会先发异常事件后断连：

- 事件名：`error:unauthorized`
- 示例：

```json
{
  "message": "token 无效或已过期"
}
```

---

## 6. 启动方式

```bash
npm start
```

启动日志：

```text
[xunjian] phase-1 server running at http://localhost:1145
```

---

## 7. 联调建议流程

1. 巡检员先调用登录接口拿 `token`
2. 巡检员用 `token` 建立 Socket 连接
3. 仪表盘建立 Socket 连接并监听 `dashboard:inspectors:list`
4. 巡检员每 5 秒发送一次 `inspector:heartbeat`
5. 仪表盘实时看到在线列表与心跳更新时间变化
