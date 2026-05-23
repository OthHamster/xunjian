/**
 * 用户打卡相关的api
 *
 */
const express = require("express");
const checkRouter = express.Router();
const checkRole = require("../utils/permission.js");
const {
  addCheckpoints,
  listCheckpoints,
  deleteCheckpoint,
  assignOngoingTask,
  listOngoingTasks,
} = require("../utils/check.js");
const {
  getActiveTaskByUser,
  activateTask,
  advanceActiveTaskCheckpoint,
  endTaskById,
} = require("../utils/task_storage.js");
checkRouter.post(
  "/routes/:id/checkpoints",
  checkRole(["admin"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);
    const { checkpoints } = req.body || {};

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    try {
      const result = addCheckpoints(routeId, checkpoints);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error("add checkpoints error:", error);
      return res.status(500).json({ error: "新增打卡点失败" });
    }
  },
);

checkRouter.get(
  "/routes/:id/checkpoints",
  checkRole(["admin", "viewer", "inspector"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    try {
      const result = listCheckpoints(routeId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("list checkpoints error:", error);
      return res.status(500).json({ error: "获取打卡点失败" });
    }
  },
);

checkRouter.delete("/checkpoints/:id", checkRole(["admin"]), (req, res) => {
  const checkpointId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(checkpointId) || checkpointId <= 0) {
    return res.status(400).json({ error: "打卡点ID不合法" });
  }

  try {
    const result = deleteCheckpoint(checkpointId);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    return res.json(result);
  } catch (error) {
    console.error("delete checkpoint error:", error);
    return res.status(500).json({ error: "删除打卡点失败" });
  }
});

checkRouter.post("/tasks/assign", checkRole(["admin"]), (req, res) => {
  const userId = Number.parseInt(req.body?.userId, 10);
  const routeId = Number.parseInt(req.body?.routeId, 10);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "用户ID不合法" });
  }

  if (!Number.isInteger(routeId) || routeId <= 0) {
    return res.status(400).json({ error: "路线ID不合法" });
  }

  try {
    const result = assignOngoingTask(userId, routeId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("assign ongoing task error:", error);
    return res.status(500).json({ error: "分派任务失败" });
  }
});

checkRouter.get(
  "/tasks/ongoing",
  checkRole(["admin", "inspector"]),
  (req, res) => {
    try {
      const userId = Number.parseInt(req.query.userId, 10);
      const normalizedUserId = Number.isInteger(userId) && userId > 0
        ? userId
        : null;

      const result = listOngoingTasks(normalizedUserId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("list ongoing tasks error:", error);
      return res.status(500).json({ error: "获取进行中任务失败" });
    }
  },
);

checkRouter.get(
  "/tasks/active",
  checkRole(["admin", "inspector"]),
  (req, res) => {
    const userId = Number.parseInt(req.query.userId, 10);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "用户ID不合法" });
    }

    try {
      const result = getActiveTaskByUser(userId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("get active task error:", error);
      return res.status(500).json({ error: "获取激活任务失败" });
    }
  },
);

checkRouter.post(
  "/tasks/activate",
  checkRole(["admin", "inspector"]),
  (req, res) => {
    const taskId = Number.parseInt(req.body?.taskId, 10);
    const userId = Number.parseInt(req.body?.userId, 10);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ error: "任务ID不合法" });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "用户ID不合法" });
    }

    try {
      const result = activateTask(taskId, userId);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("activate task error:", error);
      return res.status(500).json({ error: "激活任务失败" });
    }
  },
);

module.exports = checkRouter;
