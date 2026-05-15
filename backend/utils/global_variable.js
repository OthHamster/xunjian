/**
 * 全局变量和相关操作函数
 * 
 */
const loggedInUsers = [];

/**
 * 新增或更新已登录用户缓存条目
 *
 * @param {string} sessionId - 会话 ID
 * @param {Object} user - 用户信息对象，至少包含 { id, username, roles, EmployeeID }
 * @returns {void}
 */
function upsertLoggedInUser(sessionId, user) {
  const index = loggedInUsers.findIndex((item) => item.sessionId === sessionId);
  const previous = index >= 0 ? loggedInUsers[index] : null;

  const entry = {
    sessionId,
    id: user.id,
    username: user.username,
    roles: user.roles,
    EmployeeID: user.EmployeeID,
    loginAt: Date.now(),
    socketId: previous ? previous.socketId : null,
    lastHeartbeatAt: previous ? previous.lastHeartbeatAt : null,
    location: previous ? previous.location : null,
    locationUpdatedAt: previous ? previous.locationUpdatedAt : null,
  };

  if (index >= 0) {
    loggedInUsers[index] = entry;
    return;
  }

  loggedInUsers.push(entry);
}

/**
 * 移除指定会话的登录用户信息
 *
 * @param {string} sessionId - 会话 ID
 * @returns {void}
 */
function removeLoggedInUser(sessionId) {
  const index = loggedInUsers.findIndex((item) => item.sessionId === sessionId);
  if (index >= 0) {
    loggedInUsers.splice(index, 1);
  }
}

/**
 * 将 socketId 绑定到会话（用于推送/通信）
 *
 * @param {string} sessionId - 会话 ID
 * @param {string} socketId - Socket.IO 的连接 ID
 * @returns {boolean} 绑定成功返回 true，找不到会话返回 false
 */
function bindSocketToSession(sessionId, socketId) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  user.socketId = socketId;
  user.lastHeartbeatAt = Date.now();
  return true;
}

/**
 * 更新会话的心跳时间戳
 *
 * @param {string} sessionId - 会话 ID
 * @returns {boolean} 成功更新返回 true，否则 false
 */
function touchHeartbeat(sessionId) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  user.lastHeartbeatAt = Date.now();
  return true;
}

/**
 * 按会话更新用户位置数据
 *
 * @param {string} sessionId - 会话 ID
 * @param {Object} location - 位置对象，包含 { latitude, longitude, accuracy }
 * @returns {boolean} 更新成功返回 true，找不到会话返回 false
 */
function updateLocationBySession(sessionId, location) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  if (!location) {
    return true;
  }

  user.location = {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
  };
  user.locationUpdatedAt = Date.now();
  return true;
}

/**
 * 根据 socketId 清除绑定的会话中的 socket 字段
 *
 * @param {string} socketId - Socket.IO 连接 ID
 * @returns {void}
 */
function clearSocketBindingBySocketId(socketId) {
  const user = loggedInUsers.find((item) => item.socketId === socketId);
  if (!user) {
    return;
  }

  user.socketId = null;
}

/**
 * 获取当前所有已登录用户的缓存列表
 *
 * @returns {Array<Object>} 已登录用户数组
 */
function getLoggedInUsers() {
  return loggedInUsers;
}

module.exports = {
  loggedInUsers,
  upsertLoggedInUser,
  removeLoggedInUser,
  bindSocketToSession,
  touchHeartbeat,
  updateLocationBySession,
  clearSocketBindingBySocketId,
  getLoggedInUsers,
};
