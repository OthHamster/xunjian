/**
 * 生成 Express 中间件以校验用户角色权限
 *
 * @param {Array<string>} roles - 允许访问的角色列表，例如 ['admin','inspector']
 * @returns {Function} Express 中间件 (req, res, next)
 */
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
