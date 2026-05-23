let db;
const { isDistanceWithin } = require("./route");

/**
 * Inject the database instance used by this module.
 * @param {Database} dbInstance
 */
const setDatabase = (dbInstance) => {
  db = dbInstance;
};

const assertDatabase = () => {
  if (!db) {
    throw new Error("数据库未初始化");
  }
};

const normalizeId = (value, label) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${label}不合法`);
  }
  return id;
};

/**
 * 获取用户激活中的任务（单个，按最新分配时间）。
 * @param {number} userId
 * @returns {Object}
 */
const getActiveTaskByUser = (userId) => {
  try {
    assertDatabase();
    const normalizedUserId = normalizeId(userId, "用户ID");

    const row = db
      .prepare(
        `SELECT
					t.TaskID,
					t.UserID,
					t.RouteID,
					t.IsActive,
					t.CurrentCheckpointID,
					t.AssignedAt,
					c.Name AS CurrentCheckpointName,
					c.SeqNo AS CurrentCheckpointSeqNo,
					c.Longitude AS CurrentCheckpointLongitude,
					c.Latitude AS CurrentCheckpointLatitude
				FROM ongoing_task t
				LEFT JOIN checkpoint c ON t.CurrentCheckpointID = c.CheckpointID
				WHERE t.UserID = ? AND t.IsActive = 1
				ORDER BY t.AssignedAt DESC
				LIMIT 1`,
      )
      .get(normalizedUserId);

    if (!row) {
      return { success: true, task: null };
    }

    return {
      success: true,
      task: {
        taskId: row.TaskID,
        userId: row.UserID,
        routeId: row.RouteID,
        isActive: row.IsActive === 1,
        currentCheckpointId: row.CurrentCheckpointID || null,
        assignedAt: row.AssignedAt,
        currentCheckpoint: row.CurrentCheckpointID
          ? {
              checkpointId: row.CurrentCheckpointID,
              name: row.CurrentCheckpointName,
              seqNo: row.CurrentCheckpointSeqNo,
              longitude: row.CurrentCheckpointLongitude,
              latitude: row.CurrentCheckpointLatitude,
            }
          : null,
      },
    };
  } catch (error) {
    console.error("查询激活任务失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 激活指定任务。
 * @param {number} taskId
 * @param {number} userId
 * @returns {Object}
 */
const activateTask = (taskId, userId) => {
  try {
    assertDatabase();
    const normalizedTaskId = normalizeId(taskId, "任务ID");
    const normalizedUserId = normalizeId(userId, "用户ID");

    const taskRow = db
      .prepare(
        "SELECT TaskID, UserID, RouteID FROM ongoing_task WHERE TaskID = ?",
      )
      .get(normalizedTaskId);

    if (!taskRow) {
      return { success: false, error: "任务不存在" };
    }

    if (taskRow.UserID !== normalizedUserId) {
      return { success: false, error: "任务不属于当前用户" };
    }

    const activateTxn = db.transaction(() => {
      db.prepare("UPDATE ongoing_task SET IsActive = 0 WHERE UserID = ?").run(
        normalizedUserId,
      );
      db.prepare("UPDATE ongoing_task SET IsActive = 1 WHERE TaskID = ?").run(
        normalizedTaskId,
      );
    });

    activateTxn();
    return {
      success: true,
      taskId: normalizedTaskId,
      userId: normalizedUserId,
      routeId: taskRow.RouteID,
      isActive: true,
    };
  } catch (error) {
    console.error("激活任务失败:", error.message);
    return { success: false, error: error.message };
  }
};

const loadRouteCheckpointIds = (routeId) => {
  return db
    .prepare(
      "SELECT CheckpointID FROM checkpoint WHERE RouteID = ? ORDER BY SeqNo ASC, CheckpointID ASC",
    )
    .all(routeId)
    .map((row) => row.CheckpointID);
};

const getNextCheckpointForTask = (taskRow) => {
  if (!taskRow?.RouteID) {
    return null;
  }

  if (!taskRow.CurrentCheckpointID) {
    return db
      .prepare(
        "SELECT CheckpointID, Name, SeqNo, Longitude, Latitude FROM checkpoint WHERE RouteID = ? ORDER BY SeqNo ASC, CheckpointID ASC LIMIT 1",
      )
      .get(taskRow.RouteID);
  }

  const current = db
    .prepare(
      "SELECT SeqNo FROM checkpoint WHERE CheckpointID = ? AND RouteID = ?",
    )
    .get(taskRow.CurrentCheckpointID, taskRow.RouteID);

  if (!current) {
    return db
      .prepare(
        "SELECT CheckpointID, Name, SeqNo, Longitude, Latitude FROM checkpoint WHERE RouteID = ? ORDER BY SeqNo ASC, CheckpointID ASC LIMIT 1",
      )
      .get(taskRow.RouteID);
  }

  return db
    .prepare(
      "SELECT CheckpointID, Name, SeqNo, Longitude, Latitude FROM checkpoint WHERE RouteID = ? AND SeqNo > ? ORDER BY SeqNo ASC, CheckpointID ASC LIMIT 1",
    )
    .get(taskRow.RouteID, current.SeqNo);
};

/**
 * 将激活中的任务打卡点前移一格。
 * @param {number} taskId
 * @returns {Object}
 */
const advanceActiveTaskCheckpoint = (taskId) => {
  try {
    assertDatabase();
    const normalizedTaskId = normalizeId(taskId, "任务ID");

    const taskRow = db
      .prepare(
        "SELECT TaskID, RouteID, IsActive, CurrentCheckpointID FROM ongoing_task WHERE TaskID = ?",
      )
      .get(normalizedTaskId);

    if (!taskRow) {
      return { success: false, error: "任务不存在" };
    }

    if (taskRow.IsActive !== 1) {
      return { success: false, error: "任务未激活" };
    }

    const checkpointIds = loadRouteCheckpointIds(taskRow.RouteID);
    if (checkpointIds.length === 0) {
      return { success: false, error: "路线暂无打卡点" };
    }

    const currentId = taskRow.CurrentCheckpointID;
    const currentIndex = currentId ? checkpointIds.indexOf(currentId) : -1;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= checkpointIds.length) {
      return { success: false, error: "已到最后一个打卡点" };
    }

    const nextCheckpointId = checkpointIds[nextIndex];

    db.prepare(
      "UPDATE ongoing_task SET CurrentCheckpointID = ? WHERE TaskID = ?",
    ).run(nextCheckpointId, normalizedTaskId);

    return {
      success: true,
      taskId: normalizedTaskId,
      currentCheckpointId: nextCheckpointId,
    };
  } catch (error) {
    console.error("更新激活任务失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 校验坐标是否到达下一个打卡点，成功则自动前移打卡点。
 * @param {number} taskId
 * @param {number} longitude
 * @param {number} latitude
 * @param {number} [maxDistanceMeters=25]
 * @returns {Object}
 */
const validateCheckpointAndAdvance = (
  taskId,
  longitude,
  latitude,
  maxDistanceMeters = 25,
) => {
  try {
    assertDatabase();
    const normalizedTaskId = normalizeId(taskId, "任务ID");
    const lon = Number(longitude);
    const lat = Number(latitude);
    const distanceLimit = Number(maxDistanceMeters);

    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error("坐标不合法");
    }

    if (!Number.isFinite(distanceLimit) || distanceLimit < 0) {
      throw new Error("距离阈值不合法");
    }

    const taskRow = db
      .prepare(
        "SELECT TaskID, RouteID, IsActive, CurrentCheckpointID FROM ongoing_task WHERE TaskID = ?",
      )
      .get(normalizedTaskId);

    if (!taskRow) {
      return { success: false, error: "任务不存在" };
    }

    if (taskRow.IsActive !== 1) {
      return { success: false, error: "任务未激活" };
    }

    const nextCheckpoint = getNextCheckpointForTask(taskRow);
    if (!nextCheckpoint) {
      return { success: false, error: "没有可用的下一个打卡点" };
    }

    const checkResult = isDistanceWithin(
      lon,
      lat,
      nextCheckpoint.Longitude,
      nextCheckpoint.Latitude,
      distanceLimit,
    );

    if (!checkResult?.success) {
      return { success: false, error: checkResult?.error || "位置校验失败" };
    }

    if (!checkResult.isWithin) {
      return {
        success: false,
        error: "未到达打卡点",
        distance: checkResult.distance,
        maxDistance: checkResult.maxDistance,
        nextCheckpoint: {
          checkpointId: nextCheckpoint.CheckpointID,
          name: nextCheckpoint.Name,
          seqNo: nextCheckpoint.SeqNo,
          longitude: nextCheckpoint.Longitude,
          latitude: nextCheckpoint.Latitude,
        },
      };
    }

    const advanceResult = advanceActiveTaskCheckpoint(normalizedTaskId);
    if (!advanceResult.success) {
      return advanceResult;
    }

    return {
      success: true,
      taskId: normalizedTaskId,
      currentCheckpointId: advanceResult.currentCheckpointId,
      nextCheckpoint: {
        checkpointId: nextCheckpoint.CheckpointID,
        name: nextCheckpoint.Name,
        seqNo: nextCheckpoint.SeqNo,
        longitude: nextCheckpoint.Longitude,
        latitude: nextCheckpoint.Latitude,
      },
      distance: checkResult.distance,
      maxDistance: checkResult.maxDistance,
    };
  } catch (error) {
    console.error("校验打卡点失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 结束任务（删除记录）。
 * @param {number} taskId
 * @returns {Object}
 */
const endTaskById = (taskId) => {
  try {
    assertDatabase();
    const normalizedTaskId = normalizeId(taskId, "任务ID");

    const result = db
      .prepare("DELETE FROM ongoing_task WHERE TaskID = ?")
      .run(normalizedTaskId);

    if (result.changes === 0) {
      return { success: false, error: "任务不存在" };
    }

    return { success: true, taskId: normalizedTaskId };
  } catch (error) {
    console.error("结束任务失败:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  setDatabase,
  getActiveTaskByUser,
  activateTask,
  advanceActiveTaskCheckpoint,
  validateCheckpointAndAdvance,
  endTaskById,
};
