/**
 * 用户验证相关的api
 *
 */
const express = require("express");
const authRouter = express.Router();
const { findUserByCredentials } = require("../utils/user.js");
const checkRole = require("../utils/permission.js");
const {
  upsertLoggedInUser,
  removeLoggedInUser,
  getLoggedInUsers,
} = require("../utils/global_variable.js");

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUserByCredentials(username, password);
  if (!user) {
    return res.status(401).json({ error: "用户名或密码错误" });
  }
  req.session.user = {
    id: user.id,
    username: user.username,
    roles: user.roles,
    EmployeeID: user.EmployeeID,
  };
  req.session.isAuthenticated = true;
  upsertLoggedInUser(req.sessionID, req.session.user);

  res.json({
    success: true,
    user: req.session.user,
    sessionId: req.sessionID,
  });
});
authRouter.post("/logout", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: "未登录" });
  }

  const sessionId = req.sessionID;
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "退出失败" });
    }

    removeLoggedInUser(sessionId);

    res.clearCookie("your_app_session"); // 清除客户端Cookie
    res.json({ success: true });
  });
});
authRouter.get("/me", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: "未登录" });
  }
  res.json({ user: req.session.user });
});

authRouter.get(
  "/online-users",
  checkRole(["admin", "viewer", "repair"]),
  (req, res) => {
    res.json({
      success: true,
      count: getLoggedInUsers().length,
      users: getLoggedInUsers(),
    });
  },
);

module.exports = authRouter;
