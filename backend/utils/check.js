let db;

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

const normalizeCheckpoint = (item, seqNo) => {
  if (Array.isArray(item)) {
    return {
      name: `Checkpoint ${seqNo}`,
      longitude: Number(item[0]),
      latitude: Number(item[1]),
      seqNo,
    };
  }

  const longitude = Number(item?.longitude ?? item?.lng ?? item?.lon);
  const latitude = Number(item?.latitude ?? item?.lat);
  const name = String(item?.name || `Checkpoint ${seqNo}`);

  return { name, longitude, latitude, seqNo };
};

/**
 * Bulk insert checkpoints for a route with auto SeqNo ordering.
 * @param {number} routeId
 * @param {Array<Object|[number, number]>} checkpoints
 * @returns {Object}
 */
const addCheckpoints = (routeId, checkpoints) => {
  try {
    assertDatabase();

    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new Error("路线ID不合法");
    }

    if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
      throw new Error("打卡点数组不能为空");
    }

    const maxSeqRow = db
      .prepare(
        "SELECT COALESCE(MAX(SeqNo), 0) AS maxSeq FROM checkpoint WHERE RouteID = ?",
      )
      .get(routeId);
    const startSeq = Number(maxSeqRow?.maxSeq || 0) + 1;

    const insertStmt = db.prepare(
      `INSERT INTO checkpoint (RouteID, Name, SeqNo, Longitude, Latitude)
			 VALUES (?, ?, ?, ?, ?)`,
    );

    const insertMany = db.transaction((items) => {
      items.forEach((item, index) => {
        const seqNo = startSeq + index;
        const normalized = normalizeCheckpoint(item, seqNo);

        if (
          !Number.isFinite(normalized.longitude) ||
          !Number.isFinite(normalized.latitude)
        ) {
          throw new Error("打卡点经纬度不合法");
        }

        insertStmt.run(
          routeId,
          normalized.name,
          normalized.seqNo,
          normalized.longitude,
          normalized.latitude,
        );
      });
    });

    insertMany(checkpoints);

    return {
      success: true,
      routeId,
      insertedCount: checkpoints.length,
      startSeq,
      endSeq: startSeq + checkpoints.length - 1,
    };
  } catch (error) {
    console.error("新增打卡点失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * List checkpoints for a route.
 * @param {number} routeId
 * @returns {Object}
 */
const listCheckpoints = (routeId) => {
  try {
    assertDatabase();

    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new Error("路线ID不合法");
    }

    const rows = db
      .prepare(
        "SELECT CheckpointID, RouteID, Name, SeqNo, Longitude, Latitude, Status, CreatedAt, UpdatedAt FROM checkpoint WHERE RouteID = ? ORDER BY SeqNo ASC",
      )
      .all(routeId);

    return {
      success: true,
      routeId,
      count: rows.length,
      checkpoints: rows.map((row) => ({
        checkpointId: row.CheckpointID,
        routeId: row.RouteID,
        name: row.Name,
        seqNo: row.SeqNo,
        longitude: row.Longitude,
        latitude: row.Latitude,
        status: row.Status,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
      })),
    };
  } catch (error) {
    console.error("查询打卡点失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a checkpoint by id.
 * @param {number} checkpointId
 * @returns {Object}
 */
const deleteCheckpoint = (checkpointId) => {
  try {
    assertDatabase();

    if (!Number.isInteger(checkpointId) || checkpointId <= 0) {
      throw new Error("打卡点ID不合法");
    }

    const result = db
      .prepare("DELETE FROM checkpoint WHERE CheckpointID = ?")
      .run(checkpointId);

    if (result.changes === 0) {
      return { success: false, error: "打卡点不存在" };
    }

    return { success: true, checkpointId };
  } catch (error) {
    console.error("删除打卡点失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get a checkpoint by id.
 * @param {number} checkpointId
 * @returns {Object}
 */
const getCheckpointById = (checkpointId) => {
  try {
    assertDatabase();

    if (!Number.isInteger(checkpointId) || checkpointId <= 0) {
      throw new Error("打卡点ID不合法");
    }

    const row = db
      .prepare(
        "SELECT CheckpointID, RouteID, Name, SeqNo, Longitude, Latitude, Status, CreatedAt, UpdatedAt FROM checkpoint WHERE CheckpointID = ?",
      )
      .get(checkpointId);

    if (!row) {
      return { success: false, error: "打卡点不存在" };
    }

    return {
      success: true,
      checkpoint: {
        checkpointId: row.CheckpointID,
        routeId: row.RouteID,
        name: row.Name,
        seqNo: row.SeqNo,
        longitude: row.Longitude,
        latitude: row.Latitude,
        status: row.Status,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
      },
    };
  } catch (error) {
    console.error("查询打卡点失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Create an ongoing task assignment for a user and route.
 * @param {number} userId
 * @param {number} routeId
 * @returns {Object}
 */
const assignOngoingTask = (userId, routeId) => {
  try {
    assertDatabase();

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("用户ID不合法");
    }

    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new Error("路线ID不合法");
    }

    const result = db
      .prepare(
        "INSERT INTO ongoing_task (UserID, RouteID, IsActive) VALUES (?, ?, 0)",
      )
      .run(userId, routeId);

    return { success: true, taskId: result.lastInsertRowid, userId, routeId };
  } catch (error) {
    console.error("分派任务失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * List ongoing tasks.
 * @returns {Object}
 */
const listOngoingTasks = (userId) => {
  try {
    assertDatabase();

    const normalizedUserId = Number.isInteger(userId) ? userId : null;

    const rows = normalizedUserId
      ? db
          .prepare(
            "SELECT TaskID, UserID, RouteID, AssignedAt FROM ongoing_task WHERE UserID = ? ORDER BY AssignedAt DESC",
          )
          .all(normalizedUserId)
      : db
          .prepare(
            "SELECT TaskID, UserID, RouteID, AssignedAt FROM ongoing_task ORDER BY AssignedAt DESC",
          )
          .all();

    return {
      success: true,
      count: rows.length,
      tasks: rows.map((row) => ({
        taskId: row.TaskID,
        userId: row.UserID,
        routeId: row.RouteID,
        assignedAt: row.AssignedAt,
      })),
    };
  } catch (error) {
    console.error("查询进行中任务失败:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  setDatabase,
  addCheckpoints,
  listCheckpoints,
  getCheckpointById,
  deleteCheckpoint,
  assignOngoingTask,
  listOngoingTasks,
};
