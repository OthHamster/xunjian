/**
 * 路线相关的API路由
 *
 */

const express = require("express");
const checkRole = require("../utils/permission.js");
const routeUtils = require("../utils/route.js");
const riskUtils = require("../utils/risk.js");
const picManager = require("../utils/pic_manager.js");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const routeRouter = express.Router();

routeRouter.get(
  "/routes",
  checkRole(["admin", "viewer", "inspector", "repair"]),
  (req, res) => {
    try {
      const result = routeUtils.listRoutes();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("list routes error:", error);
      return res.status(500).json({ error: "获取路线列表失败" });
    }
  },
);

routeRouter.get(
  "/routes/:id",
  checkRole(["admin", "viewer", "inspector", "repair"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    try {
      const result = routeUtils.getRoute(routeId);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("get route error:", error);
      return res.status(500).json({ error: "获取路线失败" });
    }
  },
);

routeRouter.post("/routes", checkRole(["admin"]), (req, res) => {
  const { name, coordinates } = req.body || {};

  try {
    const result = routeUtils.addRoute(name, coordinates);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("add route error:", error);
    return res.status(500).json({ error: "添加路线失败" });
  }
});

routeRouter.put("/routes/:id", checkRole(["admin"]), (req, res) => {
  const routeId = Number.parseInt(req.params.id, 10);
  const { coordinates } = req.body || {};

  if (!Number.isInteger(routeId) || routeId <= 0) {
    return res.status(400).json({ error: "路线ID不合法" });
  }

  try {
    const result = routeUtils.updateRouteGeometry(routeId, coordinates);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json(result);
  } catch (error) {
    console.error("update route error:", error);
    return res.status(500).json({ error: "更新路线失败" });
  }
});

routeRouter.delete("/routes/:id", checkRole(["admin"]), (req, res) => {
  const routeId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(routeId) || routeId <= 0) {
    return res.status(400).json({ error: "路线ID不合法" });
  }

  try {
    const result = routeUtils.deleteRoute(routeId);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    return res.json(result);
  } catch (error) {
    console.error("delete route error:", error);
    return res.status(500).json({ error: "删除路线失败" });
  }
});

routeRouter.post(
  "/routes/:id/check-location",
  checkRole(["admin", "inspector", "repair"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);
    const { longitude, latitude, bufferDistance } = req.body || {};

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    const longitudeValue = Number(longitude);
    const latitudeValue = Number(latitude);

    if (!Number.isFinite(longitudeValue) || !Number.isFinite(latitudeValue)) {
      return res.status(400).json({ error: "经纬度不合法" });
    }

    try {
      const result = routeUtils.checkPointNearRoute(
        routeId,
        longitudeValue,
        latitudeValue,
        Number.isFinite(Number(bufferDistance)) ? Number(bufferDistance) : 50,
      );

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("check route location error:", error);
      return res.status(500).json({ error: "偏离监控失败" });
    }
  },
);

routeRouter.get(
  "/routes/:id/distance",
  checkRole(["admin", "viewer", "inspector", "repair"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);
    const longitude = Number(req.query.longitude);
    const latitude = Number(req.query.latitude);

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return res.status(400).json({ error: "经纬度不合法" });
    }

    try {
      const result = routeUtils.getPointToRouteDistance(
        routeId,
        longitude,
        latitude,
      );

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("get route distance error:", error);
      return res.status(500).json({ error: "获取路线距离失败" });
    }
  },
);

routeRouter.post(
  "/risks",
  checkRole(["admin", "inspector", "repair"]),
  upload.any(),
  (req, res) => {
    const { address, description, riskLevel, longitude, latitude, routeId } =
      req.body || {};

    const reporterUserId = req.session?.user?.id;

    // 提取上传的文件
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
        routeId,
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

// --- 图片上传 ---

routeRouter.post(
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
routeRouter.get(
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
routeRouter.delete(
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

module.exports = { routeRouter };
