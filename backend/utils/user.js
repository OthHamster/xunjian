/**
 * 用户管理相关的工具函数
 *
 */

const ALLOWED_ROLES = ["admin", "inspector", "viewer", "repair"];

let db;

/**
 * 注入数据库实例（必须在调用其他函数前设置）
 *
 * @param {Database} dbInstance - better-sqlite3 实例
 * @returns {void}
 */
const setDatabase = (dbInstance) => {
  db = dbInstance;
};

const defaultUsers = [
  {
    username: "admin",
    password: "admin123",
    roles: "admin",
  },
  {
    username: "inspector",
    password: "inspector123",
    roles: "inspector",
  },
  {
    username: "viewer",
    password: "viewer123",
    roles: "viewer",
  },
  {
    username: "repair",
    password: "repair123",
    roles: "repair",
  },
];

/**
 * 内部辅助：断言数据库已初始化
 * @private
 */
function assertDatabase() {
  if (!db) {
    throw new Error("数据库未初始化，请先调用 setDatabase()");
  }
}

/**
 * 如果 users 表为空，则插入一组默认用户（用于开发/初始化）
 *
 * @returns {void}
 */
function seedDefaultUsers() {
  assertDatabase();

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (countRow.count > 0) {
    return;
  }

  const insertStmt = db.prepare(
    "INSERT INTO users (Name, Password, Role) VALUES (?, ?, ?)",
  );

  const insertMany = db.transaction((users) => {
    users.forEach((user) => {
      insertStmt.run(user.username, user.password, user.roles);
    });
  });

  insertMany(defaultUsers);
}

/**
 * 初始化用户入口（目前只是调用 seedDefaultUsers）
 *
 * @returns {void}
 */
function initializeUsers() {
  seedDefaultUsers();
}

/**
 * 根据用户名与密码查找用户（用于登录验证）
 *
 * @param {string} username
 * @param {string} password
 * @returns {Object|null} 找到返回用户对象，否则返回 null
 */
function findUserByCredentials(username, password) {
  assertDatabase();

  const user = db
    .prepare(
      "SELECT UserID, Name, Password, Role FROM users WHERE Name = ? AND Password = ?",
    )
    .get(username, password);

  if (!user) {
    return null;
  }

  return {
    id: user.UserID,
    username: user.Name,
    password: user.Password,
    roles: user.Role,
    EmployeeID: String(user.UserID),
  };
}

/**
 * 创建新用户
 *
 * @param {string} username
 * @param {string} password
 * @param {string} roles - 角色名称，应在 ALLOWED_ROLES 中
 * @returns {Object} 新创建的用户信息（含 id 与 EmployeeID）
 * @throws {Error} 验证或重复用户名错误
 */
function createUser(username, password, roles) {
  assertDatabase();

  const normalizedName = String(username || "").trim();
  const normalizedPassword = String(password || "").trim();
  const normalizedRole = String(roles || "").trim();

  if (!normalizedName || !normalizedPassword) {
    const error = new Error("用户名和密码不能为空");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    const error = new Error(`角色必须是 ${ALLOWED_ROLES.join("、")}`);
    error.code = "INVALID_ROLE";
    throw error;
  }

  try {
    const result = db
      .prepare("INSERT INTO users (Name, Password, Role) VALUES (?, ?, ?)")
      .run(normalizedName, normalizedPassword, normalizedRole);

    return {
      id: result.lastInsertRowid,
      username: normalizedName,
      roles: normalizedRole,
      EmployeeID: String(result.lastInsertRowid),
    };
  } catch (error) {
    if (
      String(error.message).includes("UNIQUE constraint failed: users.Name")
    ) {
      const duplicateError = new Error("用户名已存在");
      duplicateError.code = "DUPLICATE_USERNAME";
      throw duplicateError;
    }
    throw error;
  }
}

/**
 * 按 ID 删除用户
 *
 * @param {number} userId
 * @returns {boolean} 删除成功返回 true，否则 false
 */
function deleteUserById(userId) {
  assertDatabase();

  const result = db.prepare("DELETE FROM users WHERE UserID = ?").run(userId);
  return result.changes > 0;
}

/**
 * 列出所有用户
 *
 * @returns {Array<Object>} 用户数组
 */
function listUsers() {
  assertDatabase();

  return db
    .prepare(
      "SELECT UserID, Name, Password, Role FROM users ORDER BY UserID ASC",
    )
    .all()
    .map((row) => ({
      id: row.UserID,
      username: row.Name,
      password: row.Password,
      roles: row.Role,
      EmployeeID: String(row.UserID),
    }));
}

/**
 * 按 ID 更新用户信息
 *
 * @param {number} userId
 * @param {string} username
 * @param {string} password
 * @param {string} roles
 * @returns {Object|null} 更新后的用户对象，找不到返回 null
 * @throws {Error} 验证或重复用户名错误
 */
function updateUserById(userId, username, password, roles) {
  assertDatabase();

  const normalizedName = String(username || "").trim();
  const normalizedPassword = String(password || "").trim();
  const normalizedRole = String(roles || "").trim();

  if (!normalizedName || !normalizedPassword) {
    const error = new Error("用户名和密码不能为空");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    const error = new Error(`角色必须是 ${ALLOWED_ROLES.join("、")}`);
    error.code = "INVALID_ROLE";
    throw error;
  }

  const exists = db
    .prepare("SELECT UserID FROM users WHERE UserID = ?")
    .get(userId);

  if (!exists) {
    return null;
  }

  const duplicateName = db
    .prepare("SELECT UserID FROM users WHERE Name = ? AND UserID != ?")
    .get(normalizedName, userId);

  if (duplicateName) {
    const duplicateError = new Error("用户名已存在");
    duplicateError.code = "DUPLICATE_USERNAME";
    throw duplicateError;
  }

  db.prepare(
    "UPDATE users SET Name = ?, Password = ?, Role = ? WHERE UserID = ?",
  ).run(normalizedName, normalizedPassword, normalizedRole, userId);

  return {
    id: userId,
    username: normalizedName,
    password: normalizedPassword,
    roles: normalizedRole,
    EmployeeID: String(userId),
  };
}

module.exports = {
  ALLOWED_ROLES,
  setDatabase,
  initializeUsers,
  findUserByCredentials,
  createUser,
  deleteUserById,
  listUsers,
  updateUserById,
};
