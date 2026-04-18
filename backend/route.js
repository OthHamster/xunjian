const express = require("express");
const router = express.Router();
const findUserByCredentials = require("./user");
const checkRole = require("./permission.js");

router.post("/login", (req, res) => {
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
  res.json({
    success: true,
    user: req.session.user,
  });
});
router.post("/logout", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: "未登录" });
  }
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "退出失败" });
    }

    res.clearCookie("your_app_session"); // 清除客户端Cookie
    res.json({ success: true });
  });
});
router.get("/me", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: "未登录" });
  }
  res.json({ user: req.session.user });
});

module.exports = router;
