const express = require("express");
const datarouter = express.Router();
const checkRole = require("../utils/permission.js");
const Database = require("better-sqlite3");
const session = require("express-session");
const path = require("path");
const { get } = require("../routers/auth.js");
const routeUtils = require("../utils/route.js");
const {
  createUser,
  deleteUserById,
  listUsers,
  updateUserById,
} = require("../utils/user.js");

let db;

const connectDatabase = () => {
  try {
    db = new Database("./mydatabase.db", { verbose: console.log });
    console.log("成功连接到 SQLite 数据库 (better-sqlite3)");

    // 加载 SpatiaLite 扩展
    try {
      const spatialite = require("spatialite");
      const spatialiteExtensionPath = path.join(
        __dirname,
        "../assets/mod_spatialite.dll",
      );
      db.loadExtension(spatialiteExtensionPath);
      console.log("✓ SpatiaLite 扩展加载成功");
    } catch (e) {
      console.warn("⚠ SpatiaLite 扩展加载失败，尝试加载备用路径...", e.message);
      try {
        const spatialitePath = path.join(
          __dirname,
          "../node_modules/spatialite/lib",
        );
        db.loadExtension("mod_spatialite");
      } catch (e2) {
        console.error("✗ 无法加载 SpatiaLite，请确保已安装 spatialite 包");
      }
    }

    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    routeUtils.setDatabase(db);

    // 初始化 SpatiaLite 空间元数据
    try {
      db.exec("SELECT InitSpatialMetadata(1)");
      console.log("✓ SpatiaLite 空间元数据初始化完成");
    } catch (e) {
      console.log("✓ SpatiaLite 空间元数据已存在");
    }

    const createTables = [
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

    createTables.forEach((inits) => {
      db.exec(inits);
    });
    console.log("✓ 所有表检查/创建完毕");

    // 为 route 表添加 WGS84 和 UTM 几何列
    try {
      db.exec(
        `SELECT AddGeometryColumn('route', 'WGS84', 4326, 'LINESTRING', 'XY')`,
      );
      db.exec(
        `SELECT AddGeometryColumn('route', 'UTM', 32651, 'LINESTRING', 'XY')`,
      );
      console.log("✓ WGS84/UTM 几何列添加完成");
    } catch (e) {
      if (e.message.includes("geometry column already exists")) {
        console.log("✓ WGS84/UTM 几何列已存在");
      } else {
        console.warn("⚠ 添加几何列时出现问题:", e.message);
      }
    }

    // 为几何列创建空间索引
    try {
      db.exec(`SELECT CreateSpatialIndex('route', 'WGS84')`);
      db.exec(`SELECT CreateSpatialIndex('route', 'UTM')`);
      console.log("✓ 空间索引创建完成");
    } catch (e) {
      console.log("ℹ 空间索引状态:", e.message);
    }
  } catch (err) {
    console.error("数据库初始化失败:", err.message);
  }
};
module.exports = { connectDatabase, datarouter };
