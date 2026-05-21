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
} = require("../utils/check.js");
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

module.exports = checkRouter;
