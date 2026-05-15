/**
 * 关于数据库的工具函数和初始化逻辑
 * - 连接数据库
 * - 加载 SpatiaLite 扩展
 * - 创建必要的表结构
 * - 提供获取数据库实例的接口
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const routeUtils = require("./route");
const userUtils = require("./user");

let db;

/**
 * 尝试加载 SpatiaLite 扩展（按候选路径顺序尝试）
 *
 * @returns {boolean} 如果成功加载返回 true，否则返回 false
 */
const loadSpatialiteExtension = () => {
  const extensionCandidates = [
    process.env.SPATIALITE_EXTENSION_PATH,
    path.join(__dirname, "../assets/mod_spatialite.dll"),
    path.join(
      __dirname,
      "../node_modules/spatialite/dist/win32/x64/mod_spatialite.dll",
    ),
    "mod_spatialite",
  ].filter(Boolean);

  const errors = [];

  for (const candidate of extensionCandidates) {
    const looksLikePath = candidate.includes("/") || candidate.includes("\\");
    if (looksLikePath && !fs.existsSync(candidate)) {
      errors.push(`${candidate}: 文件不存在`);
      continue;
    }

    try {
      db.loadExtension(candidate);
      console.log(`✓ SpatiaLite 扩展加载成功: ${candidate}`);
      return true;
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }

  console.error("✗ 无法加载 SpatiaLite 扩展 mod_spatialite");
  console.error("  详细尝试结果:", errors.join(" | "));
  return false;
};

/**
 * 根据应用所需的 schema 创建数据库表和空间列及索引
 *
 * @returns {void}
 */
const createTables = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      UserID INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      Password TEXT NOT NULL,
      Role TEXT NOT NULL,
      CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS route (
      RouteID INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS risks (
      RiskID INTEGER PRIMARY KEY AUTOINCREMENT,
      ReporterUserID INTEGER NOT NULL,
      RouteID INTEGER,
      Address TEXT,
      Longitude REAL NOT NULL,
      Latitude REAL NOT NULL,
      PhotoURL TEXT,
      Description TEXT NOT NULL,
      RiskLevel TEXT NOT NULL CHECK (RiskLevel IN ('low','medium','high')),
      Status TEXT NOT NULL DEFAULT 'open' CHECK (Status IN ('open','resolved')),
      ReportedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ResolvedAt DATETIME,
      RelatedRisk INTEGER,
      ResolvedByUserID INTEGER,
      ResolveNote TEXT,
      FOREIGN KEY (ReporterUserID) REFERENCES users(UserID),
      FOREIGN KEY (ResolvedByUserID) REFERENCES users(UserID),
      FOREIGN KEY (RouteID) REFERENCES route(RouteID),
      FOREIGN KEY (RelatedRisk) REFERENCES risks(RiskID)
    )`,
    `CREATE TABLE IF NOT EXISTS checkpoint (
      CheckpointID INTEGER PRIMARY KEY AUTOINCREMENT,
      RouteID INTEGER NOT NULL,
      Name TEXT NOT NULL,
      SeqNo INTEGER NOT NULL,
      Longitude REAL NOT NULL,
      Latitude REAL NOT NULL,
      CheckpointType TEXT,
      Status TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active','inactive')),
      CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (RouteID) REFERENCES route(RouteID),
      UNIQUE (RouteID, SeqNo)
    )`,
    `CREATE TABLE IF NOT EXISTS checkin (
      CheckinID INTEGER PRIMARY KEY AUTOINCREMENT,
      CheckpointID INTEGER NOT NULL,
      UserID INTEGER NOT NULL,
      CheckinTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Longitude REAL NOT NULL,
      Latitude REAL NOT NULL,
      Result TEXT NOT NULL CHECK (Result IN ('pass','fail')),
      PhotoURL TEXT,
      Note TEXT,
      FOREIGN KEY (CheckpointID) REFERENCES checkpoint(CheckpointID),
      FOREIGN KEY (UserID) REFERENCES users(UserID)
    )`,
  ];

  tables.forEach((sql) => db.exec(sql));

  try {
    db.exec(
      `SELECT AddGeometryColumn('route', 'WGS84', 4326, 'LINESTRING', 'XY')`,
    );
    db.exec(
      `SELECT AddGeometryColumn('route', 'UTM', 32651, 'LINESTRING', 'XY')`,
    );
  } catch (error) {
    if (!String(error.message).includes("geometry column already exists")) {
      throw error;
    }
  }

  try {
    db.exec(`SELECT CreateSpatialIndex('route', 'WGS84')`);
    db.exec(`SELECT CreateSpatialIndex('route', 'UTM')`);
  } catch (error) {
    console.log("ℹ 空间索引状态:", error.message);
  }
};

/**
 * 连接并初始化数据库实例：
 * - 连接文件数据库
 * - 设置 PRAGMA
 * - 尝试加载 SpatiaLite
 * - 初始化空间元数据并创建表
 *
 * @returns {Database} 已连接的 better-sqlite3 实例
 */
const connectDatabase = () => {
  db = new Database(path.join(__dirname, "../mydatabase.db"), {
    verbose: console.log,
  });
  console.log("成功连接到 SQLite 数据库 (better-sqlite3)");

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  if (!loadSpatialiteExtension()) {
    console.warn("⚠ SpatiaLite 未加载成功，空间能力将不可用");
  }

  routeUtils.setDatabase(db);
  userUtils.setDatabase(db);

  try {
    db.exec("SELECT InitSpatialMetadata(1)");
  } catch (error) {
    console.log("✓ SpatiaLite 空间元数据已存在");
  }

  createTables();
  console.log("✓ 所有表检查/创建完毕");

  return db;
};

/**
 * 导出接口：
 * - `connectDatabase()`：初始化并返回数据库实例
 * - `getDatabase()`：返回当前的数据库实例或 undefined
 */
module.exports = {
  connectDatabase,
  getDatabase: () => db,
};
