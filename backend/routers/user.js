/**
 * 用户管理相关的API路由
 *
 */

const express = require("express");
const datarouter = express.Router();
const checkRole = require("../utils/permission.js");
const {
  createUser,
  deleteUserById,
  listUsers,
  updateUserById,
} = require("../utils/user.js");


datarouter.get("/users", checkRole(["admin"]), (req, res) => {
  try {
    const users = listUsers();
    return res.json({ success: true, users });
  } catch (error) {
    console.error("list users error:", error);
    return res.status(500).json({ error: "获取用户列表失败" });
  }
});

datarouter.post("/users", checkRole(["admin"]), (req, res) => {
  const { username, password, roles } = req.body || {};

  try {
    const user = createUser(username, password, roles);
    return res.status(201).json({ success: true, user });
  } catch (error) {
    if (
      error.code === "VALIDATION_ERROR" ||
      error.code === "INVALID_ROLE" ||
      error.code === "DUPLICATE_USERNAME"
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error("create user error:", error);
    return res.status(500).json({ error: "创建用户失败" });
  }
});

datarouter.delete("/users/:id", checkRole(["admin"]), (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "用户ID不合法" });
  }

  const deleted = deleteUserById(userId);
  if (!deleted) {
    return res.status(404).json({ error: "用户不存在" });
  }

  return res.json({ success: true, deletedUserId: userId });
});

datarouter.put("/users/:id", checkRole(["admin"]), (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  const { username, password, roles } = req.body || {};

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "用户ID不合法" });
  }

  try {
    const user = updateUserById(userId, username, password, roles);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    return res.json({ success: true, user });
  } catch (error) {
    if (
      error.code === "VALIDATION_ERROR" ||
      error.code === "INVALID_ROLE" ||
      error.code === "DUPLICATE_USERNAME"
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error("update user error:", error);
    return res.status(500).json({ error: "更新用户失败" });
  }
});
module.exports = { datarouter };
