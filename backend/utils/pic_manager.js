const fs = require("fs");
const path = require("path");

// 图片存储根目录：pkg 模式下在 exe 同级，开发模式下在 backend/photo
const runtimeBaseDir = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");
const PHOTO_ROOT = path.join(runtimeBaseDir, "photo");

/**
 * 确保目录存在
 */
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * 获取风险工单的图片目录路径
 * @param {number|string} riskId
 * @returns {string}
 */
const getRiskDir = (riskId) => path.join(PHOTO_ROOT, String(riskId));

/**
 * 生成唯一文件名：时间戳_原始文件名
 * @param {string} originalName
 * @returns {string}
 */
const makeFilename = (originalName) => {
  const ext = path.extname(originalName) || "";
  const base = path
    .basename(originalName, ext)
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5.-]/g, "");
  const ts = Date.now();
  return `${ts}_${base}${ext}`;
};

/**
 * 保存一张图片到 photo/{riskId}/ 目录
 * @param {number|string} riskId
 * @param {Buffer} fileBuffer - 图片二进制数据
 * @param {string} originalName - 原始文件名（用于保留扩展名）
 * @returns {{ success: boolean, filePath?: string, filename?: string, error?: string }}
 */
const saveImage = (riskId, fileBuffer, originalName) => {
  try {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error("图片数据无效");
    }

    const riskDir = getRiskDir(riskId);
    ensureDir(riskDir);

    const filename = makeFilename(originalName || "image.jpg");
    const filePath = path.join(riskDir, filename);

    fs.writeFileSync(filePath, fileBuffer);

    return {
      success: true,
      filename,
      filePath,
      relativePath: `/photo/${String(riskId)}/${filename}`,
    };
  } catch (error) {
    console.error("保存图片失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 列出某个风险工单下的所有图片文件名
 * @param {number|string} riskId
 * @returns {{ success: boolean, images?: string[], error?: string }}
 */
const listImages = (riskId) => {
  try {
    const riskDir = getRiskDir(riskId);
    if (!fs.existsSync(riskDir)) {
      return { success: true, images: [] };
    }

    const files = fs.readdirSync(riskDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext);
    });

    return { success: true, images: files };
  } catch (error) {
    console.error("列出图片失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 删除风险工单下的某张图片
 * @param {number|string} riskId
 * @param {string} filename
 * @returns {{ success: boolean, error?: string }}
 */
const deleteImage = (riskId, filename) => {
  try {
    const filePath = path.join(getRiskDir(riskId), filename);
    if (!fs.existsSync(filePath)) {
      throw new Error("图片不存在");
    }
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error("删除图片失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 删除整个风险工单的图片目录
 * @param {number|string} riskId
 * @returns {{ success: boolean, error?: string }}
 */
const deleteRiskImages = (riskId) => {
  try {
    const riskDir = getRiskDir(riskId);
    if (fs.existsSync(riskDir)) {
      fs.rmSync(riskDir, { recursive: true, force: true });
    }
    return { success: true };
  } catch (error) {
    console.error("删除风险图片目录失败:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  saveImage,
  listImages,
  deleteImage,
  deleteRiskImages,
  getRiskDir,
  PHOTO_ROOT,
};
