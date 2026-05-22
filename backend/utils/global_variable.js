/**
 * 全局变量和相关操作函数
 *
 */
const {
  getActiveTaskByUser,
  validateCheckpointAndAdvance,
} = require("./task_storage");
const { checkPointNearRoute } = require("./route");

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
    hasActiveTask: previous ? previous.hasActiveTask : false,
    activeTaskId: previous ? previous.activeTaskId : null,
    activeRouteId: previous ? previous.activeRouteId : null,
    activeTaskUpdatedAt: previous ? previous.activeTaskUpdatedAt : null,
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
  refreshActiveTaskStatusBySession(sessionId);
  return true;
}

/**
 * 绑定 session 后刷新激活任务状态。
 *
 * @param {string} sessionId - 会话 ID
 * @returns {boolean} 成功更新返回 true，否则 false
 */
function refreshActiveTaskStatusBySession(sessionId) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  try {
    const result = getActiveTaskByUser(user.id);
    if (!result?.success) {
      return false;
    }

    const task = result.task;
    user.hasActiveTask = Boolean(task);
    user.activeTaskId = task ? task.taskId : null;
    user.activeRouteId = task ? task.routeId : null;
    user.activeTaskUpdatedAt = Date.now();
    return true;
  } catch (error) {
    console.error("刷新激活任务状态失败:", error.message);
    return false;
  }
}

/**
 * 获取激活任务的附加信息（偏离判断/打卡点校验）。
 *
 * @param {string} sessionId - 会话 ID
 * @param {Object} [options]
 * @param {number} [options.bufferDistance=25] - 路线偏离缓冲距离(米)
 * @param {number} [options.checkpointDistance=25] - 打卡点判定距离(米)
 * @returns {Object}
 */
function getActiveTaskExtraInfoBySession(sessionId, options = {}) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return { success: false, error: "session不存在" };
  }

  if (!user.hasActiveTask || !user.activeTaskId) {
    return { success: true, hasActiveTask: false };
  }

  if (!user.activeRouteId) {
    const refreshed = getActiveTaskByUser(user.id);
    if (!refreshed?.success || !refreshed.task) {
      return { success: true, hasActiveTask: false };
    }
    user.activeTaskId = refreshed.task.taskId;
    user.activeRouteId = refreshed.task.routeId;
    user.hasActiveTask = true;
    user.activeTaskUpdatedAt = Date.now();
  }

  const location = user.location;
  if (
    !location ||
    !Number.isFinite(Number(location.longitude)) ||
    !Number.isFinite(Number(location.latitude))
  ) {
    return { success: false, error: "缺少有效的位置信息" };
  }

  const bufferDistance = Number(options.bufferDistance ?? 25);
  const checkpointDistance = Number(options.checkpointDistance ?? 25);

  const deviationResult = checkPointNearRoute(
    user.activeRouteId,
    Number(location.longitude),
    Number(location.latitude),
    Number.isFinite(bufferDistance) ? bufferDistance : 25,
  );

  if (!deviationResult?.success) {
    return {
      success: false,
      error: deviationResult?.error || "路线偏离判断失败",
    };
  }

  const checkpointResult = validateCheckpointAndAdvance(
    user.activeTaskId,
    Number(location.longitude),
    Number(location.latitude),
    Number.isFinite(checkpointDistance) ? checkpointDistance : 25,
  );

  if (
    !checkpointResult?.success &&
    checkpointResult?.error !== "未到达打卡点"
  ) {
    return {
      success: false,
      error: checkpointResult?.error || "打卡点校验失败",
    };
  }

  return {
    success: true,
    hasActiveTask: true,
    taskId: user.activeTaskId,
    nextCheckpointId: checkpointResult?.nextCheckpoint?.checkpointId || null,
    isWithinRoute: deviationResult.isWithin,
    isDeviated: !deviationResult.isWithin,
    checkpointReached: checkpointResult?.success === true,
    checkpointInfo: checkpointResult?.nextCheckpoint || null,
    distance: checkpointResult?.distance,
    maxDistance: checkpointResult?.maxDistance,
  };
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
  refreshActiveTaskStatusBySession,
  getActiveTaskExtraInfoBySession,
  touchHeartbeat,
  updateLocationBySession,
  clearSocketBindingBySocketId,
  getLoggedInUsers,
};
