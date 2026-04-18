function checkRole(roles) {
  return (req, res, next) => {
    if (!req.session.isAuthenticated) {
      return res.status(401).json({ error: "请先登录" });
    }

    if (!roles.includes(req.session.user.roles)) {
      return res.status(403).json({
        error: "权限不足",
        requiredRoles: roles,
        userRole: req.session.user.roles,
      });
    }

    next();
  };
}

module.exports = checkRole;
