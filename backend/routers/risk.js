/**
 * 风险工单相关API路由
 */

const express = require("express");
const checkRole = require("../utils/permission.js");
const riskUtils = require("../utils/risk.js");
const picManager = require("../utils/pic_manager.js");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const riskRouter = express.Router();

// 获取风险工单列表
riskRouter.get(
  "/risks",
  checkRole(["admin", "viewer", "inspector", "repair"]),
  (req, res) => {
    try {
      const result = riskUtils.listRisks({
        status: req.query.status,
        limit: Number(req.query.limit) || undefined,
        offset: Number(req.query.offset) || undefined,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("list risks error:", error);
      return res.status(500).json({ error: "获取风险列表失败" });
    }
  },
);

// 获取单个风险工单详情
riskRouter.get(
  "/risks/:id",
  checkRole(["admin", "viewer", "inspector", "repair"]),
  (req, res) => {
    const riskId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(riskId) || riskId <= 0) {
      return res.status(400).json({ error: "风险ID不合法" });
    }

    try {
      const result = riskUtils.getRiskById(riskId);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("get risk error:", error);
      return res.status(500).json({ error: "获取风险详情失败" });
    }
  },
);

// 更新风险工单（追加工单记录/修改状态）
riskRouter.put(
  "/risks/:id",
  checkRole(["admin", "inspector", "repair"]),
  upload.any(),
  (req, res) => {
    const riskId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(riskId) || riskId <= 0) {
      return res.status(400).json({ error: "风险ID不合法" });
    }

    const { text, status } = req.body || {};
    const userId = req.session?.user?.id;

    // 提取上传的文件并保存
    const files = (req.files || []).map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
    }));

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

    try {
      // 如果有文本内容，追加工单记录
      if (text && text.trim()) {
        const logResult = riskUtils.appendRiskLog(riskId, {
          text: text.trim(),
          photoUrl: savedUrls.length > 0 ? savedUrls.join(",") : "",
          userId,
        });

        if (!logResult.success) {
          return res.status(500).json({ error: logResult.error });
        }
      }

      // 返回更新后的风险详情
      const detail = riskUtils.getRiskById(riskId);
      if (!detail.success) {
        return res.status(404).json({ error: detail.error });
      }

      return res.json(detail);
    } catch (error) {
      console.error("update risk error:", error);
      return res.status(500).json({ error: "更新风险工单失败" });
    }
  },
);

// 提交风险工单
riskRouter.post(
  "/risks",
  checkRole(["admin", "inspector", "repair"]),
  upload.any(),
  (req, res) => {
    const { address, description, riskLevel, longitude, latitude } =
      req.body || {};

    const reporterUserId = req.session?.user?.id;

    const files = (req.files || []).map((f) => ({
      buffer: f.buffer,
      originalname: f.originalname,
    }));

    try {
      const result = riskUtils.submitRisk({
        reporterUserId,
        address,
        description,
        riskLevel,
        longitude,
        latitude,
        files,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error("submit risk error:", error);
      return res.status(500).json({ error: "提交风险工单失败" });
    }
  },
);

// 上传风险工单图片
riskRouter.post(
  "/risks/:id/photo",
  checkRole(["admin", "inspector", "repair"]),
  upload.single("image"),
  (req, res) => {
    const riskId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(riskId) || riskId <= 0) {
      return res.status(400).json({ error: "风险ID不合法" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "未上传图片" });
    }

    try {
      const result = picManager.saveImage(
        riskId,
        req.file.buffer,
        req.file.originalname,
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(201).json({
        success: true,
        riskId,
        filename: result.filename,
        url: `/${result.relativePath.replace(/\\/g, "/")}`,
      });
    } catch (error) {
      console.error("upload photo error:", error);
      return res.status(500).json({ error: "上传图片失败" });
    }
  },
);

// 获取风险工单图片列表
riskRouter.get(
  "/risks/:id/photo",
  checkRole(["admin", "viewer", "inspector", "repair"]),
  (req, res) => {
    const riskId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(riskId) || riskId <= 0) {
      return res.status(400).json({ error: "风险ID不合法" });
    }

    try {
      const result = picManager.listImages(riskId);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      const images = result.images.map((f) => ({
        filename: f,
        url: `/photo/${riskId}/${f}`,
      }));

      return res.json({ success: true, images });
    } catch (error) {
      console.error("list photos error:", error);
      return res.status(500).json({ error: "获取图片列表失败" });
    }
  },
);

// 删除风险工单图片
riskRouter.delete(
  "/risks/:id/photo/:filename",
  checkRole(["admin"]),
  (req, res) => {
    const riskId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(riskId) || riskId <= 0) {
      return res.status(400).json({ error: "风险ID不合法" });
    }

    try {
      const result = picManager.deleteImage(riskId, req.params.filename);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("delete photo error:", error);
      return res.status(500).json({ error: "删除图片失败" });
    }
  },
);

module.exports = { riskRouter };
