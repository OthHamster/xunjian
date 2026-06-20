let db;

const picManager = require("./pic_manager.js");

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
 * @param {number} [payload.routeId]
 * @param {Array<{buffer: Buffer, originalname: string}>} [payload.files] - 图片文件数组
 * @returns {Object}
 */
const submitRisk = (payload) => {
  try {
    assertDatabase();

    const reporterUserId = Number.parseInt(payload?.reporterUserId, 10);
    const routeId = Number.isInteger(payload?.routeId)
      ? payload.routeId
      : Number.parseInt(payload?.routeId, 10);
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
				RouteID,
				Address,
				Longitude,
				Latitude,
				PhotoURL,
				Description,
				RiskLevel,
				Status,
				RequestClose
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 0)
		`);

    const result = insertStmt.run(
      reporterUserId,
      Number.isInteger(routeId) && routeId > 0 ? routeId : null,
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

    return {
      success: true,
      riskId,
      reporterUserId,
      routeId: Number.isInteger(routeId) && routeId > 0 ? routeId : null,
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

module.exports = {
  setDatabase,
  submitRisk,
};
