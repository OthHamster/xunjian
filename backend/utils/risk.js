let db;

const path = require("path");
const picManager = require("./pic_manager.js");
const {
  readJsonSerialized,
  writeJsonSerialized,
} = require("./json_manager.js");

// 工单记录存储目录：pkg 模式下在 exe 同级，开发模式下在 backend/risk
const runtimeBaseDir = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");
const RISK_LOG_DIR = path.join(runtimeBaseDir, "risk");

/**
 * 注入数据库实例
 * @param {Database} dbInstance
 */
const setDatabase = (dbInstance) => {
  db = dbInstance;
};

const assertDatabase = () => {
  if (!db) {
    throw new Error("数据库未初始化");
  }
};

const ALLOWED_RISK_LEVELS = ["low", "medium", "high"];

/**
 * 提交风险点
 * @param {Object} payload
 * @param {number} payload.reporterUserId
 * @param {string} [payload.address]
 * @param {string} payload.description
 * @param {string} payload.riskLevel
 * @param {number} payload.longitude
 * @param {number} payload.latitude
 * @param {Array<{buffer: Buffer, originalname: string}>} [payload.files] - 图片文件数组
 * @returns {Object}
 */
const submitRisk = (payload) => {
  try {
    assertDatabase();

    const reporterUserId = Number.parseInt(payload?.reporterUserId, 10);
    const address = String(payload?.address || "").trim();
    const description = String(payload?.description || "").trim();
    const riskLevel = String(payload?.riskLevel || "").trim();
    const longitude = Number(payload?.longitude);
    const latitude = Number(payload?.latitude);
    const files = Array.isArray(payload?.files) ? payload.files : [];

    if (!Number.isInteger(reporterUserId) || reporterUserId <= 0) {
      throw new Error("上报用户ID不合法");
    }

    if (!description) {
      throw new Error("风险描述不能为空");
    }

    if (!ALLOWED_RISK_LEVELS.includes(riskLevel)) {
      throw new Error("风险等级必须为 low、medium 或 high");
    }

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error("经纬度不合法");
    }

    const insertStmt = db.prepare(`
			INSERT INTO risks (
				ReporterUserID,
				Address,
				Longitude,
				Latitude,
				PhotoURL,
				Description,
				RiskLevel,
				Status,
				RequestClose
			) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 0)
		`);

    const result = insertStmt.run(
      reporterUserId,
      address || null,
      longitude,
      latitude,
      "", // PhotoURL 暂留空，等文件保存后更新
      description,
      riskLevel,
    );

    const riskId = result.lastInsertRowid;

    // 保存上传的图片文件到 photo/{riskId}/ 目录
    const savedUrls = [];
    for (const file of files) {
      if (file && Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
        const saveResult = picManager.saveImage(
          riskId,
          file.buffer,
          file.originalname || "image.jpg",
        );
        if (saveResult.success) {
          savedUrls.push(saveResult.relativePath.replace(/\\/g, "/"));
        }
      }
    }

    // 更新 PhotoURL 字段（多条用逗号分隔）
    const photoUrl = savedUrls.length > 0 ? savedUrls.join(",") : null;
    if (photoUrl) {
      db.prepare("UPDATE risks SET PhotoURL = ? WHERE RiskID = ?").run(
        photoUrl,
        riskId,
      );
    }

    // 创建对应的工单记录文件
    createRiskLog(riskId, {
      text: description,
      photoUrl: photoUrl || "",
      userId: reporterUserId,
    });

    return {
      success: true,
      riskId,
      reporterUserId,
      address: address || null,
      description,
      riskLevel,
      longitude,
      latitude,
      photoUrl,
      status: "open",
      requestClose: 0,
    };
  } catch (error) {
    console.error("提交风险点失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 获取风险工单列表
 * @param {Object} [filters]
 * @param {string} [filters.status] - 按状态筛选：open / resolved
 * @param {number} [filters.limit] - 返回条数，默认 50
 * @param {number} [filters.offset] - 偏移量，默认 0
 * @returns {{ success: boolean, risks?: Array, error?: string }}
 */
const listRisks = (filters = {}) => {
  try {
    assertDatabase();

    const statusFilter = ["open", "resolved"].includes(filters?.status)
      ? filters.status
      : null;
    const limit = Number.isFinite(Number(filters?.limit))
      ? Math.max(1, Math.min(Number(filters.limit), 200))
      : 50;
    const offset = Number.isFinite(Number(filters?.offset))
      ? Math.max(0, Number(filters.offset))
      : 0;

    let sql = `
      SELECT
        RiskID,
        ReporterUserID,
        Address,
        Longitude,
        Latitude,
        Description,
        RiskLevel,
        Status,
        RequestClose,
        PhotoURL,
        ReportedAt,
        ResolvedAt,
        ResolvedByUserID,
        ResolveNote
      FROM risks
    `;
    const params = [];

    if (statusFilter) {
      sql += " WHERE Status = ?";
      params.push(statusFilter);
    }

    sql += " ORDER BY ReportedAt DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);

    // 收集 reporterUserId 并解析用户名
    const userIds = rows.map((r) => r.ReporterUserID).filter(Boolean);
    const nameMap = resolveUsernames(userIds);

    return {
      success: true,
      risks: rows.map((row) => ({
        riskId: row.RiskID,
        reporterUserId: row.ReporterUserID,
        reporterUserName: nameMap[row.ReporterUserID] || String(row.ReporterUserID),
        address: row.Address,
        longitude: row.Longitude,
        latitude: row.Latitude,
        description: row.Description,
        riskLevel: row.RiskLevel,
        status: row.Status,
        requestClose: row.RequestClose,
        photoUrl: row.PhotoURL,
        reportedAt: row.ReportedAt,
        resolvedAt: row.ResolvedAt,
        resolvedByUserId: row.ResolvedByUserID,
        resolveNote: row.ResolveNote,
      })),
    };
  } catch (error) {
    console.error("获取风险列表失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 获取工单记录文件路径
 * @param {number} riskId
 * @returns {string}
 */
const getLogPath = (riskId) => path.join(RISK_LOG_DIR, `${riskId}.json`);

/**
 * 创建风险工单记录文件（初始为空数组，可附带首条记录）
 * @param {number} riskId
 * @param {{ text?: string, photoUrl?: string, userId?: number }} [firstRecord]
 * @returns {{ success: boolean, error?: string }}
 */
const createRiskLog = (riskId, firstRecord) => {
  try {
    const records = [];

    if (firstRecord) {
      records.push({
        text: String(firstRecord.text || ""),
        photoUrl: String(firstRecord.photoUrl || ""),
        userId: Number.isFinite(Number(firstRecord.userId))
          ? Number(firstRecord.userId)
          : null,
        submittedAt: new Date().toISOString(),
      });
    }

    writeJsonSerialized(getLogPath(riskId), records);
    return { success: true };
  } catch (error) {
    console.error("创建工单记录失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 向风险工单追加一条记录
 * @param {number} riskId
 * @param {{ text: string, photoUrl?: string, userId: number }} record
 * @returns {{ success: boolean, error?: string }}
 */
const appendRiskLog = (riskId, record) => {
  try {
    const current = readJsonSerialized(getLogPath(riskId), []);
    if (!Array.isArray(current)) {
      throw new Error("工单记录格式异常");
    }

    current.push({
      text: String(record?.text || ""),
      photoUrl: String(record?.photoUrl || ""),
      userId: Number.isFinite(Number(record?.userId))
        ? Number(record.userId)
        : null,
      submittedAt: new Date().toISOString(),
    });

    writeJsonSerialized(getLogPath(riskId), current);
    return { success: true };
  } catch (error) {
    console.error("追加工单记录失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 批量解析用户ID → 用户名
 * @param {number[]} userIds
 * @returns {Record<number, string>}
 */
const resolveUsernames = (userIds) => {
  const ids = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) {
    return {};
  }

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT UserID, Name FROM users WHERE UserID IN (${placeholders})`)
    .all(...ids);

  const map = {};
  for (const row of rows) {
    map[row.UserID] = row.Name;
  }
  return map;
};

/**
 * 获取单个风险详情（含工单记录）
 * @param {number} riskId
 * @returns {{ success: boolean, risk?: Object, error?: string }}
 */
const getRiskById = (riskId) => {
  try {
    assertDatabase();

    const row = db
      .prepare(
        `SELECT
          RiskID,
          ReporterUserID,
          Address,
          Longitude,
          Latitude,
          Description,
          RiskLevel,
          Status,
          RequestClose,
          PhotoURL,
          ReportedAt,
          ResolvedAt,
          ResolvedByUserID,
          ResolveNote
        FROM risks WHERE RiskID = ?`,
      )
      .get(riskId);

    if (!row) {
      return { success: false, error: "风险工单不存在" };
    }

    // 读取工单记录
    const rawLogs = readJsonSerialized(getLogPath(riskId), []);
    const logs = Array.isArray(rawLogs) ? rawLogs : [];

    // 收集所有需要解析的用户ID
    const userIds = [row.ReporterUserID, row.ResolvedByUserID];
    for (const log of logs) {
      if (Number.isFinite(log.userId) && log.userId > 0) {
        userIds.push(log.userId);
      }
    }
    const nameMap = resolveUsernames(userIds);

    return {
      success: true,
      risk: {
        riskId: row.RiskID,
        reporterUserId: row.ReporterUserID,
        reporterUserName: nameMap[row.ReporterUserID] || String(row.ReporterUserID),
        address: row.Address,
        longitude: row.Longitude,
        latitude: row.Latitude,
        description: row.Description,
        riskLevel: row.RiskLevel,
        status: row.Status,
        requestClose: row.RequestClose,
        photoUrl: row.PhotoURL,
        reportedAt: row.ReportedAt,
        resolvedAt: row.ResolvedAt,
        resolvedByUserId: row.ResolvedByUserID,
        resolvedByUserName: nameMap[row.ResolvedByUserID] || null,
        resolveNote: row.ResolveNote,
        logs: logs.map((log) => ({
          ...log,
          username: nameMap[log.userId] || String(log.userId || ""),
        })),
      },
    };
  } catch (error) {
    console.error("获取风险详情失败:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  setDatabase,
  submitRisk,
  listRisks,
  getRiskById,
  createRiskLog,
  appendRiskLog,
};
